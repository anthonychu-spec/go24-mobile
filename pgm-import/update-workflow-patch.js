const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

// Load current workflow
const wf = JSON.parse(fs.readFileSync('workflow-current.json', 'utf8'));

// Extract just the nodes and connections that changed
const extractMsgNode = wf.nodes.find(n => n.name === 'Extract Message');
const sendReplyNode = wf.nodes.find(n => n.name === 'Send WhatsApp Reply');
const helpMenuNode = wf.nodes.find(n => n.name === 'Reply: Help Menu');

// Update nodes
extractMsgNode.parameters.jsCode = `const body = $input.first().json.body || {};
const value = body.entry?.[0]?.changes?.[0]?.value;
const messages = value?.messages;
if (!messages || !messages[0]) return [];
const msg = messages[0];
let from = msg.from;
let messageId = msg.id;
let rawText = "";
let question = "";
if (msg.type === "text") {
  rawText = (msg.text?.body || "").trim();
}
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

sendReplyNode.parameters.headerParameters.parameters[0].value = "=Bearer {{ $('Google Sheets2').item.json['Access Token'] }}";

helpMenuNode.parameters.jsonBody = `={{ JSON.stringify({ messaging_product: "whatsapp", to: $("Extract Message").first().json.from, type: "interactive", interactive: { type: "button", body: { text: "✅ 密碼正確！\\n\\n請選擇查詢項目或直接提問：" }, action: { buttons: [{ type: "reply", reply: { id: "q_active", title: "🧑 Active Members" } }, { type: "reply", reply: { id: "q_pos", title: "💰 POS Revenue" } }, { type: "reply", reply: { id: "q_studio", title: "🎯 Studio Classes" } }] } } }) }}`;

const bodyStr = JSON.stringify(wf);
console.log('Trying PATCH instead of PUT...');

const options = {
  hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PATCH',
  headers: {
    'X-N8N-API-KEY': N8N_API_KEY,
    'Content-Type': 'application/json',
    'Content-Length': bodyStr.length,
  },
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const result = JSON.parse(data);
        console.log('✅ Workflow updated!');
      } catch (e) {
        console.log('Response:', data);
      }
    } else {
      console.log('Error:', data.substring(0, 500));
    }
  });
});

req.on('error', e => console.error('Error:', e.message));
req.write(bodyStr);
req.end();
