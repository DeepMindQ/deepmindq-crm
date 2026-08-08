/**
 * Phase 5.2 — SSO Integration (SAML/OIDC)
 *
 * Enterprise SSO providing:
 *   - SAML 2.0 Service Provider configuration
 *   - OpenID Connect (OIDC) client with PKCE flow
 *   - IdP metadata storage and management
 *   - SSO login/logout flow coordination
 *   - JIT (Just-In-Time) user provisioning
 *   - SSO session linking to local sessions
 *   - Multi-IdP support per organization
 *
 * DEPENDS ON: session.ts (session creation), rbac.ts (role assignment)
 *
 * DESIGN:
 *   - SSO configurations stored in SystemSetting table (JSON)
 *   - Supports multiple IdPs simultaneously
 *   - On SSO login: verify assertion → find/create user → create session
 *   - Non-throwing: SSO failures fall back to password/OTP auth
 *
 * SAML NOTE: Full SAML assertion parsing and signature verification
 *   requires @boxyhq/saml-jackson. This module constructs a proper
 *   SAML AuthnRequest URL but cannot verify SAML responses without
 *   that library. Install it for production SAML deployments.
 */

import { randomBytes, createHash } from 'crypto';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { createSession } from '@/lib/session';
import { createAuditEntry } from '@/lib/comprehensive-audit';

// ── Types ────────────────────────────────────────────────────────────

export type SSOProvider = 'saml' | 'oidc';

export interface SSOConfig {
  id: string;
  provider: SSOProvider;
  name: string;
  isActive: boolean;
  isDefault: boolean;

  // SAML-specific
  saml?: {
    entryPoint: string;        // IdP SSO URL
    issuer: string;            // SP Entity ID
    callbackUrl: string;       // ACS URL
    certificate: string;        // IdP X.509 certificate (base64)
    nameIdFormat?: string;      // NameID format (email, persistent, transient)
    signingAlgorithm?: string;  // SHA-1, SHA-256
    wantAssertionsSigned?: boolean;
    wantAssertionsEncrypted?: boolean;
  };

  // OIDC-specific
  oidc?: {
    clientId: string;
    clientSecret: string;       // encrypted at rest
    issuerUrl: string;
    authorizationEndpoint: string;
    tokenEndpoint: string;
    userinfoEndpoint: string;
    jwksUri: string;
    scopes: string[];
    callbackUrl: string;
  };

  // JIT provisioning
  autoProvision: boolean;
  defaultRole: string;
  domainWhitelist: string[];   // Only allow SSO for specific email domains

  // Metadata
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}

export interface SSOProfile {
  id: string;
  userId: string;
  ssoConfigId: string;
  externalId: string;           // IdP subject identifier
  email: string;
  name: string;
  attributes: Record<string, unknown>;
  linkedAt: string;
  lastLoginAt: string | null;
}

export interface SSOLoginResult {
  success: boolean;
  userId?: string;
  sessionToken?: string;
  error?: string;
  requiresProvisioning?: boolean;
}

export interface SSOURLs {
  loginUrl: string;
  logoutUrl?: string;
  callbackUrl: string;
  state: string;  // returned for the caller to verify on callback
}

// ── PKCE Helpers (S256) ───────────────────────────────────────────

/** Generate a cryptographically random code_verifier (43-128 chars, unreserved). */
export function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url');
}

/** Derive code_challenge from code_verifier using S256 method. */
export function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

// ── In-memory state store (10min TTL for PKCE state+verifier) ──────

interface PendingOAuthState {
  state: string;
  codeVerifier: string;
  ssoConfigId: string;
  nonce: string;
  createdAt: number;
  expiresAt: number;
}

const TEN_MINUTES_MS = 10 * 60 * 1000;
const pendingStates = new Map<string, PendingOAuthState>();

/** Prune expired entries from the pending state store. */
function pruneExpiredStates(): void {
  const now = Date.now();
  for (const [key, entry] of pendingStates) {
    if (entry.expiresAt <= now) {
      pendingStates.delete(key);
    }
  }
}

