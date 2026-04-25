const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

// Load current workflow
const wf = JSON.parse(fs.readFileSync('workflow-current.json', 'utf8'));

// 1. Update Extract Message to handle button_reply + text
const extractMsgNode = wf.nodes.find(n => n.name === 'Extract Message');
extractMsgNode.parameters.jsCode = `const body = $input.first().json.body || {};
const value = body.entry?.[0]?.changes?.[0]?.value;
const messages = value?.messages;
if (!messages || !messages[0]) return [];
const msg = messages[0];

let from = msg.from;
let messageId = msg.id;
let rawText = "";
let question = "";

// Handle text messages
if (msg.type === "text") {
  rawText = (msg.text?.body || "").trim();
}
// Handle button_reply messages
else if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
  const buttonId = msg.interactive.button_reply.id;
  rawText = buttonId;
  question = buttonId;
}

if (!rawText) return [];

const PASSWORD = "6778";
let authenticated = false;

if (rawText === PASSWORD) {
  authenticated = true;
  question = "__HELP__";
}
else if (rawText.startsWith(PASSWORD + " ")) {
  authenticated = true;
  question = rawText.slice(PASSWORD.length + 1).trim();
}
else {
  authenticated = false;
  question = rawText;
}

return [{ json: { from, messageId, rawText, question, authenticated, isButtonReply: msg.type === "interactive" } }];`;

// 2. Fix Send WhatsApp Reply to use Google Sheets2 instead of missing Get WhatsApp Token node
const sendReplyNode = wf.nodes.find(n => n.name === 'Send WhatsApp Reply');
sendReplyNode.parameters.headerParameters.parameters[0].value = "=Bearer {{ $('Google Sheets2').item.json['Access Token'] }}";

// 3. Add Check Session node (Postgres query) after IF: Password OK false
const checkSessionNode = {
  "parameters": {
    "operation": "executeQuery",
    "query": "SELECT EXISTS(SELECT 1 FROM bot.sessions WHERE phone = $1 AND last_seen_at > NOW() - INTERVAL '2 hours') AS is_valid;",
    "options": {}
  },
  "id": "n_check_session",
  "name": "Check Session",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "position": [1584, 560]
};
wf.nodes.push(checkSessionNode);

// 4. Add IF: Session Valid node
const ifSessionNode = {
  "parameters": {
    "conditions": {
      "options": {
        "caseSensitive": false,
        "leftValue": "",
        "typeValidation": "loose",
        "version": 2
      },
      "conditions": [
        {
          "id": "c4",
          "leftValue": "={{ $json.is_valid }}",
          "rightValue": true,
          "operator": {
            "type": "boolean",
            "operation": "true"
          }
        }
      ],
      "combinator": "and"
    },
    "options": {}
  },
  "id": "n_if_session",
  "name": "IF: Session Valid",
  "type": "n8n-nodes-base.if",
  "typeVersion": 2,
  "position": [1968, 560]
};
wf.nodes.push(ifSessionNode);

// 5. Add Upsert Session node (Code) - after successful password
const upsertSessionNode = {
  "parameters": {
    "jsCode": "const from = $(\"Extract Message\").first().json.from;\nreturn [{ json: { phone: from } }];"
  },
  "id": "n_upsert_session",
  "name": "Upsert Session",
  "type": "n8n-nodes-base.code",
  "typeVersion": 2,
  "position": [1750, 224]
};
wf.nodes.push(upsertSessionNode);

// 6. Add Postgres Upsert node after Upsert Session
const pgUpsertNode = {
  "parameters": {
    "operation": "executeQuery",
    "query": "INSERT INTO bot.sessions (phone, authed_at, last_seen_at) VALUES ($1, NOW(), NOW()) ON CONFLICT (phone) DO UPDATE SET last_seen_at = NOW();",
    "options": {}
  },
  "id": "n_pg_upsert",
  "name": "PG: Upsert Session",
  "type": "n8n-nodes-base.postgres",
  "typeVersion": 2.5,
  "position": [1920, 224]
};
wf.nodes.push(pgUpsertNode);

// 7. Add Send Interactive Buttons node (replace Reply: Help Menu logic)
const sendButtonsNode = {
  "parameters": {
    "method": "POST",
    "url": "https://graph.facebook.com/v22.0/793508627177133/messages",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $('Google Sheets2').item.json['Access Token'] }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ messaging_product: \"whatsapp\", to: $(\"Extract Message\").first().json.from, type: \"interactive\", interactive: { type: \"button\", body: { text: \"✅ 密碼正確！\\n\\n請選擇查詢項目或直接提問：\" }, action: { buttons: [{ type: \"reply\", reply: { id: \"q_active\", title: \"🧑 Active Members\" } }, { type: \"reply\", reply: { id: \"q_pos\", title: \"💰 POS Revenue\" } }, { type: \"reply\", reply: { id: \"q_studio\", title: \"🎯 Studio Classes\" } }] } } }) }}",
    "options": {}
  },
  "id": "n_send_buttons",
  "name": "Send Interactive Buttons",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [2080, 224]
};
wf.nodes.push(sendButtonsNode);

