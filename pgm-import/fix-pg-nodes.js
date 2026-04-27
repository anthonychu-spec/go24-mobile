const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const wf = JSON.parse(fs.readFileSync('workflow-updated.json', 'utf8'));

// Fix 1: PG Upsert Session - restore real INSERT query
const pgUpsert = wf.nodes.find(n => n.name === 'PG Upsert Session');
pgUpsert.parameters.query = `INSERT INTO bot.sessions (phone, authed_at, last_seen_at)
VALUES ('{{ $("Extract Message").first().json.from }}', NOW(), NOW())
ON CONFLICT (phone) DO UPDATE SET last_seen_at = NOW();`;

// Fix 2: PG Check Session - use COALESCE so it ALWAYS returns a row
// even when phone not in sessions table → returns false
const pgCheck = wf.nodes.find(n => n.name === 'PG Check Session');
pgCheck.parameters.query = `SELECT COALESCE(
  (SELECT (last_seen_at > NOW() - INTERVAL '2 hours')
   FROM bot.sessions
   WHERE phone = '{{ $("Extract Message").first().json.from }}'),
  false
) AS is_valid;`;

const payload = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: { executionOrder: 'v1' },
  staticData: wf.staticData || null
};

const bodyStr = JSON.stringify(payload);
const options = {
  hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(bodyStr)
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Fixed!');
      console.log('Fix 1: PG Upsert Session → real INSERT restored');
      console.log('Fix 2: PG Check Session → COALESCE always returns a row');
      console.log('\nNext step: send 6778 to create session first, then ask questions.');
    } else {
      console.log('Error:', res.statusCode, data.substring(0, 300));
    }
  });
});
req.on('error', e => console.error(e.message));
req.write(bodyStr);
req.end();
