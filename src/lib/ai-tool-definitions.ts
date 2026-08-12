/**
 * AI Tool Definitions — CRM Tool Schemas for Function Calling
 *
 * Defines tools the AI can use to query and act on CRM data in real-time.
 * Uses OpenAI-compatible function calling format.
 *
 * Each tool definition has:
 *   - name: unique tool identifier
 *   - description: what the tool does (visible to LLM for routing)
 *   - parameters: JSON Schema for the input arguments
 *
 * IMPORTANT: Tools are the bridge between the LLM's natural language understanding
 * and the actual CRM database. When the AI decides it needs data, it calls a tool
 * instead of hallucinating an answer.
 */

// ─── OpenAI-compatible tool definition types ──────────────────────────────

export interface ToolParameter {
  type: 'string' | 'number' | 'boolean' | 'integer' | 'array'
  description: string
  enum?: string[]
  items?: { type: string; description?: string }
  default?: unknown
}

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: {
      type: 'object'
      properties: Record<string, ToolParameter>
      required?: string[]
    }
  }
}

// ─── Tool Names (centralized enum to prevent typos) ──────────────────────

export const ToolName = {
  // ── Company tools ──
  SEARCH_COMPANIES: 'search_companies',
  GET_COMPANY_DETAILS: 'get_company_details',
  GET_COMPANY_SIGNALS: 'get_company_signals',
  GET_COMPANY_OPPORTUNITIES: 'get_company_opportunities',
  GET_COMPANY_SCORES: 'get_company_scores',

  // ── Contact tools ──
  SEARCH_CONTACTS: 'search_contacts',
  GET_CONTACT_DETAILS: 'get_contact_details',
  GET_CONTACT_ACTIVITY: 'get_contact_activity',

  // ── Pipeline / Pursuit tools ──
  GET_PIPELINE_SUMMARY: 'get_pipeline_summary',
  SEARCH_PURSUITS: 'search_pursuits',

  // ── Aggregate / Analytics tools ──
  GET_TOP_LEADS: 'get_top_leads',
  GET_SIGNALS_DIGEST: 'get_signals_digest',
  GET_ENGAGEMENT_STATS: 'get_engagement_stats',

  // ── Knowledge / Intelligence tools ──
  SEARCH_KNOWLEDGE: 'search_knowledge',
  GET_ACCOUNT_BRIEF: 'get_account_brief',
} as const

export type ToolNameType = (typeof ToolName)[keyof typeof ToolName]

// ─── Tool Definitions Array ──────────────────────────────────────────────

