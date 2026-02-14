import { OpenAI } from 'openai';
import { AgentContext, JuniorResponse } from './types';

const openai = new OpenAI();

const JUNIOR_SYSTEM_PROMPT = `You are a polite, professional, but junior recruiter assistant.
Your goal is to conduct an interview based on instructions from your supervisor (The Senior Agent).
You are the interface to the candidate. Be welcoming, keep things moving, but don't dig too deep yourself unless instructed.
Always check your 'instructions' from the Senior Agent before responding.
`;

export class JuniorAgent {
  async process(input: string, context: AgentContext): Promise<JuniorResponse> {
    // Construct messages with system prompt + history + current input
    const messages: any[] = [
      { role: 'system', content: JUNIOR_SYSTEM_PROMPT },
      ...context.conversationHistory,
      { role: 'user', content: input }
    ];

    // If there are specific instructions from Senior, inject them as a system reminder
    if (context.seniorInstructions.length > 0) {
      const latestInstruction = context.seniorInstructions[context.seniorInstructions.length - 1];
      messages.push({ 
        role: 'system', 
        content: `[HIDDEN INSTRUCTION FROM SUPERVISOR]: ${latestInstruction}` 
      });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo', // Low latency model
      messages: messages,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content || "I apologize, I didn't catch that.";

    return { content };
  }
}
