"""
Data migration script: SQLite → Supabase (PostgreSQL)

This script reads all data from the local SQLite database and inserts it into Supabase.

Usage:
1. Set up your Supabase project and get the connection string
2. Set DATABASE_URL in .env to your Supabase PostgreSQL URL
3. Run: bun run db:push  (to create tables in Supabase)
4. Run: python3 scripts/migrate_to_supabase.py <sqlite_db_path> <supabase_url>

Example:
  python3 scripts/migrate_to_supabase.py /home/z/my-project/db/custom.db \
    "postgresql://postgres:password@db.xxx.supabase.co:5432/postgres"
"""
import sqlite3
import psycopg2
import sys
import os
from datetime import datetime

SQLITE_PATH = sys.argv[1] if len(sys.argv) > 1 else '/home/z/my-project/db/custom.db'
PG_URL = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('DATABASE_URL', '')

if not PG_URL:
    print('ERROR: Provide Supabase URL as argument or set DATABASE_URL env')
    sys.exit(1)

print(f'Source (SQLite): {SQLITE_PATH}')
print(f'Target (PostgreSQL): {PG_URL[:50]}...')
print()

# Connect to both databases
sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row
pg_conn = psycopg2.connect(PG_URL)
pg_cur = pg_conn.cursor()

# Tables to migrate in order (respecting foreign keys)
TABLES = [
    'Category',
    'DocType',
    'Discipline',
    'Transmittal',
    'Revision',
    'Review',
    'Attachment',
]

# Column names for each table
COLUMNS = {
    'Category': ['id', 'code', 'label', 'icon', 'color', 'createdAt', 'updatedAt'],
    'DocType': ['id', 'code', 'label', 'createdAt', 'updatedAt'],
    'Discipline': ['id', 'code', 'label', 'color', 'prefix', 'categoryCode', 'createdAt', 'updatedAt'],
    'Transmittal': ['id', 'reference', 'discipline', 'disciplineCode', 'category', 'type', 'description', 'createdAt', 'updatedAt'],
    'Revision': ['id', 'transmittalId', 'revNumber', 'submitDate', 'replyDate', 'action', 'approvalType', 'notes', 'createdAt', 'updatedAt'],
    'Review': ['id', 'transmittalId', 'party', 'status', 'submitDate', 'submitRev', 'reviewDate', 'notes', 'createdAt', 'updatedAt'],
    'Attachment': ['id', 'transmittalId', 'fileName', 'filePath', 'fileType', 'fileSize', 'url', 'urlSource', 'createdAt'],
}

total_migrated = 0

for table in TABLES:
    cols = COLUMNS[table]
    col_list = ', '.join(f'"{c}"' for c in cols)
    placeholders = ', '.join(['%s'] * len(cols))

    # Read from SQLite
    try:
        rows = sqlite_conn.execute(f'SELECT {col_list} FROM "{table}"').fetchall()
    except sqlite3.OperationalError:
        print(f'  {table}: table not found, skipping')
        continue

    if not rows:
        print(f'  {table}: 0 rows')
        continue

    # Insert into PostgreSQL
    inserted = 0
    for row in rows:
        values = []
        for col in cols:
            val = row[col]
            # Convert datetime strings
            if col in ('createdAt', 'updatedAt', 'submitDate', 'replyDate', 'reviewDate') and val:
                if isinstance(val, str):
                    try:
                        val = datetime.fromisoformat(val.replace('Z', '+00:00'))
                    except:
                        pass
            values.append(val)

        try:
            pg_cur.execute(
                f'INSERT INTO "{table}" ({col_list}) VALUES ({placeholders}) ON CONFLICT DO NOTHING',
                values
            )
            inserted += 1
        except Exception as e:
            print(f'    ERROR on {table} row {row["id"]}: {e}')
            pg_conn.rollback()
            # Retry without the problematic row
            continue

    pg_conn.commit()
    print(f'  {table}: {inserted}/{len(rows)} rows migrated')
    total_migrated += inserted

print(f'\n✅ Total: {total_migrated} rows migrated to Supabase')

# Verify
for table in TABLES:
    try:
        pg_cur.execute(f'SELECT COUNT(*) FROM "{table}"')
        count = pg_cur.fetchone()[0]
        print(f'  {table}: {count} rows in Supabase')
    except:
        pass

sqlite_conn.close()
pg_conn.close()
