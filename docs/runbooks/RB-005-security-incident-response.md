# RB-005: Security Incident Response

**Severity**: SEV1
**Owner**: Platform Engineering / Security Team
**Last Updated**: 2026-08-10
**Status**: Tested in Staging

## Overview

A security incident encompasses unauthorized access attempts, CSRF failures,
session hijacking indicators, API key exposure, audit log anomalies, and data
breaches. All security incidents are treated as SEV1 by default due to the
potential for data loss or exposure. This runbook provides a structured
response procedure for containment, investigation, and recovery.

## Detection

### Alert Indicators

| Source | Signal | Severity |
|--------|--------|----------|
| Audit logs (`audit-logger.ts`) | Spike in `unauthorized` actions | SEV1 |
| Audit logs | Multiple failed login attempts from single IP | SEV2 |
| CSRF protection (`csrf.ts`) | CSRF token validation failures | SEV2 |
| Incident Manager | Security-related incident auto-created | SEV1 |
| Rate limiter | Rate limit violations on auth endpoints | SEV2 |
| External | User reports of unauthorized access | SEV1 |
| External | Credential exposure in logs/repos | SEV1 |

### Audit Log Queries

```bash
# Recent unauthorized access attempts
curl -s https://deepmindq.io/api/audit-logs?limit=50 | jq '.logs[] | select(.action == "login" or .action == "unauthorized")'

# Recent failed login attempts (more than 5 from same IP in 5 min)
curl -s https://deepmindq.io/api/security/audit | jq '.recentFailures'

# Rate limit violations
curl -s https://deepmindq.io/api/security/rate-limits | jq .
```

## Immediate Response (First 5 Minutes)

### CRITICAL: Do NOT delete logs or evidence.

1. **Immediately create a SEV1 incident**:
   ```bash
   curl -X POST https://deepmindq.io/api/incidents \
     -H 'Content-Type: application/json' \
     -d '{
       "action": "create",
       "title": "Security Incident — [Brief Description]",
       "severity": "SEV1",
       "description": "Detected: [what was detected]. Scope: [known affected systems]",
       "author": "on-call-engineer"
     }'
   ```

2. **Page the Security Lead** via PagerDuty/Slack immediately.

3. **Send a Slack notification** to `#security-alerts`:
   ```bash
   # Using the quickSlack helper from slack-integration.ts
   # (or send manually to the channel)
   # Include: incident ID, type of incident, timestamp, initial scope
   ```

4. **Begin containment** (do not wait for full assessment):
   - Review the specific sections below for the incident type

5. **Document everything** — all actions, findings, and decisions go into
   the incident timeline via `incidentManager.addNote()`.

## Diagnosis

### Step 1: Review Audit Logs

The audit logger (`audit-logger.ts`) records all security-relevant actions
to the `AuditLog` Prisma table:

```bash
# All audit events in the last hour, ordered by most recent
psql $DATABASE_URL -c "
  SELECT id, action, user_id, ip_address, user_agent, details, \"createdAt\"
  FROM \"AuditLog\"
  WHERE \"createdAt\" > now() - interval '1 hour'
  ORDER BY \"createdAt\" DESC
  LIMIT 100;
"

# Group by action type to find anomaly patterns
psql $DATABASE_URL -c "
  SELECT action, count(*), min(\"createdAt\") as first_seen, max(\"createdAt\") as last_seen
  FROM \"AuditLog\"
  WHERE \"createdAt\" > now() - interval '24 hours'
  GROUP BY action
  ORDER BY count(*) DESC;
"

# Suspicious IP addresses (more than 10 actions from same IP)
psql $DATABASE_URL -c "
  SELECT ip_address, count(*) as actions, array_agg(DISTINCT action) as actions_taken
  FROM \"AuditLog\"
  WHERE \"createdAt\" > now() - interval '6 hours'
  GROUP BY ip_address
  HAVING count(*) > 10
  ORDER BY count(*) DESC;
"
```

### Step 2: Check Active Sessions

```bash
# Active sessions (check for suspicious sessions)
curl -s https://deepmindq.io/api/sessions | jq '.sessions[] | select(.ip != "trusted")'

# Check Session table for anomalies
psql $DATABASE_URL -c "
  SELECT id, user_id, ip_address, \"userAgent\", \"createdAt\", \"expiresAt\"
  FROM \"Session\"
  WHERE \"expiresAt\" > now()
  ORDER BY \"createdAt\" DESC
  LIMIT 50;
"
```

### Step 3: Check Incident Manager for Pre-Existing Incidents

```bash
# List active security incidents
curl -s https://deepmindq.io/api/incidents | jq '.incidents[] | select(.severity == "SEV1")'
```

### Step 4: Determine Incident Type

| Type | Indicators | Containment Priority |
|------|-----------|---------------------|
| Credential theft | Unauthorized access from new geolocation/device | Lock affected accounts |
| Session hijacking | Session used from different IP than created | Kill sessions |
| CSRF attack | CSRF validation failures in logs | No code change needed |
| Brute force | High failed login count from single IP | Block IP |
| API key exposure | Key used from unexpected source | Rotate keys |
| Data exfiltration | Large data export from unusual user/IP | Revoke access |
| SQL injection | Anomalous query patterns in logs | Patch + audit |

