/**
 * Task 4.5 — HubSpot API Adapter
 *
 * Implements CRMConnector for the HubSpot CRM API.
 * Uses OAuth2 authorization code flow for authentication.
 * All API URLs are configurable via environment variables and default
 * to placeholder values (same pattern as clearbit-connector.ts).
 *
 * Field Mapping:
 *   HS Company → CRMAccount
 *   HS Contact → CRMContact
 *   HS Deal    → CRMDeal
 *
 * Pagination: Uses offset/limit with after query param for cursor-based.
 */

import type {
  CRMConnector,
  CRMToken,
  CRMFetchOptions,
  CRMAccount,
  CRMContact,
  CRMDeal,
  CRMExportAccount,
  CRMExportContact,
  CRMExportResult,
} from './crm-connector';
import { logger } from '@/lib/logger';

// ─── Configuration ─────────────────────────────────────────────────

const HS_API_BASE =
  process.env.HUBSPOT_API_BASE || 'https://api.hubapi.com';

const HS_AUTH_URL =
  process.env.HUBSPOT_AUTH_URL || 'https://app.hubspot.com/oauth/authorize';

const HS_TOKEN_URL =
  process.env.HUBSPOT_TOKEN_URL || 'https://api.hubapi.com/oauth/v1/token';

const HS_CLIENT_ID =
  process.env.HUBSPOT_CLIENT_ID || 'placeholder_client_id';

const HS_CLIENT_SECRET =
  process.env.HUBSPOT_CLIENT_SECRET || 'placeholder_client_secret';

const HS_SCOPES = [
  'crm.objects.companies.read',
  'crm.objects.companies.write',
  'crm.objects.contacts.read',
  'crm.objects.contacts.write',
  'crm.objects.deals.read',
  'crm.objects.deals.write',
].join(' ');

const HS_WEBHOOK_PATH = '/api/webhooks/crm/hubspot';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// ─── HubSpot API Response Types ───────────────────────────────────

interface HSAuthResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope: string;
}

interface HSPaginatedResponse<T> {
  results: T[];
  paging?: {
    next?: {
      after: string;
      link: string;
    };
  };
  total?: number;
}

interface HSCompany {
  id: string;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface HSContact {
  id: string;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface HSDeal {
  id: string;
  properties: Record<string, string>;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
}

interface HSCreateResponse {
  id: string;
  properties: Record<string, string>;
}

// ─── HubSpot Property Name Constants ───────────────────────────────

const COMPANY_PROPS = [
  'name',
  'domain',
  'industry',
  'description',
  'numberofemployees',
  'annualrevenue',
  'phone',
  'website',
  'street_address',
  'city',
  'state',
  'zip',
  'country',
  'company_type',
  'hubspot_owner_id',
  'hs_lastmodifieddate',
];

const CONTACT_PROPS = [
  'firstname',
  'lastname',
  'email',
  'phone',
  'jobtitle',
  'department',
  'associatedcompanyid',
  'hubspot_owner_id',
  'lastmodifieddate',
];

const DEAL_PROPS = [
  'dealname',
  'amount',
  'dealstage',
  'probability',
  'closedate',
  'associatedcompanyid',
  'associatedcontacts',
  'dealtype',
  'hubspot_owner_id',
  'hs_lastmodifieddate',
];

// ─── HTTP Helper ───────────────────────────────────────────────────

async function hsFetchWithRetry(
  url: string,
  headers: Record<string, string>,
  retries = MAX_RETRIES,
): Promise<Response> {
  let lastError: Error | null = null;

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(15000),
      });

      if (response.status === 401) {
        throw new Error('HubSpot: Authentication expired');
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : RETRY_DELAY_MS * (i + 1);
        await new Promise(resolve =>
          setTimeout(resolve, Math.min(delay, 5000)),
        );
        continue;
      }

      return response;
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (i < retries) {
        await new Promise(resolve =>
          setTimeout(resolve, RETRY_DELAY_MS * (i + 1)),
        );
      }
    }
  }

  throw lastError || new Error('HubSpot API request failed after retries');
}

// ─── HubSpot Adapter ───────────────────────────────────────────────

export class HubSpotAdapter implements CRMConnector {
  readonly id = 'hubspot-crm-v3';
  readonly name = 'HubSpot CRM API';
  readonly type = 'hubspot' as const;

  // ── Authentication ────────────────────────────────────────────

