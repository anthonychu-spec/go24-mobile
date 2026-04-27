// Send a diagnostic question to the N8N WhatsApp webhook
// This will trigger the AI to query distinct status values
const https = require('https');

// Use the boss phone number (already authed) and send a debug question
// The session (entered 6778 earlier) should still be valid for 2 hours

const WEBHOOK_URL = 'n8n-app-do-d9hvm.ondigitalocean.app';
// Get the webhook path from the live workflow
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const fs = require('fs');

// First get the webhook path from the live workflow
const wf = JSON.parse(fs.readFileSync('workflow-live.json', 'utf8'));
const webhookNode = wf.nodes.find(n => n.type === 'n8n-nodes-base.webhook');
console.log('Webhook node:', webhookNode?.name, webhookNode?.parameters);

// Build a fake WhatsApp webhook payload
// Using 85261172810 (boss phone) which should have an active session
const from = '85261172810';
const fakePayload = {
  object: 'whatsapp_business_account',
  entry: [{
    id: '12345',
    changes: [{
      value: {
        messaging_product: 'whatsapp',
        metadata: { display_phone_number: '85261172810', phone_number_id: '793508627177133' },
        contacts: [{ profile: { name: 'Boss' }, wa_id: from }],
        messages: [{
          from: from,
          id: 'wamid.test_diagnostic_001',
          timestamp: Math.floor(Date.now() / 1000),
          text: { body: 'SELECT DISTINCT status, COUNT(*) as cnt FROM pgm.members GROUP BY status ORDER BY cnt DESC' },
          type: 'text'
        }]
      },
      field: 'messages'
    }]
  }]
};

// Find webhook path
const webhookPath = webhookNode?.parameters?.path;
console.log('Sending to webhook path:', webhookPath);

const body = JSON.stringify(fakePayload);
const options = {
  hostname: WEBHOOK_URL,
  path: '/webhook/' + webhookPath,
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body)
  }
};

console.log('POST', options.path);
const req = https.request(options, (res) => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    console.log('Response:', d.substring(0, 200));
    console.log('\n⏳ Wait 5 seconds then check executions...');
  });
});
req.on('error', e => console.error(e.message));
req.write(body);
req.end();
