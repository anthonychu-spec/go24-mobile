const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const wf = JSON.parse(fs.readFileSync('workflow-updated.json', 'utf8'));

// ── 1. Update Extract Message: translate button IDs + support button_reply ──
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
  // Translate button IDs to real questions
  const btnMap = {
    'q_active':  '依家有幾多個 Active Members？',
    'q_pos':     '今日 POS Revenue 係幾多？',
    'q_studio':  '今日有咩 Studio Classes？'
  };
  question = btnMap[rawText] || rawText;
}

if (!rawText) return [];

const PASSWORD = '6778';
let authenticated = false;

if (rawText === PASSWORD) {
  authenticated = true;
  question = '__HELP__';
} else if (rawText.startsWith(PASSWORD + ' ')) {
  authenticated = true;
  question = rawText.slice(PASSWORD.length + 1).trim();
} else {
  if (!question) question = rawText;
  authenticated = false;
}

return [{ json: { from, messageId, rawText, question, authenticated } }];
`.trim();

// ── 2. Remove old SQL chain nodes ──
const removeNodes = ['Build SQL Request','Gemini: Generate SQL','Extract SQL','Query Postgres',
                     'Build Answer Request','Gemini: Format Answer','Extract Answer',
                     'Send WhatsApp Reply','Send WhatsApp Reply1','Reply: Wrong Password','Whatsapp 5'];
wf.nodes = wf.nodes.filter(n => !removeNodes.includes(n.name));

// ── 3. Add AI Agent + subnodes ──
wf.nodes.push({
  id: 'ai_agent_1',
  name: 'AI Agent',
  type: '@n8n/n8n-nodes-langchain.agent',
  typeVersion: 3.1,
  position: [2400, 560],
  parameters: {
    promptType: 'define',
    text: "={{ $('Extract Message').first().json.question }}",
    options: {
      systemMessage: `You are a smart data assistant for GO24 Fitness gym chain in Hong Kong.
