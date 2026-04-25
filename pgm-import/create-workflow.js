const https = require('https');

const wf = {
  name: 'GO24 WhatsApp AI Bot',
  nodes: [
    {
      parameters: { httpMethod: 'POST', path: 'go24-bot', responseMode: 'responseNode', options: {} },
      id: 'n01', name: 'WhatsApp Webhook', type: 'n8n-nodes-base.webhook', typeVersion: 2, position: [260, 300]
    },
    {
      parameters: { respondWith: 'text', responseBody: 'OK', options: { responseCode: 200 } },
      id: 'n02', name: 'Respond 200 OK', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [480, 300]
    },
    {
      parameters: {
        jsCode: [
          'const body = $input.first().json.body || {};',
          'const value = body.entry?.[0]?.changes?.[0]?.value;',
          'const messages = value?.messages;',
          'if (!messages || !messages[0]) return [];',
          'const msg = messages[0];',
          'if (msg.type !== "text") return [];',
          'const from = msg.from;',
          'const rawText = (msg.text?.body || "").trim();',
          'const PASSWORD = "6778";',
          'let authenticated = false, question = "";',
          'if (rawText === PASSWORD) { authenticated = true; question = "__HELP__"; }',
          'else if (rawText.startsWith(PASSWORD + " ")) { authenticated = true; question = rawText.slice(PASSWORD.length + 1).trim(); }',
          'else { authenticated = false; question = rawText; }',
          'return [{ json: { from, messageId: msg.id, rawText, question, authenticated } }];'
        ].join('\n')
      },
      id: 'n03', name: 'Extract Message', type: 'n8n-nodes-base.code', typeVersion: 2, position: [700, 300]
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [{ id: 'c1', leftValue: '={{ $json.from }}', rightValue: '85261172810', operator: { type: 'string', operation: 'equals' } }],
          combinator: 'and'
        },
        options: {}
      },
      id: 'n04', name: 'IF: From Boss', type: 'n8n-nodes-base.if', typeVersion: 2, position: [920, 300]
    },
    {
      parameters: {
        operation: 'read',
        documentId: { __rl: true, value: '1w-1SC4sSQpFwoJH6ux35UYY4drOtitz0PqV3m5cf7XI', mode: 'id' },
        sheetName: { __rl: true, value: 'gid=0', mode: 'id' },
        options: {}
      },
      id: 'n05', name: 'Get WhatsApp Token', type: 'n8n-nodes-base.googleSheets', typeVersion: 4.5, position: [1140, 220],
      credentials: { googleSheetsOAuth2Api: { id: '0XbB4tqamwjFQ6RO', name: 'Google Sheets account 6' } }
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: false, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [{ id: 'c2', leftValue: '={{ $("Extract Message").first().json.authenticated }}', rightValue: true, operator: { type: 'boolean', operation: 'true' } }],
          combinator: 'and'
        },
        options: {}
      },
      id: 'n06', name: 'IF: Password OK', type: 'n8n-nodes-base.if', typeVersion: 2, position: [1360, 220]
    },
    {
      parameters: {
        method: 'POST', url: 'https://graph.facebook.com/v22.0/793508627177133/messages',
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: 'Authorization', value: '=Bearer {{ $("Get WhatsApp Token").first().json["Access Token"] }}' },
          { name: 'Content-Type', value: 'application/json' }
        ]},
        sendBody: true, specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ messaging_product: "whatsapp", to: $("Extract Message").first().json.from, type: "text", text: { body: "❌ 請先輸入密碼再問問題\\n例如：6778 依家有幾多個 active member?" } }) }}',
        options: {}
      },
      id: 'n07', name: 'Reply: Wrong Password', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1580, 420]
    },
    {
      parameters: {
        conditions: {
          options: { caseSensitive: true, leftValue: '', typeValidation: 'loose', version: 2 },
          conditions: [{ id: 'c3', leftValue: '={{ $("Extract Message").first().json.question }}', rightValue: '__HELP__', operator: { type: 'string', operation: 'equals' } }],
          combinator: 'and'
        },
        options: {}
      },
      id: 'n08', name: 'IF: Help Menu', type: 'n8n-nodes-base.if', typeVersion: 2, position: [1580, 220]
    },
    {
      parameters: {
        method: 'POST', url: 'https://graph.facebook.com/v22.0/793508627177133/messages',
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: 'Authorization', value: '=Bearer {{ $("Get WhatsApp Token").first().json["Access Token"] }}' },
          { name: 'Content-Type', value: 'application/json' }
        ]},
        sendBody: true, specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ messaging_product: "whatsapp", to: $("Extract Message").first().json.from, type: "text", text: { body: "✅ 密碼正確！歡迎使用 GO24 數據查詢\\n\\n用法：6778 + 問題\\n\\n📊 可以問嘅嘢：\\n• 依家有幾多個 active member?\\n• 今個月 POS 收入幾多?\\n• 邊個分店會員最多?\\n• 今日有幾多堂 studio class?\\n• 最近 join 嘅 10 個 member?" } }) }}',
        options: {}
      },
      id: 'n09', name: 'Reply: Help Menu', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [1800, 120]
    },
    {
      parameters: {
        jsCode: [
          'const question = $("Extract Message").first().json.question;',
          'const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Hong_Kong" });',
          'const sp = `You are a SQL expert for GO24 Fitness gym chain in Hong Kong. Generate ONE PostgreSQL SELECT query. Return ONLY raw SQL, no markdown, no explanation.\\n\\nToday HKT: ${today}\\n\\npgm.members(member_code,name,phone,email,gender,dob DATE,join_date DATE,plan_type,plan_start DATE,plan_end DATE,status VARCHAR,pt_sessions_left INT,last_visit DATE,total_paid NUMERIC,branch,notes) status:Active,Frozen,Expired,Cancelled\\ncommissions.sold(club,sell_date DATE,user_number,first_name,product_name,net_sold NUMERIC,gross_sold NUMERIC,is_new BOOL,sold_employee,commission_category)\\ncommissions.done(club,done_date DATE,user_number,product_name,done_amount NUMERIC,done_employee,department,commission_category)\\nstudio.classes(club,class_name,category,employee_name,start_date DATE,day_of_week,class_time,users_limit INT,users_assigned INT,users_present INT,rating NUMERIC)\\nstudio.by_member(club,class_date DATE,class_name,first_name,last_name,user_number,has_presence BOOL)\\npos.transactions(club,transaction_date DATE,product_name,category,quantity NUMERIC,net_amount NUMERIC,gross_amount NUMERIC,payment_method,full_name,employee)\\npayments.epayment_log(club,user_number,name,payment_date DATE,amount NUMERIC,net_amount NUMERIC,status,provider,membership_status,payment_plan)\\nRules: LIMIT 20 detail queries; no limit aggregations; name ILIKE; readable English aliases`;',
          'return [{ json: { geminiBody: JSON.stringify({ systemInstruction: { parts: [{ text: sp }] }, contents: [{ role: "user", parts: [{ text: question }] }], generationConfig: { maxOutputTokens: 600, temperature: 0.1 } }), question } }];'
        ].join('\n')
      },
      id: 'n10', name: 'Build SQL Request', type: 'n8n-nodes-base.code', typeVersion: 2, position: [1800, 300]
    },
    {
      parameters: {
        method: 'POST',
        url: '=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=REPLACE_GEMINI_API_KEY',
        sendHeaders: true, headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
        sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.geminiBody }}', options: { timeout: 30000 }
      },
      id: 'n11', name: 'Gemini: Generate SQL', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [2020, 300]
    },
    {
      parameters: {
        jsCode: [
          'const r = $input.first().json;',
          'let sql = r.candidates?.[0]?.content?.parts?.[0]?.text || "";',
          'sql = sql.replace(/```sql/gi, "").replace(/```/g, "").trim();',
          'if (!sql.toUpperCase().startsWith("SELECT")) throw new Error("Non-SELECT: " + sql.slice(0, 100));',
          'return [{ json: { sql, question: $("Build SQL Request").first().json.question } }];'
        ].join('\n')
      },
      id: 'n12', name: 'Extract SQL', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2240, 300]
    },
    {
      parameters: { operation: 'executeQuery', query: '={{ $json.sql }}', options: {} },
      id: 'n13', name: 'Query Postgres', type: 'n8n-nodes-base.postgres', typeVersion: 2.4, position: [2460, 300],
      credentials: { postgres: { id: 'BdWjFTVmkC8DZtSo', name: 'Postgres account' } }
    },
    {
      parameters: {
        jsCode: [
          'const results = $input.all().map(i => i.json);',
          'const question = $("Extract SQL").first().json.question;',
          'const sp2 = "You are a helpful assistant for GO24 Fitness in Hong Kong. Reply in the same language as the question (Cantonese or English). Be brief (1-4 sentences). Use numbers clearly. Add 1-2 relevant emoji. Do NOT mention SQL or database.";',
          'const userContent = `Question: ${question}\\n\\nData (${results.length} rows):\\n${JSON.stringify(results, null, 2)}`;',
          'return [{ json: { geminiBody: JSON.stringify({ systemInstruction: { parts: [{ text: sp2 }] }, contents: [{ role: "user", parts: [{ text: userContent }] }], generationConfig: { maxOutputTokens: 400, temperature: 0.7 } }) } }];'
        ].join('\n')
      },
      id: 'n14', name: 'Build Answer Request', type: 'n8n-nodes-base.code', typeVersion: 2, position: [2680, 300]
    },
    {
      parameters: {
        method: 'POST',
        url: '=https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=REPLACE_GEMINI_API_KEY',
        sendHeaders: true, headerParameters: { parameters: [{ name: 'Content-Type', value: 'application/json' }] },
        sendBody: true, specifyBody: 'json', jsonBody: '={{ $json.geminiBody }}', options: { timeout: 30000 }
      },
      id: 'n15', name: 'Gemini: Format Answer', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [2900, 300]
    },
    {
      parameters: {
        jsCode: [
          'const r = $input.first().json;',
          'const answer = r.candidates?.[0]?.content?.parts?.[0]?.text || "唔好意思，暫時無法回答。";',
          'return [{ json: { answer, to: $("Extract Message").first().json.from } }];'
        ].join('\n')
      },
      id: 'n16', name: 'Extract Answer', type: 'n8n-nodes-base.code', typeVersion: 2, position: [3120, 300]
    },
    {
      parameters: {
        method: 'POST', url: 'https://graph.facebook.com/v22.0/793508627177133/messages',
        sendHeaders: true,
        headerParameters: { parameters: [
          { name: 'Authorization', value: '=Bearer {{ $("Get WhatsApp Token").first().json["Access Token"] }}' },
          { name: 'Content-Type', value: 'application/json' }
        ]},
        sendBody: true, specifyBody: 'json',
        jsonBody: '={{ JSON.stringify({ messaging_product: "whatsapp", to: $json.to, type: "text", text: { body: $json.answer } }) }}',
        options: {}
      },
      id: 'n17', name: 'Send WhatsApp Reply', type: 'n8n-nodes-base.httpRequest', typeVersion: 4.2, position: [3340, 300]
    }
  ],
  connections: {
    'WhatsApp Webhook':     { main: [[{ node: 'Respond 200 OK',        type: 'main', index: 0 }]] },
    'Respond 200 OK':       { main: [[{ node: 'Extract Message',        type: 'main', index: 0 }]] },
    'Extract Message':      { main: [[{ node: 'IF: From Boss',          type: 'main', index: 0 }]] },
    'IF: From Boss':        { main: [[{ node: 'Get WhatsApp Token',     type: 'main', index: 0 }], []] },
    'Get WhatsApp Token':   { main: [[{ node: 'IF: Password OK',        type: 'main', index: 0 }]] },
    'IF: Password OK':      { main: [[{ node: 'IF: Help Menu',          type: 'main', index: 0 }], [{ node: 'Reply: Wrong Password', type: 'main', index: 0 }]] },
    'IF: Help Menu':        { main: [[{ node: 'Reply: Help Menu',       type: 'main', index: 0 }], [{ node: 'Build SQL Request', type: 'main', index: 0 }]] },
    'Build SQL Request':    { main: [[{ node: 'Gemini: Generate SQL',   type: 'main', index: 0 }]] },
    'Gemini: Generate SQL': { main: [[{ node: 'Extract SQL',            type: 'main', index: 0 }]] },
    'Extract SQL':          { main: [[{ node: 'Query Postgres',         type: 'main', index: 0 }]] },
    'Query Postgres':       { main: [[{ node: 'Build Answer Request',   type: 'main', index: 0 }]] },
    'Build Answer Request': { main: [[{ node: 'Gemini: Format Answer',  type: 'main', index: 0 }]] },
    'Gemini: Format Answer':{ main: [[{ node: 'Extract Answer',         type: 'main', index: 0 }]] },
    'Extract Answer':       { main: [[{ node: 'Send WhatsApp Reply',    type: 'main', index: 0 }]] }
  },
  settings: { executionOrder: 'v1' }
};

