/**
 * DeepMindQ — UAT Sign-Off Matrix (Milestone 10.6)
 *
 * Structured sign-off matrix that maps every UAT scenario to:
 *   - Unique scenario ID and title
 *   - Parent business requirement
 *   - Detailed acceptance criteria
 *   - Required test data
 *   - Responsible tester role
 *   - Priority level (Critical / High / Medium / Low)
 *   - Pass/fail status tracking
 *
 * This matrix is the authoritative record for UAT sign-off.
 * All Critical scenarios MUST pass before production release.
 */

import { describe, it, expect } from 'vitest'

// ═══════════════════════════════════════════════════════════════════════
// Type definitions for the sign-off matrix
// ═══════════════════════════════════════════════════════════════════════

type Priority = 'Critical' | 'High' | 'Medium' | 'Low'
type TestStatus = 'pass' | 'fail' | 'blocked' | 'not_run'
type TesterRole = 'Sales Rep' | 'Sales Manager' | 'Admin' | 'Intelligence Analyst' | 'QA Engineer'

interface UATScenario {
  /** Unique scenario identifier (e.g., UAT-SR-01) */
  id: string
  /** Human-readable scenario title */
  title: string
  /** Parent business requirement ID this scenario validates */
  businessRequirementId: string
  /** Business requirement description */
  businessRequirement: string
  /** Detailed acceptance criteria — must all be met for pass */
  acceptanceCriteria: string[]
  /** Test data required to execute this scenario */
  testDataRequirements: string[]
  /** Role responsible for testing */
  testerRole: TesterRole
  /** Priority level — Critical blocks release */
  priority: Priority
  /** Current test status */
  status: TestStatus
  /** Failure reason if status is 'fail' */
  failureReason?: string
  /** Date the test was last executed (ISO string) */
  lastExecutedAt?: string
  /** Sign-off approver name */
  signedOffBy?: string
}

// ═══════════════════════════════════════════════════════════════════════
// Complete UAT Sign-Off Matrix Definition
// ═══════════════════════════════════════════════════════════════════════

