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

  // ── Status ──
  'status.active':       'Active',
  'status.inactive':     'Inactive',
  'status.pending':      'Pending',
  'status.processing':   'Processing',
  'status.completed':    'Completed',
  'status.failed':       'Failed',
};

export default en;