const N8N_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxOWE2NTNkYy1lZmZhLTQyMjAtOGIxNC04NjY0ZjM5MTM5NDkiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiNDM3ZjM3ZjQtMmU2Yy00NzhmLWI0MWQtYTgyM2IzYTRmYTU3IiwiaWF0IjoxNzc2ODIyNTY0fQ.EY8Bf6i6tEVfQWFhaSXulT4-ETY0Zc8upSj-R4acoAQ';
const body = JSON.stringify(wf);

const options = {
  hostname: 'n8n-app-do-d9hvm.ondigitalocean.app',
  path: '/api/v1/workflows',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-N8N-API-KEY': N8N_KEY,
    'Content-Length': Buffer.byteLength(body)
  }
};

const req = https.request(options, res => {
  let data = '';
  res.on('data', d => data += d);
  res.on('end', () => {
    try {
      const result = JSON.parse(data);
      if (result.id) {
        console.log('✅ SUCCESS! Workflow created.');
        console.log('ID:', result.id);
        console.log('Name:', result.name);
        console.log('URL: https://n8n-app-do-d9hvm.ondigitalocean.app/workflow/' + result.id);
      } else {
        console.log('Response:', JSON.stringify(result).substring(0, 800));
      }
    } catch(e) {
      console.log('Raw:', data.substring(0, 500));
    }
  });
});
req.on('error', e => console.error('ERROR:', e.message));
req.write(body);
req.end();