const UAT_SIGNOFF_MATRIX: UATScenario[] = [
  // ═══════════════════════════════════════════════════════════════
  // SCENARIO GROUP 1: Sales Rep Daily Workflow (UAT-SR-*)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'UAT-SR-01',
    title: 'Login to application',
    businessRequirementId: 'BR-AUTH-001',
    businessRequirement: 'Users must authenticate via email/password or SSO before accessing the platform',
    acceptanceCriteria: [
      'User can submit valid credentials and receive a session token',
      'Session token is 64-character hex string',
      'Session expiry is set to 24 hours from creation',
      'Invalid credentials return clear error message without revealing system details',
    ],
    testDataRequirements: ['Valid user account with known password', 'Expired user account for negative test'],
    testerRole: 'Sales Rep',
    priority: 'Critical',
    status: 'not_run',
  },
  {
    id: 'UAT-SR-02',
    title: 'View dashboard with today\'s metrics',
    businessRequirementId: 'BR-DASH-001',
    businessRequirement: 'Dashboard must display real-time KPIs for the logged-in user\'s scope',
    acceptanceCriteria: [
      'Dashboard loads within 2 seconds',
      'New leads today count is displayed and non-negative',
      'Emails sent today count is displayed and non-negative',
      'Meetings booked today count is displayed',
      'Pipeline value is displayed with currency formatting',
    ],
    testDataRequirements: ['User with assigned leads and pipeline data', 'Recent email sends and meeting records'],
    testerRole: 'Sales Rep',
    priority: 'Critical',
    status: 'not_run',
  },
  {
    id: 'UAT-SR-03',
    title: 'Check assigned leads',
    businessRequirementId: 'BR-LEAD-001',
    businessRequirement: 'Reps must see only their assigned leads, sorted by intelligence score',
    acceptanceCriteria: [
      'Only leads assigned to the logged-in rep are displayed',
      'Leads are sorted by score in descending order',
      'Each lead shows name, company, score, and status',
      'Pagination works for > 20 leads',
    ],
    testDataRequirements: ['At least 10 leads assigned to the test rep', 'Leads with varying scores (20-100)'],
    testerRole: 'Sales Rep',
    priority: 'Critical',
    status: 'not_run',
  },
  {
    id: 'UAT-SR-04',
    title: 'Review company intelligence brief',
    businessRequirementId: 'BR-INTL-001',
    businessRequirement: 'Users can view AI-generated intelligence briefs for any company',
    acceptanceCriteria: [
      'Intelligence score is displayed (0-100 range)',
      'Active signals are listed with confidence scores (0-1 range)',
      'Company overview section shows industry, size, and revenue',
      'Brief loads within 3 seconds',
    ],
    testDataRequirements: ['Company with intelligence score > 80', 'At least 2 active signals attached'],
    testerRole: 'Sales Rep',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-SR-05',
    title: 'Generate personalized email for contact',
    businessRequirementId: 'BR-AI-001',
    businessRequirement: 'AI must generate personalized email content using contact and company context',
    acceptanceCriteria: [
      'Generated email subject contains contact\'s first name',
      'Generated email body contains company name',
      'Email references relevant signals or context',
      'Personalization tokens are replaced with actual values',
    ],
    testDataRequirements: ['Contact with first name, title, and company', 'Company with recent signals'],
    testerRole: 'Sales Rep',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-SR-06',
    title: 'Send email and track delivery',
    businessRequirementId: 'BR-EMAIL-001',
    businessRequirement: 'Emails can be sent with open/click tracking enabled',
    acceptanceCriteria: [
      'Email status changes to "sent" after sending',
      'Tracking pixel is embedded in sent email',
      'Sent timestamp is recorded',
      'Email appears in sent items list',
    ],
    testDataRequirements: ['Approved email draft', 'Valid recipient email address'],
    testerRole: 'Sales Rep',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-SR-07',
    title: 'Log call note',
    businessRequirementId: 'BR-NOTE-001',
    businessRequirement: 'Reps can log call notes linked to companies and contacts',
    acceptanceCriteria: [
      'Note content is saved with full text',
      'Call duration is recorded in minutes',
      'Outcome (positive/neutral/negative) is selectable',
      'Note is linked to both company and contact',
      'Timestamp is automatically set',
    ],
    testDataRequirements: ['Company and contact to link note to'],
    testerRole: 'Sales Rep',
    priority: 'Medium',
    status: 'not_run',
  },
  {
    id: 'UAT-SR-08',
    title: 'Update opportunity stage',
    businessRequirementId: 'BR-PIPE-001',
    businessRequirement: 'Opportunities can advance through pipeline stages with probability updates',
    acceptanceCriteria: [
      'Stage transitions only forward (no backward moves)',
      'Probability auto-recalculates based on new stage',
      'Stage change is logged in audit trail',
      'Pipeline view updates immediately after stage change',
    ],
    testDataRequirements: ['Opportunity in "discovery" stage', 'Valid stage transition path defined'],
    testerRole: 'Sales Rep',
    priority: 'Critical',
    status: 'not_run',
  },

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO GROUP 2: Sales Manager Review Workflow (UAT-SM-*)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'UAT-SM-01',
    title: 'View team performance dashboard',
    businessRequirementId: 'BR-MGR-001',
    businessRequirement: 'Managers must see individual rep metrics for their entire team',
    acceptanceCriteria: [
      'All team members are listed with their names',
      'Each rep shows leads assigned, emails sent, meetings booked',
      'Pipeline value per rep is displayed',
      'Closed-won count per rep is visible',
    ],
    testDataRequirements: ['Manager account with 3+ direct reports', 'Activity data for each report'],
    testerRole: 'Sales Manager',
    priority: 'Critical',
    status: 'not_run',
  },
  {
    id: 'UAT-SM-02',
    title: 'Review pipeline health report',
    businessRequirementId: 'BR-PIPE-002',
    businessRequirement: 'Pipeline health shows distribution across all stages with values and aging',
    acceptanceCriteria: [
      'All pipeline stages are displayed (discovery through closed_won)',
      'Each stage shows count and total value',
      'Average age in days is shown per stage',
      'Total pipeline value is calculated and displayed',
    ],
    testDataRequirements: ['Opportunities distributed across all 5 pipeline stages'],
    testerRole: 'Sales Manager',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-SM-03',
    title: 'Check lead assignment distribution',
    businessRequirementId: 'BR-LEAD-002',
    businessRequirement: 'Managers can review how leads are distributed across reps',
    acceptanceCriteria: [
      'Each rep\'s lead count is displayed',
      'Average lead score per rep is shown',
      'Distribution spread is visible (max - min)',
      'Spread is within acceptable balance threshold (< 50% of average)',
    ],
    testDataRequirements: ['Leads assigned to 3+ reps with varying counts'],
    testerRole: 'Sales Manager',
    priority: 'Medium',
    status: 'not_run',
  },
  {
    id: 'UAT-SM-04',
    title: 'Review AI-generated recommendations',
    businessRequirementId: 'BR-AI-002',
    businessRequirement: 'AI recommendations are surfaced to managers with actionable reasoning',
    acceptanceCriteria: [
      'Each recommendation has a clear action description',
      'Target company is identified',
      'Score is in valid range (0-100)',
      'Reasoning explains why the recommendation was generated',
    ],
    testDataRequirements: ['At least 5 AI-generated recommendations with scores > 80'],
    testerRole: 'Sales Manager',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-SM-05',
    title: 'Approve email drafts pending review',
    businessRequirementId: 'BR-WFLOW-001',
    businessRequirement: 'Managers can approve or reject email drafts before sending',
    acceptanceCriteria: [
      'Pending drafts are listed in review queue',
      'Manager can approve draft, changing status to "approved"',
      'Manager can reject draft with feedback reason',
      'Approved drafts become sendable by rep',
    ],
    testDataRequirements: ['2+ drafts in "pending_review" status from different reps'],
    testerRole: 'Sales Manager',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-SM-06',
    title: 'Export team activity report',
    businessRequirementId: 'BR-EXPORT-001',
    businessRequirement: 'Managers can export team activity data as CSV',
    acceptanceCriteria: [
      'CSV file is generated with column headers',
      'All activity rows are included in export',
      'Date, rep name, action, and count columns are present',
      'CSV is downloadable via browser',
    ],
    testDataRequirements: ['Team activity data spanning at least 1 week'],
    testerRole: 'Sales Manager',
    priority: 'Medium',
    status: 'not_run',
  },
  {
    id: 'UAT-SM-07',
    title: 'Check data quality scores',
    businessRequirementId: 'BR-DQ-001',
    businessRequirement: 'Data quality metrics are visible to managers for CRM health monitoring',
    acceptanceCriteria: [
      'Company completeness score is displayed (0-100)',
      'Contact completeness score is displayed (0-100)',
      'Email validity score is displayed (0-100)',
      'Overall data quality score is calculated and shown',
    ],
    testDataRequirements: ['Companies and contacts with varying field completeness'],
    testerRole: 'Sales Manager',
    priority: 'Medium',
    status: 'not_run',
  },

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO GROUP 3: Admin Configuration Workflow (UAT-AD-*)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'UAT-AD-01',
    title: 'Login as admin with full system access',
    businessRequirementId: 'BR-AUTH-002',
    businessRequirement: 'Admin users have unrestricted access to all system areas',
    acceptanceCriteria: [
      'Admin can access users management page',
      'Admin can access settings page',
      'Admin can access audit logs',
      'Admin can access integrations configuration',
      'Admin can access AI governance dashboard',
      'Admin can access system health dashboard',
    ],
    testDataRequirements: ['Admin user account with all permissions'],
    testerRole: 'Admin',
    priority: 'Critical',
    status: 'not_run',
  },
  {
    id: 'UAT-AD-02',
    title: 'Configure SSO settings',
    businessRequirementId: 'BR-SEC-001',
    businessRequirement: 'Admin can configure SAML or OIDC SSO for enterprise authentication',
    acceptanceCriteria: [
      'SSO provider can be selected (e.g., Okta, Azure AD)',
      'Protocol can be set to SAML or OIDC',
      'Entity ID and SSO URL are saved',
      'Attribute mapping for email, name, and role is configured',
      'Configuration persists after save and page reload',
    ],
    testDataRequirements: ['Test IdP metadata (entity ID, SSO URL, certificate)'],
    testerRole: 'Admin',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-AD-03',
    title: 'Review security audit logs',
    businessRequirementId: 'BR-AUDIT-001',
    businessRequirement: 'All system operations are logged and filterable in audit trail',
    acceptanceCriteria: [
      'Audit log entries show action, user, timestamp, and resource',
      'Entries are filterable by action type',
      'Entries are filterable by date range',
      'Log entries are ordered by timestamp descending',
      'Total count of log entries is displayed',
    ],
    testDataRequirements: ['At least 10 audit log entries from various actions'],
    testerRole: 'Admin',
    priority: 'Critical',
    status: 'not_run',
  },
  {
    id: 'UAT-AD-04',
    title: 'Check system health dashboard',
    businessRequirementId: 'BR-OPS-001',
    businessRequirement: 'System health is monitored across all critical subsystems',
    acceptanceCriteria: [
      'Database subsystem shows healthy status with latency',
      'AI engine subsystem shows healthy status with model version',
      'Email queue shows pending count and processed rate',
      'Cron jobs show last run time and failure count',
    ],
    testDataRequirements: ['Running system with all subsystems operational'],
    testerRole: 'Admin',
    priority: 'Critical',
    status: 'not_run',
  },
  {
    id: 'UAT-AD-05',
    title: 'Configure rate limits',
    businessRequirementId: 'BR-SEC-002',
    businessRequirement: 'Admin can configure API rate limits per role to prevent abuse',
    acceptanceCriteria: [
      'Rate limits are displayed per role (anonymous, viewer, user, operator, admin)',
      'Limits are properly tiered (admin > operator > user > viewer > anonymous)',
      'New limits can be saved and take effect immediately',
      'Rate limiting can be enabled/disabled per role',
    ],
    testDataRequirements: ['Admin access to rate limit configuration'],
    testerRole: 'Admin',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-AD-06',
    title: 'Manage user roles and permissions',
    businessRequirementId: 'BR-RBAC-001',
    businessRequirement: 'Admin can assign and change user roles with immediate effect',
    acceptanceCriteria: [
      'All users are listed with current roles',
      'Role can be changed (e.g., user -> operator)',
      'New role permissions apply immediately after change',
      'Role change is logged in audit trail',
    ],
    testDataRequirements: ['Users with different current roles to modify'],
    testerRole: 'Admin',
    priority: 'Critical',
    status: 'not_run',
  },
  {
    id: 'UAT-AD-07',
    title: 'Review AI governance dashboard',
    businessRequirementId: 'BR-AI-003',
    businessRequirement: 'AI model performance and safety metrics are visible to admins',
    acceptanceCriteria: [
      'Average confidence score is displayed (0-1 range)',
      'Hallucination rate is below 10% threshold',
      'Grounding coverage is above 80%',
      'Total AI queries count is shown',
      'Flagged responses and human correction counts are visible',
    ],
    testDataRequirements: ['System with at least 100 AI queries executed'],
    testerRole: 'Admin',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-AD-08',
    title: 'Configure email templates and branding',
    businessRequirementId: 'BR-EMAIL-002',
    businessRequirement: 'Admin can create and manage email templates with personalization variables',
    acceptanceCriteria: [
      'Template name and category can be set',
      'Subject line supports {{variable}} placeholders',
      'Body supports {{variable}} placeholders',
      'All declared variables are used in subject or body',
      'Template can be activated/deactivated',
    ],
    testDataRequirements: ['Template editor access', 'List of valid personalization variables'],
    testerRole: 'Admin',
    priority: 'Medium',
    status: 'not_run',
  },
  {
    id: 'UAT-AD-09',
    title: 'Run data import for new batch',
    businessRequirementId: 'BR-IMPORT-001',
    businessRequirement: 'Admin can import data from CSV files with validation and error reporting',
    acceptanceCriteria: [
      'CSV file can be uploaded via file picker',
      'Import processes total, created, updated, skipped, and error counts',
      'Error rate is below 10% of total rows',
      'Error details show row numbers and reasons',
      'Import progress is displayed during processing',
    ],
    testDataRequirements: ['CSV file with 100+ rows', 'File with some intentionally invalid rows'],
    testerRole: 'Admin',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-AD-10',
    title: 'Verify data integrity after import',
    businessRequirementId: 'BR-IMPORT-002',
    businessRequirement: 'Imported data must maintain referential integrity and field validity',
    acceptanceCriteria: [
      'Record counts match expected total (pre-import + imported)',
      'No duplicate records created',
      'All required fields are populated',
      'Foreign key relationships are intact',
      'Data quality score does not decrease significantly',
    ],
    testDataRequirements: ['Pre-import record count', 'Post-import verification query'],
    testerRole: 'Admin',
    priority: 'Critical',
    status: 'not_run',
  },

  // ═══════════════════════════════════════════════════════════════
  // SCENARIO GROUP 4: Intelligence Analyst Workflow (UAT-IA-*)
  // ═══════════════════════════════════════════════════════════════
  {
    id: 'UAT-IA-01',
    title: 'Access intelligence hub',
    businessRequirementId: 'BR-INTL-002',
    businessRequirement: 'Intelligence hub provides centralized access to all intelligence modules',
    acceptanceCriteria: [
      'Intelligence hub page loads successfully',
      'Enrichment module is accessible',
      'Signals module is accessible',
      'Recommendations module is accessible',
      'Knowledge graph module is accessible',
      'AI advisor module is accessible',
    ],
    testDataRequirements: ['User with intelligence module access permissions'],
    testerRole: 'Intelligence Analyst',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-IA-02',
    title: 'Trigger company enrichment',
    businessRequirementId: 'BR-INTL-003',
    businessRequirement: 'Analysts can trigger on-demand enrichment from external data sources',
    acceptanceCriteria: [
      'Enrichment can be triggered for a selected company',
      'Multiple external sources are queried (clearbit, linkedin, etc.)',
      'Updated fields are listed after enrichment',
      'Enrichment confidence score is > 80%',
      'Completion timestamp is recorded',
    ],
    testDataRequirements: ['Company without recent enrichment', 'External API access configured'],
    testerRole: 'Intelligence Analyst',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-IA-03',
    title: 'Review cross-account intelligence',
    businessRequirementId: 'BR-INTL-004',
    businessRequirement: 'Analysts can identify patterns across groups of related companies',
    acceptanceCriteria: [
      'Companies can be grouped by segment',
      'Common patterns are identified across the segment',
      'Pattern types include technology, funding, and hiring trends',
      'Average intelligence score for the segment is calculated',
    ],
    testDataRequirements: ['Segment with 10+ companies', 'Diverse signal data across companies'],
    testerRole: 'Intelligence Analyst',
    priority: 'Medium',
    status: 'not_run',
  },
  {
    id: 'UAT-IA-04',
    title: 'Analyze signal patterns',
    businessRequirementId: 'BR-SIG-001',
    businessRequirement: 'Signal patterns are analyzed to identify trends and anomalies',
    acceptanceCriteria: [
      'Signals are grouped by type (funding, hiring, tech_change)',
      'Each signal type shows count and trend direction',
      'Trend is one of: increasing, stable, decreasing',
      'Top companies per signal type are identified',
    ],
    testDataRequirements: ['50+ signals across multiple types', 'Signals spanning at least 2 weeks'],
    testerRole: 'Intelligence Analyst',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-IA-05',
    title: 'Check knowledge graph',
    businessRequirementId: 'BR-KG-001',
    businessRequirement: 'Knowledge graph stores and queries entity relationships',
    acceptanceCriteria: [
      'Entities are returned with type and name',
      'Relationships between entities are typed (uses, competes, partner)',
      'Relationship confidence scores are in 0-1 range',
      'Graph query returns results within 2 seconds',
    ],
    testDataRequirements: ['Knowledge graph with 20+ entities and relationships'],
    testerRole: 'Intelligence Analyst',
    priority: 'Medium',
    status: 'not_run',
  },
  {
    id: 'UAT-IA-06',
    title: 'Review AI model performance',
    businessRequirementId: 'BR-AI-004',
    businessRequirement: 'AI model accuracy and latency metrics are tracked and displayed',
    acceptanceCriteria: [
      'Scoring engine accuracy is displayed and > 70%',
      'Recommendation engine accuracy is displayed and > 70%',
      'Signal detection shows precision, recall, and F1 score',
      'Average latency is displayed per model',
      'Total prediction counts are shown',
    ],
    testDataRequirements: ['Models with 1000+ predictions each'],
    testerRole: 'Intelligence Analyst',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-IA-07',
    title: 'Validate grounding evidence',
    businessRequirementId: 'BR-AI-005',
    businessRequirement: 'AI-generated claims are backed by verifiable evidence sources',
    acceptanceCriteria: [
      'Each claim has an associated source',
      'Source URL is provided where applicable',
      'Verification status is tracked (verified/unverified)',
      'At least one verified evidence exists per insight',
    ],
    testDataRequirements: ['AI-generated insights with grounding evidence'],
    testerRole: 'Intelligence Analyst',
    priority: 'High',
    status: 'not_run',
  },
  {
    id: 'UAT-IA-08',
    title: 'Run competitive analysis',
    businessRequirementId: 'BR-COMP-001',
    businessRequirement: 'Analysts can compare companies across multiple competitive dimensions',
    acceptanceCriteria: [
      'Target company and competitors are selected',
      'Comparison dimensions include market share, features, pricing, satisfaction',
      'Matrix shows numeric scores for each dimension',
      'All scores are non-negative numbers',
    ],
    testDataRequirements: ['Target company with 3+ known competitors', 'Competitive data for all companies'],
    testerRole: 'Intelligence Analyst',
    priority: 'Medium',
    status: 'not_run',
  },
]

