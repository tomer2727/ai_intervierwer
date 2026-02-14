import * as readline from 'readline';
import { JuniorAgent } from './agent/junior';
import { SeniorAgent } from './agent/senior';
import { AgentContext } from './agent/types';
import dotenv from 'dotenv';
import { createActor } from 'xstate';
import { interviewMachine } from './fsm/machine';

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is not set in .env or environment variables.");
  process.exit(1);
}

const junior = new JuniorAgent();
const senior = new SeniorAgent();
const fsmActor = createActor(interviewMachine);
fsmActor.start();

const context: AgentContext = {
  conversationHistory: [],
  seniorInstructions: [],
  currentState: 'WELCOME' // Default initialization
};

// Sync context with FSM state
fsmActor.subscribe((snapshot) => {
    const stateVal = typeof snapshot.value === 'string' ? snapshot.value : JSON.stringify(snapshot.value);
    context.currentState = stateVal;
    console.log(`\n[System] State Changed to: ${stateVal}`.toUpperCase());
});

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("--- AI Interviewer Simulation (Type 'exit' to quit) ---");

function ask() {
  rl.question('> Candidate: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
        fsmActor.stop();
        rl.close();
        return;
    }

    // 1. Notify FSM of user input (logic only, doesn't change state usually)
    fsmActor.send({ type: 'USER_MESSAGE', content: input });

    // 2. Junior processes input
    try {
      const juniorResponse = await junior.process(input, context);
      console.log(`\n Junior: ${juniorResponse.content}`);

      // Update history
      context.conversationHistory.push({ role: 'user', content: input });
      context.conversationHistory.push({ role: 'assistant', content: juniorResponse.content });

      // 3. Senior analyzes
      console.log(`\n... Senior Agent Analyzing ...`);
      const analysis = await senior.analyze(context);
      if (analysis.feedback) {
          console.log(`[Senior Feedback]: ${analysis.feedback}`);
      }
      
      if (analysis.instruction) {
          console.log(`[Senior Instruction]: ${analysis.instruction}`);
          context.seniorInstructions.push(analysis.instruction);
      }

      // 4. Trigger FSM transition if Senior says so
      if (analysis.suggestedState === 'NEXT_STAGE') {
          console.log("[System] Senior triggered NEXT_STAGE...");
          fsmActor.send({ type: 'SENIOR_SIGNAL', instruction: analysis.instruction || "", transition: 'NEXT_STAGE' });
          // Note: The state change will update context.currentState via the subscription
      }
    } catch (error) {
      console.error("Error in loop:", error);
    }
    
    ask();
  });
}

// Initial Greeting
console.log("\nInitializing interview...");
(async () => {
  try {
    const introContext = { ...context, conversationHistory: [] }; 
    const intro = await junior.process("Start the interview.", introContext); 
    console.log(`\n Junior: ${intro.content}`);
    context.conversationHistory.push({ role: 'assistant', content: intro.content });
    ask();
  } catch (err) {
      console.error("Failed to start:", err);
  }
})();