## Resolution

### Containment Actions

#### A. Rotate Session Token HMAC Secret

If session integrity is compromised:

1. Generate a new `SESSION_TOKEN_HMAC_SECRET`:
   ```bash
   openssl rand -base64 32
   ```

2. Update the environment variable:
   ```bash
   vercel env rm SESSION_TOKEN_HMAC_SECRET production
   vercel env add SESSION_TOKEN_HMAC_SECRET production
   # Paste the new secret
   ```

3. **Redeploy** to invalidate all existing sessions:
   ```bash
   vercel --prod
   ```

4. All users will be logged out and must re-authenticate.

#### B. Rotate API Keys

If AI provider API keys may be compromised:

1. Rotate each key from the provider's dashboard:
   - `NVIDIA_API_KEY` → NVIDIA console
   - `FIREWORKS_API_KEY` → Fireworks console
   - `GROQ_API_KEY` → Groq console
   - `GEMINI_API_KEY` → Google AI Studio

2. Update in Vercel and redeploy (see RB-003 for details).

#### C. Block Suspicious IP Addresses

```bash
# Block at the WAF/firewall level (Vercel):
# Use Vercel Firewall Rules or add to blocked IPs list
# Via Vercel Dashboard: Settings > Firewall

# Or block at the application middleware level by adding to a blocklist
```

#### D. Kill Specific Sessions

```bash
# Delete suspicious sessions from the database
psql $DATABASE_URL -c "
  DELETE FROM \"Session\" WHERE ip_address = 'SUSPICIOUS_IP';
"

# Or kill all sessions for a specific user
psql $DATABASE_URL -c "
  DELETE FROM \"Session\" WHERE user_id = 'USER_ID';
"
```

#### E. Enable Additional Rate Limiting

If under brute force attack, temporarily tighten rate limits in middleware.

### Notification

Send notifications via `src/lib/slack-integration.ts`:

```bash
# The sendSlackNotification() function sends to a configured webhook
# It is called with level: 'critical' for SEV1 security incidents
# Notifications are routed to the 'slack' channel in ALERT_RULES notificationChannels
```

## Verification

1. **No new unauthorized access attempts** after containment:
   ```bash
   psql $DATABASE_URL -c "
     SELECT count(*) FROM \"AuditLog\"
     WHERE action = 'unauthorized'
       AND \"createdAt\" > now() - interval '15 minutes';
   "
   # Should be 0
   ```

2. **Suspicious sessions are terminated**:
   ```bash
   psql $DATABASE_URL -c "
     SELECT count(*) FROM \"Session\" WHERE ip_address = 'SUSPICIOUS_IP';
   "
   # Should be 0
   ```

3. **All affected API keys are rotated** (verify new keys work).

4. **CSRF validation is passing** (if applicable):
   ```bash
   curl -s https://deepmindq.io/api/security/audit | jq '.csrfFailures'
   # Should be 0 or baseline
   ```

5. **Monitor for 1 hour** minimum before transitioning to `monitoring` status.

## Escalation

| Condition | Action | Timeline |
|-----------|--------|----------|
| Any security incident | Page Security Lead | Immediately |
| PII/data exposure confirmed | Notify legal/compliance | 1 hour |
| External credential leak (GitHub, etc.) | Notify CTO | Immediately |
| Active intrusion detected | Engage incident response firm | 1 hour |
| Regulatory notification required | Legal team leads | Per regulation |

**All security incidents require post-incident review within 48 hours.**

## Prevention

### Short-Term

- **Review and tighten rate limiting** on authentication endpoints.
- **Add IP-based anomaly detection** to the audit logger.
- **Implement automated IP blocking** after N failed attempts.

### Medium-Term

- **Add security alerting** for audit log anomalies (e.g., `unauthorized`
  action count > 10 per minute triggers SEV2 alert).

- **Implement session anomaly detection**: Alert when a session is used
  from a different country/ISP than where it was created.

- **Secret scanning**: Enable GitHub secret scanning or equivalent to
  prevent API key commits.

### Long-Term

- **Penetration testing**: Quarterly penetration tests with automated
  re-testing of findings.

- **Security headers audit**: Ensure CSP, HSTS, X-Frame-Options are
  properly configured.

- **SOC 2 compliance**: If not already, pursue SOC 2 Type II certification.

## Related

- **Incident Manager**: `src/lib/incident-manager.ts` — `create()`, `addNote()`,
  `escalate()`, SLA tracking (SEV1: 15 min response SLA)
- **Audit Logger**: `src/lib/audit-logger.ts` — All security events recorded
  to `AuditLog` table
- **CSRF Protection**: `src/lib/csrf.ts` — CSRF token generation and validation
- **Middleware**: `src/middleware.ts` — Request-level security checks,
  session validation, rate limiting
- **Slack Integration**: `src/lib/slack-integration.ts` — `sendSlackNotification()`,
  `quickSlack()` for incident notifications
- **Incident Response**: `docs/incident-response.md` — Section 3.7 Security Breach,
  full escalation matrix, communication templates
- **Session Model**: Prisma `Session` table — `ip_address`, `userAgent`,
  `expiresAt`, `userId` fields
- **OTP Model**: Prisma `OtpCode` table — Rate limiting on auth endpoints
