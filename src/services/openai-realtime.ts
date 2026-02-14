import WebSocket from 'ws';

export class OpenAIRealtimeService {
  private ws: WebSocket | null = null;
  private apiKey: string;
  private onAudioCallback: ((audio: string) => void) | null = null;
  private onTranscriptCallback: ((role: 'user' | 'assistant', text: string) => void) | null = null;
  private onToolCallCallback: ((toolCall: any) => Promise<string>) | null = null;
  private onSpeechStoppedCallback: (() => void) | null = null;
  private sessionInitialized = false;
  private currentInstructions: string = 'You are an AI Interviewer. Be concise.';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  onAudio(callback: (audio: string) => void) {
    this.onAudioCallback = callback;
  }

  onTranscript(callback: (role: 'user' | 'assistant', text: string) => void) {
    this.onTranscriptCallback = callback;
  }

  onToolCall(callback: (toolCall: any) => Promise<string>) {
    this.onToolCallCallback = callback;
  }

  onSpeechStopped(callback: () => void) {
    this.onSpeechStoppedCallback = callback;
  }

  updateInstructions(newInstructions: string) {
    this.currentInstructions = newInstructions;
    if (this.sessionInitialized) {
      this.initializeSession();
    }
  }

  getCurrentInstructions(): string {
      return this.currentInstructions;
  }

  cancelResponse() {
    console.log('[OpenAI] Canceling response...');
    this.send({ type: 'response.cancel' });
  }

  createResponse() {
    console.log('[OpenAI] Creating manual response...');
    this.send({ type: 'response.create' });
  }

  connect() {
    const url = 'wss://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview';
    this.ws = new WebSocket(url, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'OpenAI-Beta': 'realtime=v1',
      },
    });

    this.ws.on('open', () => {
      console.log('Connected to OpenAI Realtime API');
      this.initializeSession();
    });

    this.ws.on('message', (data) => {
      try {
        const event = JSON.parse(data.toString());
        this.handleEvent(event);
      } catch (e) {
        console.error('Error parsing OpenAI event', e);
      }
    });

    this.ws.on('error', (e) => console.error('OpenAI WebSocket error', e));
  }

  private initializeSession() {
    const sessionUpdate = {
      type: 'session.update',
      session: {
        voice: 'alloy',
        instructions: this.currentInstructions,
        input_audio_format: 'g711_ulaw',
        output_audio_format: 'g711_ulaw',
        modalities: ['text', 'audio'],
        turn_detection: {
          type: 'server_vad',
          threshold: 0.7,
          prefix_padding_ms: 300,
          silence_duration_ms: 1500
        },
        input_audio_transcription: { model: 'whisper-1' },
        max_response_output_tokens: 300,
        tools: [
          {
            type: 'function',
            name: 'consult_senior',
            description: 'Consult the Senior Architect for technical clarification or advice on how to proceed.',
            parameters: {
              type: 'object',
              properties: {
                question: { type: 'string', description: 'The specific question or concern for the Senior Architect.' }
              },
              required: ['question']
            }
          },
          {
            type: 'function',
            name: 'request_next_stage',
            description: 'Call this when you have fulfilled all goals for the current interview stage and are ready to move to the next topic.',
            parameters: {
              type: 'object',
              properties: {
                reason: { type: 'string', description: 'Briefly explain why you are ready to move on (e.g., "Intro complete", "Technical explanation sufficient").' }
              },
              required: ['reason']
            }
          }
        ],
        tool_choice: 'auto'
      }
    };
    console.log('Updating OpenAI session configuration...');
    this.send(sessionUpdate);
  }

  sendAudio(base64Audio: string) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.send({
      type: 'input_audio_buffer.append',
      audio: base64Audio
    });
  }

  private handleEvent(event: any) {
    console.log(`[OpenAI Event] ${event.type}`);

    if (event.type === 'session.created') {
      console.log('Session created. Initializing...');
      this.initializeSession();
    }

    if (event.type === 'session.updated' && !this.sessionInitialized) {
      this.sessionInitialized = true;
      console.log('Session updated. Sending initial greeting...');

      this.send({
        type: 'conversation.item.create',
        item: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: 'Hello! I am ready for the interview. Please introduce yourself and let\'s begin.'
            }
          ]
        }
      });

      this.send({ type: 'response.create' });
    }

    if (event.type === 'response.audio.delta' && event.delta) {
      if (this.onAudioCallback) {
        this.onAudioCallback(event.delta);
      }
    }

    if (event.type === 'input_audio_buffer.speech_started') {
      console.log('[OpenAI] 👄 Speech started (VAD)');
    }

    if (event.type === 'input_audio_buffer.speech_stopped') {
      console.log('[OpenAI] 🤐 Speech stopped (VAD)');
      if (this.onSpeechStoppedCallback) {
        this.onSpeechStoppedCallback();
      }
    }

    if (event.type === 'response.audio_transcript.done') {
      console.log(`[OpenAI] Assistant says: ${event.transcript}`);
      if (this.onTranscriptCallback) {
        this.onTranscriptCallback('assistant', event.transcript);
      }
    }

    if (event.type === 'response.cancel') {
        console.log('[OpenAI] 🚫 Response canceled!');
    }

    if (event.type === 'response.done') {
      console.log('[AI Response Done]');
      const output = event.response?.output || [];
      for (const item of output) {
        if (item.type === 'function_call') {
          this.handleToolCall(item);
        }
      }
      if (event.response?.status_details?.error) {
        console.error('[AI Error Details]:', event.response.status_details.error);
      }
    }

    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      console.log(`[User Said]: ${event.transcript}`);
      if (this.onTranscriptCallback) {
        this.onTranscriptCallback('user', event.transcript);
      }
    }

    if (event.type === 'error') {
      console.error('[OpenAI Error]:', event.error);
    }
  }

  private async handleToolCall(toolCall: any) {
    console.log(`[Tool Call] ${toolCall.name}: ${toolCall.arguments}`);
    if (this.onToolCallCallback) {
      try {
        const result = await this.onToolCallCallback({
          name: toolCall.name,
          arguments: JSON.parse(toolCall.arguments)
        });
        
        this.send({
          type: 'conversation.item.create',
          item: {
            type: 'function_call_output',
            call_id: toolCall.call_id,
            output: result
          }
        });
        this.send({ type: 'response.create' });
      } catch (e) {
        console.error('Error handling tool call', e);
      }
    }
  }

  private send(event: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(event));
    }
  }
}
