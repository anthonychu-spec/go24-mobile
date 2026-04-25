const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const wf = JSON.parse(fs.readFileSync('workflow-current.json', 'utf8'));

// ---------- 1. Update Extract Message ----------
wf.nodes.find(n => n.name === 'Extract Message').parameters.jsCode =
`const body = $input.first().json.body || {};
const value = body.entry?.[0]?.changes?.[0]?.value;
const messages = value?.messages;
if (!messages || !messages[0]) return [];
const msg = messages[0];
let from = msg.from, messageId = msg.id, rawText = '', question = '';
if (msg.type === 'text') rawText = (msg.text?.body || '').trim();
else if (msg.type === 'interactive' && msg.interactive?.type === 'button_reply') {
  rawText = msg.interactive.button_reply.id;
  question = rawText;
}
if (!rawText) return [];
const PASSWORD = '6778';
let authenticated = false;
if (rawText === PASSWORD) { authenticated = true; question = '__HELP__'; }
else if (rawText.startsWith(PASSWORD + ' ')) { authenticated = true; question = rawText.slice(PASSWORD.length + 1).trim(); }
else { authenticated = false; question = rawText; }
return [{ json: { from, messageId, rawText, question, authenticated } }];`;

// ---------- 2. Fix Send WhatsApp Reply token reference ----------
const sendReply = wf.nodes.find(n => n.name === 'Send WhatsApp Reply');
sendReply.parameters.headerParameters.parameters[0].value =
  "=Bearer {{ $('Google Sheets2').item.json['Access Token'] }}";

// ---------- 3. Reply: Help Menu → send interactive buttons ----------
const helpMenu = wf.nodes.find(n => n.name === 'Reply: Help Menu');
helpMenu.parameters.jsonBody =
  "={{ JSON.stringify({ messaging_product: 'whatsapp', to: $(\"Extract Message\").first().json.from, type: 'interactive', interactive: { type: 'button', body: { text: '✅ 密碼正確！\\n\\n按下面選項，或直接打問題：' }, action: { buttons: [{ type: 'reply', reply: { id: 'q_active', title: '🧑 Active Members' } }, { type: 'reply', reply: { id: 'q_pos', title: '💰 POS Revenue' } }, { type: 'reply', reply: { id: 'q_studio', title: '🎯 Studio Classes' } }] } } }) }}";

// ---------- 4. Also update Upsert Session + session check ----------
// After __HELP__ detected: upsert bot.sessions then send buttons
// Check if already exists:
const hasUpsert = wf.nodes.find(n => n.name === 'PG Upsert Session');
if (!hasUpsert) {
  wf.nodes.push({
    id: 'pg_upsert_1',
    name: 'PG Upsert Session',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [1780, -224],
    parameters: {
      operation: 'executeQuery',
      query: "INSERT INTO bot.sessions (phone, authed_at, last_seen_at)\nVALUES ('{{ $(\"Extract Message\").first().json.from }}', NOW(), NOW())\nON CONFLICT (phone) DO UPDATE SET last_seen_at = NOW();",
      options: {}
    },
    credentials: { postgres: { id: 'BdWjFTVmkC8DZtSo', name: 'Postgres account' } }
  });

  wf.nodes.push({
    id: 'pg_check_session_1',
    name: 'PG Check Session',
    type: 'n8n-nodes-base.postgres',
    typeVersion: 2.5,
    position: [1580, 560],
    parameters: {
      operation: 'executeQuery',
      query: "SELECT (last_seen_at > NOW() - INTERVAL '2 hours') AS is_valid\nFROM bot.sessions WHERE phone = '{{ $(\"Extract Message\").first().json.from }}';",
      options: {}
    },
    credentials: { postgres: { id: 'BdWjFTVmkC8DZtSo', name: 'Postgres account' } }
  });

  wf.nodes.push({
    id: 'if_session_valid_1',
    name: 'IF Session Valid',
    type: 'n8n-nodes-base.if',
    typeVersion: 2,
    position: [1980, 560],
    parameters: {
      conditions: {
        options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 2 },
        conditions: [{
          id: 'sv1',
          leftValue: '={{ $json.is_valid }}',
          rightValue: true,
          operator: { type: 'boolean', operation: 'true' }
        }],
        combinator: 'and'
      },
      options: {}
    }
  });

  wf.nodes.push({
    id: 'reply_expired_1',
    name: 'Reply Session Expired',
    type: 'n8n-nodes-base.httpRequest',
    typeVersion: 4.2,
    position: [2180, 700],
    parameters: {
      method: 'POST',
      url: 'https://graph.facebook.com/v22.0/793508627177133/messages',
      sendHeaders: true,
      headerParameters: { parameters: [
        { name: 'Authorization', value: "=Bearer {{ $('Google Sheets2').item.json['Access Token'] }}" },
        { name: 'Content-Type', value: 'application/json' }
      ]},
      sendBody: true,
      specifyBody: 'json',
      jsonBody: "={{ JSON.stringify({ messaging_product: 'whatsapp', to: $(\"Extract Message\").first().json.from, type: 'text', text: { body: '⏱️ Session 已過期，請重新輸入：\\n6778' } }) }}",
      options: {}
    }
  });

  // Wire new nodes into connections
  // IF: Password OK false → PG Check Session
  wf.connections['IF: Password OK'].main[1] = [{ node: 'PG Check Session', type: 'main', index: 0 }];

  // Google Sheets2 → PG Upsert Session → Reply: Help Menu
  wf.connections['Google Sheets2'] = {
    main: [[{ node: 'PG Upsert Session', type: 'main', index: 0 }]]
  };
  wf.connections['PG Upsert Session'] = {
    main: [[{ node: 'Reply: Help Menu', type: 'main', index: 0 }]]
  };

  // PG Check Session → IF Session Valid
  wf.connections['PG Check Session'] = {
    main: [[{ node: 'IF Session Valid', type: 'main', index: 0 }]]
  };

  // IF Session Valid true → Build SQL Request, false → Reply Session Expired
  wf.connections['IF Session Valid'] = {
    main: [
      [{ node: 'Build SQL Request', type: 'main', index: 0 }],
      [{ node: 'Reply Session Expired', type: 'main', index: 0 }]
    ]
  };

  // Also update session last_seen_at when session is valid and question flows through
  // We reuse Build SQL Request which is already connected

  wf.connections['Reply Session Expired'] = { main: [[]] };
}

// ---------- Send ONLY required fields to N8N ----------
// N8N PUT requires: name, nodes, connections, settings
const payload = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: { executionOrder: 'v1' },  // only allowed field
  staticData: wf.staticData || null
};

const bodyStr = JSON.stringify(payload);
console.log('Payload size:', bodyStr.length, 'bytes');
console.log('Node count:', payload.nodes.length);

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
    console.log('HTTP status:', res.statusCode);
    if (res.statusCode === 200) {
      const r = JSON.parse(data);
      console.log('✅ Workflow updated! Active:', r.active);
      console.log('Nodes in response:', r.nodes?.length);
    } else {
      // Try to get a useful error
      try {
        const err = JSON.parse(data);
        console.log('❌ Error:', JSON.stringify(err, null, 2));
      } catch {
        console.log('❌ Raw error:', data.substring(0, 600));
      }
    }
  });
});
req.on('error', e => console.error(e));
req.write(bodyStr);
req.end();
