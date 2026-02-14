import { OpenAI } from 'openai';
import { AgentContext, SeniorAnalysis } from './types';

const SENIOR_SYSTEM_PROMPT = `
You are an expert Senior Engineering Manager and Hiring Architect.
You are the "Brain" behind an AI Interviewer called Wandy.

Your job is NOT just to analyze, but to CUSTOMIZE the Junior's system prompt.

TASKS:
1. TRANSITION CONSULTANT: You are called ONLY when Wandy (Junior) believes a stage is complete via the "request_next_stage" tool.
2. STAGE SUMMARIZATION: Analyze the transcript of the stage just completed. Create a concise summary (e.g., "The candidate explained their RAG architecture well, focusing on vector sync.").
3. DECISIVE TRANSITIONS: Always suggest the NEXT_STAGE in the sequence (check All Interview Stages map).
4. THE BRIDGING PROMPT: Your "instruction" output MUST be the full system prompt for the NEXT stage, but it MUST start with Wandy's "Bridge":
   - Acknowledge the summary of the previous stage.
   - Close the subject ("That's a solid explanation of X.").
   - Pivot to the next goal ("Now, I'd love to hear about...").
5. GOAL MASTERY: Ensure the instructions for the next stage are clear and prune any irrelevant old goals.

CONVERSATIONAL RHYTHM:
- Wandy should feel like she's in a conversation. If the user only says "All right", it means they are about to speak. Do not interrupt them with a new prompt.

OUTPUT FORMAT (JSON):
{
  "feedback": "Internal technical critique for the logs",
  "instruction": "The EXACT string that will become the Junior's System Prompt. Include all template text with placeholders replaced.",
  "suggestedState": "NEXT_STAGE" | "CONTINUE" | "TERMINATE"
}
`;

export class SeniorAgent {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async analyze(context: AgentContext): Promise<SeniorAnalysis> {
    const messages: any[] = [
      { role: 'system', content: SENIOR_SYSTEM_PROMPT },
      { 
        role: 'user', 
        content: `
          Current State: ${context.currentState}
          Target Stage Template: ${context.targetStageTemplate || 'N/A'}
          All Interview Stages:
          ${JSON.stringify(context.fullStageMap, null, 2)}
          
          Conversation History:
          ${JSON.stringify(context.conversationHistory)}
        ` 
      }
    ];

    const response = await this.openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      response_format: { type: 'json_object' }
    });

    return JSON.parse(response.choices[0].message.content || '{}');
  }
}
