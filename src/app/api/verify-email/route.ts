import { promises as dns } from 'dns';
import { NextResponse } from 'next/server';
import { checkSyntax, checkDisposable, checkRoleBased, checkFreeProvider } from '@/lib/email-verify';

/* ═══════════════════════════════════════════════════
   Email Verification Engine (with DNS MX lookup)
   Works on Vercel — no external API needed.
   ═══════════════════════════════════════════════════ */

interface VerifyResult {
  email: string;
  is_valid: boolean;
  score: number;
  status: 'valid' | 'risky' | 'invalid' | 'unknown';
  checks: {
    syntax: { pass: boolean; detail: string };
    mx_records: { pass: boolean; detail: string; records?: string[] };
    disposable: { pass: boolean; detail: string };
    role_based: { pass: boolean; detail: string };
    free_provider: { pass: boolean; detail: string };
    company_match: { pass: boolean; detail: string };
  };
  recommendation: string;
}

async function checkMXRecords(email: string): Promise<{ pass: boolean; detail: string; records?: string[] }> {
  const domain = email.split('@')[1];
  if (!domain) return { pass: false, detail: 'No domain to check' };

  try {
    const addresses = await dns.resolveMx(domain);
    if (addresses && addresses.length > 0) {
      const records = addresses.map(a => a.exchange).sort();
      return { pass: true, detail: `${addresses.length} MX record(s) found`, records };
    }
    // No MX but might have A record (some domains accept mail via A)
    try {
      await dns.resolve4(domain);
      return { pass: true, detail: 'No MX but A record exists (may accept mail)', records: [] };
    } catch {
      return { pass: false, detail: 'No MX or A records found — domain cannot receive email' };
    }
  } catch {
    // MX lookup failed — try A record as fallback
    try {
      await dns.resolve4(domain);
      return { pass: true, detail: 'MX lookup failed but A record exists', records: [] };
    } catch {
      return { pass: false, detail: 'DNS lookup failed — domain may not exist' };
    }
  }
}

function checkCompanyMatch(email: string, companyDomain?: string): { pass: boolean; detail: string } {
  if (!companyDomain) return { pass: true, detail: 'No company domain to compare' };
  const emailDomain = email.split('@')[1]?.toLowerCase();
  const compDomain = companyDomain.toLowerCase().replace(/^www\./, '');
  if (!emailDomain) return { pass: true, detail: 'No email domain' };
  if (emailDomain === compDomain || emailDomain.endsWith('.' + compDomain)) {
    return { pass: true, detail: `Email domain matches company: ${compDomain}` };
  }
  return { pass: false, detail: `Email domain (${emailDomain}) differs from company (${compDomain})` };
}

export { checkSyntax, checkDisposable, checkRoleBased, checkFreeProvider, checkMXRecords, checkCompanyMatch };
export type { VerifyResult };

