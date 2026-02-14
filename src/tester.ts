import { SeniorAgent } from './agent/senior';
import { STAGE_TEMPLATES } from './agent/prompts';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

const API_KEY = process.env.OPENAI_API_KEY;

if (!API_KEY) {
  console.error("Please set OPENAI_API_KEY in .env");
  process.exit(1);
}

const senior = new SeniorAgent(API_KEY);

async function runSimulation() {
  const senior = new SeniorAgent(API_KEY!);
  
  let currentState = 'WELCOME';
  let history: any[] = [];
  
  const turns = [
    { role: 'user', text: "Yeah, my name is Tomer, and I'm a computer scientist degree graduate. I started working three months ago at Harness as a back-end engineer, and I feel like the position of FBE is going to be more suitable for me." },
    { role: 'user', text: "All right." }
  ];

  for (let i = 0; i < turns.length; i++) {
    const userTurn = turns[i];
    history.push(userTurn);
    
    console.log(`\n=== TURN ${i + 1} (State: ${currentState}) ===`);
    console.log(`User Said: ${userTurn.text}`);

    const result = await senior.analyze({
      currentState,
      conversationHistory: history,
      seniorInstructions: [],
      targetStageTemplate: STAGE_TEMPLATES[currentState] || STAGE_TEMPLATES.WELCOME,
      fullStageMap: STAGE_TEMPLATES
    });

    console.log("\nSenior Analysis Result:");
    console.log(`- Suggested State: ${result.suggestedState}`);
    console.log(`- Internal Feedback: ${result.feedback}`);
    console.log(`- Instruction: ${result.instruction}`);

    if (result.suggestedState === 'NEXT_STAGE') {
        // Find next state
        const states = Object.keys(STAGE_TEMPLATES);
        const currentIndex = states.indexOf(currentState);
        currentState = states[currentIndex + 1] || currentState;
        console.log(`>>> TRANSITIONED TO: ${currentState}`);
    } else if (result.suggestedState && result.suggestedState !== 'CONTINUE') {
        currentState = result.suggestedState;
        console.log(`>>> MOVED TO STATE: ${currentState}`);
    }

    // Simulate Assistant Response
    history.push({ role: 'assistant', text: `[MOCK RESPONSE BASED ON: ${result.instruction?.substring(0, 50)}]` });
  }
}

runSimulation().catch(console.error);
