#!/usr/bin/env python3
"""Verify all 4 Neon database connections."""
import psycopg2

urls = {
    "PROD (pooler)": "postgresql://neondb_owner:npg_KEm0tqPp6IOe@ep-square-sound-ad2dx7qw-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require",
    "PROD (direct)": "postgresql://neondb_owner:npg_KEm0tqPp6IOe@ep-square-sound-ad2dx7qw.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require",
    "STAGING (pooler)": "postgresql://neondb_owner:npg_KEm0tqPp6IOe@ep-weathered-term-adrxyf5u-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require",
    "STAGING (direct)": "postgresql://neondb_owner:npg_KEm0tqPp6IOe@ep-weathered-term-adrxyf5u.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require",
}

print("=" * 70)
print("  NEON POSTGRESQL CONNECTIVITY VERIFICATION")
print("=" * 70)

for label, url in urls.items():
    try:
        conn = psycopg2.connect(url, connect_timeout=10)
        cur = conn.cursor()
        cur.execute("SELECT version()")
        ver = cur.fetchone()[0][:50]
        cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
        tables = cur.fetchone()[0]
        cur.execute("SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = '_prisma_migrations')")
        has_migrations = cur.fetchone()[0]
        migrations = []
        if has_migrations:
            cur.execute("SELECT migration_name FROM _prisma_migrations ORDER BY started_at")
            migrations = [r[0] for r in cur.fetchall()]
        conn.close()
        mig_str = ", ".join(migrations) if migrations else "NONE"
        print(f"\n  {label}")
        print(f"    Status:    CONNECTED")
        print(f"    Version:   {ver}")
        print(f"    Tables:    {tables}")
        print(f"    Migrations: {mig_str}")
    except Exception as e:
        print(f"\n  {label}")
        print(f"    Status:    FAILED")
        print(f"    Error:     {e}")

print("\n" + "=" * 70)