Answer in the SAME language as the question: reply in 廣東話 if asked in Chinese, English if asked in English.
Be concise (1-4 sentences). Use numbers clearly. Add 1-2 relevant emoji. Do NOT mention SQL or database.
Today HKT: {{ new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' }) }}

Use the "Query Database" tool to fetch data when needed.

Database schema:
pgm.members(member_code,name,phone,email,gender,dob DATE,join_date DATE,plan_type,plan_start DATE,plan_end DATE,status,pt_sessions_left INT,last_visit DATE,total_paid NUMERIC,branch,notes) -- status: Active,Frozen,Expired,Cancelled
commissions.sold(club,sell_date DATE,user_number,first_name,product_name,net_sold NUMERIC,gross_sold NUMERIC,is_new BOOL,sold_employee,commission_category)
commissions.done(club,done_date DATE,user_number,product_name,done_amount NUMERIC,done_employee,department,commission_category)
studio.classes(club,class_name,category,employee_name,start_date DATE,day_of_week,class_time,users_limit INT,users_assigned INT,users_present INT,rating NUMERIC)
studio.by_member(club,class_date DATE,class_name,first_name,last_name,user_number,has_presence BOOL)
pos.transactions(club,transaction_date DATE,product_name,category,quantity NUMERIC,net_amount NUMERIC,gross_amount NUMERIC,payment_method,full_name,employee)
payments.epayment_log(club,user_number,name,payment_date DATE,amount NUMERIC,net_amount NUMERIC,status,provider,membership_status,payment_plan)

SQL rules: LIMIT 20 for detail queries; no LIMIT for aggregations; use name ILIKE for searches; readable English aliases.`
    }
  }
});

// Google Gemini Chat Model (subnode)
wf.nodes.push({
  id: 'gemini_model_1',
  name: 'Google Gemini Chat Model',
  type: '@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
  typeVersion: 1,
  position: [2200, 760],
  parameters: {
    modelName: 'models/gemini-2.0-flash',
    options: { maxOutputTokens: 1024, temperature: 0.4 }
  }
  // credentials must be set in UI: Google Gemini(PaLM) API
});

// Postgres Chat Memory (subnode)
wf.nodes.push({
  id: 'pg_chat_memory_1',
  name: 'Postgres Chat Memory',
  type: '@n8n/n8n-nodes-langchain.memoryPostgresChat',
  typeVersion: 1.3,
  position: [2400, 760],
  parameters: {
    sessionIdType: 'customKey',
    sessionKey: "={{ $('Extract Message').first().json.from }}",
    tableName: 'n8n_chat_histories',
    contextWindowLength: 5
  },
  credentials: { postgres: { id: 'BdWjFTVmkC8DZtSo', name: 'Postgres account' } }
});

// Postgres Tool (subnode) - query is filled by AI agent at runtime
wf.nodes.push({
  id: 'pg_tool_1',
  name: 'Query Database',
  type: 'n8n-nodes-base.postgresTool',
  typeVersion: 2.6,
  position: [2600, 760],
  parameters: {
    operation: 'executeQuery',
    query: "={{ $fromAI('query', 'The PostgreSQL SELECT query to execute') }}",
    options: {}
  },
  credentials: { postgres: { id: 'BdWjFTVmkC8DZtSo', name: 'Postgres account' } }
});

// ── 4. Update Send WhatsApp Reply2 to use AI Agent output ──
const reply2 = wf.nodes.find(n => n.name === 'Send WhatsApp Reply2');
reply2.parameters.jsonBody = `={{ JSON.stringify({ messaging_product: "whatsapp", to: $('Extract Message').first().json.from, type: "text", text: { body: $('AI Agent').first().json.output } }) }}`;

// ── 5. Update connections ──
// Remove old node connections
const removeCon = ['Build SQL Request','Gemini: Generate SQL','Extract SQL','Query Postgres',
                   'Build Answer Request','Gemini: Format Answer','Extract Answer',
                   'Send WhatsApp Reply','Send WhatsApp Reply1','Reply: Wrong Password','Whatsapp 5'];
removeCon.forEach(n => delete wf.connections[n]);

// IF Session Valid true → AI Agent
wf.connections['IF Session Valid'] = {
  main: [
    [{ node: 'AI Agent', type: 'main', index: 0 }],          // true
    [{ node: 'Reply Session Expired', type: 'main', index: 0 }] // false
  ]
};

// AI Agent → Google Sheets (fetch token) → Send WhatsApp Reply2
wf.connections['AI Agent'] = {
  main: [[{ node: 'Google Sheets', type: 'main', index: 0 }]]
};

// Subnodes connect TO the AI Agent via special types
wf.connections['Google Gemini Chat Model'] = {
  ai_languageModel: [[{ node: 'AI Agent', type: 'ai_languageModel', index: 0 }]]
};
wf.connections['Postgres Chat Memory'] = {
  ai_memory: [[{ node: 'AI Agent', type: 'ai_memory', index: 0 }]]
};
wf.connections['Query Database'] = {
  ai_tool: [[{ node: 'AI Agent', type: 'ai_tool', index: 0 }]]
};

// ── 6. Send to N8N ──
const payload = {
  name: wf.name,
  nodes: wf.nodes,
  connections: wf.connections,
  settings: { executionOrder: 'v1' },
  staticData: wf.staticData || null
};

const bodyStr = JSON.stringify(payload);
console.log('Nodes:', payload.nodes.length, '| Payload:', bodyStr.length, 'bytes');

const options = {
  hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
  path: `/api/v1/workflows/${WORKFLOW_ID}`,
  method: 'PUT',
  headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', () => {
    if (res.statusCode === 200) {
      const r = JSON.parse(data);
      console.log('✅ Workflow updated! Nodes:', r.nodes?.length);
      console.log('\n⚠️  ACTION REQUIRED:');
      console.log('Go to N8N → workflow editor → click "Google Gemini Chat Model" node');
      console.log('→ Set credential to your "Google Gemini(PaLM) API"');
      console.log('→ Save workflow');
    } else {
      try { console.log('❌', JSON.stringify(JSON.parse(data), null, 2)); }
      catch { console.log('❌', res.statusCode, data.substring(0, 400)); }
    }
  });
});
req.on('error', e => console.error(e.message));
req.write(bodyStr);
req.end();
