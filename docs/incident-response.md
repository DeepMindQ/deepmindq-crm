# DeepMindQ — Incident Response Playbooks

> **Version:** 1.0  
> **Last Updated:** $(date)  
> **Owner:** Platform Engineering / SRE Team  
> **Classification:** Internal — Operational

---

## Table of Contents

1. [Incident Classification](#1-incident-classification)
2. [Response Procedures](#2-response-procedures)
3. [Common Incident Scenarios](#3-common-incident-scenarios)
4. [Communication Templates](#4-communication-templates)
5. [On-Call Runbook](#5-on-call-runbook)
6. [Post-Incident Review Process](#6-post-incident-review-process)
7. [Escalation Matrix](#7-escalation-matrix)
8. [Appendix: Tooling & Access](#8-appendix-tooling--access)

---

## 1. Incident Classification

### Severity Levels

| Severity | Label | Description | Response SLA | Update Frequency | Examples |
|----------|-------|-------------|--------------|-----------------|----------|
| **SEV1** | Critical | Full service outage, data loss risk, security breach | **15 min** initial response | Every 30 min | All users unable to access; database corrupted; credential leak |
| **SEV2** | Major | Partial outage, degraded performance, critical feature broken | **30 min** initial response | Every 60 min | AI scoring down; import failures >50%; login issues for subset |
| **SEV3** | Minor | Non-critical feature unavailable, minor performance impact | **2 hours** initial response | Every 4 hours | Dashboard widget slow; non-core export fails; minor UI bug |
| **SEV4** | Low | Cosmetic issues, minor bugs, convenience features broken | **24 hours** initial response | Daily or next business day | Typo in label; color contrast issue; tooltip text wrong |

### Severity Decision Tree

```
Is user data at risk (loss, leak, corruption)?
  └─ YES → SEV1
  └─ NO → Is the service completely unavailable for >50% of users?
        └─ YES → SEV1
        └─ NO → Is a critical business feature broken (login, AI scoring, data import)?
              └─ YES → SEV2
              └─ NO → Is a non-critical feature broken?
                    └─ YES → SEV3
                    └─ NO → SEV4
```

### Impact Assessment

When classifying an incident, assess:

- **Breadth:** How many users/tenants are affected? (1, <10, <100, all)
- **Depth:** What functionality is impacted? (read, write, all)
- **Duration:** How long has the issue been occurring? (minutes, hours, days)
- **Revenue Impact:** Is there direct revenue impact?
- **Data Risk:** Is customer data at risk of loss or exposure?

---

## 2. Response Procedures

### 2.1 SEV1 — Critical Incident Response

**Initial Response (0–15 minutes):**

1. **Acknowledge** the incident in the incident channel immediately
2. **Page** the on-call SRE + Engineering Lead
3. **Assess** scope — confirm it's truly SEV1 using the decision tree
4. **Declare** incident commander (first SRE on call)
5. **Open** a dedicated Slack channel: `#incident-INC-XXXXX`
6. **Post** initial notification (see templates below)
7. **Begin** immediate investigation — do NOT wait for all stakeholders

**Investigation Phase (15–60 minutes):**

1. Incident commander assigns investigation roles
2. Each investigator reports findings every 10 minutes
3. Identify root cause hypothesis within 30 minutes
4. Document all actions taken in the incident timeline
5. If no progress in 30 minutes, escalate to VP Engineering

**Resolution Phase:**

1. Apply fix with incident commander approval
2. Verify fix across all affected systems
3. Monitor for 15 minutes post-fix for recurrence
4. Communicate resolution to all stakeholders
5. Transition status to "monitoring" for 1 hour minimum

**Post-Incident (within 24 hours):**

1. Schedule post-incident review (PIR) within 48 hours
2. Begin timeline reconstruction while memory is fresh
3. Collect all logs, metrics, and screenshots

### 2.2 SEV2 — Major Incident Response

**Initial Response (0–30 minutes):**

1. **Acknowledge** in the incident channel within 15 minutes
2. **Assess** scope and confirm SEV2 classification
3. **Assign** to on-call engineer
4. **Post** status update to `#incidents` channel
5. **Begin** investigation

**Investigation Phase:**

1. On-call engineer leads investigation
2. Update status every 30 minutes
3. Escalate to SEV1 if scope widens
4. Engage domain expert if needed

**Resolution Phase:**

1. Apply fix after testing in staging if possible
2. Verify resolution
3. Monitor for 30 minutes
4. Communicate resolution

### 2.3 SEV3 — Minor Incident Response

1. **Log** the incident in the tracking system
2. **Assign** to appropriate team member
3. **Investigate** during regular working hours
4. **Resolve** and document within 1 business day
5. **Update** affected users if necessary

### 2.4 SEV4 — Low Priority Response

1. **Create** a ticket in the backlog
2. **Triage** in next sprint planning
3. **Resolve** as part of regular development

---

## 3. Common Incident Scenarios

### 3.1 Database Connection Failure

**Symptoms:**
- 500 errors on all/most API endpoints
- `ECONNREFUSED` or `CONNECTION_TIMEOUT` in logs
- Health check failures on `/api/health/database`

**Diagnosis:**
```bash
# Check database connectivity
curl -s http://localhost:3000/api/health/database | jq .

# Check connection pool status
curl -s http://localhost:3000/api/health | jq '.details.database'

# Verify database is reachable
docker exec -it deepmindq-blue pg_isready -h $DATABASE_HOST

# Check connection count
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state = 'active';"

# Check for connection pool exhaustion
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity WHERE state != 'idle';"
```

**Resolution Steps:**
1. Verify database host is reachable from application
2. Check for connection pool exhaustion — increase `DATABASE_POOL_SIZE` if needed
3. Check database resource limits (memory, CPU, connections)
4. If connection limit hit, identify long-running queries:
   ```sql
   SELECT pid, now() - pg_stat_activity.query_start AS duration, query, state
   FROM pg_stat_activity WHERE state != 'idle' ORDER BY duration DESC;
   ```
5. Terminate stuck connections if necessary
6. If database is down, contact infrastructure team
7. Restart application with increased pool timeout if transient

### 3.2 API Response Time Degradation

**Symptoms:**
- P95 latency > 2s (normal: <500ms)
- User complaints about slowness
- Timeouts on client side

**Diagnosis:**
```bash
# Check API metrics
curl -s http://localhost:3000/api/performance | jq .

# Check CPU/memory of container
docker stats --no-stream deepmindq-blue

# Check recent slow queries
psql $DATABASE_URL -c "
  SELECT query, mean_exec_time, calls, total_exec_time
  FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;
"

# Check AI provider latency
curl -s http://localhost:3000/api/ai/health | jq .

# Check for memory pressure
docker exec deepmindq-blue free -h
```

**Resolution Steps:**
1. Identify bottleneck: CPU, memory, I/O, network, or external service
2. If AI provider is slow, check rate limits and fallback configuration
3. If database is slow, check for missing indexes, lock contention, or large queries
4. If memory pressure, check for memory leaks (restart container as immediate fix)
5. Enable or increase caching for expensive operations
6. Scale horizontally if single-instance is saturated
7. If persistent, create SEV2 incident for performance investigation

### 3.3 Memory Leak / Out of Memory (OOM)

**Symptoms:**
- Container restarts with OOMKilled status
- Gradual increase in memory usage over time
- Sudden degradation in performance before crash

**Diagnosis:**
```bash
# Check container restart history
docker inspect deepmindq-blue --format='{{.RestartCount}}'

# Check OOM events
docker inspect deepmindq-blue --format='{{.State.OOMKilled}}'

# Monitor memory in real-time
docker stats deepmindq-blue

# Check Node.js heap (if accessible)
docker exec deepmindq-blue node -e "
  const v8 = require('v8');
  const heap = v8.getHeapStatistics();
  console.log('Heap used:', Math.round(heap.used_heap_size / 1024 / 1024), 'MB');
  console.log('Heap limit:', Math.round(heap.heap_size_limit / 1024 / 1024), 'MB');
"

# Generate heap snapshot for analysis
docker exec deepmindq-blue node -e "
  const v8 = require('v8');
  const fs = require('fs');
  const stream = v8.getHeapSnapshot();
  stream.pipe(fs.createWriteStream('/tmp/heapdump.heapsnapshot'));
"
```

**Resolution Steps:**
1. **Immediate:** Restart the container to restore service
2. **Short-term:** Increase container memory limit if justified
3. **Investigation:** Analyze heap snapshot for leak sources
4. Common causes in DeepMindQ:
   - Unclosed database connections
   - Large AI response caching without eviction
   - Growing in-memory session store
   - Event listener accumulation
5. Implement memory monitoring alerts at 80% threshold
6. Fix root cause and deploy via blue-green pipeline

### 3.4 AI Service Provider Outage

**Symptoms:**
- AI features returning errors or timeouts
- `/api/ai/health` showing provider failures
- Intelligence features degraded

**Diagnosis:**
```bash
# Check AI health
curl -s http://localhost:3000/api/ai/health | jq .

# Check AI provider status pages
# OpenAI: https://status.openai.com
# Anthropic: https://status.anthropic.com

# Check rate limit status
curl -s http://localhost:3000/api/ai/usage | jq '.rateLimits'

# Test fallback provider
curl -s http://localhost:3000/api/ai/health | jq '.fallback'
```

**Resolution Steps:**
1. Confirm it's a provider issue, not our integration
2. If primary provider is down:
   - Automatic fallback should engage (if configured)
   - Verify fallback provider is working
   - If no fallback, display graceful degradation message
3. Check rate limits — may need to request increase
4. If all providers down, switch to cached responses mode
5. Communicate to users about degraded AI features
6. Monitor provider status page for resolution
7. Post-incident: implement multi-provider resilience if not present

### 3.5 Failed Deployment

**Symptoms:**
- New container fails health check
- Deploy script exits with error
- Users see new version briefly, then errors

**Diagnosis:**
```bash
# Check deploy status
./scripts/deploy.sh status

# Check container logs
docker logs deepmindq-green --tail 100

# Check health of both slots
curl -s http://localhost:3000/api/health
curl -s http://localhost:3001/api/health

# Check build artifacts
docker images | grep deepmindq
```

**Resolution Steps:**
1. **If deploy script is still running:** Let it complete — it auto-rollbacks on health failure
2. **If traffic already switched:**
   - Run `./scripts/deploy.sh rollback` immediately
   - If rollback fails, manually switch: `./scripts/deploy.sh switch`
   - As last resort: `docker start deepmindq-blue` (or whichever was stable)
3. Investigate failure cause from container logs
4. Fix the issue and re-deploy
5. Post-incident: add test case to prevent regression

### 3.6 Data Integrity Issue

**Symptoms:**
- Duplicate records appearing
- Data corruption in specific fields
- Incorrect AI scores or recommendations
- Data mismatch between systems

**Diagnosis:**
```bash
# Check data health
curl -s http://localhost:3000/api/data-health | jq .

# Check for duplicates
curl -s http://localhost:3000/api/duplicates/scan | jq '.summary'

# Check scoring consistency
curl -s http://localhost:3000/api/companies/stats | jq .

# Verify database integrity
psql $DATABASE_URL -c "SELECT COUNT(*) FROM companies;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM contacts;"
```

**Resolution Steps:**
1. **Stop** any running data imports or batch operations
2. **Identify** the scope of corruption (which tables, which records, which time range)
3. **Backup** current state before making changes
4. **Determine** if data can be corrected vs. needs re-import
5. If re-import needed, use the data import pipeline with validation enabled
6. Verify corrections with spot checks
7. Document the incident for audit trail
8. If data loss occurred, escalate to SEV1

### 3.7 Security Breach / Unauthorized Access

**Symptoms:**
- Unusual API access patterns
- Reports of unauthorized data access
- Anomalous login attempts
- Security scan alerts

**Diagnosis:**
```bash
# Check recent audit logs
curl -s http://localhost:3000/api/audit-logs?limit=50 | jq '.logs[] | select(.action == "login" or .action == "unauthorized")'

# Check for failed login attempts
curl -s http://localhost:3000/api/security/audit | jq '.recentFailures'

# Check rate limit violations
curl -s http://localhost:3000/api/security/rate-limits | jq .

# Check active sessions
curl -s http://localhost:3000/api/sessions | jq '.sessions[] | select(.ip != "trusted")'
```

**Resolution Steps — URGENT:**
1. **IMMEDIATELY** escalate to SEV1 — this is always SEV1
2. **DO NOT** delete logs or evidence
3. **Contain** the breach:
   - Rotate all compromised credentials
   - Revoke suspicious sessions
   - Enable additional rate limiting
   - Block suspicious IPs at WAF/firewall level
4. **Assess** what data was accessed
5. **Notify** security team and legal/compliance within 1 hour
6. **Document** timeline of events meticulously
7. **Preserve** all logs for forensic analysis
8. **Prepare** customer notification if PII was exposed
9. Post-incident: full security audit, penetration test, and policy review

---

## 4. Communication Templates

### 4.1 Initial Notification — Slack

```
🔴 **SEV1** — [Brief Title]

**Status:** Investigating
**Started:** [Timestamp UTC]
**Incident Commander:** @[name]
**Channel:** #incident-INC-XXXXX

**Impact:** [What is broken and who is affected]

**Next Update:** [Timestamp + 30min]
```

### 4.2 Initial Notification — Email (Stakeholders)

```
Subject: [SEV1] DeepMindQ Incident — [Brief Title]

Hi team,

We are currently investigating a [SEV1/SEV2] incident affecting DeepMindQ.

**Incident ID:** INC-XXXXX
**Status:** Investigating
**Started:** [Timestamp]
**Impact:** [Description]

The incident response team has been engaged and is actively working on
resolution. We will provide updates every [30/60] minutes.

Please join #incident-INC-XXXXX for real-time updates.

— Incident Commander: [Name]
```

### 4.3 Status Update (Every 30 min for SEV1)

```
🔴 **SEV1 Update #N** — [Brief Title]

**Status:** [Investigating | Identified | Monitoring]
**Elapsed:** [Duration since start]

**Progress:**
- [What we've learned/done]
- [What we're doing next]

**Impact:** [Updated if changed]
**Next Update:** [Timestamp + 30min]
```

### 4.4 Resolution Announcement

```
🟢 **RESOLVED** — [SEV1] [Brief Title]

**Incident ID:** INC-XXXXX
**Duration:** [Total duration]
**Root Cause:** [Brief summary]

**Resolution:** [What we did to fix it]

**Impact Summary:**
- Duration of impact: [Time range]
- Affected users: [Number or estimate]
- Data loss: [Yes/No + details]

**Preventive Measures:**
- [Action item 1]
- [Action item 2]

Post-incident review scheduled for: [Date/Time]
```

### 4.5 Post-Incident Review (PIR) Template

```markdown
# Post-Incident Review: INC-XXXXX

## Summary
- **Title:** [Incident title]
- **Severity:** [SEV1/2/3/4]
- **Duration:** [Start] → [End] ([total duration])
- **Incident Commander:** [Name]
- **Date of Review:** [Date]

## Timeline
| Time (UTC) | Event |
|-----------|-------|
| HH:MM | Incident detected via [alert/manual/user report] |
| HH:MM | [Action taken] |
| HH:MM | [Status change] |
| HH:MM | Root cause identified: [description] |
| HH:MM | Fix applied |
| HH:MM | Service restored |
| HH:MM | Incident resolved |

## Root Cause Analysis (5 Whys)
1. **Why did [symptom] occur?**
   → [Direct cause]
2. **Why did [direct cause] happen?**
   → [Contributing factor]
3. **Why did [contributing factor] exist?**
   → [Process/system gap]
4. **Why wasn't [gap] caught earlier?**
   → [Missing safeguard]
5. **Why was the safeguard missing?**
   → [Root cause — usually process, tooling, or knowledge gap]

## What Went Well
- [Positive aspects of the response]

## What Could Be Improved
- [Areas for improvement]

## Action Items
| # | Action | Owner | Priority | Due Date | Status |
|---|--------|-------|----------|----------|--------|
| 1 | [Action] | [Name] | P1 | [Date] | Open |
| 2 | [Action] | [Name] | P2 | [Date] | Open |

## Lessons Learned
- [Key takeaway 1]
- [Key takeaway 2]
```

---

## 5. On-Call Runbook

### 5.1 Tools & Dashboards

| Tool | Purpose | URL/Access |
|------|---------|------------|
| Grafana | Metrics dashboard | `https://grafana.deepmindq.internal` |
| Loki | Log aggregation | `https://loki.deepmindq.internal` |
| Alertmanager | Alert management | `https://alerts.deepmindq.internal` |
| Sentry | Error tracking | `https://sentry.deepmindq.internal` |
| Incidents API | Incident management | `POST /api/incidents` |
| Health Check | Service health | `GET /api/health` |
| Database Console | DB access | `psql $DATABASE_URL` |

### 5.2 Quick Diagnostic Commands

```bash
# ── Service Health ──
curl -s http://localhost:3000/api/health | jq .
curl -s http://localhost:3000/api/health/database | jq .
curl -s http://localhost:3000/api/health/deps | jq .
curl -s http://localhost:3000/api/health/ai | jq .

# ── System Resources ──
docker stats --no-stream
docker inspect deepmindq-blue --format='{{.State.Status}} {{.State.Health.Status}}'
docker logs deepmindq-blue --tail 50 --timestamps

# ── Deployment ──
./scripts/deploy.sh status
./scripts/deploy.sh rollback

# ── Incident Management ──
curl -s http://localhost:3000/api/incidents | jq '.active'
curl -X POST http://localhost:3000/api/incidents \
  -H 'Content-Type: application/json' \
  -d '{"action":"create","title":"...","severity":"SEV1","author":"on-call"}'

# ── Database Quick Checks ──
psql $DATABASE_URL -c "SELECT pg_is_in_recovery();"  # Replication status
psql $DATABASE_URL -c "SELECT count(*) FROM pg_stat_activity;"  # Connection count
psql $DATABASE_URL -c "SELECT pg_database_size(current_database());"  # DB size

# ── Rate Limits & Security ──
curl -s http://localhost:3000/api/security/rate-limits | jq .
curl -s http://localhost:3000/api/security/audit | jq '.summary'
```

### 5.3 Escalation Contacts

| Role | Name | Contact | Hours |
|------|------|---------|-------|
| On-Call SRE | [From schedule] | PagerDuty | 24/7 |
| Engineering Lead | [Name] | Slack: @eng-lead | 24/7 for SEV1 |
| VP Engineering | [Name] | Slack: @vp-eng | SEV1 only |
| Security Lead | [Name] | Slack: @security-lead | Security incidents |
| Database Admin | [Name] | Slack: @dba-oncall | 24/7 |
| AI/ML Lead | [Name] | Slack: @ai-lead | Business hours |
| Customer Success | [Name] | Slack: @cs-escalation | Business hours |

### 5.4 Decision Tree — Common On-Call Decisions

```
User reports issue
├─ Is it a SEV1?
│   ├─ YES → Page SRE + Eng Lead, open incident, start war room
│   └─ NO → Is it SEV2?
│       ├─ YES → Create incident, assign to on-call, update hourly
│       └─ NO → Create ticket, triage next business day

Alert fires
├─ Is it a false positive?
│   ├─ YES → Acknowledge, document, adjust alert threshold
│   └─ NO → Is it SEV1/SEV2?
│       ├─ YES → Start incident response
│       └─ NO → Acknowledge, investigate, create ticket

Deployment fails
├─ Did it auto-rollback?
│   ├─ YES → Investigate cause, fix, re-deploy
│   └─ NO → Manual rollback: ./scripts/deploy.sh rollback

Performance degradation
├─ Is it database-related?
│   ├─ YES → Check queries, connections, indexes
│   └─ NO → Check AI provider, memory, CPU
```

---

## 6. Post-Incident Review Process

### 6.1 Timeline Reconstruction

- Collect all timestamps from: logs, alerts, Slack messages, incident channel
- Use the Incident Manager API to retrieve the full timeline
- Arrange chronologically with evidence links
- Identify gaps where events are unaccounted for

### 6.2 Root Cause Analysis — 5 Whys Method

The 5 Whys is our standard root cause analysis technique:

1. Start with the incident symptom
2. Ask "why" to each answer
3. Continue until you reach a systemic root cause
4. The root cause should be actionable — something we can change

**Common root cause categories:**
- **Process gaps:** Missing runbook, unclear ownership, no review process
- **Tooling gaps:** Missing monitoring, no automated rollback, no alerting
- **Knowledge gaps:** On-call unfamiliar with system, undocumented behavior
- **System design:** Single point of failure, insufficient redundancy, tight coupling

### 6.3 Action Items Tracking

All PIR action items must be:

1. **Specific:** Clear description of what needs to be done
2. **Assigned:** Single owner responsible
3. **Prioritized:** P1 (prevent recurrence) vs P2 (improve resilience) vs P3 (nice to have)
4. **Dated:** Target completion date
5. **Tracked:** Added to the engineering backlog with PIR reference

### 6.4 Prevention Measures

**Immediate (within 1 week):**
- Fix the direct cause of the incident
- Add monitoring/alerting for the failure mode
- Update runbook with new diagnostic steps

**Short-term (within 1 month):**
- Implement automated remediation where possible
- Add resilience patterns (circuit breakers, retries, fallbacks)
- Improve error messages and logging

**Long-term (within 1 quarter):**
- Architectural changes to prevent class of incidents
- Investment in tooling and automation
- Training and knowledge sharing

### 6.5 PIR Meeting Format

- **Duration:** 30–60 minutes
- **Attendees:** Incident commander, all responders, relevant stakeholders
- **Facilitator:** Incident commander or SRE lead
- **Format:** Blameless — focus on systems, not individuals
- **Output:** PIR document with timeline, root cause, and action items
- **Follow-up:** Action items reviewed in weekly engineering meeting

---

## 7. Escalation Matrix

### Automatic Escalation Triggers

| Trigger | Action |
|---------|--------|
| SEV1 not acknowledged in 5 min | Page backup on-call + Eng Lead |
| SEV1 not resolved in 1 hour | Page VP Engineering |
| SEV1 not resolved in 2 hours | Page CTO |
| SEV2 not acknowledged in 15 min | Page backup on-call |
| SEV2 not resolved in 4 hours | Escalate to SEV1 |
| SEV3 not resolved in 24 hours | Escalate to SEV2 |
| SLA breach on any incident | Notify Engineering Lead |

### Escalation Path

```
Level 1: On-Call SRE
  ↓ (5 min no ack, or 30 min no progress on SEV1)
Level 2: Engineering Lead
  ↓ (1 hour no resolution on SEV1)
Level 3: VP Engineering
  ↓ (2 hours no resolution on SEV1, or security/legal involvement)
Level 4: CTO / Executive Team
```

---

## 8. Appendix: Tooling & Access

### Required Access for On-Call

- [ ] Docker host SSH access
- [ ] Database read access (psql)
- [ ] Grafana dashboard access
- [ ] Log aggregation access (Loki/ELK)
- [ ] Sentry error tracking access
- [ ] Slack incident channels
- [ ] PagerDuty (or equivalent) access
- [ ] AWS/GCP console (read-only minimum)
- [ ] DNS management access (for emergency changes)

### Monitoring Alert Rules

| Alert | Condition | Severity | Channel |
|-------|-----------|----------|---------|
| Service Down | Health check fails 3x | SEV1 | #alerts-critical |
| High Error Rate | >5% 5xx responses (5min) | SEV1 | #alerts-critical |
| High Latency | P95 > 5s (5min) | SEV2 | #alerts-warnings |
| Database Down | Connection refused or timeout | SEV1 | #alerts-critical |
| Memory High | >85% container memory | SEV2 | #alerts-warnings |
| Disk High | >90% disk usage | SEV3 | #alerts-info |
| AI Provider Down | Fallback engaged | SEV2 | #alerts-warnings |
| Failed Login Spike | >100/min from single IP | SEV2 | #security-alerts |

### Incident Manager API Reference

```bash
# List all incidents
GET /api/incidents

# Create incident
POST /api/incidents
{
  "action": "create",
  "title": "Database connection timeout",
  "severity": "SEV1",
  "description": "All API endpoints returning 500",
  "author": "on-call-engineer"
}

# Update status
POST /api/incidents
{
  "action": "update_status",
  "incidentId": "INC-1234567890",
  "status": "identified",
  "message": "Root cause: connection pool exhausted",
  "author": "on-call-engineer"
}

# Add note
POST /api/incidents
{
  "action": "note",
  "incidentId": "INC-1234567890",
  "message": "Increased pool size from 10 to 50",
  "author": "on-call-engineer"
}

# Assign incident
POST /api/incidents
{
  "action": "assign",
  "incidentId": "INC-1234567890",
  "assignee": "senior-sre",
  "author": "engineering-lead"
}
```

---

*This document is a living reference. Update it after every SEV1/SEV2 incident and quarterly reviews.*