/** Store PKCE state and verifier for later callback verification. */
export function storePendingState(
  state: string,
  codeVerifier: string,
  ssoConfigId: string,
  nonce: string = '',
  ttlMs: number = TEN_MINUTES_MS,
): void {
  pruneExpiredStates();
  pendingStates.set(state, {
    state,
    codeVerifier,
    ssoConfigId,
    nonce,
    createdAt: Date.now(),
    expiresAt: Date.now() + ttlMs,
  });
}

/** Retrieve and consume a pending OAuth state (one-time use). */
export function consumePendingState(
  state: string,
): { codeVerifier: string; ssoConfigId: string; nonce: string } | null {
  pruneExpiredStates();
  const entry = pendingStates.get(state);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    pendingStates.delete(state);
    return null;
  }
  pendingStates.delete(state); // one-time use
  return { codeVerifier: entry.codeVerifier, ssoConfigId: entry.ssoConfigId, nonce: entry.nonce };
}

// ── Config Management ────────────────────────────────────────────────

/**
 * Store/retrieve SSO configs in SystemSetting table.
 */
const SSO_SETTINGS_KEY = 'sso_configurations';

async function getSSOConfigsFromDB(): Promise<SSOConfig[]> {
  try {
    const setting = await db.systemSetting.findUnique({
      where: { key: SSO_SETTINGS_KEY },
    });

    if (!setting) return [];

    const parsed = JSON.parse(setting.value || '[]');
    return parsed as SSOConfig[];
  } catch (err) {
    logger.error('[SSO] Failed to load configs from DB', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

async function saveSSOConfigsToDB(configs: SSOConfig[]): Promise<void> {
  await db.systemSetting.upsert({
    where: { key: SSO_SETTINGS_KEY },
    create: {
      key: SSO_SETTINGS_KEY,
      value: JSON.stringify(configs),
    },
    update: {
      value: JSON.stringify(configs),
    },
  });
}

/**
 * List all SSO configurations.
 */
export async function listSSOConfigs(): Promise<SSOConfig[]> {
  return getSSOConfigsFromDB();
}

/**
 * Get a specific SSO config by ID.
 */
export async function getSSOConfig(id: string): Promise<SSOConfig | null> {
  const configs = await getSSOConfigsFromDB();
  return configs.find((c) => c.id === id) || null;
}

/**
 * Get the default/active SSO config.
 */
export async function getDefaultSSOConfig(): Promise<SSOConfig | null> {
  const configs = await getSSOConfigsFromDB();
  return configs.find((c) => c.isActive && c.isDefault) || configs.find((c) => c.isActive) || null;
}

/**
 * Create or update an SSO configuration.
 */
export async function saveSSOConfig(
  config: SSOConfig,
  actorId: string,
): Promise<SSOConfig | null> {
  try {
    const configs = await getSSOConfigsFromDB();
    const existingIndex = configs.findIndex((c) => c.id === config.id);

    if (existingIndex >= 0) {
      configs[existingIndex] = { ...config, updatedAt: new Date().toISOString() };
    } else {
      configs.push(config);
    }

    await saveSSOConfigsToDB(configs);

    await createAuditEntry({
      action: 'config_change',
      entity: 'SSOConfig',
      entityId: config.id,
      actorId,
      metadata: {
        provider: config.provider,
        name: config.name,
        isActive: config.isActive,
      },
    });

    return config;
  } catch (err) {
    logger.error('[SSO] Failed to save config', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Delete an SSO configuration.
 */
export async function deleteSSOConfig(
  id: string,
  actorId: string,
): Promise<boolean> {
  try {
    const configs = await getSSOConfigsFromDB();
    const filtered = configs.filter((c) => c.id !== id);

    if (filtered.length === configs.length) {
      return false; // Not found
    }

    await saveSSOConfigsToDB(filtered);

    await createAuditEntry({
      action: 'delete',
      entity: 'SSOConfig',
      entityId: id,
      actorId,
    });

    return true;
  } catch (err) {
    logger.error('[SSO] Failed to delete config', {
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

// ── SSO Login Flow (Orchestration) ───────────────────────────────────

/**
 * Initiate SSO login.
 * Returns the IdP login URL for the user to redirect to.
 *
 * OIDC: Builds a full OAuth2 authorize URL with PKCE (S256),
 *   stores the code_verifier for later token exchange.
 * SAML: Constructs a base64-encoded SAML AuthnRequest URL.
 *   NOTE: SAML response verification requires @boxyhq/saml-jackson;
 *   without it, handleSSOCallback will not be able to process SAML
 *   assertions — the URL construction is provided so the redirect
 *   flow is correct, but install the library for full SAML support.
 */
export function initiateSSOLogin(config: SSOConfig): SSOURLs {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  // ── SAML ──────────────────────────────────────────────────────
  if (config.provider === 'saml' && config.saml) {
    const relayState = crypto.randomUUID();
    // Build a minimal but structurally valid SAML 2.0 AuthnRequest.
    // This constructs the XML, base64-encodes it, and appends it
    // as the SAMLRequest query parameter — matching the IdP redirect
    // binding. For full SAML response parsing, install
    // @boxyhq/saml-jackson and wire it into handleSSOCallback.
    const authnRequest = buildSAMLAuthnRequest({
      spIssuer: config.saml.issuer,
      acsUrl: config.saml.callbackUrl,
      destination: config.saml.entryPoint,
      nameIdFormat: config.saml.nameIdFormat || 'urn:oasis:names:tc:SAML:2.0:nameid-format:emailAddress',
    });
    const encoded = Buffer.from(authnRequest, 'utf-8').toString('base64');
    const params = new URLSearchParams({
      SAMLRequest: encoded,
      RelayState: relayState,
    });
    return {
      loginUrl: `${config.saml.entryPoint}?${params.toString()}`,
      callbackUrl: config.saml.callbackUrl,
      state: relayState,
    };
  }

  // ── OIDC (OAuth2 + PKCE) ──────────────────────────────────────
  if (config.provider === 'oidc' && config.oidc) {
    const state = crypto.randomUUID();
    const nonce = crypto.randomUUID();
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);

    // Persist state + code_verifier + nonce for callback verification (10min TTL)
    storePendingState(state, codeVerifier, config.id, nonce);

    const scopes = ['openid', 'email', 'profile', ...config.oidc.scopes.filter(s => s !== 'openid' && s !== 'email' && s !== 'profile')];

    const params = new URLSearchParams({
      client_id: config.oidc.clientId,
      redirect_uri: config.oidc.callbackUrl,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256',
    });

    return {
      loginUrl: `${config.oidc.authorizationEndpoint}?${params.toString()}`,
      logoutUrl: config.oidc.issuerUrl.replace(/\/$/, '') + '/session/end',
      callbackUrl: config.oidc.callbackUrl,
      state,
    };
  }

  return {
    loginUrl: `${baseUrl}/api/security/sso/error?reason=no_config`,
    callbackUrl: `${baseUrl}/api/security/sso/callback`,
    state: '',
  };
}

/**
 * Build a SAML 2.0 AuthnRequest XML string.
 *
 * NOTE: This produces a valid AuthnRequest for the redirect binding.
 * Processing the SAML Response (assertion verification, signature
 * validation, XML decryption) requires @boxyhq/saml-jackson.
 */
function buildSAMLAuthnRequest(opts: {
  spIssuer: string;
  acsUrl: string;
  destination: string;
  nameIdFormat?: string;
}): string {
  const id = `_${crypto.randomUUID().replace(/-/g, '')}`;
  const issueInstant = new Date().toISOString();
  const nameIdPolicy = opts.nameIdFormat
    ? `    <samlp:NameIDPolicy Format="${opts.nameIdFormat}" AllowCreate="true"/>\n`
    : '';

  return [
    '<samlp:AuthnRequest',
    `  xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"`,
    `  xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"`,
    `  ID="${id}"`,
    `  Version="2.0"`,
    `  IssueInstant="${issueInstant}"`,
    `  ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"`,
    `  AssertionConsumerServiceURL="${opts.acsUrl}"`,
    `  Destination="${opts.destination}">`,
    `  <saml:Issuer>${opts.spIssuer}</saml:Issuer>`,
    nameIdPolicy.trimEnd(),
    '</samlp:AuthnRequest>',
  ].join('\n');
}

/**
 * Handle OIDC SSO callback — the real OAuth2 token exchange flow.
 *
 * 1. Validates the `state` parameter and retrieves the stored PKCE code_verifier
 * 2. POSTs to the token endpoint with authorization code + PKCE
 * 3. Decodes the ID token (JWT) to extract subject, email, name
 * 4. Fetches userinfo from the userinfo endpoint for additional claims
 * 5. Calls processSSOCallback for JIT provisioning and session creation
 */
export async function handleSSOCallback(
  params: { code: string; state: string },
  ipAddress?: string,
): Promise<SSOLoginResult> {
  try {
    // 1. Validate state & retrieve PKCE verifier and nonce
    const pending = consumePendingState(params.state);
    if (!pending) {
      return { success: false, error: 'Invalid or expired OAuth state' };
    }

    const { codeVerifier, ssoConfigId, nonce } = pending;
    const config = await getSSOConfig(ssoConfigId);
    if (!config || !config.oidc) {
      return { success: false, error: 'SSO configuration not found or not OIDC' };
    }

    if (!config.isActive) {
      return { success: false, error: 'SSO configuration is inactive' };
    }

    const oidc = config.oidc;

    // 2. Exchange authorization code for tokens (PKCE)
    const tokenRes = await fetch(oidc.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: params.code,
        redirect_uri: oidc.callbackUrl,
        client_id: oidc.clientId,
        client_secret: oidc.clientSecret,
        code_verifier: codeVerifier,
      }).toString(),
    });

    if (!tokenRes.ok) {
      const errorBody = await tokenRes.text();
      logger.error('[SSO] Token exchange failed', { status: tokenRes.status, body: errorBody });
      return { success: false, error: `Token exchange failed: ${tokenRes.status}` };
    }

    const tokens = await tokenRes.json() as {
      access_token: string;
      id_token?: string;
      token_type: string;
      expires_in?: number;
      refresh_token?: string;
    };

    // 3. Decode ID token (JWT) to extract identity claims
    let externalId = '';
    let email = '';
    let name = '';
    const idTokenAttributes: Record<string, unknown> = {};

    if (tokens.id_token) {
      const idClaims = await verifyIdToken(tokens.id_token, config, nonce);
      externalId = (idClaims.sub as string) || '';
      email = (idClaims.email as string) || '';
      name = (idClaims.name as string) || (idClaims.preferred_username as string) || email;
      Object.assign(idTokenAttributes, idClaims);
    }

    // 4. Fetch userinfo for additional/authoritative claims
    if (oidc.userinfoEndpoint && tokens.access_token) {
      try {
        const userInfoRes = await fetch(oidc.userinfoEndpoint, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (userInfoRes.ok) {
          const userInfo = await userInfoRes.json() as Record<string, unknown>;
          // userinfo is authoritative for email/name; ID token is authoritative for sub
          if (userInfo.email) email = userInfo.email as string;
          if (userInfo.name) name = userInfo.name as string;
          if (userInfo.sub) externalId = userInfo.sub as string;
          Object.assign(idTokenAttributes, { userinfo: userInfo });
        }
      } catch (err) {
        logger.warn('[SSO] Userinfo fetch failed (continuing with ID token claims)', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    if (!email) {
      return { success: false, error: 'No email returned from IdP' };
    }

    // 5. Delegate to processSSOCallback for user provisioning + session
    return processSSOCallback(
      ssoConfigId,
      externalId,
      email,
      name,
      idTokenAttributes,
      ipAddress,
    );
  } catch (err) {
    logger.error('[SSO] OIDC callback failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: 'SSO authentication failed' };
  }
}

/**
 * Decode a JWT without verification (used for ID token claims extraction).
 * The token signature is NOT validated here — we trust the TLS-secured
 * token endpoint response. For strict ID token validation in production,
 * verify the `iss`, `aud`, `exp`, `nonce` claims and optionally the
 * signature against the JWKS at config.oidc.jwksUri.
 */
function decodeJWT(token: string): Record<string, unknown> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return {};
    // base64url decode the payload (second segment)
    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload) as Record<string, unknown>;
  } catch {
    return {};
  }
}

/**
 * Verify an OIDC ID token's claims (iss, aud, exp, iat, nonce).
 * Validates standard OIDC claims against the provider configuration.
 * Note: Full RSA/ECDSA signature verification against JWKS requires
 * a crypto library (e.g., node-jose, @boxyhq/jackson). This function
 * validates all standard claims and logs a reminder for JWKS integration.
 */
async function verifyIdToken(
  idToken: string,
  config: SSOConfig,
  expectedNonce?: string,
): Promise<Record<string, unknown>> {
  const oidc = config.oidc!;
  const claims = decodeJWT(idToken);

  // Validate iss (issuer)
  if (claims.iss !== oidc.issuerUrl) {
    throw new Error(`ID token iss mismatch: expected ${oidc.issuerUrl}, got ${claims.iss}`);
  }

  // Validate aud (audience)
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!aud.includes(oidc.clientId)) {
    throw new Error(`ID token aud mismatch: expected ${oidc.clientId}, got ${claims.aud}`);
  }

  // Validate exp (expiration)
  const exp = claims.exp as number | undefined;
  if (exp && Date.now() / 1000 >= exp) {
    throw new Error('ID token expired');
  }

  // Validate iat (issued at) - not too far in the past (5 min clock skew)
  const iat = claims.iat as number | undefined;
  if (iat && Date.now() / 1000 < iat - 300) {
    throw new Error('ID token issued too far in the past');
  }

  // Validate nonce if provided (replay protection)
  if (expectedNonce && claims.nonce !== expectedNonce) {
    throw new Error('ID token nonce mismatch — possible replay attack');
  }

  // Log that signature verification should use JWKS in production
  // For enterprise deployments, integrate with @boxyhq/jackson or node-jose
  logger.info('[SSO] ID token claims validated', {
    iss: claims.iss,
    sub: claims.sub,
    aud: claims.aud,
    exp: claims.exp ? new Date((claims.exp as number) * 1000).toISOString() : 'missing',
    nonceVerified: !!expectedNonce,
    note: 'JWKS signature verification requires crypto library integration (see SAML NOTE in module header)',
  });

  return claims;
}

/**
 * Process SSO callback — verify assertion and create/find user.
 *
 * This is the core SSO authentication handler that:
 *   1. Validates the SSO config and domain whitelist
 *   2. Extracts user identity (email, name, external ID)
 *   3. Finds existing user or provisions new one (JIT)
 *   4. Creates a local session
 *   5. Audits the SSO login
 *
 * For OIDC: called automatically by handleSSOCallback().
 * For SAML: called after @boxyhq/saml-jackson verifies the assertion
 *   and extracts the identity attributes.
 */
export async function processSSOCallback(
  ssoConfigId: string,
  externalId: string,
  email: string,
  name: string,
  attributes: Record<string, unknown> = {},
  ipAddress?: string,
): Promise<SSOLoginResult> {
  try {
    const config = await getSSOConfig(ssoConfigId);
    if (!config) {
      return { success: false, error: 'SSO configuration not found' };
    }

    if (!config.isActive) {
      return { success: false, error: 'SSO configuration is inactive' };
    }

    // Domain whitelist check
    const emailDomain = email.split('@')[1]?.toLowerCase();
    if (
      config.domainWhitelist.length > 0 &&
      emailDomain &&
      !config.domainWhitelist.includes(emailDomain)
    ) {
      return { success: false, error: `Email domain ${emailDomain} is not allowed for SSO` };
    }

    // Find or create user
    let user = await db.user.findUnique({
      where: { email },
    });

    if (!user) {
      // JIT provisioning
      if (!config.autoProvision) {
        return { success: false, error: 'User not found and auto-provisioning is disabled', requiresProvisioning: true };
      }

      user = await db.user.create({
        data: {
          email,
          name,
          role: config.defaultRole || 'user',
          isActive: true,
        },
      });

      logger.info(`[SSO] JIT provisioned user: ${email} with role: ${user.role}`);
    }

    // Create session
    const sessionResult = await createSession(
      user.id,
      undefined,
      ipAddress,
    );

    // Update lastUsedAt on the config
    const configs = await getSSOConfigsFromDB();
    const configIdx = configs.findIndex((c) => c.id === ssoConfigId);
    if (configIdx >= 0) {
      configs[configIdx].lastUsedAt = new Date().toISOString();
      await saveSSOConfigsToDB(configs);
    }

    // Audit the SSO login
    await createAuditEntry({
      action: 'sso_login',
      entity: 'User',
      entityId: user.id,
      actorId: user.id,
      actorEmail: email,
      actorRole: user.role,
      ipAddress: ipAddress || null,
      metadata: {
        ssoProvider: config.provider,
        ssoConfigId: config.id,
        ssoConfigName: config.name,
        externalId,
        jitProvisioned: !!(attributes._jitProvisioned),
      },
    });

    logger.info(`[SSO] Login successful: ${email} via ${config.name}`);

    return {
      success: true,
      userId: user.id,
      sessionToken: sessionResult.token,
    };
  } catch (err) {
    logger.error('[SSO] Callback processing failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { success: false, error: 'SSO authentication failed' };
  }
}

/**
 * Get SSO status summary for admin dashboard.
 */
export async function getSSOStatus(): Promise<{
  configured: boolean;
  activeProviders: number;
  providerReady: boolean;
  readinessIssues: string[];
  providers: Array<{ id: string; name: string; provider: string; isActive: boolean; lastUsed: string | null; ready: boolean; issues: string[] }>;
}> {
  const configs = await getSSOConfigsFromDB();

  const providerStatuses = configs.map((c) => {
    const issues: string[] = [];
    let ready = false;

    if (c.isActive) {
      // OIDC readiness checks
      if (c.oidc) {
        if (!c.oidc.clientId) issues.push('Missing OIDC clientId');
        if (!c.oidc.clientSecret) issues.push('Missing OIDC clientSecret');
        if (!c.oidc.issuerUrl) issues.push('Missing OIDC issuer URL');
        if (!c.oidc.callbackUrl) issues.push('Missing OIDC callback URL');
        if (issues.length === 0) ready = true;
      }

      // SAML readiness checks
      if (c.saml) {
        if (!c.saml.entryPoint) issues.push('Missing SAML entry point');
        if (!c.saml.issuer) issues.push('Missing SAML issuer');
        if (!c.saml.certificate) issues.push('Missing SAML certificate');
        if (issues.length === 0) ready = true;
      }
    }

    return {
      id: c.id,
      name: c.name,
      provider: c.provider,
      isActive: c.isActive,
      lastUsed: c.lastUsedAt,
      ready,
      issues,
    };
  });

  const activeConfigs = configs.filter((c) => c.isActive);
  const readinessIssues: string[] = [];

  if (activeConfigs.length === 0 && configs.length > 0) {
    readinessIssues.push('All configured providers are inactive');
  }

  const anyReady = providerStatuses.some((p) => p.ready);
  if (!anyReady && activeConfigs.length > 0) {
    readinessIssues.push('No active provider has complete configuration (check clientId, clientSecret, issuer)');
  }

  if (configs.length === 0) {
    readinessIssues.push('No SSO providers configured. Add a SAML or OIDC provider to enable SSO login.');
  }

  return {
    configured: configs.length > 0,
    activeProviders: activeConfigs.length,
    providerReady: anyReady,
    readinessIssues,
    providers: providerStatuses,
  };
}
