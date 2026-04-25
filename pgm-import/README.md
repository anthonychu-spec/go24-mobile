# Perfect Gym — PGM Data + WhatsApp AI Bot

## 架構
```
PGM daily email (with XLS link)
      │
      ▼
N8N Workflow 1: Daily Import  ──►  Postgres (gym_members)
                                   Postgres (gym_sales)     ← 其他 source
                                   Postgres (gym_pt)
                                           │
老闆 WhatsApp ──► N8N Workflow 2: AI Bot ──┘
                  (Claude + 3 DB tools)
                         │
                         ▼
                  回覆 WhatsApp
```

## Files
- `schema.sql` — Postgres `members` + `import_log` schema
- `workflow-daily-import.json` — import PGM XLS 每日
- `workflow-whatsapp-ai-bot.json` — 老闆用 WhatsApp 問嘢

---

## Setup steps

### 1. Postgres
```bash
sudo -u postgres createdb gym_members
sudo -u postgres psql gym_members < schema.sql

# 以後每個 data source 一個 DB（或者 schema），e.g.
sudo -u postgres createdb gym_sales
sudo -u postgres createdb gym_pt
```

### 2. N8N credentials（喺 N8N UI 入面開）
| Credential | 用途 |
|---|---|
| Gmail OAuth2 | 收 PGM email |
| Postgres (gym_members) | UPSERT + 查 members |
| Postgres (gym_sales) | 查銷售 |
| Postgres (gym_pt) | 查 PT |
| WhatsApp Business Cloud | 收 + send message |
| Anthropic API | Claude |

### 3. Import workflow
- Import `workflow-daily-import.json`
- Replace 所有 `REPLACE_*` placeholder
- 改 `Gmail: fetch PGM email` 入面嘅 `q:` filter，match 你真實 PGM email 嘅 sender / subject
- 改 `Extract download link` 個 regex（如果 PGM 個 link format 特別）
- 改 `Clean & map columns` 入面嘅 column name（match 你個 XLS 真實 header）
- 先手動 Execute 一次睇結果 → OK 先 Activate schedule

### 4. WhatsApp bot workflow
- Import `workflow-whatsapp-ai-bot.json`
- Webhook URL 填入 Meta WhatsApp Business Cloud API 嘅 callback
- `IF: authorized phone` 入面填老闆 + 你嘅號碼
- 3 個 `Tool: query_*` node 要分別駁唔同嘅 Postgres credential
  - ⚠️ **加 SQL safeguard**：每個 tool 入面加 Code node，reject 非 SELECT
- System prompt 已經寫好跨 DB 查詢 logic，可以直接用

### 5. SQL safeguard snippet（放喺每個 query tool 最前）
```js
const sql = $input.first().json.sql || '';
if (!/^\s*SELECT\s/i.test(sql)) throw new Error('Only SELECT allowed');
if (/\b(DROP|DELETE|UPDATE|INSERT|ALTER|TRUNCATE|CREATE|GRANT)\b/i.test(sql))
  throw new Error('Dangerous SQL keyword');
return [{ json: { sql } }];
```

另外喺 Postgres connection 用 **read-only user**：
```sql
CREATE USER n8n_reader WITH PASSWORD 'xxx';
GRANT CONNECT ON DATABASE gym_members TO n8n_reader;
GRANT USAGE ON SCHEMA public TO n8n_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO n8n_reader;
```

---

## 跨 DB 查詢點 work

Claude 會自己拆 step。例如老闆問：

> 「今個月到期嘅會員入面，邊個仲有 PT session 未用？」

Claude 做：
1. Call `query_members`: `SELECT member_code, name FROM members WHERE plan_end BETWEEN '2026-04-01' AND '2026-04-30' AND status='active'`
2. 攞到 list of codes → call `query_pt`: `SELECT member_code, sessions_total - sessions_used AS remaining FROM pt_agreements WHERE member_code IN ('M001','M002',...) AND sessions_total > sessions_used`
3. 腦入面 merge → 回覆「有 8 個：Peter (5 堂), Mary (3 堂)...」

Limit：
- 每個 tool 每次最多 return ~500 rows（Claude context 限制）
- 跨 DB JOIN 大數據 → 要預先喺 N8N 建 aggregated table，或者用 Postgres `postgres_fdw` 將 2 個 DB link 埋一齊

---

## 成本
- Claude Sonnet 4.6 + prompt caching: ~$0.01/問
- 50 問/日 ≈ **$15 USD/月**
- N8N + Postgres 都 self-host，$0

---

## Roadmap
- [ ] 加 `query_attendance` tool（check-in 紀錄）
- [ ] 每朝 auto push 日報（expiring members, yesterday sales）
- [ ] Log 所有問題到 `qa_log` table，方便 review
- [ ] 加 chart generator（畫圖發返 WhatsApp）
