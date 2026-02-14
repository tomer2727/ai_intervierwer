export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AgentContext {
  currentState: string;
  conversationHistory: { role: string; text: string }[];
  seniorInstructions: string[];
  targetStageTemplate?: string;
  fullStageMap?: Record<string, string>;
}

export interface JuniorResponse {
  content: string; // What the user hears
  metadata?: any;
}

export interface SeniorAnalysis {
  feedback: string; // Internal feedback
  instruction: string | null; // Instruction to Junior ("Ask about X")
  suggestedState?: string; // If state transition is needed
}
