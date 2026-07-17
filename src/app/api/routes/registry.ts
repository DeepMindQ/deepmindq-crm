// Auto-generated route registry
const ROUTE_REGISTRY = {
  "auth": [
    {
      "key": "auth/[...nextauth]",
      "file": "auth____catchall_nextauth",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/logout",
      "file": "auth__logout",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/reset-password",
      "file": "auth__reset-password",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/reset-password/confirm",
      "file": "auth__reset-password__confirm",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/login",
      "file": "auth__login",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/me",
      "file": "auth__me",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/update-profile",
      "file": "auth__update-profile",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/register",
      "file": "auth__register",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/change-password",
      "file": "auth__change-password",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/set-password",
      "file": "auth__set-password",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/verify-otp",
      "file": "auth__verify-otp",
      "prefixes": [
        "auth"
      ]
    },
    {
      "key": "auth/request-otp",
      "file": "auth__request-otp",
      "prefixes": [
        "auth"
      ]
    }
  ],
  "crm": [
    {
      "key": "companies",
      "file": "companies",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/mind-map",
      "file": "companies__mind-map",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/enrich",
      "file": "companies__enrich",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/stats",
      "file": "companies__stats",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/compare",
      "file": "companies__compare",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/bulk",
      "file": "companies__bulk",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/[id]",
      "file": "companies___id",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/[id]/signals",
      "file": "companies___id__signals",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/[id]/signals/[signalId]",
      "file": "companies___id__signals___signalId",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/[id]/notes",
      "file": "companies___id__notes",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/[id]/notes/[noteId]",
      "file": "companies___id__notes___noteId",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/[id]/intelligence",
      "file": "companies___id__intelligence",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/[id]/contacts",
      "file": "companies___id__contacts",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/[id]/timeline",
      "file": "companies___id__timeline",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "companies/meta",
      "file": "companies__meta",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "contacts",
      "file": "contacts",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "contacts/[id]",
      "file": "contacts___id",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "contacts/[id]/generate-email",
      "file": "contacts___id__generate-email",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "contacts/[id]/notes",
      "file": "contacts___id__notes",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "contacts/[id]/timeline",
      "file": "contacts___id__timeline",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "contacts/[id]/validate",
      "file": "contacts___id__validate",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "signals",
      "file": "signals",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "segments",
      "file": "segments",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "segments/[id]/contacts",
      "file": "segments___id__contacts",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "suppressions",
      "file": "suppressions",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "pipeline",
      "file": "pipeline",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "leads",
      "file": "leads",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "leads/dedup",
      "file": "leads__dedup",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "leads/source-stats",
      "file": "leads__source-stats",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "leads/lookalike",
      "file": "leads__lookalike",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "leads/status",
      "file": "leads__status",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "leads/recalculate-scores",
      "file": "leads__recalculate-scores",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "leads/assign",
      "file": "leads__assign",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "leads/export",
      "file": "leads__export",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "leads/consent",
      "file": "leads__consent",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "leads/schedule-optimal",
      "file": "leads__schedule-optimal",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "duplicates",
      "file": "duplicates",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "batches",
      "file": "batches",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "batches/[id]/progress",
      "file": "batches___id__progress",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "batches/preview",
      "file": "batches__preview",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    },
    {
      "key": "bounces",
      "file": "bounces",
      "prefixes": [
        "companies",
        "contacts",
        "signals",
        "segments",
        "suppressions",
        "pipeline",
        "leads",
        "duplicates",
        "batches",
        "bounces"
      ]
    }
  ],
  "ai": [
    {
      "key": "ai/suggested-contacts",
      "file": "ai__suggested-contacts",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/signals",
      "file": "ai__signals",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/recommendations",
      "file": "ai__recommendations",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/query",
      "file": "ai__query",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/chat",
      "file": "ai__chat",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/score-leads",
      "file": "ai__score-leads",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/enrich",
      "file": "ai__enrich",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/summarize",
      "file": "ai__summarize",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/opportunities",
      "file": "ai__opportunities",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/relationship-memory",
      "file": "ai__relationship-memory",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/conversation-plan",
      "file": "ai__conversation-plan",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/insights",
      "file": "ai__insights",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/account-brief",
      "file": "ai__account-brief",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "ai/generate",
      "file": "ai__generate",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "command-center/query",
      "file": "command-center__query",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "command-center/insights",
      "file": "command-center__insights",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "research-agent",
      "file": "research-agent",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "capabilities",
      "file": "capabilities",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "capabilities/import",
      "file": "capabilities__import",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "capabilities/dedup-check",
      "file": "capabilities__dedup-check",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "capabilities/enrich",
      "file": "capabilities__enrich",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "capabilities/[id]/children",
      "file": "capabilities___id__children",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "capabilities/export",
      "file": "capabilities__export",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "knowledge",
      "file": "knowledge",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "knowledge/engine",
      "file": "knowledge__engine",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "knowledge/search",
      "file": "knowledge__search",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "knowledge/search/rebuild",
      "file": "knowledge__search__rebuild",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "knowledge/search/feedback",
      "file": "knowledge__search__feedback",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "knowledge/[id]",
      "file": "knowledge___id",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "knowledge/graph",
      "file": "knowledge__graph",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "conversation-plans",
      "file": "conversation-plans",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    },
    {
      "key": "conversation-plans/[id]",
      "file": "conversation-plans___id",
      "prefixes": [
        "ai",
        "command-center",
        "research-agent",
        "capabilities",
        "knowledge",
        "conversation-plans"
      ]
    }
  ],
  "outreach": [
    {
      "key": "sequences",
      "file": "sequences",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "sequences/enroll",
      "file": "sequences__enroll",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "sequences/[id]",
      "file": "sequences___id",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "sequences/[id]/steps/[stepId]",
      "file": "sequences___id__steps___stepId",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "sequences/[id]/execute",
      "file": "sequences___id__execute",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "sequences/process",
      "file": "sequences__process",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "templates",
      "file": "templates",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "prompt-templates",
      "file": "prompt-templates",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "prompt-templates/[id]",
      "file": "prompt-templates___id",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "queue",
      "file": "queue",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "drafts",
      "file": "drafts",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "drafts/[id]",
      "file": "drafts___id",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "replies",
      "file": "replies",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "email-worker",
      "file": "email-worker",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "tracking/click",
      "file": "tracking__click",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "tracking/open",
      "file": "tracking__open",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "webhooks/bounce",
      "file": "webhooks__bounce",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "webhooks/reply",
      "file": "webhooks__reply",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "unsubscribe",
      "file": "unsubscribe",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "verify-email",
      "file": "verify-email",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "verify-queue",
      "file": "verify-queue",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    },
    {
      "key": "verify-queue/process",
      "file": "verify-queue__process",
      "prefixes": [
        "sequences",
        "templates",
        "prompt-templates",
        "queue",
        "drafts",
        "replies",
        "email-worker",
        "tracking",
        "webhooks",
        "unsubscribe",
        "verify-email",
        "verify-queue"
      ]
    }
  ],
  "strategy": [
    {
      "key": "playbooks",
      "file": "playbooks",
      "prefixes": [
        "playbooks",
        "strategy-room"
      ]
    },
    {
      "key": "playbooks/[id]",
      "file": "playbooks___id",
      "prefixes": [
        "playbooks",
        "strategy-room"
      ]
    },
    {
      "key": "strategy-room",
      "file": "strategy-room",
      "prefixes": [
        "playbooks",
        "strategy-room"
      ]
    },
    {
      "key": "strategy-room/[id]",
      "file": "strategy-room___id",
      "prefixes": [
        "playbooks",
        "strategy-room"
      ]
    }
  ],
  "data": [
    {
      "key": "stats",
      "file": "stats",
      "prefixes": [
        "stats",
        "dashboard",
        "analytics",
        "data-health",
        "team",
        "ab-tests",
        "notifications",
        "compliance",
        "audit",
        "audit-logs"
      ]
    },
    {
      "key": "dashboard",
      "file": "dashboard",
      "prefixes": [
        "stats",
        "dashboard",
        "analytics",
        "data-health",
        "team",
        "ab-tests",
        "notifications",
        "compliance",
        "audit",
        "audit-logs"
      ]
    },
    {
      "key": "analytics",
      "file": "analytics",
      "prefixes": [
        "stats",
        "dashboard",
        "analytics",
        "data-health",
        "team",
        "ab-tests",
        "notifications",
        "compliance",
        "audit",
        "audit-logs"
      ]
    },
    {
      "key": "data-health",
      "file": "data-health",
      "prefixes": [
        "stats",
        "dashboard",
        "analytics",
        "data-health",
        "team",
        "ab-tests",
        "notifications",
        "compliance",
        "audit",
        "audit-logs"
      ]
    },
    {
      "key": "team/performance",
      "file": "team__performance",
      "prefixes": [
        "stats",
        "dashboard",
        "analytics",
        "data-health",
        "team",
        "ab-tests",
        "notifications",
        "compliance",
        "audit",
        "audit-logs"
      ]
    },
    {
      "key": "ab-tests",
      "file": "ab-tests",
      "prefixes": [
        "stats",
        "dashboard",
        "analytics",
        "data-health",
        "team",
        "ab-tests",
        "notifications",
        "compliance",
        "audit",
        "audit-logs"
      ]
    },
    {
      "key": "notifications",
      "file": "notifications",
      "prefixes": [
        "stats",
        "dashboard",
        "analytics",
        "data-health",
        "team",
        "ab-tests",
        "notifications",
        "compliance",
        "audit",
        "audit-logs"
      ]
    },
    {
      "key": "compliance",
      "file": "compliance",
      "prefixes": [
        "stats",
        "dashboard",
        "analytics",
        "data-health",
        "team",
        "ab-tests",
        "notifications",
        "compliance",
        "audit",
        "audit-logs"
      ]
    },
    {
      "key": "audit",
      "file": "audit",
      "prefixes": [
        "stats",
        "dashboard",
        "analytics",
        "data-health",
        "team",
        "ab-tests",
        "notifications",
        "compliance",
        "audit",
        "audit-logs"
      ]
    },
    {
      "key": "audit-logs",
      "file": "audit-logs",
      "prefixes": [
        "stats",
        "dashboard",
        "analytics",
        "data-health",
        "team",
        "ab-tests",
        "notifications",
        "compliance",
        "audit",
        "audit-logs"
      ]
    }
  ],
  "system": [
    {
      "key": "settings",
      "file": "settings",
      "prefixes": [
        "settings",
        "seed"
      ]
    },
    {
      "key": "seed",
      "file": "seed",
      "prefixes": [
        "settings",
        "seed"
      ]
    }
  ]
} as const;
export default ROUTE_REGISTRY;
