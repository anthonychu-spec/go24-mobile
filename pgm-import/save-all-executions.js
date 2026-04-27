// Enable saving all executions so we can see what AI Agent is doing
const https = require('https');
const fs = require('fs');
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const wf = JSON.parse(fs.readFileSync('workflow-ai.json', 'utf8'));

const payload = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: {
    executionOrder: 'v1',
    saveDataSuccessExecution: 'all',   // save successful executions
    saveDataErrorExecution: 'all',
    saveManualExecutions: true
  },
  staticData: wf.staticData || null
};

const bodyStr = JSON.stringify(payload);
const options = {
  hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
};

const req = https.request(options, (res) => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    if (res.statusCode === 200) console.log('✅ Now saving all executions. Send a question in WhatsApp and I can check the full AI Agent log.');
    else { try { console.log('❌', JSON.stringify(JSON.parse(d))); } catch { console.log('❌', res.statusCode); } }
  });
});
req.on('error', e => console.error(e.message));
req.write(bodyStr);
req.end();
