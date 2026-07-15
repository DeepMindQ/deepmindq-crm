#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  DeepMindQ — Free Cloud Setup (Neon PostgreSQL + Vercel)
# ═══════════════════════════════════════════════════════════
# 
# PREREQUISITES:
#   - Node.js 18+
#   - A GitHub account (free)
#   - A Vercel account (free) at https://vercel.com
#   - A Neon account (free) at https://console.neon.tech
#
# ESTIMATED TIME: 5 minutes
# ═══════════════════════════════════════════════════════════

set -e
echo ""
echo "🚀 DeepMindQ — Cloud Setup Guide"
echo "=================================="
echo ""

# ─── Step 1: Neon Database ───
echo "STEP 1: Create a FREE Neon PostgreSQL database"
echo "------------------------------------------------"
echo "1. Go to: https://console.neon.tech/signup"
echo "2. Sign up with GitHub (1 click)"
echo "3. Create a project (name: deepmindq, region: closest to you)"
echo "4. Copy the connection string from the dashboard"
echo "   (looks like: postgresql://neondb_owner:xxx@ep-xxx.neon.tech/neondb?sslmode=require)"
echo ""
read -p "Paste your Neon connection string: " PG_URL

if [ -z "$PG_URL" ]; then
  echo "❌ No connection string provided. Exiting."
  exit 1
fi

export DATABASE_URL="$PG_URL"
export DB_PROVIDER="postgresql"

echo ""
echo "✓ Connection string set"
echo ""

# ─── Step 2: Push Schema to PostgreSQL ───
echo "STEP 2: Create database schema"
echo "--------------------------------"
echo "Running: npx prisma generate && npx prisma db push ..."
echo ""
npx prisma generate
npx prisma db push --skip-generate
echo ""
echo "✓ Schema created in PostgreSQL"
echo ""

# ─── Step 3: Migrate Data ───
echo "STEP 3: Import 40K+ contacts"
echo "------------------------------"
echo "Running: node scripts/migrate-to-postgres.js ..."
echo ""
DB_PROVIDER=postgresql DATABASE_URL="$PG_URL" node scripts/migrate-to-postgres.js
echo ""
echo "✓ Data migrated"
echo ""

# ─── Step 4: Verify ───
echo "STEP 4: Verify data"
echo "--------------------"
DB_PROVIDER=postgresql DATABASE_URL="$PG_URL" node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const [co, ct] = await Promise.all([db.company.count(), db.contact.count()]);
  console.log('  Companies:', co);
  console.log('  Contacts:', ct);
  if (co > 0 && ct > 0) console.log('  ✅ Data verified!');
  else console.log('  ⚠ Data may be incomplete');
  await db.\$disconnect();
})();
"
echo ""

# ─── Step 5: Vercel Setup ───
echo "STEP 5: Deploy to Vercel (FREE)"
echo "--------------------------------"
echo ""
echo "1. Go to: https://vercel.com/new"
echo "2. Import your GitHub repo: DeepMindQ/deepmindq-crm"
echo "3. Add these Environment Variables in Vercel:"
echo ""
echo "   DATABASE_URL = $PG_URL"
echo "   DB_PROVIDER = postgresql"
echo ""
echo "4. Click 'Deploy'"
echo ""
echo "Your app will be live at: https://deepmindq-crm.vercel.app"
echo ""
echo "🎉 DONE! Your DeepMindQ app is live with 40K+ contacts!"