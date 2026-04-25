#!/usr/bin/env python3
"""
PGM All_Members → pgm.members (Postgres)
用法:
  python3 import_members.py "https://go24fitness-hk.perfectgym.com/Api/Reports/Download/All_Members/..."
"""

import sys, io, requests, pandas as pd
import psycopg2, psycopg2.extras
from datetime import datetime

# ── DB 連線 ────────────────────────────────────────────────
DB = dict(host="127.0.0.1", port=5432, dbname="gym_data",
          user="gym_admin", password="Gym@Admin2026Change")

# ── 欄位 mapping（已根據真實 column 名 tune 好）────────────
def safe_str(v):
    if pd.isna(v): return None
    s = str(v).strip()
    return s if s and s.lower() != 'nan' else None

def safe_date(v):
    if pd.isna(v): return None
    try:
        return pd.to_datetime(v).strftime('%Y-%m-%d')
    except:
        return None

def safe_num(v):
    if pd.isna(v): return None
    try:
        return float(str(v).replace('$','').replace(',','').strip())
    except:
        return None

def map_row(row):
    return (
        safe_str(row.get('User number')),           # member_code
        safe_str(row.get('Full name')),              # name
        safe_str(row.get('PhoneMobile')) or
          safe_str(row.get('Phone')),                # phone
        safe_str(row.get('Email')),                  # email
        safe_str(row.get('Gender')),                 # gender
        safe_date(row.get('Birth date')),            # dob
        safe_date(row.get('Signup date')) or
          safe_date(row.get('Created date')),        # join_date
        safe_str(row.get('Payment Plan Name')),      # plan_type
        safe_date(row.get('Start date')),            # plan_start
        safe_date(row.get('End date')),              # plan_end
        safe_str(row.get('Membership Status')) or
          safe_str(row.get('Status')),               # status
        0,                                           # pt_sessions_left (not in this report)
        safe_date(row.get('Last visit')),            # last_visit
        safe_num(row.get('Membership fee')),         # total_paid
        safe_str(row.get('Club')),                   # branch
        safe_str(row.get('Cancel reason')),          # notes
    )

# ── UPSERT SQL ─────────────────────────────────────────────
UPSERT = """
INSERT INTO pgm.members (
  member_code, name, phone, email, gender, dob, join_date,
  plan_type, plan_start, plan_end, status, pt_sessions_left,
  last_visit, total_paid, branch, notes
) VALUES (
  %s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s
)
ON CONFLICT (member_code) DO UPDATE SET
  name             = EXCLUDED.name,
  phone            = EXCLUDED.phone,
  email            = EXCLUDED.email,
  gender           = EXCLUDED.gender,
  dob              = EXCLUDED.dob,
  join_date        = EXCLUDED.join_date,
  plan_type        = EXCLUDED.plan_type,
  plan_start       = EXCLUDED.plan_start,
  plan_end         = EXCLUDED.plan_end,
  status           = EXCLUDED.status,
  last_visit       = EXCLUDED.last_visit,
  total_paid       = EXCLUDED.total_paid,
  branch           = EXCLUDED.branch,
  notes            = EXCLUDED.notes,
  updated_at       = NOW()
"""

def main(url):
    print(f"[{datetime.now():%H:%M:%S}] Downloading...")
    r = requests.get(url, timeout=180)
    r.raise_for_status()

    print(f"[{datetime.now():%H:%M:%S}] Parsing Excel ({len(r.content)//1024//1024}MB)...")
    df = pd.read_excel(io.BytesIO(r.content), engine='openpyxl')
    print(f"[{datetime.now():%H:%M:%S}] {len(df)} rows loaded")

    conn = psycopg2.connect(**DB)
    cur  = conn.cursor()

    batch, total, skipped = [], 0, 0
    BATCH_SIZE = 500

    for _, row in df.iterrows():
        rec = map_row(row)
        if not rec[0]:   # skip rows without member_code
            skipped += 1
            continue
        batch.append(rec)

        if len(batch) >= BATCH_SIZE:
            psycopg2.extras.execute_batch(cur, UPSERT, batch, page_size=BATCH_SIZE)
            conn.commit()
            total += len(batch)
            print(f"  ...{total} rows done")
            batch = []

    if batch:
        psycopg2.extras.execute_batch(cur, UPSERT, batch, page_size=BATCH_SIZE)
        conn.commit()
        total += len(batch)

    # log
    cur.execute("""
        INSERT INTO pgm.import_log (source, file_name, rows_total, rows_inserted, finished_at)
        VALUES (%s, %s, %s, %s, NOW())
    """, ('pgm_all_members', 'All_Members_' + datetime.now().strftime('%Y%m%d'), total, total))
    conn.commit()
    cur.close(); conn.close()

    print(f"[{datetime.now():%H:%M:%S}] ✅ Done! {total} rows UPSERT, {skipped} skipped")

if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 import_members.py <download_url>")
        sys.exit(1)
    main(sys.argv[1])
