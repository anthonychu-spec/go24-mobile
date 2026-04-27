// Add typing indicator before AI Agent
// Flow change:
//   BEFORE: IF Session Valid → AI Agent → Google Sheets(token) → Send WhatsApp Reply2
//   AFTER:  IF Session Valid → Google Sheets(token) → Typing Indicator → AI Agent → Send WhatsApp Reply2
const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const wf = JSON.parse(fs.readFileSync('workflow-live.json', 'utf8'));

// ── 1. Move Google Sheets node to before AI Agent ──
const gsNode = wf.nodes.find(n => n.name === 'Google Sheets');
gsNode.position = [2192, 368];  // above and left of AI Agent

// ── 2. Add Typing Indicator HTTP Request node ──
wf.nodes.push({
  id: 'typing_indicator_1',
  name: 'Typing Indicator',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [2192, 560],
  parameters: {
    method: 'POST',
    url: 'https://graph.facebook.com/v22.0/793508627177133/messages',
    sendHeaders: true,
    headerParameters: {
      parameters: [
        {
          name: 'Authorization',
          value: "=Bearer {{ $('Google Sheets').first().json['Access Token'] }}"
        },
        {
          name: 'Content-Type',
          value: 'application/json'
        }
      ]
    },
    sendBody: true,
    specifyBody: 'json',
    // Mark as read + show typing indicator simultaneously
    jsonBody: `={{ JSON.stringify({
  messaging_product: "whatsapp",
  status: "read",
  message_id: $('Extract Message').first().json.messageId,
  typing_indicator: { type: "text" }
}) }}`,
    options: {}
  }
});

// ── 3. Update Send WhatsApp Reply2: use explicit Google Sheets reference for token ──
const reply2 = wf.nodes.find(n => n.name === 'Send WhatsApp Reply2');
// Change $json['Access Token'] → $('Google Sheets').first().json['Access Token']
reply2.parameters.headerParameters.parameters[0].value =
  "=Bearer {{ $('Google Sheets').first().json['Access Token'] }}";

// ── 4. Rewire connections ──
// IF Session Valid true → Google Sheets (was AI Agent)
wf.connections['IF Session Valid'] = {
  main: [
    [{ node: 'Google Sheets', type: 'main', index: 0 }],        // true → fetch token first
    [{ node: 'Reply Session Expired', type: 'main', index: 0 }] // false → session expired
  ]
};

// Google Sheets → Typing Indicator
wf.connections['Google Sheets'] = {
  main: [[{ node: 'Typing Indicator', type: 'main', index: 0 }]]
};

// Typing Indicator → AI Agent
wf.connections['Typing Indicator'] = {
  main: [[{ node: 'AI Agent', type: 'main', index: 0 }]]
};

// AI Agent → Send WhatsApp Reply2 (skip Google Sheets, token already fetched)
wf.connections['AI Agent'] = {
  main: [[{ node: 'Send WhatsApp Reply2', type: 'main', index: 0 }]]
};

// ── 5. Verify ──
const check = ['Google Sheets', 'Typing Indicator', 'AI Agent', 'Send WhatsApp Reply2'];
check.forEach(name => {
  const n = wf.nodes.find(x => x.name === name);
  const c = wf.connections[name];
  console.log(name, '→', JSON.stringify(c?.main?.[0]?.[0]?.node));
});

// ── 6. Deploy ──
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

const req = https.request(options, (res) => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('\n✅ Typing indicator added!');
      console.log('New flow:');
      console.log('  IF Session Valid → Google Sheets(token) → Typing Indicator → AI Agent → Send Reply');
      console.log('\nUser will now see:');
      console.log('  ✓ Blue ticks (read) immediately');
      console.log('  ✓ "輸入中..." while AI thinks (~3-5s)');
      console.log('  ✓ Answer arrives');
    } else {
      try { console.log('❌', JSON.stringify(JSON.parse(d), null, 2)); }
      catch { console.log('❌', res.statusCode, d.substring(0, 300)); }
    }
  });
});
req.on('error', e => console.error(e.message));
req.write(bodyStr);
req.end();
