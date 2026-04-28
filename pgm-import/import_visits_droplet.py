#!/usr/bin/env python3
"""
PGM Visits in Club → Postgres (pgm.visits)
Standalone import script — run on droplet via cron, or wrap as HTTP endpoint.

Usage:
  python3 import_visits_droplet.py "<PGM_DOWNLOAD_URL>"
  # or set DEFAULT_URL below for testing
"""
import sys
import io
import os
import requests
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from datetime import datetime, timedelta

# ---- Config (override via env vars in production) ----
PG_DSN = os.environ.get(
    "PG_DSN",
    "postgresql://accounts:Accounts@6778@127.0.0.1:5432/gym_data"
)
SHEET_NAME = "Visits"
BATCH = 1000

EXCEL_EPOCH = datetime(1899, 12, 30)


def excel_to_ts(v):
    if v is None or v == "" or pd.isna(v):
        return None
    try:
        n = float(v)
        return EXCEL_EPOCH + timedelta(days=n)
    except Exception:
        return None


def parse_duration(s):
    if not s or pd.isna(s):
        return None
    try:
        h, m = str(s).split(":")
        return int(h) * 60 + int(m)
    except Exception:
        return None


def to_bool(v):
    return str(v).strip().lower() == "true"


def to_int(v):
    if v is None or v == "" or pd.isna(v):
        return None
    try:
        return int(float(v))
    except Exception:
        return None


def to_num(v):
    if v is None or v == "" or pd.isna(v):
        return None
    try:
        return float(v)
    except Exception:
        return None


def txt(v):
    if v is None or v == "" or (isinstance(v, float) and pd.isna(v)):
        return None
    return str(v).strip() or None


def import_visits(url: str) -> dict:
    print(f"[visits] downloading {url}", flush=True)
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    print(f"[visits] downloaded {len(r.content):,} bytes", flush=True)

    xl = pd.ExcelFile(io.BytesIO(r.content), engine="openpyxl")
    if SHEET_NAME not in xl.sheet_names:
        raise RuntimeError(f"Sheet '{SHEET_NAME}' not found. Available: {xl.sheet_names}")

    df = xl.parse(SHEET_NAME)
    print(f"[visits] parsed {len(df):,} rows", flush=True)

    conn = psycopg2.connect(PG_DSN)
    conn.autocommit = False
    cur = conn.cursor()

    # Ensure table exists (idempotent)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS pgm.visits (
          id BIGSERIAL PRIMARY KEY,
          club TEXT, user_number TEXT, full_name TEXT,
          enter_date TIMESTAMP, leave_date TIMESTAMP,
          length_of_stay TEXT, duration_minutes INT,
          access_rules TEXT, payment_plan TEXT, payment_plan_type TEXT,
          membership_status TEXT, balance NUMERIC, financial_status TEXT,
          gender TEXT, email TEXT, company_name TEXT, contract_discount TEXT,
          is_deleted BOOLEAN, deleted_time TIMESTAMP, deleted_by TEXT,
          home_club TEXT, age INT, tags TEXT,
          imported_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(user_number, enter_date, club)
        );
        CREATE INDEX IF NOT EXISTS visits_user_idx  ON pgm.visits(user_number);
        CREATE INDEX IF NOT EXISTS visits_enter_idx ON pgm.visits(enter_date);
        CREATE INDEX IF NOT EXISTS visits_club_idx  ON pgm.visits(club);
        CREATE INDEX IF NOT EXISTS visits_home_idx  ON pgm.visits(home_club);
    """)

    rows = []
    for _, r_ in df.iterrows():
        rows.append((
            txt(r_.get("Club")),
            txt(r_.get("User number")),
            txt(r_.get("Full name")),
            excel_to_ts(r_.get("Enter date")),
            excel_to_ts(r_.get("Leave date")),
            txt(r_.get("Length of stay")),
            parse_duration(r_.get("Length of stay")),
            txt(r_.get("Access rules")),
            txt(r_.get("Payment plan")),
            txt(r_.get("Payment plan type")),
            txt(r_.get("Membership Status")),
            to_num(r_.get("Balance")),
            txt(r_.get("Financial status")),
            txt(r_.get("Gender")),
            txt(r_.get("Email")),
            txt(r_.get("Company name")),
            txt(r_.get("Contract discount")),
            to_bool(r_.get("Is deleted")),
            excel_to_ts(r_.get("Deleted time")),
            txt(r_.get("Deleted by")),
            txt(r_.get("Home Club")),
            to_int(r_.get("Age")),
            txt(r_.get("Tags")),
        ))

    sql = """
        INSERT INTO pgm.visits (
          club, user_number, full_name, enter_date, leave_date,
          length_of_stay, duration_minutes, access_rules, payment_plan,
          payment_plan_type, membership_status, balance, financial_status,
          gender, email, company_name, contract_discount, is_deleted,
          deleted_time, deleted_by, home_club, age, tags
        ) VALUES %s
        ON CONFLICT (user_number, enter_date, club) DO NOTHING
    """

    inserted = 0
    for i in range(0, len(rows), BATCH):
        batch = rows[i : i + BATCH]
        execute_values(cur, sql, batch, page_size=BATCH)
        inserted += cur.rowcount
        if (i // BATCH) % 10 == 0:
            print(f"[visits] {i + len(batch):,}/{len(rows):,} rows", flush=True)

    conn.commit()

    cur.execute("""
        SELECT COUNT(*), MIN(enter_date), MAX(enter_date),
               COUNT(DISTINCT user_number), COUNT(DISTINCT club)
        FROM pgm.visits
    """)
    total, min_d, max_d, members, clubs = cur.fetchone()
    cur.close()
    conn.close()

    result = {
        "status": "ok",
        "rows_processed": len(rows),
        "rows_inserted": inserted,
        "rows_skipped_duplicate": len(rows) - inserted,
        "table_total": total,
        "date_min": str(min_d),
        "date_max": str(max_d),
        "distinct_members": members,
        "distinct_clubs": clubs,
    }
    print(f"[visits] DONE: {result}", flush=True)
    return result


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 import_visits_droplet.py <PGM_DOWNLOAD_URL>", file=sys.stderr)
        sys.exit(1)
    import_visits(sys.argv[1])