// 8. Add Reply: Session Expired node
const sessionExpiredNode = {
  "parameters": {
    "method": "POST",
    "url": "https://graph.facebook.com/v22.0/793508627177133/messages",
    "sendHeaders": true,
    "headerParameters": {
      "parameters": [
        {
          "name": "Authorization",
          "value": "=Bearer {{ $('Google Sheets2').item.json['Access Token'] }}"
        },
        {
          "name": "Content-Type",
          "value": "application/json"
        }
      ]
    },
    "sendBody": true,
    "specifyBody": "json",
    "jsonBody": "={{ JSON.stringify({ messaging_product: \"whatsapp\", to: $(\"Extract Message\").first().json.from, type: \"text\", text: { body: \"⏱️ 密碼已過期，請重新輸入:\\n6778\" } }) }}",
    "options": {}
  },
  "id": "n_session_expired",
  "name": "Reply: Session Expired",
  "type": "n8n-nodes-base.httpRequest",
  "typeVersion": 4.2,
  "position": [2352, 560]
};
wf.nodes.push(sessionExpiredNode);

// 9. Update connections
// Change IF: Password OK false branch to go to Check Session
wf.connections['IF: Password OK'].main[1] = [{ node: 'Check Session', type: 'main', index: 0 }];

// Add Check Session connections
wf.connections['Check Session'] = {
  main: [[{ node: 'IF: Session Valid', type: 'main', index: 0 }]]
};

// Add IF: Session Valid connections
wf.connections['IF: Session Valid'] = {
  main: [
    [{ node: 'Build SQL Request', type: 'main', index: 0 }],  // true
    [{ node: 'Reply: Session Expired', type: 'main', index: 0 }]  // false
  ]
};

// IF: Help Menu true branch goes to Upsert Session
wf.connections['IF: Help Menu'].main[0] = [{ node: 'Upsert Session', type: 'main', index: 0 }];

// Upsert Session → PG: Upsert Session
wf.connections['Upsert Session'] = {
  main: [[{ node: 'PG: Upsert Session', type: 'main', index: 0 }]]
};

// PG: Upsert Session → Send Interactive Buttons
wf.connections['PG: Upsert Session'] = {
  main: [[{ node: 'Send Interactive Buttons', type: 'main', index: 0 }]]
};

// Send Interactive Buttons ends (no output to next)
wf.connections['Send Interactive Buttons'] = {
  main: [[]]
};

// Reply: Session Expired ends
wf.connections['Reply: Session Expired'] = {
  main: [[]]
};

// Remove the old Reply: Help Menu node connection
delete wf.connections['Reply: Help Menu'];

// Remove Reply: Help Menu and Whatsapp 5 nodes (we don't need them anymore)
wf.nodes = wf.nodes.filter(n => !['Reply: Help Menu', 'Whatsapp 5'].includes(n.name));

// 10. Replace Gemini URLs with placeholder
wf.nodes.forEach(n => {
  if (n.name.includes('Gemini')) {
    const url = n.parameters.url || '';
    if (url.includes('key=')) {
      n.parameters.url = url.replace(/key=([^&"]+)/, 'key=REPLACE_GEMINI_API_KEY');
    }
  }
});

// Save updated workflow
const updatedWf = wf;

// Update workflow via API
const options = {
  hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PUT',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': JSON.stringify(updatedWf).length,
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Workflow updated successfully!');
      const result = JSON.parse(data);
      console.log('Workflow ID:', result.id);
      console.log('Name:', result.name);
      console.log('Active:', result.active);
      console.log('\n⚠️  IMPORTANT: You need to update the Gemini API keys:');
      console.log('1. Go to N8N workflow editor');
      console.log('2. Find "Gemini: Generate SQL" node');
      console.log('3. Replace "REPLACE_GEMINI_API_KEY" with your real Gemini API key');
      console.log('4. Repeat for "Gemini: Format Answer" node');
      console.log('5. Save workflow');
    } else {
      console.log('❌ Error:', res.statusCode);
      console.log('Response:', data);
    }
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(JSON.stringify(updatedWf));
req.end();
