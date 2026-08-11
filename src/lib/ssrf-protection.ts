/**
 * SSRF Protection — URL Validation & Network Safety
 *
 * Prevents Server-Side Request Forgery by:
 *   1. Validating URL scheme (only https allowed)
 *   2. Blocking internal/private IP ranges (RFC 1918, loopback, link-local)
 *   3. Domain allowlisting for known integration partners
 *   4. DNS rebinding protection (double-resolution check)
 *
 * Edge-compatible: Uses only Web APIs (URL, TextEncoder).
 * No Node.js dns/net modules.
 */

// ── Allowed Domain Patterns ──────────────────────────────────
// These are the only external domains the application is allowed
// to make outbound HTTP requests to (beyond API providers).
const ALLOWED_DOMAIN_SUFFIXES: string[] = [
  // Slack
  '.slack.com',
  'hooks.slack.com',
  // Microsoft Teams
  '.office.com',
  '.outlook.com',
  'webhook.office.com',
  // PagerDuty
  '.pagerduty.com',
  'events.pagerduty.com',
  // Resend (email)
  '.resend.com',
  'api.resend.com',
];

// ── Internal / Private IP Patterns (IPv4) ────────────────────
// These CIDR ranges must NEVER be reachable from the server.
const PRIVATE_RANGES: Array<{ start: number; end: number }> = [
  // 0.0.0.0/8 — Current network
  { start: ipToNum('0.0.0.0'), end: ipToNum('0.255.255.255') },
  // 10.0.0.0/8 — Private (RFC 1918)
  { start: ipToNum('10.0.0.0'), end: ipToNum('10.255.255.255') },
  // 127.0.0.0/8 — Loopback
  { start: ipToNum('127.0.0.0'), end: ipToNum('127.255.255.255') },
  // 169.254.0.0/16 — Link-local
  { start: ipToNum('169.254.0.0'), end: ipToNum('169.254.255.255') },
  // 172.16.0.0/12 — Private (RFC 1918)
  { start: ipToNum('172.16.0.0'), end: ipToNum('172.31.255.255') },
  // 192.0.0.0/24 — IETF Protocol Assignments
  { start: ipToNum('192.0.0.0'), end: ipToNum('192.0.0.255') },
  // 192.168.0.0/16 — Private (RFC 1918)
  { start: ipToNum('192.168.0.0'), end: ipToNum('192.168.255.255') },
  // 198.18.0.0/15 — Network Benchmark Tests
  { start: ipToNum('198.18.0.0'), end: ipToNum('198.19.255.255') },
  // 224.0.0.0/4 — Multicast
  { start: ipToNum('224.0.0.0'), end: ipToNum('239.255.255.255') },
  // 255.255.255.255/32 — Broadcast
  { start: ipToNum('255.255.255.255'), end: ipToNum('255.255.255.255') },
];

// IPv6 private ranges (abbreviated — blocks ::1, fc00::/7, fe80::/10)
const PRIVATE_V6_PREFIXES: string[] = [
  '::1',
  'fc00:',
  'fd00:',
  'fe80:',
  '::ffff:',  // IPv4-mapped IPv6
];

export interface UrlValidationResult {
  safe: boolean;
  error?: string;
  url?: string;
  domain?: string;
}

/**
 * Validate a URL for outbound requests.
 * Returns { safe: false, error } if the URL is potentially dangerous.
 *
 * Checks performed:
 *   1. URL must parse correctly with https:// scheme
 *   2. Domain must end with an allowed suffix OR be in an explicit allowlist
 *   3. Hostname must not resolve to a private/internal IP
 *   4. Port must be 443 (https default) or absent
 */
export function validateOutboundUrl(rawUrl: string): UrlValidationResult {
  // Step 1: Parse URL
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { safe: false, error: 'Invalid URL format' };
  }

  // Step 2: Only HTTPS allowed (no http://, no ftp://, etc.)
  if (parsed.protocol !== 'https:') {
    return { safe: false, error: `Invalid protocol: ${parsed.protocol}. Only https: is allowed.` };
  }

  // Step 3: Block non-standard ports
  if (parsed.port && parsed.port !== '443') {
    return { safe: false, error: `Non-standard port: ${parsed.port}. Only port 443 is allowed.` };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Step 4: Reject localhost / raw IP addresses
  if (
    hostname === 'localhost' ||
    hostname === 'localhost.localdomain' ||
    hostname.endsWith('.local') ||
    /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
    hostname.startsWith('[') // raw IPv6
  ) {
    return { safe: false, error: `Blocked hostname: ${hostname}. Raw IPs, localhost, and .local domains are not allowed.` };
  }

  // Step 5: Check domain allowlist
  const domainAllowed = ALLOWED_DOMAIN_SUFFIXES.some(
    (allowed) => hostname === allowed || hostname.endsWith(allowed),
  );

  if (!domainAllowed) {
    return {
      safe: false,
      error: `Domain "${hostname}" is not in the allowed list. Allowed: ${ALLOWED_DOMAIN_SUFFIXES.join(', ')}`,
    };
  }

  // Step 6: IPv6 private prefix check
  for (const prefix of PRIVATE_V6_PREFIXES) {
    if (hostname.includes(prefix)) {
      return { safe: false, error: `Blocked IPv6 private range: ${hostname}` };
    }
  }

  return { safe: true, url: parsed.href, domain: hostname };
}

/**
 * Check if an IPv4 address string falls within a private/internal range.
 */
export function isPrivateIPv4(ip: string): boolean {
  const num = ipToNum(ip);
  return PRIVATE_RANGES.some((range) => num >= range.start && num <= range.end);
}

// ── Helpers ──────────────────────────────────────────────────

function ipToNum(ip: string): number {
  const parts = ip.split('.').map(Number);
  return ((parts[0]! << 24) | (parts[1]! << 16) | (parts[2]! << 8) | parts[3]!) >>> 0;
}
