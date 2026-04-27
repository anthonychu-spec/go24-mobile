// Diagnose: check actual status values in pgm.members
// Uses the Query Database tool directly via N8N workflow
const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

// Step 1: Fetch live workflow
function fetchWorkflow() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
      path: `/api/v1/workflows/${WORKFLOW_ID}`,
      method: 'GET',
      headers: { 'X-N8N-API-KEY': N8N_API_KEY }
    };
    const req = https.request(options, (res) => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('Fetching live workflow...');
  const wf = await fetchWorkflow();

  // Save live state
  fs.writeFileSync('workflow-live.json', JSON.stringify(wf, null, 2));
  console.log('Saved to workflow-live.json');

  // Show Query Database node details
  const qdb = wf.nodes.find(n => n.name === 'Query Database');
  if (qdb) {
    console.log('\nQuery Database node:', JSON.stringify(qdb, null, 2));
  } else {
    console.log('\n❌ Query Database node NOT FOUND. Nodes:', wf.nodes.map(n => n.name).join(', '));
  }

  // Show AI Agent
  const agent = wf.nodes.find(n => n.name === 'AI Agent');
  if (agent) {
    console.log('\nAI Agent typeVersion:', agent.typeVersion);
    console.log('AI Agent parameters:', JSON.stringify(agent.parameters, null, 2));
  }

  // Show connections for AI Agent
  console.log('\nConnections TO AI Agent:');
  Object.entries(wf.connections).forEach(([src, conn]) => {
    Object.entries(conn).forEach(([type, outputs]) => {
      outputs.forEach(output => {
        (output || []).forEach(target => {
          if (target.node === 'AI Agent') {
            console.log(`  ${src} --[${type}]--> AI Agent`);
          }
        });
      });
    });
  });

  // Show all connections from AI Agent
  const agentConns = wf.connections['AI Agent'];
  console.log('\nConnections FROM AI Agent:', JSON.stringify(agentConns, null, 2));
}

main().catch(console.error);
