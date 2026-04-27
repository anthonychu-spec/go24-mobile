const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const wf = JSON.parse(fs.readFileSync('workflow-ai.json', 'utf8'));

// ── 1. Simplify Extract Message: remove "6778 question" shorthand ──
// Now: 6778 alone → __HELP__; everything else → regular question (session checked)
wf.nodes.find(n => n.name === 'Extract Message').parameters.jsCode = `
const body = $input.first().json.body || {};
const value = body.entry?.[0]?.changes?.[0]?.value;
const messages = value?.messages;
if (!messages || !messages[0]) return [];
const msg = messages[0];

let from = msg.from, messageId = msg.id, rawText = '', question = '';

if (msg.type === 'text') {
  rawText = (msg.text?.body || '').trim();
} else if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
  rawText = msg.interactive.button_reply.id;
  const btnMap = {
    'q_active':  '依家有幾多個 Active Members？',
    'q_pos':     '今日 POS Revenue 係幾多？',
    'q_studio':  '今日有咩 Studio Classes？'
  };
  question = btnMap[rawText] || rawText;
}

if (!rawText) return [];

const PASSWORD = '6778';
if (rawText === PASSWORD) {
  return [{ json: { from, messageId, rawText, question: '__HELP__', authenticated: true } }];
}

// All other messages: check session (not pre-authenticated here)
if (!question) question = rawText;
return [{ json: { from, messageId, rawText, question, authenticated: false } }];
`.trim();

// ── 2. Remove IF: Help Menu node ──
wf.nodes = wf.nodes.filter(n => n.name !== 'IF: Help Menu');
delete wf.connections['IF: Help Menu'];

// ── 3. IF: Password OK true → Google Sheets2 (skip IF: Help Menu) ──
wf.connections['IF: Password OK'] = {
  main: [
    [{ node: 'Google Sheets2', type: 'main', index: 0 }],        // true → upsert session → buttons
    [{ node: 'PG Check Session', type: 'main', index: 0 }]        // false → check session → AI
  ]
};

// ── 4. Verify other connections are intact ──
const check = ['Google Sheets2','PG Upsert Session','Reply: Help Menu',
               'PG Check Session','IF Session Valid','AI Agent','Google Sheets','Send WhatsApp Reply2'];
check.forEach(n => {
  const node = wf.nodes.find(x => x.name === n);
  if (!node) console.log('MISSING NODE:', n);
  else console.log('OK:', n);
});

// ── 5. Push ──
const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings: { executionOrder: 'v1' }, staticData: wf.staticData || null };
const bodyStr = JSON.stringify(payload);
console.log('\nNodes:', payload.nodes.length, '| Size:', bodyStr.length);

const options = {
  hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
};

const req = https.request(options, (res) => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Fixed! Workflow updated.');
    } else {
      try { console.log('❌', JSON.stringify(JSON.parse(d), null, 2)); }
      catch { console.log('❌', res.statusCode, d.substring(0, 300)); }
    }
  });
});
req.on('error', e => console.error(e.message));
req.write(bodyStr);
req.end();
