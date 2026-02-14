import { setup, assign } from 'xstate';

export interface InterviewContext {
  candidateName?: string;
  transcript: string[];
  seniorInstructions: string[];
}

export type InterviewEvent =
  | { type: 'USER_MESSAGE'; content: string }
  | { type: 'SENIOR_SIGNAL'; instruction: string; transition?: string }
  | { type: 'NEXT' }
  | { type: 'TERMINATE' };

export const interviewMachine = setup({
  types: {
    context: {} as InterviewContext,
    events: {} as InterviewEvent,
  },
  actions: {
    logTransition: ({ context, event }) => {
      console.log(`[FSM] Transitioning due to event: ${event.type}`);
    },
    appendTranscript: assign({
      transcript: ({ context, event }) => {
        if (event.type === 'USER_MESSAGE') {
          return [...context.transcript, `User: ${event.content}`];
        }
        return context.transcript;
      }
    }),
    appendSeniorInstruction: assign({
      seniorInstructions: ({ context, event }) => {
        if (event.type === 'SENIOR_SIGNAL' && event.instruction) {
          return [...context.seniorInstructions, event.instruction];
        }
        return context.seniorInstructions;
      }
    })
  },
}).createMachine({
  id: 'interview',
  initial: 'WELCOME',
  context: {
    transcript: [],
    seniorInstructions: [],
  },
  states: {
    WELCOME: {
      on: {
        USER_MESSAGE: {
          actions: 'appendTranscript',
          // Logic: Wait for name or "ready" signal. For now, simple transition on command or Senior signal.
        },
        NEXT: 'SCREENING',
        SENIOR_SIGNAL: [
            { 
              guard: ({ event }) => event.transition === 'NEXT_STAGE', 
              target: 'SCREENING',
              actions: 'appendSeniorInstruction' 
            },
            {
              actions: 'appendSeniorInstruction'
            }
        ]
      }
    },
    SCREENING: {
      on: {
        USER_MESSAGE: { actions: 'appendTranscript' },
        NEXT: 'TECHNICAL_Q1',
        SENIOR_SIGNAL: [
            { guard: ({ event }) => event.transition === 'NEXT_STAGE', target: 'TECHNICAL_Q1', actions: 'appendSeniorInstruction' },
            { actions: 'appendSeniorInstruction' }
        ]
      }
    },
    TECHNICAL_Q1: {
      on: {
        USER_MESSAGE: { actions: 'appendTranscript' },
        NEXT: 'DEEP_DIVE',
        SENIOR_SIGNAL: [
            { guard: ({ event }) => event.transition === 'NEXT_STAGE', target: 'DEEP_DIVE', actions: 'appendSeniorInstruction' },
            { actions: 'appendSeniorInstruction' }
        ]
      }
    },
    DEEP_DIVE: {
      on: {
        USER_MESSAGE: { actions: 'appendTranscript' },
        NEXT: 'JOB_PITCH',
        SENIOR_SIGNAL: [
            { guard: ({ event }) => event.transition === 'NEXT_STAGE', target: 'JOB_PITCH', actions: 'appendSeniorInstruction' },
            { actions: 'appendSeniorInstruction' }
        ]
      }
    },
    JOB_PITCH: {
      on: {
        USER_MESSAGE: { actions: 'appendTranscript' },
        NEXT: 'FEEDBACK',
        SENIOR_SIGNAL: [
            { guard: ({ event }) => event.transition === 'NEXT_STAGE', target: 'FEEDBACK', actions: 'appendSeniorInstruction' },
            { actions: 'appendSeniorInstruction' }
        ]
      }
    },
    FEEDBACK: {
      type: 'final',
      on: {
        USER_MESSAGE: { actions: 'appendTranscript' }
      }
    },
  }
});