  async authenticate(code: string): Promise<CRMToken> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: HS_CLIENT_ID,
        client_secret: HS_CLIENT_SECRET,
        redirect_uri: process.env.HUBSPOT_REDIRECT_URI || '',
      });

      const response = await fetch(HS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          `HubSpot OAuth failed: ${response.status} ${JSON.stringify(errorData)}`,
        );
      }

      const data = (await response.json()) as HSAuthResponse;

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;

      logger.info('[CRM:HubSpot] Authentication successful', {
        scope: data.scope,
      });

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        scopes: data.scope?.split(' '),
      };
    } catch (err) {
      logger.error('[CRM:HubSpot] Authentication failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async refreshToken(token: CRMToken): Promise<CRMToken> {
    if (!token.refreshToken) {
      throw new Error('HubSpot: No refresh token available');
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: HS_CLIENT_ID,
        client_secret: HS_CLIENT_SECRET,
      });

      const response = await fetch(HS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(
          `HubSpot token refresh failed: ${response.status}`,
        );
      }

      const data = (await response.json()) as HSAuthResponse;

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        scopes: data.scope?.split(' '),
      };
    } catch (err) {
      logger.error('[CRM:HubSpot] Token refresh failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async testConnection(token: CRMToken): Promise<boolean> {
    try {
      const url = `${HS_API_BASE}/crm/v3/objects/companies/1?properties=name`;
      const response = await hsFetchWithRetry(url, {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      });
      // 404 is expected if no company with ID 1 exists, but 401 means bad token
      return response.status !== 401;
    } catch {
      return false;
    }
  }

  // ── Data Fetching ──────────────────────────────────────────

  async fetchAccounts(
    token: CRMToken,
    options?: CRMFetchOptions,
  ): Promise<CRMAccount[]> {
    const properties = options?.fields?.length
      ? options.fields
      : COMPANY_PROPS;

    const limit = Math.min(options?.limit || 100, 100);
    const after = options?.offset || undefined;

    const records: CRMAccount[] = [];
    let currentAfter = after;

    try {
      while (true) {
        const params = new URLSearchParams({
          limit: String(limit),
          properties: properties.join(','),
          archived: 'false',
        });

        if (currentAfter) {
          params.set('after', currentAfter);
        }

        const url = `${HS_API_BASE}/crm/v3/objects/companies/search?${params.toString()}`;
        const response = await hsFetchWithRetry(url, {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
        });

        if (!response.ok) break;

        const data = (await response.json()) as HSPaginatedResponse<HSCompany>;

        for (const record of data.results) {
          records.push(mapHSCompany(record));
        }

        if (data.paging?.next?.after) {
          currentAfter = data.paging.next.after;
        } else {
          break;
        }
      }

      return records;
    } catch (err) {
      logger.error('[CRM:HubSpot] Failed to fetch accounts', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async fetchContacts(
    token: CRMToken,
    options?: CRMFetchOptions,
  ): Promise<CRMContact[]> {
    const properties = options?.fields?.length
      ? options.fields
      : CONTACT_PROPS;

    const limit = Math.min(options?.limit || 100, 100);
    const after = options?.offset || undefined;

    const records: CRMContact[] = [];
    let currentAfter = after;

    try {
      while (true) {
        const params = new URLSearchParams({
          limit: String(limit),
          properties: properties.join(','),
          archived: 'false',
        });

        if (currentAfter) {
          params.set('after', currentAfter);
        }

        const url = `${HS_API_BASE}/crm/v3/objects/contacts/search?${params.toString()}`;
        const response = await hsFetchWithRetry(url, {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
        });

        if (!response.ok) break;

        const data = (await response.json()) as HSPaginatedResponse<HSContact>;

        for (const record of data.results) {
          records.push(mapHSContact(record));
        }

        if (data.paging?.next?.after) {
          currentAfter = data.paging.next.after;
        } else {
          break;
        }
      }

      return records;
    } catch (err) {
      logger.error('[CRM:HubSpot] Failed to fetch contacts', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async fetchDeals(
    token: CRMToken,
    options?: CRMFetchOptions,
  ): Promise<CRMDeal[]> {
    const properties = options?.fields?.length
      ? options.fields
      : DEAL_PROPS;

    const limit = Math.min(options?.limit || 100, 100);
    const after = options?.offset || undefined;

    const records: CRMDeal[] = [];
    let currentAfter = after;

    try {
      while (true) {
        const params = new URLSearchParams({
          limit: String(limit),
          properties: properties.join(','),
          archived: 'false',
        });

        if (currentAfter) {
          params.set('after', currentAfter);
        }

        const url = `${HS_API_BASE}/crm/v3/objects/deals/search?${params.toString()}`;
        const response = await hsFetchWithRetry(url, {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
        });

        if (!response.ok) break;

        const data = (await response.json()) as HSPaginatedResponse<HSDeal>;

        for (const record of data.results) {
          records.push(mapHSDeal(record));
        }

        if (data.paging?.next?.after) {
          currentAfter = data.paging.next.after;
        } else {
          break;
        }
      }

      return records;
    } catch (err) {
      logger.error('[CRM:HubSpot] Failed to fetch deals', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ── Data Pushing ─────────────────────────────────────────────

  async pushAccount(
    token: CRMToken,
    account: CRMExportAccount,
  ): Promise<CRMExportResult> {
    const url = `${HS_API_BASE}/crm/v3/objects/companies`;

    try {
      const properties: Record<string, string> = {
        name: account.name,
      };

      if (account.domain) properties.domain = account.domain;
      if (account.industry) properties.industry = account.industry;
      if (account.description) properties.description = account.description;
      if (account.website) properties.website = account.website;
      if (account.phone) properties.phone = account.phone;

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DeepMindQ-Enterprise-CRM/1.0',
        },
        body: JSON.stringify({ properties }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: `HubSpot push failed: ${res.status} - ${JSON.stringify(errorData)}`,
        };
      }

      const data = await res.json() as HSCreateResponse;

      return {
        success: true,
        externalId: data.id,
      };
    } catch (err) {
      logger.error('[CRM:HubSpot] Failed to push account', {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async pushContact(
    token: CRMToken,
    contact: CRMExportContact,
  ): Promise<CRMExportResult> {
    const url = `${HS_API_BASE}/crm/v3/objects/contacts`;

    try {
      const properties: Record<string, string> = {
        firstname: contact.firstName,
        lastname: contact.lastName,
      };

      if (contact.email) properties.email = contact.email;
      if (contact.phone) properties.phone = contact.phone;
      if (contact.title) properties.jobtitle = contact.title;
      if (contact.accountId) {
        properties.associatedcompanyid = contact.accountId;
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DeepMindQ-Enterprise-CRM/1.0',
        },
        body: JSON.stringify({ properties }),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: `HubSpot push failed: ${res.status} - ${JSON.stringify(errorData)}`,
        };
      }

      const data = await res.json() as HSCreateResponse;

      return {
        success: true,
        externalId: data.id,
      };
    } catch (err) {
      logger.error('[CRM:HubSpot] Failed to push contact', {
        error: err instanceof Error ? err.message : String(err),
      });
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  // ── Webhook ─────────────────────────────────────────────────────

  getWebhookUrl(): string {
    return HS_WEBHOOK_PATH;
  }
}

// ─── Field Mappers ──────────────────────────────────────────────────

function getProp(props: Record<string, string>, key: string): string | undefined {
  return props[key] || undefined;
}

function getNumProp(props: Record<string, string>, key: string): number | undefined {
  const val = props[key];
  if (!val) return undefined;
  const num = parseFloat(val);
  return Number.isFinite(num) ? num : undefined;
}

function mapHSCompany(record: HSCompany): CRMAccount {
  const props = record.properties;

  const addressParts = [
    getProp(props, 'street_address'),
    getProp(props, 'city'),
    getProp(props, 'state'),
    getProp(props, 'zip'),
    getProp(props, 'country'),
  ].filter(Boolean);

  return {
    externalId: record.id,
    name: getProp(props, 'name') || 'Unknown',
    domain: getProp(props, 'domain'),
    industry: getProp(props, 'industry'),
    description: getProp(props, 'description'),
    employeeCount: getNumProp(props, 'numberofemployees'),
    revenue: getNumProp(props, 'annualrevenue'),
    phone: getProp(props, 'phone'),
    website: getProp(props, 'website'),
    billingAddress: addressParts.length > 0 ? addressParts.join(', ') : undefined,
    type: getProp(props, 'company_type'),
    ownerId: getProp(props, 'hubspot_owner_id'),
    lastModifiedAt: getProp(props, 'hs_lastmodifieddate') || record.updatedAt,
  };
}

function mapHSContact(record: HSContact): CRMContact {
  const props = record.properties;

  return {
    externalId: record.id,
    firstName: getProp(props, 'firstname') || '',
    lastName: getProp(props, 'lastname') || '',
    email: getProp(props, 'email'),
    phone: getProp(props, 'phone'),
    title: getProp(props, 'jobtitle'),
    department: getProp(props, 'department'),
    accountId: getProp(props, 'associatedcompanyid'),
    ownerId: getProp(props, 'hubspot_owner_id'),
    lastModifiedAt: getProp(props, 'lastmodifieddate') || record.updatedAt,
  };
}

function mapHSDeal(record: HSDeal): CRMDeal {
  const props = record.properties;

  const amount = getNumProp(props, 'amount');
  const probability = getNumProp(props, 'probability');

  return {
    externalId: record.id,
    name: getProp(props, 'dealname') || 'Unknown',
    amount,
    stage: getProp(props, 'dealstage'),
    probability: probability != null ? probability / 100 : undefined,
    closeDate: getProp(props, 'closedate'),
    accountId: getProp(props, 'associatedcompanyid'),
    type: getProp(props, 'dealtype'),
    ownerId: getProp(props, 'hubspot_owner_id'),
    lastModifiedAt: getProp(props, 'hs_lastmodifieddate') || record.updatedAt,
  };
}

// ── Singleton Export ───────────────────────────────────────────────

export const hubSpotAdapter = new HubSpotAdapter();
