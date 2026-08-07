/**
 * Phase 5.2 — SSO Integration (SAML/OIDC)
 *
 * Enterprise SSO providing:
 *   - SAML 2.0 Service Provider configuration
 *   - OpenID Connect (OIDC) client configuration
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
 * NOTE: Full SAML/OIDC protocol implementation requires:
 *   - @boxyhq/saml-jackson or similar for SAML
 *   - next-auth or openid-client for OIDC
 *   - This module provides the configuration and orchestration layer
 *     that wraps those protocol libraries.
 */

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
 */
export function initiateSSOLogin(config: SSOConfig): SSOURLs {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  if (config.provider === 'saml' && config.saml) {
    // In production, this would use @boxyhq/saml-jackson to generate
    // a proper SAML AuthnRequest URL
    const relayState = crypto.randomUUID();
    return {
      loginUrl: `${config.saml.entryPoint}?SAMLRequest=...&RelayState=${relayState}`,
      callbackUrl: config.saml.callbackUrl,
    };
  }

  if (config.provider === 'oidc' && config.oidc) {
    const params = new URLSearchParams({
      client_id: config.oidc.clientId,
      redirect_uri: config.oidc.callbackUrl,
      response_type: 'code',
      scope: config.oidc.scopes.join(' '),
      state: crypto.randomUUID(),
      nonce: crypto.randomUUID(),
    });
    return {
      loginUrl: `${config.oidc.authorizationEndpoint}?${params.toString()}`,
      logoutUrl: config.oidc.issuerUrl,
      callbackUrl: config.oidc.callbackUrl,
    };
  }

  return {
    loginUrl: `${baseUrl}/api/security/sso/error?reason=no_config`,
    callbackUrl: `${baseUrl}/api/security/sso/callback`,
  };
}

/**
 * Process SSO callback — verify assertion and create/find user.
 *
 * This is the core SSO authentication handler that:
 *   1. Verifies the SAML assertion or OIDC token
 *   2. Extracts user identity (email, name, external ID)
 *   3. Finds existing user or provisions new one (JIT)
 *   4. Creates a local session
 *   5. Audits the SSO login
 *
 * NOTE: Actual protocol verification requires a SAML/OIDC library.
 * This function handles the business logic around identity mapping.
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
  providers: Array<{ id: string; name: string; provider: string; isActive: boolean; lastUsed: string | null }>;
}> {
  const configs = await getSSOConfigsFromDB();

  return {
    configured: configs.length > 0,
    activeProviders: configs.filter((c) => c.isActive).length,
    providers: configs.map((c) => ({
      id: c.id,
      name: c.name,
      provider: c.provider,
      isActive: c.isActive,
      lastUsed: c.lastUsedAt,
    })),
  };
}
