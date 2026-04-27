// Move typing indicator to fire for ALL boss message paths
// New flow: IF: From Boss true → Google Sheets(token) → Typing Indicator → IF: Password OK → ...
const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const wf = JSON.parse(fs.readFileSync('workflow-live.json', 'utf8'));

// ── 1. Reposition nodes to make room for Google Sheets + Typing Indicator
//       between IF: From Boss and IF: Password OK

// Move Google Sheets (token fetch) to early in flow
wf.nodes.find(n => n.name === 'Google Sheets').position = [1136, 224];

// Move Typing Indicator to before IF: Password OK
wf.nodes.find(n => n.name === 'Typing Indicator').position = [1360, 224];

// Shift IF: Password OK and downstream right
wf.nodes.find(n => n.name === 'IF: Password OK').position    = [1600, 224];
wf.nodes.find(n => n.name === 'Google Sheets2').position     = [1824, 0];
wf.nodes.find(n => n.name === 'PG Upsert Session').position  = [2048, -224];
wf.nodes.find(n => n.name === 'Reply: Help Menu').position   = [2272, -224];
wf.nodes.find(n => n.name === 'PG Check Session').position   = [1824, 560];
wf.nodes.find(n => n.name === 'IF Session Valid').position   = [2048, 560];
wf.nodes.find(n => n.name === 'AI Agent').position           = [2608, 560];
wf.nodes.find(n => n.name === 'Reply Session Expired').position = [2272, 704];
wf.nodes.find(n => n.name === 'Send WhatsApp Reply2').position  = [3200, 432];

// Also reposition AI Agent subnodes to stay aligned
wf.nodes.find(n => n.name === 'Google Gemini Chat Model').position = [2608, 1200];
wf.nodes.find(n => n.name === 'Query Database').position           = [2816, 768];
wf.nodes.find(n => n.name === 'Simple Memory').position            = [2608, 960];

// ── 2. Rewire connections ──

// IF: From Boss true → Google Sheets (was IF: Password OK)
wf.connections['IF: From Boss'] = {
  main: [
    [{ node: 'Google Sheets', type: 'main', index: 0 }],  // true (boss) → fetch token first
    []                                                       // false (non-boss) → ignore
  ]
};

// Google Sheets → Typing Indicator (already was this, keep it)
wf.connections['Google Sheets'] = {
  main: [[{ node: 'Typing Indicator', type: 'main', index: 0 }]]
};

// Typing Indicator → IF: Password OK (was AI Agent)
wf.connections['Typing Indicator'] = {
  main: [[{ node: 'IF: Password OK', type: 'main', index: 0 }]]
};

// IF: Password OK: true → Google Sheets2 (unchanged), false → PG Check Session (unchanged)
// (no change needed here, already correct)

// IF Session Valid: true → AI Agent (already set), false → Reply Session Expired (already set)

// AI Agent → Send WhatsApp Reply2 (already connected)

// ── 3. Update token references in reply nodes to use Google Sheets (not Google Sheets2) ──
// Reply: Help Menu token
const helpMenu = wf.nodes.find(n => n.name === 'Reply: Help Menu');
helpMenu.parameters.headerParameters.parameters[0].value =
  "=Bearer {{ $('Google Sheets').first().json['Access Token'] }}";

// Reply Session Expired token
const sessionExpired = wf.nodes.find(n => n.name === 'Reply Session Expired');
sessionExpired.parameters.headerParameters.parameters[0].value =
  "=Bearer {{ $('Google Sheets').first().json['Access Token'] }}";

// Send WhatsApp Reply2 already updated to $('Google Sheets').first()
// (done in add-typing-indicator.js, verify it's still correct)
const reply2 = wf.nodes.find(n => n.name === 'Send WhatsApp Reply2');
reply2.parameters.headerParameters.parameters[0].value =
  "=Bearer {{ $('Google Sheets').first().json['Access Token'] }}";

// ── 4. Verify connections ──
console.log('Connection flow:');
console.log('IF: From Boss true →', wf.connections['IF: From Boss'].main[0][0]?.node);
console.log('Google Sheets →', wf.connections['Google Sheets'].main[0][0]?.node);
console.log('Typing Indicator →', wf.connections['Typing Indicator'].main[0][0]?.node);
console.log('IF: Password OK true →', wf.connections['IF: Password OK'].main[0][0]?.node);
console.log('IF: Password OK false →', wf.connections['IF: Password OK'].main[1][0]?.node);
console.log('IF Session Valid true →', wf.connections['IF Session Valid'].main[0][0]?.node);
console.log('AI Agent →', wf.connections['AI Agent'].main[0][0]?.node);

// ── 5. Deploy ──
const payload = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: { executionOrder: 'v1', saveDataSuccessExecution: 'all', saveDataErrorExecution: 'all' },
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

https.request(options, (res) => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('\n✅ Typing indicator now fires for ALL boss messages!');
      console.log('   6778 (help menu)  → typing → buttons reply');
      console.log('   Question (authed) → typing → AI answer');
      console.log('   Session expired   → typing → expired reply');
    } else {
      try { console.log('❌', JSON.stringify(JSON.parse(d), null, 2)); }
      catch { console.log('❌', res.statusCode, d.substring(0, 300)); }
    }
  });
}).end(bodyStr);
