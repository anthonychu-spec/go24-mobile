const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

// Load current workflow
const wf = JSON.parse(fs.readFileSync('workflow-current.json', 'utf8'));

console.log('Preparing minimal updates...');

// Only update: Extract Message parameters
const extractMsgNode = wf.nodes.find(n => n.name === 'Extract Message');
const oldCode = extractMsgNode.parameters.jsCode;
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

console.log('Extract Message code updated');

// Fix Send WhatsApp Reply to use Google Sheets2
const sendReplyNode = wf.nodes.find(n => n.name === 'Send WhatsApp Reply');
sendReplyNode.parameters.headerParameters.parameters[0].value = "=Bearer {{ $('Google Sheets2').item.json['Access Token'] }}";
console.log('Send WhatsApp Reply fixed');

// Replace Gemini URLs with placeholder
wf.nodes.forEach(n => {
  if (n.name.includes('Gemini')) {
    const url = n.parameters?.url || '';
    if (url.includes('key=')) {
      const maskedUrl = url.replace(/key=([^"&]+)/, 'key=REPLACE_GEMINI_API_KEY');
      n.parameters.url = maskedUrl;
      console.log('Masked Gemini key in:', n.name);
    }
  }
});

// Update workflow via PUT
const bodyStr = JSON.stringify(wf);
console.log('Sending update, payload size:', bodyStr.length, 'bytes');

const options = {
  hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PUT',
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
        console.log('\n✅ Workflow updated!');
        console.log('ID:', result.id);
        console.log('Name:', result.name);
      } catch (e) {
        console.log('Response:', data);
      }
    } else {
      console.log('Error response:');
      console.log(data);
    }
  });
});

req.on('error', e => console.error('Request error:', e.message));
req.write(bodyStr);
req.end();
