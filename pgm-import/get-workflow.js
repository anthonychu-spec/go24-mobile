const https = require('https');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const options = {
  hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'GET',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const wf = JSON.parse(data);
    // Print node names and IDs only (not full params to avoid secrets)
    const nodes = wf.nodes || [];
    console.log('Workflow name:', wf.name);
    console.log('Active:', wf.active);
    console.log('\nNodes:');
    nodes.forEach(n => {
      console.log(`  id=${n.id}  type=${n.type}  name="${n.name}"`);
    });
    console.log('\nConnections keys:', Object.keys(wf.connections || {}));
    // Save full workflow to file for inspection
    const fs = require('fs');
    fs.writeFileSync('workflow-current.json', JSON.stringify(wf, null, 2));
    console.log('\nFull workflow saved to workflow-current.json');
  });
});

req.on('error', e => console.error('Error:', e.message));
req.end();