export const CRM_TOOLS: ToolDefinition[] = [
  // ═══════════════════════════════════════════════════════════════════
  // COMPANY TOOLS
  // ═══════════════════════════════════════════════════════════════════

  {
    type: 'function',
    function: {
      name: ToolName.SEARCH_COMPANIES,
      description:
        'Search for companies in the CRM by name, industry, domain, or priority tier. Returns a list of matching companies with key metrics.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term — company name, domain, or industry keyword',
          },
          industry: {
            type: 'string',
            description: 'Filter by industry (e.g. "SaaS", "Fintech", "Healthcare")',
          },
          priority_tier: {
            type: 'string',
            description: 'Filter by priority tier',
            enum: ['HOT', 'ACTIVE', 'NURTURE', 'LOW'],
          },
          min_intelligence_score: {
            type: 'integer',
            description: 'Minimum intelligence score (0-100)',
          },
          limit: {
            type: 'integer',
            description: 'Max results to return (default 10, max 50)',
          },
        },
      },
    },
  },

  {
    type: 'function',
    function: {
      name: ToolName.GET_COMPANY_DETAILS,
      description:
        'Get full details of a specific company including research card, contacts, signals, and intelligence data. Use when the user asks about a specific company.',
      parameters: {
        type: 'object',
        properties: {
          company_id: {
            type: 'string',
            description: 'The UUID of the company',
          },
        },
        required: ['company_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: ToolName.GET_COMPANY_SIGNALS,
      description:
        'Get all active signals for a specific company — buying signals, technology triggers, leadership changes, funding events, etc.',
      parameters: {
        type: 'object',
        properties: {
          company_id: {
            type: 'string',
            description: 'The UUID of the company',
          },
          signal_type: {
            type: 'string',
            description: 'Filter by signal type (e.g. "TECHNOLOGY_TRIGGER", "FUNDING_EVENT", "LEADERSHIP_CHANGE")',
          },
          severity: {
            type: 'string',
            description: 'Filter by severity',
            enum: ['high', 'medium', 'low'],
          },
          limit: {
            type: 'integer',
            description: 'Max signals to return (default 20)',
          },
        },
        required: ['company_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: ToolName.GET_COMPANY_OPPORTUNITIES,
      description:
        'Get AI-generated opportunity recommendations for a specific company — including business triggers, capability matches, and action suggestions.',
      parameters: {
        type: 'object',
        properties: {
          company_id: {
            type: 'string',
            description: 'The UUID of the company',
          },
          status: {
            type: 'string',
            description: 'Filter by status',
            enum: ['NEW', 'ACTIVE', 'PURSUING', 'WON', 'LOST', 'DISMISSED'],
          },
        },
        required: ['company_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: ToolName.GET_COMPANY_SCORES,
      description:
        'Get all scoring dimensions for a company — intelligence score, engagement score, account priority, revenue score, and score breakdown.',
      parameters: {
        type: 'object',
        properties: {
          company_id: {
            type: 'string',
            description: 'The UUID of the company',
          },
        },
        required: ['company_id'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // CONTACT TOOLS
  // ═══════════════════════════════════════════════════════════════════

  {
    type: 'function',
    function: {
      name: ToolName.SEARCH_CONTACTS,
      description:
        'Search for contacts by name, email, title, company, or lead score. Returns matching contacts with key info.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term — name, email, or title keyword',
          },
          company_id: {
            type: 'string',
            description: 'Filter by company UUID',
          },
          min_lead_score: {
            type: 'integer',
            description: 'Minimum lead score (0-100)',
          },
          status: {
            type: 'string',
            description: 'Filter by contact status',
            enum: ['active', 'engaged', 'imported', 'cleaned', 'drafted', 'queued', 'sent', 'replied', 'bounced', 'suppressed', 'archived'],
          },
          needs_follow_up: {
            type: 'boolean',
            description: 'Only return contacts that need follow-up (last contacted > 7 days ago or never)',
          },
          limit: {
            type: 'integer',
            description: 'Max results to return (default 10, max 50)',
          },
        },
      },
    },
  },

  {
    type: 'function',
    function: {
      name: ToolName.GET_CONTACT_DETAILS,
      description:
        'Get full details of a specific contact including company info, lead score breakdown, recent drafts, and engagement history.',
      parameters: {
        type: 'object',
        properties: {
          contact_id: {
            type: 'string',
            description: 'The UUID of the contact',
          },
        },
        required: ['contact_id'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: ToolName.GET_CONTACT_ACTIVITY,
      description:
        'Get recent activity for a contact — emails sent, opens, clicks, replies, drafts created, and last contacted date.',
      parameters: {
        type: 'object',
        properties: {
          contact_id: {
            type: 'string',
            description: 'The UUID of the contact',
          },
          days: {
            type: 'integer',
            description: 'Look back this many days (default 30)',
          },
        },
        required: ['contact_id'],
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // PIPELINE / PURSUIT TOOLS
  // ═══════════════════════════════════════════════════════════════════

  {
    type: 'function',
    function: {
      name: ToolName.GET_PIPELINE_SUMMARY,
      description:
        'Get a summary of the entire sales pipeline — total pursuits by status, total value, recent wins/losses, and pipeline health metrics.',
      parameters: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by pursuit status',
            enum: ['ACTIVE', 'WON', 'LOST', 'PAUSED', 'DISMISSED'],
          },
        },
      },
    },
  },

  {
    type: 'function',
    function: {
      name: ToolName.SEARCH_PURSUITS,
      description:
        'Search for active pursuits/opportunities by company, status, or owner.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search term — company name or opportunity title',
          },
          status: {
            type: 'string',
            description: 'Filter by status',
            enum: ['ACTIVE', 'WON', 'LOST', 'PAUSED', 'DISMISSED'],
          },
          limit: {
            type: 'integer',
            description: 'Max results to return (default 10)',
          },
        },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // AGGREGATE / ANALYTICS TOOLS
  // ═══════════════════════════════════════════════════════════════════

  {
    type: 'function',
    function: {
      name: ToolName.GET_TOP_LEADS,
      description:
        'Get the top-ranked leads in the CRM sorted by lead score, intelligence score, or engagement. Use when the user asks "who are my hottest leads" or "best prospects".',
      parameters: {
        type: 'object',
        properties: {
          sort_by: {
            type: 'string',
            description: 'How to rank leads',
            enum: ['lead_score', 'intelligence_score', 'engagement_score', 'account_priority'],
          },
          min_score: {
            type: 'integer',
            description: 'Minimum score threshold (0-100, default 50)',
          },
          limit: {
            type: 'integer',
            description: 'Number of leads to return (default 10, max 50)',
          },
        },
      },
    },
  },

  {
    type: 'function',
    function: {
      name: ToolName.GET_SIGNALS_DIGEST,
      description:
        'Get a digest of recent signals across all companies — what buying signals, tech triggers, funding events, or leadership changes have been detected recently.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'integer',
            description: 'Look back this many days (default 7)',
          },
          signal_type: {
            type: 'string',
            description: 'Filter by signal type',
          },
          severity: {
            type: 'string',
            description: 'Filter by severity',
            enum: ['high', 'medium', 'low'],
          },
          limit: {
            type: 'integer',
            description: 'Max signals to return (default 20)',
          },
        },
      },
    },
  },

  {
    type: 'function',
    function: {
      name: ToolName.GET_ENGAGEMENT_STATS,
      description:
        'Get engagement statistics — emails sent, opened, clicked, replied, bounced. Can filter by date range.',
      parameters: {
        type: 'object',
        properties: {
          days: {
            type: 'integer',
            description: 'Look back this many days (default 30)',
          },
          company_id: {
            type: 'string',
            description: 'Filter by company UUID',
          },
        },
      },
    },
  },

  // ═══════════════════════════════════════════════════════════════════
  // KNOWLEDGE / INTELLIGENCE TOOLS
  // ═══════════════════════════════════════════════════════════════════

  {
    type: 'function',
    function: {
      name: ToolName.SEARCH_KNOWLEDGE,
      description:
        'Search the knowledge base for research, insights, briefings, or intelligence about a topic, company, or technology.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Search query — topic, company, technology, or concept',
          },
          category: {
            type: 'string',
            description: 'Filter by knowledge category',
          },
          limit: {
            type: 'integer',
            description: 'Max results to return (default 10)',
          },
        },
        required: ['query'],
      },
    },
  },

  {
    type: 'function',
    function: {
      name: ToolName.GET_ACCOUNT_BRIEF,
      description:
        'Get the AI-generated account brief for a specific company — includes summary, health score, key signals, risks, opportunities, and recommended engagement.',
      parameters: {
        type: 'object',
        properties: {
          company_id: {
            type: 'string',
            description: 'The UUID of the company',
          },
        },
        required: ['company_id'],
      },
    },
  },
]

// ─── Utility: Get tool definitions for LLM request ──────────────────────

/**
 * Returns the tool definitions array in the format expected by OpenAI-compatible APIs.
 * Pass this as `tools` in the request body.
 */
export function getToolDefinitions(): ToolDefinition[] {
  return CRM_TOOLS
}

/**
 * Get a tool definition by name.
 */
export function getToolByName(name: string): ToolDefinition | undefined {
  return CRM_TOOLS.find((t) => t.function.name === name)
}
