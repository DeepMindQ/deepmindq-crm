/**
 * One-off script: delete broken admin@deepmindq.com user, register new user
 * with shanker001@gmail.com, and trigger a fresh OTP via the live Vercel API.
 */
const { PrismaClient } = require('@prisma/client');

const DATABASE_URL = 'postgresql://neondb_owner:npg_KEm0tqPp6IOe@ep-square-sound-ad2dx7qw-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';
process.env.DATABASE_URL = DATABASE_URL;

const db = new PrismaClient();

async function main() {
  // 1. Delete the broken admin@deepmindq.com user
  console.log('=== Step 1: Deleting broken admin@deepmindq.com user ===');
  const delOtp1 = await db.otpCode.deleteMany({ where: { email: 'admin@deepmindq.com' } }).catch(() => ({ count: 0 }));
  const delUser1 = await db.user.deleteMany({ where: { email: 'admin@deepmindq.com' } }).catch(() => ({ count: 0 }));
  console.log(`  Deleted OTPs: ${delOtp1.count}, users: ${delUser1.count}`);

  // 2. Clear any old shanker001@gmail.com OTPs (rate-limit reset)
  console.log('\n=== Step 2: Clearing old shanker001@gmail.com OTPs ===');
  const delOtp2 = await db.otpCode.deleteMany({ where: { email: 'shanker001@gmail.com' } }).catch(() => ({ count: 0 }));
  console.log(`  Deleted OTPs: ${delOtp2.count}`);

  // 3. Delete any existing shanker001 user (so registration is fresh)
  console.log('\n=== Step 3: Deleting any existing shanker001@gmail.com user ===');
  const delUser2 = await db.user.deleteMany({ where: { email: 'shanker001@gmail.com' } }).catch(() => ({ count: 0 }));
  console.log(`  Deleted users: ${delUser2.count}`);

  await db.$disconnect();
  console.log('\n✓ Database cleanup complete');
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