/* ═══════════════════════════════════════════════════
   POST /api/verify-email
   Body: { email: string, companyDomain?: string }
   Returns: VerifyResult
   ═══════════════════════════════════════════════════ */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, companyDomain } = body;

    if (!email) {
      return NextResponse.json({ error: 'email is required' }, { status: 400 });
    }

    // Run all checks
    const syntax = checkSyntax(email);
    const disposable = checkDisposable(email);
    const roleBased = checkRoleBased(email);
    const freeProvider = checkFreeProvider(email);
    const companyMatch = checkCompanyMatch(email, companyDomain);
    const mxRecords = await checkMXRecords(email);

    // Calculate overall score
    let score = 0;
    if (syntax.pass) score += 25;
    if (mxRecords.pass) score += 30;
    if (!disposable.pass) score -= 40; else score += 10;
    if (!roleBased.pass) score -= 15; else score += 10;
    if (freeProvider.detail === 'Corporate/custom domain') score += 15;
    if (companyMatch.pass) score += 10;

    score = Math.max(0, Math.min(100, score));

    // Determine status
    let status: VerifyResult['status'] = 'unknown';
    if (!syntax.pass || !mxRecords.pass || !disposable.pass) {
      status = 'invalid';
    } else if (!roleBased.pass || freeProvider.detail.startsWith('Free')) {
      status = 'risky';
    } else {
      status = 'valid';
    }

    // Recommendation
    let recommendation = '';
    if (status === 'invalid') {
      if (!syntax.pass) recommendation = 'Remove — invalid email format';
      else if (!mxRecords.pass) recommendation = 'Remove — domain cannot receive mail';
      else if (!disposable.pass) recommendation = 'Remove — disposable/throwaway email';
    } else if (status === 'risky') {
      if (!roleBased.pass) recommendation = 'Keep but deprioritize — reaches a department, not a person';
      else recommendation = 'Accept — free provider, lower business value';
    } else {
      if (companyMatch.pass) recommendation = 'High priority — corporate email matching company domain';
      else recommendation = 'Good — valid corporate email';
    }

    const result: VerifyResult = {
      email,
      is_valid: status !== 'invalid',
      score,
      status,
      checks: {
        syntax,
        mx_records: mxRecords,
        disposable,
        role_based: roleBased,
        free_provider: freeProvider,
        company_match: companyMatch,
      },
      recommendation,
    };

    return NextResponse.json({ success: true, result });
  } catch (error) {
    console.error('Email verification error:', error);
    return NextResponse.json(
      { error: 'Verification failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/verify-email/bulk
   Body: { emails: string[], companyDomains?: Record<string, string> }
   Returns: { results: VerifyResult[] }
   ═══════════════════════════════════════════════════ */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { emails, companyDomains } = body;

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ error: 'emails array is required' }, { status: 400 });
    }

    if (emails.length > 100) {
      return NextResponse.json({ error: 'Max 100 emails per batch' }, { status: 400 });
    }

    const results: VerifyResult[] = [];
    for (const item of emails) {
      const email = typeof item === 'string' ? item : item.email;
      const companyDomain = typeof item === 'object' ? item.companyDomain : (companyDomains?.[email]);

      const syntax = checkSyntax(email);
      const disposable = checkDisposable(email);
      const roleBased = checkRoleBased(email);
      const freeProvider = checkFreeProvider(email);
      const companyMatch = checkCompanyMatch(email, companyDomain);
      const mxRecords = await checkMXRecords(email);

      let score = 0;
      if (syntax.pass) score += 25;
      if (mxRecords.pass) score += 30;
      if (disposable.pass) score += 10; else score -= 40;
      if (roleBased.pass) score += 10; else score -= 15;
      if (freeProvider.detail === 'Corporate/custom domain') score += 15;
      if (companyMatch.pass) score += 10;
      score = Math.max(0, Math.min(100, score));

      let status: VerifyResult['status'] = 'unknown';
      if (!syntax.pass || !mxRecords.pass || !disposable.pass) status = 'invalid';
      else if (!roleBased.pass || freeProvider.detail.startsWith('Free')) status = 'risky';
      else status = 'valid';

      let recommendation = '';
      if (status === 'invalid') {
        if (!syntax.pass) recommendation = 'Remove — invalid format';
        else if (!mxRecords.pass) recommendation = 'Remove — domain cannot receive mail';
        else recommendation = 'Remove — disposable email';
      } else if (status === 'risky') {
        recommendation = !roleBased.pass ? 'Deprioritize — department address' : 'Accept — free provider';
      } else {
        recommendation = companyMatch.pass ? 'High priority — matches company' : 'Good — valid corporate';
      }

      results.push({
        email,
        is_valid: status !== 'invalid',
        score,
        status,
        checks: { syntax, mx_records: mxRecords, disposable, role_based: roleBased, free_provider: freeProvider, company_match: companyMatch },
        recommendation,
      });
    }

    const summary = {
      total: results.length,
      valid: results.filter(r => r.status === 'valid').length,
      risky: results.filter(r => r.status === 'risky').length,
      invalid: results.filter(r => r.status === 'invalid').length,
      avgScore: Math.round(results.reduce((a, r) => a + r.score, 0) / results.length),
    };

    return NextResponse.json({ success: true, results, summary });
  } catch (error) {
    console.error('Bulk verification error:', error);
    return NextResponse.json(
      { error: 'Bulk verification failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    );
  }
}