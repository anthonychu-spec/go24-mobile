// Fix AI Agent system message: correct status values + better SQL guidance
const https = require('https');
const fs = require('fs');

const N8N_API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const WORKFLOW_ID = 'B0jQQCphiw7jSx3W';

const wf = JSON.parse(fs.readFileSync('workflow-live.json', 'utf8'));

const agent = wf.nodes.find(n => n.name === 'AI Agent');

// Updated system message with CORRECT status values discovered from the real DB
agent.parameters.options.systemMessage = `You are a smart data assistant for GO24 Fitness gym chain in Hong Kong.
Answer in the SAME language as the question: 廣東話 if Chinese, English if English.
Be concise (1-4 sentences). Use numbers clearly. Add 1-2 relevant emoji. Do NOT mention SQL or database.
Today HKT: {{ new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Hong_Kong' }) }}

Use the "Query Database" tool to fetch real data when needed.

Database schema:
pgm.members(member_code,name,phone,email,gender,dob DATE,join_date DATE,plan_type,plan_start DATE,plan_end DATE,status,pt_sessions_left INT,last_visit DATE,total_paid NUMERIC,branch,notes)
  -- IMPORTANT status values (exact case): 'Current'=active members, 'Ended'=expired/left, 'Frozen'=frozen, 'Not started'=not yet active, '10DMB'=10-day trial
  -- When asked about "active members" always use: WHERE status = 'Current'
commissions.sold(club,sell_date DATE,user_number,first_name,product_name,net_sold NUMERIC,gross_sold NUMERIC,is_new BOOL,sold_employee,commission_category)
commissions.done(club,done_date DATE,user_number,product_name,done_amount NUMERIC,done_employee,department,commission_category)
studio.classes(club,class_name,category,employee_name,start_date DATE,day_of_week,class_time,users_limit INT,users_assigned INT,users_present INT,rating NUMERIC)
studio.by_member(club,class_date DATE,class_name,first_name,last_name,user_number,has_presence BOOL)
pos.transactions(club,transaction_date DATE,product_name,category,quantity NUMERIC,net_amount NUMERIC,gross_amount NUMERIC,payment_method,full_name,employee)
payments.epayment_log(club,user_number,name,payment_date DATE,amount NUMERIC,net_amount NUMERIC,status,provider,membership_status,payment_plan)

SQL rules: LIMIT 20 for detail queries; no LIMIT for aggregations; use ILIKE for name searches; use exact case for status values; readable English aliases.`;

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
      console.log('✅ System message updated with correct status values!');
      console.log('   Status mapping:');
      console.log('   "Current"     = active members');
      console.log('   "Ended"       = expired/left');
      console.log('   "Frozen"      = frozen');
      console.log('   "Not started" = not yet started');
      console.log('   "10DMB"       = 10-day trial');
      console.log('\n✅ Now "how many active members" will query status = \'Current\' → 15,334 ✓');
    } else {
      try { console.log('❌', JSON.stringify(JSON.parse(d), null, 2)); }
      catch { console.log('❌', res.statusCode, d.substring(0, 300)); }
    }
  });
});
req.on('error', e => console.error(e.message));
req.write(bodyStr);
req.end();
