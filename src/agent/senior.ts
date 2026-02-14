import { OpenAI } from 'openai';
import { AgentContext, SeniorAnalysis } from './types';

const openai = new OpenAI(); // Would likely use a stronger model (GPT-4) in production

const SENIOR_SYSTEM_PROMPT = `You are an expert Senior Engineer and Hiring Manager.
You are silently observing an interview conducted by a Junior Recruiter.
Your job is to:
1. Analyze the candidate's answers for technical depth and accuracy.
2. Provide specific instructions to the Junior Recruiter on what to ask next.
3. Decide if we have enough signal to move to the next interview stage.

Output JSON format:
{
  "feedback": "Internal critique of the candidate's answer",
  "instruction": "What the Junior should say/ask next",
  "suggestedState": "NEXT_STAGE" | "CONTINUE" | "TERMINATE"
}
`;

export class SeniorAgent {
  async analyze(context: AgentContext): Promise<SeniorAnalysis> {
    const messages: any[] = [
      { role: 'system', content: SENIOR_SYSTEM_PROMPT },
      { role: 'user', content: `Current Conversation History:\n${JSON.stringify(context.conversationHistory)}` }
    ];

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // Higher intelligence model
      messages: messages,
      response_format: { type: "json_object" },
      temperature: 0.2, // Be objective
    });

    try {
      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No content from Senior Agent");
      return JSON.parse(content) as SeniorAnalysis;
    } catch (e) {
      console.error("Failed to parse Senior Agent response", e);
      return {
        feedback: "Error parsing analysis",
        instruction: null,
        suggestedState: "CONTINUE"
      };
    }
  }
}
