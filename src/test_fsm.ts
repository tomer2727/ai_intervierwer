import { createActor } from 'xstate';
import { interviewMachine} from './fsm/machine';

const actor = createActor(interviewMachine);

actor.subscribe((snapshot) => {
  console.log(`[State Change] Value: ${snapshot.value}`);
  // console.log(`[Context] Transcript Size: ${snapshot.context.transcript.length}`);
});

actor.start();

console.log("--- Testing State Machine Transitions ---");

// 1. Welcome
console.log("Sending User Message...");
actor.send({ type: 'USER_MESSAGE', content: "Hi, I'm Tomer." });

console.log("Triggering Next Stage (to Screening)...");
actor.send({ type: 'NEXT' }); // Or simulate SENIOR_SIGNAL

// 2. Screening
console.log("Sending User Message in Screening...");
actor.send({ type: 'USER_MESSAGE', content: "I am a software engineer." });

console.log("Triggering Next Stage (to Technical)...");
actor.send({ type: 'SENIOR_SIGNAL', instruction: "Move on", transition: "NEXT_STAGE" });

// ...
