/**
 * Task 4.5 — CRM Integration Framework: Unified Connector Interface
 *
 * Defines the abstract contract that every CRM provider adapter
 * (Salesforce, HubSpot, etc.) must implement. Follows the same
 * connector pattern established by clearbit-connector.ts.
 *
 * All actual API calls use configurable base URLs from env vars
 * so this framework works without real credentials during development.
 */

import { salesforceAdapter } from './salesforce-adapter';
import { tokens } from '@/lib/design-tokens';
import { hubSpotAdapter } from './hubspot-adapter';

// ─── Connector Registry ──────────────────────────────────────────

const connectors: Record<string, CRMConnector> = {
  salesforce: salesforceAdapter,
  hubspot: hubSpotAdapter,
};

/**
 * Resolve a CRMConnector by provider name.
 * Returns null if no connector is registered for the provider.
 */
export function getConnectorForProvider(
  provider: string,
): CRMConnector | null {
  return connectors[provider] || null;
}

/**
 * List all registered CRM providers.
 */
export function getRegisteredProviders(): CRMConnector[] {
  return Object.values(connectors);
}

// ─── OAuth Token Types ──────────────────────────────────────────────

export interface CRMToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  instanceUrl?: string;
  scopes?: string[];
}

// ─── Fetch Options ─────────────────────────────────────────────────

export interface CRMFetchOptions {
  /** Maximum number of records to fetch (default: 100) */
  limit?: number;
  /** Cursor / offset for pagination */
  offset?: string;
  /** SOQL where clause (Salesforce) or filter string (HubSpot) */
  filter?: string;
  /** Fields to include (default: all mapped fields) */
  fields?: string[];
  /** ISO date string — only fetch records modified after this date */
  modifiedAfter?: string;
}

// ─── CRM Entity Types ───────────────────────────────────────────────

export interface CRMAccount {
  externalId: string;
  name: string;
  domain?: string;
  industry?: string;
  description?: string;
  employeeCount?: number;
  revenue?: number;
  phone?: string;
  website?: string;
  billingAddress?: string;
  shippingAddress?: string;
  type?: string;
  ownerId?: string;
  ownerName?: string;
  lastModifiedAt?: string;
  customFields?: Record<string, unknown>;
}

export interface CRMContact {
  externalId: string;
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  department?: string;
  accountId?: string;
  accountName?: string;
  ownerId?: string;
  ownerName?: string;
  lastModifiedAt?: string;
  customFields?: Record<string, unknown>;
}

export interface CRMDeal {
  externalId: string;
  name: string;
  amount?: number;
  stage?: string;
  probability?: number;
  closeDate?: string;
  accountId?: string;
  accountName?: string;
  contactId?: string;
  contactName?: string;
  type?: string;
  ownerId?: string;
  ownerName?: string;
  lastModifiedAt?: string;
  customFields?: Record<string, unknown>;
}

// ─── Export Types (push from DeepMindQ → CRM) ──────────────────────

export interface CRMExportAccount {
  name: string;
  domain?: string;
  industry?: string;
  description?: string;
  employeeCount?: string;
  revenue?: string;
  website?: string;
  phone?: string;
}

export interface CRMExportContact {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  title?: string;
  accountId?: string;
}

// ─── Export Result ─────────────────────────────────────────────────

export interface CRMExportResult {
  success: boolean;
  externalId?: string;
  error?: string;
}

// ─── CRM Connector Interface ──────────────────────────────────────

export interface CRMConnector {
  /** Unique connector identifier, e.g. "salesforce-rest-v1" */
  id: string;
  /** Human-readable name, e.g. "Salesforce REST API" */
  name: string;
  /** CRM provider type */
  type: 'salesforce' | 'hubspot';

  // ── Authentication ──

  /**
   * Exchange an authorization code for access/refresh tokens.
   * Used during the initial OAuth flow.
   */
  authenticate(code: string): Promise<CRMToken>;

  /**
   * Refresh an expired access token using the refresh token.
   */
  refreshToken(token: CRMToken): Promise<CRMToken>;

  /**
   * Verify that the current token is valid by making a lightweight
   * API call (e.g. GET /services/data/vXX.X/limits for Salesforce).
   */
  testConnection(token: CRMToken): Promise<boolean>;

  // ── Data Fetching (CRM → DeepMindQ) ──

  fetchAccounts(token: CRMToken, options?: CRMFetchOptions): Promise<CRMAccount[]>;
  fetchContacts(token: CRMToken, options?: CRMFetchOptions): Promise<CRMContact[]>;
  fetchDeals(token: CRMToken, options?: CRMFetchOptions): Promise<CRMDeal[]>;

  // ── Data Pushing (DeepMindQ → CRM) ──

  pushAccount(token: CRMToken, account: CRMExportAccount): Promise<CRMExportResult>;
  pushContact(token: CRMToken, contact: CRMExportContact): Promise<CRMExportResult>;

  // ── Webhook Support ──

  /**
   * Return the relative webhook URL path that the CRM provider
   * should call for realtime sync events.
   */
  getWebhookUrl(): string;
}
