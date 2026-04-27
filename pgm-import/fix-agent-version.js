const https = require('https');
const fs = require('fs');
const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const wf = JSON.parse(fs.readFileSync('workflow-current2.json', 'utf8'));

// ── Fix 1: AI Agent typeVersion 3.1 → 1.7 (matching working example) ──
const agent = wf.nodes.find(n => n.name === 'AI Agent');
agent.typeVersion = 1.7;
// v1.7 parameters are slightly different from v3.1
agent.parameters = {
  text: "={{ $('Extract Message').first().json.question }}",
  options: {
    systemMessage: `You are a smart data assistant for GO24 Fitness gym chain in Hong Kong.
Answer in the SAME language as the question: 廣東話 if Chinese, English if English.
Be concise (1-4 sentences). Use numbers clearly. Add 1-2 relevant emoji. Do NOT mention SQL or database.
Today HKT: {{ new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' }) }}

Use the "Query Database" tool to fetch real data when needed.

Database schema:
pgm.members(member_code,name,phone,email,gender,dob DATE,join_date DATE,plan_type,plan_start DATE,plan_end DATE,status,pt_sessions_left INT,last_visit DATE,total_paid NUMERIC,branch,notes) -- status: Active,Frozen,Expired,Cancelled
commissions.sold(club,sell_date DATE,user_number,first_name,product_name,net_sold NUMERIC,gross_sold NUMERIC,is_new BOOL,sold_employee,commission_category)
commissions.done(club,done_date DATE,user_number,product_name,done_amount NUMERIC,done_employee,department,commission_category)
studio.classes(club,class_name,category,employee_name,start_date DATE,day_of_week,class_time,users_limit INT,users_assigned INT,users_present INT,rating NUMERIC)
studio.by_member(club,class_date DATE,class_name,first_name,last_name,user_number,has_presence BOOL)
pos.transactions(club,transaction_date DATE,product_name,category,quantity NUMERIC,net_amount NUMERIC,gross_amount NUMERIC,payment_method,full_name,employee)
payments.epayment_log(club,user_number,name,payment_date DATE,amount NUMERIC,net_amount NUMERIC,status,provider,membership_status,payment_plan)

SQL rules: LIMIT 20 for detail queries; no LIMIT for aggregations; name ILIKE for searches; readable English aliases.`
  }
};

// ── Fix 2: memoryBufferWindow instead of memoryPostgresChat ──
// Remove Postgres Chat Memory node
wf.nodes = wf.nodes.filter(n => n.name !== 'Postgres Chat Memory');
delete wf.connections['Postgres Chat Memory'];

// Add Simple Memory (Window Buffer)
wf.nodes.push({
  id: 'simple_memory_1',
  name: 'Simple Memory',
  type: '@n8n/n8n-nodes-langchain.memoryBufferWindow',
  typeVersion: 1.3,
  position: [2400, 960],
  parameters: {
    sessionIdType: 'customKey',
    sessionKey: "={{ $('Extract Message').first().json.from }}",
    contextWindowLength: 5
  }
});

wf.connections['Simple Memory'] = {
  ai_memory: [[{ node: 'AI Agent', type: 'ai_memory', index: 0 }]]
};

console.log('Nodes:', wf.nodes.map(n => n.name + ' v' + n.typeVersion));
console.log('AI Agent version:', agent.typeVersion);

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
  headers: { 'X-N8N-API-KEY': N8N_API_KEY, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) }
};

const req = https.request(options, (res) => {
  let d = ''; res.on('data', c => d += c);
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ Fixed! AI Agent v1.7 + Simple Memory deployed.');
      console.log('Note: Simple Memory resets per execution. For persistent cross-message memory,');
      console.log('we can switch back to Postgres Chat Memory once basic flow works.');
    } else {
      try { console.log('❌', JSON.stringify(JSON.parse(d), null, 2)); }
      catch { console.log('❌', res.statusCode, d.substring(0, 300)); }
    }
  });
});
req.on('error', e => console.error(e.message));
req.write(bodyStr);
req.end();
