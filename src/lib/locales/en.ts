/* ═══════════════════════════════════════════════════
   DeepMindQ — English (en-US) Locale

   Common UI strings for navigation, actions, errors,
   and domain-specific labels.
   ═══════════════════════════════════════════════════ */

const en: Record<string, string> = {
  // ── Navigation ──
  'nav.dashboard':       'Dashboard',
  'nav.analytics':       'Analytics',
  'nav.pipelines':       'Pipelines',
  'nav.contacts':        'Contacts',
  'nav.companies':       'Companies',
  'nav.intelligence':    'Intelligence',
  'nav.settings':        'Settings',
  'nav.knowledge':       'Knowledge Library',
  'nav.capabilities':    'Capabilities',

  // ── Common Actions ──
  'common.save':         'Save',
  'common.cancel':       'Cancel',
  'common.delete':       'Delete',
  'common.edit':         'Edit',
  'common.create':       'Create',
  'common.search':       'Search',
  'common.filter':       'Filter',
  'common.export':       'Export',
  'common.import':       'Import',
  'common.refresh':      'Refresh',
  'common.confirm':      'Confirm',
  'common.back':         'Back',
  'common.next':         'Next',
  'common.close':        'Close',
  'common.loading':      'Loading...',
  'common.noData':       'No data available',

  // ── Error Messages ──
  'error.generic':       'Something went wrong. Please try again.',
  'error.network':       'Network error. Check your connection.',
  'error.unauthorized':  'You are not authorized to perform this action.',
  'error.notFound':      'The requested resource was not found.',
  'error.timeout':       'The request timed out. Please retry.',
  'error.serverError':   'Server error. Please contact support if this persists.',

  // ── Domain Labels ──
  'domain.score':        'Score',
  'domain.confidence':   'Confidence',
  'domain.trust':        'Trust',
  'domain.signal':       'Signal',
  'domain.opportunity':  'Opportunity',
  'domain.risk':         'Risk',

  // ── Greetings / Plurals ──
  'greeting':            'Hello, {name}!',
  'items.count':         '{count} items',

  // ── Navigation (extended) ──
  'nav.commandCenter':    'Command Center',
  'nav.companyWorkspace': 'Company Workspace',
  'nav.companyDetail':    'Company Detail',
  'nav.contactDetail':    'Contact Detail',
  'nav.collapse':         'Collapse',
  'nav.expandSidebar':    'Expand sidebar',

  // ── Intelligence Hub ──
  'hub.prioritySignals':      'Priority Signals',
  'hub.activeOpportunities':  'Active Opportunities',
  'hub.confidenceAvg':        'Confidence Avg',
  'hub.accountsMonitored':    'Accounts Monitored',
  'hub.signalIntelligence':   'Signal Intelligence',
  'hub.aiRecommendations':    'AI Recommendations',
  'hub.activityFeed':         'Activity Feed',
  'hub.quickActions':         'Quick Actions',
  'hub.newAnalysis':          'New Analysis',
  'hub.importAccounts':       'Import Accounts',
  'hub.configureSources':     'Configure Sources',
  'hub.exportReport':         'Export Report',
  'hub.intelligenceSummary':  'Intelligence Summary',

  // ── Company Detail ──
  'company.aiIntelligence':         'AI Intelligence',
  'company.companyProfile':         'Company Profile',
  'company.orgChart':                'Org Chart',
  'company.activityTimeline':        'Activity Timeline',
  'company.evidenceSources':         'Evidence Sources',
  'company.activeSignals':           'Active Signals',
  'company.keyContacts':             'Key Contacts',
  'company.aiIntelligenceInsights':  'AI Intelligence Insights',
  'company.researchNotes':           'Research Notes',

  // ── Contact Detail ──
  'contact.aiEmails':            'AI Emails',
  'contact.notes':               'Notes',
  'contact.activity':            'Activity',
  'contact.buyerProfileDetails': 'Buyer Profile Details',
  'contact.aiGeneratedEmails':   'AI-Generated Emails',
  'contact.researchNotes':       'Research Notes',
  'contact.activityTimeline':    'Activity Timeline',

  // ── Drafts Screen ──
  'drafts.emailDrafts':   'Email Drafts',
  'drafts.subtitle':      'Review, edit, and approve AI-generated outreach drafts',
  'drafts.all':           'All',
  'drafts.pendingReview': 'Pending Review',
  'drafts.approved':      'Approved',
  'drafts.rejected':      'Rejected',
  'drafts.allDrafts':     'All Drafts',
  'drafts.threadView':    'Thread View',

  // ── Status ──
  'status.active':       'Active',
  'status.inactive':     'Inactive',
  'status.pending':      'Pending',
  'status.processing':   'Processing',
  'status.completed':    'Completed',
  'status.failed':       'Failed',
};

export default en;
