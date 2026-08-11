/**
 * ESLint custom rule: no-secrets
 * 
 * Detects hardcoded secrets in source code that should be in environment
 * variables or secret management. Catches common secret patterns before
 * they reach the repository.
 * 
 * Patterns detected:
 *   - API keys: strings like "sk-...", "key-...", "pk_..."
 *   - Tokens: strings like "ghp_", "gho_", "xoxb-", "glpat-..."
 *   - AWS keys: "AKIA...", "ASIA..."
 *   - Generic: password=, secret=, token= with hardcoded values
 *   - Connection strings with credentials
 *   - Private keys (-----BEGIN PRIVATE KEY-----)
 * 
 * Allowed:
 *   - process.env.X references
 *   - Template literals with env vars like `${process.env.X}`
 *   - Test fixtures in tests/** (excluded by eslint config)
 *   - Placeholder values: "your-api-key-here", "placeholder", "<", "TODO"
 *   - Short strings (< 8 chars, unlikely to be real secrets)
 *   - Boolean/numeric values
 *   - Empty strings
 */

const SECRET_PATTERNS = [
  // API key prefixes
  /\bsk-[a-zA-Z0-9]{20,}/,
  /\bkey-[a-zA-Z0-9]{20,}/,
  /\bpk_[a-zA-Z0-9]{20,}/,
  /\bra_[a-zA-Z0-9]{20,}/,
  /\brc_[a-zA-Z0-9]{20,}/,
  // GitHub tokens
  /\bghp_[a-zA-Z0-9]{30,}/,
  /\bgho_[a-zA-Z0-9]{30,}/,
  /\bghu_[a-zA-Z0-9]{30,}/,
  /\bghs_[a-zA-Z0-9]{30,}/,
  // Slack tokens
  /\bxoxb-[a-zA-Z0-9-]{30,}/,
  /\bxoxp-[a-zA-Z0-9-]{30,}/,
  /\bxoxr-[a-zA-Z0-9-]{30,}/,
  // GitLab tokens
  /\bglpat-[a-zA-Z0-9\-_]{20,}/,
  // AWS keys
  /\bAKIA[A-Z0-9]{16}/,
  /\bASIA[A-Z0-9]{16}/,
  // Private keys
  /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/,
  // Generic secret assignments
  /\b(?:password|passwd|secret|token|api_key|apikey|auth_token|access_key)\s*[:=]\s*['"`][^'"`\s<]{8,}['"`]/i,
  // Connection strings with credentials
  /\b(?:mongodb|postgres|mysql|redis|amqp):\/\/[^\s'"]+:[^\s'"]+@/i,
];

const PLACEHOLDER_PATTERN = /^(<.*>|(your|placeholder|todo|example|test|dummy|fake|mock|xxx+|changeme|insert).*)$/i;

export default {
  meta: {
    type: 'problem',
    docs: {
      description: 'Disallow hardcoded secrets, API keys, tokens, and passwords in source code',
      category: 'Security',
      recommended: true,
    },
    messages: {
      noSecrets: 'Possible hardcoded secret detected. Use environment variables (process.env.X) instead of hardcoding secrets.',
    },
    schema: [],
  },

  create(context) {
    return {
      Literal(node) {
        const value = node.value;
        
        // Skip non-strings
        if (typeof value !== 'string') return;
        
        // Skip short strings (unlikely to be secrets)
        if (value.length < 8) return;
        
        // Skip empty strings
        if (value.length === 0) return;
        
        // Skip placeholder values
        if (PLACEHOLDER_PATTERN.test(value)) return;
        
        // Skip strings that look like URLs or domains (false positives)
        if (/^(https?:\/\/|www\.|[a-z]+\.[a-z]{2,})/i.test(value)) return;
        
        // Skip import paths
        if (/^[.@/]/.test(value)) return;
        
        // Skip file paths
        if (value.includes('/') && !value.includes('://')) return;
        
        // Check against secret patterns
        for (const pattern of SECRET_PATTERNS) {
          if (pattern.test(value)) {
            context.report({
              node,
              messageId: 'noSecrets',
            });
            return; // Report once per literal
          }
        }
      },
      
      TemplateLiteral(node) {
        // Check template literal expressions for secrets in quasis
        for (const quasi of node.quasis) {
          const value = quasi.value.raw;
          
          if (!value || value.length < 8) continue;
          if (PLACEHOLDER_PATTERN.test(value)) continue;
          
          for (const pattern of SECRET_PATTERNS) {
            if (pattern.test(value)) {
              context.report({
                node,
                messageId: 'noSecrets',
              });
              return;
            }
          }
        }
      },
    };
  },
};
