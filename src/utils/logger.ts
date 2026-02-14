import fs from 'fs';
import path from 'path';

const LOG_DIR = path.join(__dirname, '../../logs');

export function logStep(data: {
    stage: string;
    userInput?: string;
    systemPrompt: string;
    analysis: any;
}) {
    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }

    const logFile = path.join(LOG_DIR, 'debug_log.md');
    const timestamp = new Date().toISOString();
    
    const entry = `
## [${timestamp}] Stage: ${data.stage}
**User Input:** ${data.userInput || 'N/A'}

**System Prompt (Sent to Junior):**
\`\`\`
${data.systemPrompt}
\`\`\`

**Senior Agent Analysis:**
\`\`\`json
${JSON.stringify(data.analysis, null, 2)}
\`\`\`

---
`;

    fs.appendFileSync(logFile, entry);
}
