import * as readline from 'readline';
import { JuniorAgent } from './agent/junior';
import { SeniorAgent } from './agent/senior';
import { AgentContext } from './agent/types';
import dotenv from 'dotenv';

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  console.error("ERROR: OPENAI_API_KEY is not set in .env or environment variables.");
  process.exit(1);
}

const junior = new JuniorAgent();
const senior = new SeniorAgent();

const context: AgentContext = {
  conversationHistory: [],
  seniorInstructions: []
};

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log("--- AI Interviewer Simulation (Type 'exit' to quit) ---");

function ask() {
  rl.question('> Candidate: ', async (input) => {
    if (input.toLowerCase() === 'exit') {
      rl.close();
      return;
    }

    // 1. Junior processes input
    try {
      const juniorResponse = await junior.process(input, context);
      console.log(`\n Junior: ${juniorResponse.content}`);

      // Update history
      context.conversationHistory.push({ role: 'user', content: input });
      context.conversationHistory.push({ role: 'assistant', content: juniorResponse.content });

      // 2. Senior analyzes
      console.log(`\n... Senior Agent Analyzing ...`);
      const analysis = await senior.analyze(context);
      if (analysis.feedback) {
          console.log(`[Senior Feedback]: ${analysis.feedback}`);
      }
      
      if (analysis.instruction) {
          console.log(`[Senior Instruction]: ${analysis.instruction}`);
          context.seniorInstructions.push(analysis.instruction);
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
    const introContext = { ...context, conversationHistory: [] }; // Empty history for first hello
    // We can just manually trigger the first greeting or ask the junior to introduce themselves
    // Let's ask the junior to start.
    const intro = await junior.process("Start the interview.", introContext); 
    console.log(`\n Junior: ${intro.content}`);
    context.conversationHistory.push({ role: 'assistant', content: intro.content });
    ask();
  } catch (err) {
      console.error("Failed to start:", err);
  }
})();
