#!/usr/bin/env python3
"""PGM Visits in Club → pgm.visits  (matches /opt/gym-import/ pattern)
Usage: python3 import_visits.py <download_url>
"""
import sys, io, requests, pandas as pd
import psycopg2, psycopg2.extras
from datetime import datetime, timedelta

DB = dict(host="127.0.0.1", port=5432, dbname="gym_data",
          user="gym_admin", password="Gym@Admin2026Change")

EXCEL_EPOCH = datetime(1899, 12, 30)

def safe_str(v, maxlen=None):
    if v is None: return None
    try:
        if pd.isna(v): return None
    except: pass
    s = str(v).strip()
    if not s or s.lower() == "nan": return None
    return s[:maxlen] if maxlen else s

def safe_excel_ts(v):
    """PGM Excel serial number → timestamp"""
    if v is None: return None
    try:
        if pd.isna(v): return None
    except: pass
    try:
        return EXCEL_EPOCH + timedelta(days=float(v))
    except:
        try: return pd.to_datetime(v).to_pydatetime()
        except: return None

def safe_num(v):
    if v is None: return None
    try:
        if pd.isna(v): return None
    except: pass
    try: return float(str(v).replace(",","").strip())
    except: return None

def safe_int(v):
    n = safe_num(v)
    return int(n) if n is not None else None

def safe_bool(v):
    if v is None: return None
    try:
        if pd.isna(v): return None
    except: pass
    return str(v).strip() in ("1","True","true","Yes","yes")

def parse_duration(v):
    """ '1:37' -> 97 minutes """
    s = safe_str(v)
    if not s: return None
    try:
        h, m = s.split(":")
        return int(h) * 60 + int(m)
    except:
        return None

SQL_VISITS = """INSERT INTO pgm.visits
  (club,user_number,full_name,enter_date,leave_date,length_of_stay,duration_minutes,
   access_rules,payment_plan,payment_plan_type,membership_status,balance,financial_status,
   gender,email,company_name,contract_discount,is_deleted,deleted_time,deleted_by,
   home_club,age,tags)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
ON CONFLICT (user_number, enter_date, club) DO NOTHING"""

def map_visit(row):
    return (
        safe_str(row.get("Club"), 100),
        safe_str(row.get("User number"), 50),
        safe_str(row.get("Full name"), 200),
        safe_excel_ts(row.get("Enter date")),
        safe_excel_ts(row.get("Leave date")),
        safe_str(row.get("Length of stay"), 20),
        parse_duration(row.get("Length of stay")),
        safe_str(row.get("Access rules"), 100),
        safe_str(row.get("Payment plan"), 200),
        safe_str(row.get("Payment plan type"), 50),
        safe_str(row.get("Membership Status"), 30),
        safe_num(row.get("Balance")),
        safe_str(row.get("Financial status"), 30),
        safe_str(row.get("Gender"), 20),
        safe_str(row.get("Email"), 200),
        safe_str(row.get("Company name"), 200),
        safe_str(row.get("Contract discount"), 200),
        safe_bool(row.get("Is deleted")),
        safe_excel_ts(row.get("Deleted time")),
        safe_str(row.get("Deleted by"), 100),
        safe_str(row.get("Home Club"), 100),
        safe_int(row.get("Age")),
        safe_str(row.get("Tags")),
    )

def batch_insert(cur, conn, df, sql, mapper, label):
    batch, total = [], 0
    for _, row in df.iterrows():
        if pd.isna(row.get("Club")): continue
        batch.append(mapper(row))
        if len(batch) >= 500:
            psycopg2.extras.execute_batch(cur, sql, batch, page_size=500)
            conn.commit()
            total += len(batch)
            print(f"  ...{total} {label}")
            batch = []
    if batch:
        psycopg2.extras.execute_batch(cur, sql, batch, page_size=500)
        conn.commit()
        total += len(batch)
    return total

def main(url):
    print(f"[{datetime.now():%H:%M:%S}] Downloading...")
    r = requests.get(url.strip(), timeout=300)
    r.raise_for_status()
    xl = pd.ExcelFile(io.BytesIO(r.content), engine="openpyxl")

    df = xl.parse("Visits", header=0)
    print(f"[{datetime.now():%H:%M:%S}] Visits sheet: {len(df)} rows")

    conn = psycopg2.connect(**DB)
    cur = conn.cursor()

    # Snapshot count BEFORE (to compute new rows inserted)
    cur.execute("SELECT COUNT(*) FROM pgm.visits")
    before = cur.fetchone()[0]

    # Append with dedup (ON CONFLICT DO NOTHING) — preserves history beyond 2-month window
    n_processed = batch_insert(cur, conn, df, SQL_VISITS, map_visit, "visits")

    cur.execute("SELECT COUNT(*) FROM pgm.visits")
    after = cur.fetchone()[0]
    n_new = after - before

    cur.execute("""INSERT INTO pgm.import_log (source,file_name,rows_total,rows_inserted,finished_at)
                   VALUES (%s,%s,%s,%s,NOW())""",
                ("visits", "Visits_"+datetime.now().strftime("%Y%m%d"), n_processed, n_new))
    conn.commit()
    cur.close()
    conn.close()
    print(f"[{datetime.now():%H:%M:%S}] Done. Processed:{n_processed}  New:{n_new}  Total:{after}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 import_visits.py <url>"); sys.exit(1)
    main(sys.argv[1])
