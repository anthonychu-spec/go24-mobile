const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

// Try just extracting the code without changing anything else
const wf = JSON.parse(fs.readFileSync('workflow-current.json', 'utf8'));

const extractMsgNode = wf.nodes.find(n => n.name === 'Extract Message');
console.log('Original code length:', extractMsgNode.parameters.jsCode.length);

// New code
const newCode = `const body = $input.first().json.body || {};
const value = body.entry?.[0]?.changes?.[0]?.value;
const messages = value?.messages;
if (!messages || !messages[0]) return [];
const msg = messages[0];
let from = msg.from, messageId = msg.id, rawText = "", question = "";
if (msg.type === "text") rawText = (msg.text?.body || "").trim();
else if (msg.type === "interactive" && msg.interactive?.type === "button_reply") {
  rawText = msg.interactive.button_reply.id;
  question = rawText;
}
if (!rawText) return [];
const PASSWORD = "6778";
let authenticated = false;
if (rawText === PASSWORD) { authenticated = true; question = "__HELP__"; }
else if (rawText.startsWith(PASSWORD + " ")) { authenticated = true; question = rawText.slice(PASSWORD.length + 1).trim(); }
else { authenticated = false; question = rawText; }
return [{ json: { from, messageId, rawText, question, authenticated } }];`;

extractMsgNode.parameters.jsCode = newCode;
console.log('New code length:', extractMsgNode.parameters.jsCode.length);

const bodyStr = JSON.stringify(wf);
console.log('Payload size:', bodyStr.length);

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

console.log('Sending PUT request...');

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    if (res.statusCode === 200) {
      console.log('✅ Success!');
    } else {
      console.log('Error. First 500 chars:');
      console.log(data.substring(0, 500));
      // Try to parse as JSON
      try {
        const err = JSON.parse(data);
        console.log('\nParsed error:');
        console.log(JSON.stringify(err, null, 2));
      } catch (e) {
        console.log('Not JSON');
      }
    }
  });
});

req.on('error', e => console.error('Request error:', e.message));
req.write(bodyStr);
req.end();
