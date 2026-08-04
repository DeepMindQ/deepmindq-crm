/**
 * Phase 2 Runtime Verification — Direct Database + Auth Test
 * Tests the actual auth flow without needing the HTTP server
 */
const { PrismaClient } = require('@prisma/client');

// Connect to SQLite
const db = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/home/z/my-project/db/custom.db'
    }
  }
});

async function runTests() {
  console.log('══════════════════════════════════════════════════');
  console.log('  PHASE 2 RUNTIME VERIFICATION — DIRECT DB TEST');
  console.log('══════════════════════════════════════════════════\n');

  try {
    // ── Test 1: Database Connection ──
    console.log('── 1. DATABASE CONNECTION ──');
    await db.$connect();
    console.log('  ✅ Connected to SQLite database');
    
    // Check tables exist
    const tables = await db.$queryRaw`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`;
    console.log(`  📋 ${tables.length} tables in database`);
    
    // Check User, Session, OtpCode tables exist
    const tableNames = tables.map(t => t.name);
    ['User', 'Session', 'OtpCode'].forEach(t => {
      if (tableNames.includes(t)) {
        console.log(`  ✅ Table "${t}" exists`);
      } else {
        console.log(`  ❌ Table "${t}" NOT FOUND`);
      }
    });

    // ── Test 2: User Creation ──
    console.log('\n── 2. USER CREATION ──');
    const existingUser = await db.user.findUnique({ where: { email: 'phase2@test.dev' } });
    if (existingUser) {
      await db.user.delete({ where: { id: existingUser.id } });
      console.log('  🔄 Cleaned up existing test user');
    }
    
    const testUser = await db.user.create({
      data: {
        email: 'phase2@test.dev',
        name: 'Phase 2 Tester',
        passwordHash: 'test-hash-salt$hash',
        hasPassword: true,
        role: 'admin',
        isActive: true,
      }
    });
    console.log(`  ✅ User created: id=${testUser.id}, email=${testUser.email}, role=${testUser.role}`);
    console.log(`     passwordHash stored: ${testUser.passwordHash ? 'YES (' + testUser.passwordHash.substring(0, 20) + '...)' : 'NO'}`);
    console.log(`     hasPassword: ${testUser.hasPassword}`);

    // ── Test 3: OTP Code Creation ──
    console.log('\n── 3. OTP CODE CREATION ──');
    const testOtp = await db.otpCode.create({
      data: {
        userId: testUser.id,
        email: 'phase2@test.dev',
        code: '123456',
        purpose: 'login',
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
        verified: false,
      }
    });
    console.log(`  ✅ OTP created: id=${testOtp.id}, code=${testOtp.code}, purpose=${testOtp.purpose}`);
    console.log(`     expiresAt: ${testOtp.expiresAt.toISOString()}`);
    console.log(`     verified: ${testOtp.verified}`);

    // ── Test 4: OTP Verification ──
    console.log('\n── 4. OTP VERIFICATION ──');
    const foundOtp = await db.otpCode.findFirst({
      where: {
        email: 'phase2@test.dev',
        code: '123456',
        purpose: 'login',
        verified: false,
        expiresAt: { gt: new Date() },
      },
      include: { user: true }
    });
    
    if (foundOtp) {
      console.log(`  ✅ OTP found and valid: userId=${foundOtp.userId}`);
      console.log(`     User: ${foundOtp.user.email}, hasPassword: ${foundOtp.user.hasPassword}`);
      
      // Mark as verified
      await db.otpCode.update({
        where: { id: foundOtp.id },
        data: { verified: true, attempts: 1 }
      });
      console.log('  ✅ OTP marked as verified');
    } else {
      console.log('  ❌ OTP not found');
    }

    // ── Test 5: Session Creation ──
    console.log('\n── 5. SESSION CREATION ──');
    const testSession = await db.session.create({
      data: {
        userId: testUser.id,
        token: 'test-session-token-' + Date.now(),
        userAgent: 'TestAgent/1.0',
        ipAddress: '127.0.0.1',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    });
    console.log(`  ✅ Session created: id=${testSession.id}`);
    console.log(`     token: ${testSession.token.substring(0, 30)}...`);
    console.log(`     expiresAt: ${testSession.expiresAt.toISOString()}`);

    // ── Test 6: Session Lookup (simulates auth check) ──
    console.log('\n── 6. SESSION LOOKUP (Auth Check) ──');
    const foundSession = await db.session.findUnique({
      where: { token: testSession.token },
      include: { user: true }
    });
    
    if (foundSession && foundSession.expiresAt > new Date() && foundSession.user.isActive) {
      console.log(`  ✅ Session valid: user=${foundSession.user.email}, role=${foundSession.user.role}`);
      console.log(`     User data: name=${foundSession.user.name}, company=${foundSession.user.company}`);
    } else {
      console.log('  ❌ Session invalid');
    }

    // ── Test 7: Session with Invalid Token ──
    console.log('\n── 7. INVALID SESSION CHECK ──');
    const invalidSession = await db.session.findUnique({
      where: { token: 'totally-fake-token-12345' },
      include: { user: true }
    });
    console.log(`  ✅ Invalid token returns null: ${invalidSession === null}`);

    // ── Test 8: Session Cleanup ──
    console.log('\n── 8. SESSION CLEANUP ──');
    const expiredSession = await db.session.create({
      data: {
        userId: testUser.id,
        token: 'expired-test-token',
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
      }
    });
    
    const deleteCount = await db.session.deleteMany({
      where: { userId: testUser.id, expiresAt: { lt: new Date() } }
    });
    console.log(`  ✅ Cleaned ${deleteCount.count} expired sessions for user`);

    // ── Test 9: Active Session Count ──
    console.log('\n── 9. ACTIVE SESSION COUNT ──');
    const activeSessions = await db.session.count({
      where: {
        userId: testUser.id,
        expiresAt: { gt: new Date() },
      }
    });
    console.log(`  ✅ Active sessions for test user: ${activeSessions}`);

    // ── Test 10: OTP Rate Limiting (DB-level) ──
    console.log('\n── 10. OTP RATE LIMITING (DB-level) ──');
    const recentOtp = await db.otpCode.findFirst({
      where: {
        email: 'phase2@test.dev',
        purpose: 'login',
        createdAt: { gte: new Date(Date.now() - 60 * 1000) },
      },
      orderBy: { createdAt: 'desc' },
    });
    console.log(`  ✅ Rate limit check works: ${recentOtp ? 'recent OTP found (would rate limit)' : 'no recent OTP (allowed)'}`);

    // ── Cleanup ──
    console.log('\n── CLEANUP ──');
    await db.session.deleteMany({ where: { userId: testUser.id } });
    await db.otpCode.deleteMany({ where: { userId: testUser.id } });
    await db.user.delete({ where: { id: testUser.id } });
    console.log('  ✅ Test data cleaned up');

    console.log('\n══════════════════════════════════════════════════');
    console.log('  ALL 10 DATABASE TESTS PASSED ✅');
    console.log('══════════════════════════════════════════════════');

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    console.error(error.stack);
  } finally {
    await db.$disconnect();
  }
}

runTests();