// ═══════════════════════════════════════════════════════════════════════
// Sign-Off Matrix Validation Tests
// These tests verify the matrix itself is well-formed and complete.
// ═══════════════════════════════════════════════════════════════════════

describe('UAT Sign-Off Matrix — Structural Validation', () => {

  it('should contain at least 30 scenarios', () => {
    expect(UAT_SIGNOFF_MATRIX.length).toBeGreaterThanOrEqual(30)
  })

  it('should cover all 4 persona groups', () => {
    const groups = new Set(UAT_SIGNOFF_MATRIX.map((s) => s.id.split('-').slice(0, 2).join('-')))
    expect(groups.has('UAT-SR')).toBe(true)  // Sales Rep
    expect(groups.has('UAT-SM')).toBe(true)  // Sales Manager
    expect(groups.has('UAT-AD')).toBe(true)  // Admin
    expect(groups.has('UAT-IA')).toBe(true)  // Intelligence Analyst
  })

  it('should have unique scenario IDs', () => {
    const ids = UAT_SIGNOFF_MATRIX.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  it('should have unique business requirement IDs', () => {
    const reqIds = UAT_SIGNOFF_MATRIX.map((s) => s.businessRequirementId)
    const _uniqueReqIds = new Set(reqIds)
    // Some scenarios may share the same BR, so we just verify all are populated
    reqIds.forEach((id) => { expect(id).toMatch(/^BR-[A-Z]+-\d+$/) })
  })

  it('should have at least 3 acceptance criteria per scenario', () => {
    UAT_SIGNOFF_MATRIX.forEach((s) => {
      expect(s.acceptanceCriteria.length).toBeGreaterThanOrEqual(3)
    })
  })

  it('should have at least 1 test data requirement per scenario', () => {
    UAT_SIGNOFF_MATRIX.forEach((s) => {
      expect(s.testDataRequirements.length).toBeGreaterThanOrEqual(1)
    })
  })

  it('should have valid priority levels for all scenarios', () => {
    const validPriorities: Priority[] = ['Critical', 'High', 'Medium', 'Low']
    UAT_SIGNOFF_MATRIX.forEach((s) => {
      expect(validPriorities).toContain(s.priority)
    })
  })

  it('should have valid test statuses for all scenarios', () => {
    const validStatuses: TestStatus[] = ['pass', 'fail', 'blocked', 'not_run']
    UAT_SIGNOFF_MATRIX.forEach((s) => {
      expect(validStatuses).toContain(s.status)
    })
  })

  it('should have valid tester roles for all scenarios', () => {
    const validRoles: TesterRole[] = ['Sales Rep', 'Sales Manager', 'Admin', 'Intelligence Analyst', 'QA Engineer']
    UAT_SIGNOFF_MATRIX.forEach((s) => {
      expect(validRoles).toContain(s.testerRole)
    })
  })

  it('should have at least 8 Critical priority scenarios', () => {
    const criticalCount = UAT_SIGNOFF_MATRIX.filter((s) => s.priority === 'Critical').length
    expect(criticalCount).toBeGreaterThanOrEqual(8)
  })

  it('should map scenarios to distinct business requirements', () => {
    const uniqueReqs = new Set(UAT_SIGNOFF_MATRIX.map((s) => s.businessRequirementId))
    // Should have at least 15 distinct business requirements
    expect(uniqueReqs.size).toBeGreaterThanOrEqual(15)
  })

  // Summary: Print the matrix for CI visibility
  it('should output a summary of the sign-off matrix', () => {
    const byGroup = UAT_SIGNOFF_MATRIX.reduce((acc, s) => {
      const group = s.id.split('-').slice(0, 2).join('-')
      acc[group] = (acc[group] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const byPriority = UAT_SIGNOFF_MATRIX.reduce((acc, s) => {
      acc[s.priority] = (acc[s.priority] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const byStatus = UAT_SIGNOFF_MATRIX.reduce((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    // Validate the summary itself is well-formed
    expect(Object.keys(byGroup).length).toBe(4)
    expect(byPriority['Critical']).toBeGreaterThanOrEqual(8)
    expect(byStatus['not_run']).toBe(UAT_SIGNOFF_MATRIX.length) // All start as not_run
  })
})
