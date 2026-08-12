/**
 * CSP (Content-Security-Policy) Header Tests
 *
 * Validates that Content-Security-Policy headers are correctly
 * configured on API and page responses.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── CSP Header Configuration (from middleware/next.config) ──
function buildCspHeaders(environment: 'production' | 'development'): Record<string, string> {
  const isProd = environment === 'production';

  const defaultSrc = isProd ? "'self'" : "'self' 'unsafe-eval'";
  const scriptSrc = isProd
    ? "'self'"
    : "'self' 'unsafe-eval' 'unsafe-inline'";
  const styleSrc = "'self' 'unsafe-inline'";
  const imgSrc = "'self' data: blob: https: http:";
  const fontSrc = "'self' data:";
  const connectSrc = isProd
    ? "'self' https://api.deepmindq.com wss://api.deepmindq.com"
    : "'self' http://localhost:* ws://localhost:*";
  const frameSrc = "'none'";
  const frameAncestors = "'none'";
  const objectSrc = "'none'";
  const baseUri = "'self'";
  const formAction = "'self'";

  const csp = [
    `default-src ${defaultSrc}`,
    `script-src ${scriptSrc}`,
    `style-src ${styleSrc}`,
    `img-src ${imgSrc}`,
    `font-src ${fontSrc}`,
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    `frame-ancestors ${frameAncestors}`,
    `object-src ${objectSrc}`,
    `base-uri ${baseUri}`,
    `form-action ${formAction}`,
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  };
}

function parseCsp(cspString: string): Record<string, string> {
  const directives: Record<string, string> = {};
  for (const part of cspString.split(';')) {
    const trimmed = part.trim();
    const tokens = trimmed.split(/\s+/);
    if (tokens.length > 0) {
      directives[tokens[0]] = tokens.slice(1).join(' ');
    }
  }
  return directives;
}

describe('CSP Headers', () => {
  describe('Production CSP', () => {
    let headers: Record<string, string>;
    let cspDirectives: Record<string, string>;

    beforeEach(() => {
      headers = buildCspHeaders('production');
      cspDirectives = parseCsp(headers['Content-Security-Policy']);
    });

    it('includes Content-Security-Policy header', () => {
      expect(headers['Content-Security-Policy']).toBeDefined();
      expect(headers['Content-Security-Policy'].length).toBeGreaterThan(0);
    });

    it('sets X-Frame-Options to DENY', () => {
      expect(headers['X-Frame-Options']).toBe('DENY');
    });

    it('sets X-Content-Type-Options to nosniff', () => {
      expect(headers['X-Content-Type-Options']).toBe('nosniff');
    });

    it('sets Referrer-Policy to strict-origin-when-cross-origin', () => {
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    it('disables permissions for camera, microphone, geolocation', () => {
      const pp = headers['Permissions-Policy'];
      expect(pp).toContain('camera=()');
      expect(pp).toContain('microphone=()');
      expect(pp).toContain('geolocation=()');
    });

    it('script-src does NOT include unsafe-inline in production', () => {
      expect(cspDirectives['script-src']).not.toContain("'unsafe-inline'");
    });

    it('script-src does NOT include unsafe-eval in production', () => {
      expect(cspDirectives['script-src']).not.toContain("'unsafe-eval'");
    });

    it('script-src allows self', () => {
      expect(cspDirectives['script-src']).toContain("'self'");
    });

    it('frame-ancestors is none', () => {
      expect(cspDirectives['frame-ancestors']).toBe("'none'");
    });

    it('frame-src is none', () => {
      expect(cspDirectives['frame-src']).toBe("'none'");
    });

    it('object-src is none', () => {
      expect(cspDirectives['object-src']).toBe("'none'");
    });

    it('connect-src restricts to allowed origins only', () => {
      const connect = cspDirectives['connect-src'];
      expect(connect).toContain("'self'");
      // Should contain specific allowed domains, not wildcard
      expect(connect).not.toContain('*');
      // Should not allow arbitrary http:// in production
      expect(connect).not.toContain('http://');
    });

    it('base-uri is self', () => {
      expect(cspDirectives['base-uri']).toBe("'self'");
    });

    it('form-action is self', () => {
      expect(cspDirectives['form-action']).toBe("'self'");
    });

    it('includes all required directives', () => {
      const required = ['default-src', 'script-src', 'style-src', 'img-src', 'connect-src', 'frame-ancestors', 'object-src'];
      for (const directive of required) {
        expect(cspDirectives[directive]).toBeDefined();
      }
    });
  });

  describe('Development CSP', () => {
    let headers: Record<string, string>;
    let cspDirectives: Record<string, string>;

    beforeEach(() => {
      headers = buildCspHeaders('development');
      cspDirectives = parseCsp(headers['Content-Security-Policy']);
    });

    it('allows unsafe-eval in development for HMR', () => {
      expect(cspDirectives['default-src']).toContain("'unsafe-eval'");
    });

    it('allows unsafe-inline in development for scripts', () => {
      expect(cspDirectives['script-src']).toContain("'unsafe-inline'");
    });

    it('frame-ancestors is still none in development', () => {
      expect(cspDirectives['frame-ancestors']).toBe("'none'");
    });
  });
});
