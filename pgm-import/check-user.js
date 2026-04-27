// Temporarily change PG Upsert Session to SELECT current_user to diagnose
const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const wf = JSON.parse(fs.readFileSync('workflow-updated.json', 'utf8'));

// Change PG Upsert Session to just SELECT current_user
const pgNode = wf.nodes.find(n => n.name === 'PG Upsert Session');
pgNode.parameters.query = "SELECT current_user AS whoami, current_database() AS db, has_schema_privilege(current_user, 'bot', 'USAGE') AS can_use_bot;";

const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' }, staticData: wf.staticData || null };
const bodyStr = JSON.stringify(payload);

const options = {
  hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    if (res.statusCode === 200) console.log('✅ Updated! Now send 6778 again to see which user N8N connects as.');
    else console.log('Error:', res.statusCode, data.substring(0, 300));
  });
});
req.on('error', e => console.error(e.message));
req.write(bodyStr);
req.end();
