import Fastify from 'fastify';
import WebSocket from '@fastify/websocket';
import formBody from '@fastify/formbody';
import cors from '@fastify/cors';
import dotenv from 'dotenv';
import { interviewMachine } from './fsm/machine';
import { createActor } from 'xstate';
import { generateStreamTwiML, makeCall } from './services/twilio';
import { OpenAIRealtimeService } from './services/openai-realtime';
import { SeniorAgent } from './agent/senior';
import { logStep } from './utils/logger';
import { getStageTemplate, STAGE_TEMPLATES } from './agent/prompts';

dotenv.config();

const fastify = Fastify({ logger: true });
fastify.register(WebSocket);
fastify.register(formBody);
fastify.register(cors, {
  origin: [
    "https://ai-interviewer-dashboard-production.up.railway.app",
    "https://aiintervierwer-production.up.railway.app",
    /https:\/\/.*\.up\.railway\.app$/,
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});

const seniorAgent = new SeniorAgent(process.env.OPENAI_API_KEY!);
const PORT = process.env.PORT;

console.log(`[Config] Detected PORT from environment: ${process.env.PORT}`);
console.log(`[Config] Using PORT: ${PORT}`);
console.log(`[Config] PUBLIC_URL: ${process.env.PUBLIC_URL}`);

const activeSessions = new Map<string, any>();

// Health check endpoint for Railway
fastify.get('/health', async (_request, reply) => {
  reply.code(200).send('ok');
});

// Root endpoint for simple status
fastify.get('/', async (request) => {
  console.log(`[Request] Root status received from ${request.ip}`);
  return { status: 'Voice Gateway Active' };
});

fastify.register(async (fastify) => {
  // 1. TwiML Endpoint - Twilio calls this when a call comes in
  fastify.all('/incoming-call', async (request, reply) => {
    // Determine the external hostname
    let host = request.headers.host || 'localhost:3000';
    
    // If PUBLIC_URL is set, extract the hostname from it
    if (process.env.PUBLIC_URL) {
      try {
        const publicUrl = new URL(process.env.PUBLIC_URL);
        host = publicUrl.host;
      } catch (e) {
        console.warn('[Config] Invalid PUBLIC_URL, falling back to header host');
      }
    }

    console.log(`[Twilio] Generating TwiML for host: ${host}`);
    const twiml = generateStreamTwiML(host);
    reply.type('text/xml').send(twiml);
  });

  // 1.5 Outbound Call Endpoint
  fastify.post('/make-call', async (request: any, reply) => {
    const { to } = request.body;
    const host = process.env.PUBLIC_URL || request.headers.host || 'localhost:3000';
    const protocol = process.env.PUBLIC_URL ? '' : (request.headers['x-forwarded-proto'] || 'http');
    
    // Ensure we don't double up on protocols if PUBLIC_URL already includes it
    const baseUrl = process.env.PUBLIC_URL ? process.env.PUBLIC_URL : `${protocol}://${host}`;
    const url = `${baseUrl.replace(/\/$/, '')}/incoming-call`;

    if (!to) {
        return reply.status(400).send({ error: 'Missing "to" phone number' });
    }

    if (!process.env.TWILIO_PHONE_NUMBER) {
        return reply.status(500).send({ error: 'TWILIO_PHONE_NUMBER not configured' });
    }

    try {
        await makeCall(to, process.env.TWILIO_PHONE_NUMBER, url);
        return reply.send({ success: true, message: 'Call initiated' });
    } catch (err) {
        request.log.error(err);
        return reply.status(500).send({ error: 'Failed to initiate call' });
    }
  });

  // 2. WebSocket Endpoint - Handles the audio stream
  fastify.get('/media-stream', { websocket: true }, (connection: any, req) => {
    console.log("Client connected to media-stream");

    const actor = createActor(interviewMachine);
    actor.start();

    const openaiService = new OpenAIRealtimeService(process.env.OPENAI_API_KEY || "");
    let streamSid: string | null = null;
    let transcript: any[] = [];
    let stateInstructions = "";

    // Sync XState with OpenAI Instructions
    let lastCritique = "";
    const updateAIInstructions = (customPrompt?: string) => {
      const state = actor.getSnapshot().value as string;
      const context = actor.getSnapshot().context;
      
      const promptToUse = customPrompt || getStageTemplate(state);
      openaiService.updateInstructions(promptToUse);
      
      broadcastToUI({
          event: 'state_update',
          state,
          instructions: promptToUse,
          critique: lastCritique,
          seniorInstructions: context.seniorInstructions,
          transcript
      });
    };

    actor.subscribe((snapshot) => {
        console.log(`[FSM] Current State: ${snapshot.value}`);
    });

    openaiService.onSpeechStopped(() => {
        // We no longer cancel every turn! Wandy is autonomous within stages.
        // openaiService.cancelResponse();
    });

    openaiService.onTranscript(async (role, text) => {
        transcript.push({ role, text });
        if (role === 'user') {
            console.log(`[Transcript] User: ${text}`);
            // Wandy handles this turn autonomously!
        }
    });

    openaiService.onToolCall(async (toolCall) => {
        const { name, arguments: args } = toolCall;
        console.log(`[Tool Handler] Executing: ${name}`, args);

        const state = actor.getSnapshot().value as string;
        const context = actor.getSnapshot().context;
        const template = getStageTemplate(state);

        if (name === 'request_next_stage') {
            console.log(`[Senior] Transitioning from ${state} because: ${args.reason}`);

            // 1. Senior Analysis for the NEXT stage
            const analysis = await seniorAgent.analyze({
                currentState: state,
                conversationHistory: transcript,
                seniorInstructions: context.seniorInstructions,
                targetStageTemplate: template,
                fullStageMap: STAGE_TEMPLATES
            });

            console.log("[Senior Analysis]", analysis);
            lastCritique = analysis.feedback;

            logStep({
                stage: state,
                userInput: `TOOL_CALL: request_next_stage (${args.reason})`,
                systemPrompt: openaiService.getCurrentInstructions(),
                analysis
            });

            // 2. State transition
            if (analysis.suggestedState === 'NEXT_STAGE' || (analysis.suggestedState && analysis.suggestedState !== 'CONTINUE')) {
                actor.send({ type: 'SENIOR_SIGNAL', instruction: analysis.feedback, transition: 'NEXT_STAGE' });
            }

            // 3. Update instructions
            if (analysis.instruction) {
                updateAIInstructions(analysis.instruction);
            } else {
                updateAIInstructions();
            }

            // Broadcast after transition
            const finalState = actor.getSnapshot().value as string;
            broadcastToUI({
                event: 'state_update',
                state: finalState,
                instructions: openaiService.getCurrentInstructions(),
                critique: analysis.feedback,
                seniorInstructions: actor.getSnapshot().context.seniorInstructions,
                transcript
            });

            // Trigger response with 1.2s "Thinking" rhythm
            setTimeout(() => {
                console.log("[OpenAI] Triggering manual response after tool pause.");
                openaiService.createResponse();
            }, 1200);

            return JSON.stringify({ status: 'success', message: 'Moving to the next stage.' });
        }

        if (name === 'consult_senior') {
            const analysis = await seniorAgent.analyze({
                currentState: state,
                conversationHistory: [...transcript, { role: 'user', text: `[CONSULT]: ${args.question}` }],
                seniorInstructions: context.seniorInstructions,
                targetStageTemplate: template
            });

            if (analysis.instruction) {
                updateAIInstructions(analysis.instruction);
            }

            return JSON.stringify({ guidance: analysis.feedback });
        }

        return JSON.stringify({ error: 'Unknown tool' });
    });

    openaiService.onAudio((audioDelta: string) => {
        if (streamSid) {
            connection.send(JSON.stringify({ event: 'media', streamSid, media: { payload: audioDelta } }));
        }
    });

    openaiService.connect();

    connection.on('message', (message: any) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.event === 'media') {
            openaiService.sendAudio(data.media.payload);
        } else if (data.event === 'start') {
            streamSid = data.start.streamSid;
            updateAIInstructions();
        }
      } catch (e) {
          console.error("Error parsing message", e);
      }
    });

    connection.on('close', () => {
        console.log("Client disconnected");
        actor.stop();
    });
  });

  // 3. UI WebSocket for live dashboard
  fastify.get('/ui-stream', { websocket: true }, (connection: any, req) => {
      activeSessions.set(req.id, connection);
      connection.on('close', () => activeSessions.delete(req.id));
  });
});

const broadcastToUI = (data: any) => {
    for (const [id, connection] of activeSessions) {
        connection.send(JSON.stringify(data));
    }
};

// Global error handlers to prevent silent crashes
process.on('uncaughtException', (err) => {
  console.error('[Fatal] Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[Fatal] Unhandled Rejection at:', promise, 'reason:', reason);
});

const start = async () => {
  try {
    
    const port = Number(process.env.PORT) || 8080;
    const host = '0.0.0.0';
    console.log(`[Startup] Attempting to listen on ${host}:${port}...`);
    
    const address = await fastify.listen({ port, host });
    console.log(`[Startup] Server is PERSISTENT and listening at ${address}`);
    
    // Keep-alive log every 30 seconds to monitor stability in Railway logs
    setInterval(() => {
        console.log(`[KeepAlive] Server heartbeat - ${new Date().toISOString()}`);
    }, 30000);

  } catch (err) {
    console.error(`[Startup] Failed to start server:`, err);
    process.exit(1);
  }
};

start();
