/**
 * Task 4.5 — Salesforce REST API Adapter
 *
 * Implements CRMConnector for the Salesforce REST API (v59.0).
 * Uses OAuth2 JWT bearer flow for authentication.
 * All API URLs are configurable via environment variables and default
 * to placeholder values (same pattern as clearbit-connector.ts).
 *
 * Field Mapping:
 *   SF Account.Name        → CRMAccount.name
 *   SF Account.Website    → CRMAccount.domain
 *   SF Account.Industry   → CRMAccount.industry
 *   SF Account.Description → CRMAccount.description
 *   SF Account.NumberOfEmployees → CRMAccount.employeeCount
 *   SF Account.AnnualRevenue → CRMAccount.revenue
 *   SF Contact.FirstName/LastName → CRMContact.firstName/lastName
 *   SF Opportunity        → CRMDeal
 *
 * Pagination: Uses nextRecordsUrl from queryResults.
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

const SF_API_BASE =
  process.env.SALESFORCE_API_BASE || 'https://api.salesforce.com';

const SF_AUTH_URL =
  process.env.SALESFORCE_AUTH_URL || 'https://login.salesforce.com/services/oauth2/token';

const SF_API_VERSION =
  process.env.SALESFORCE_API_VERSION || '59.0';

const SF_CLIENT_ID =
  process.env.SALESFORCE_CLIENT_ID || 'placeholder_client_id';

const SF_CLIENT_SECRET =
  process.env.SALESFORCE_CLIENT_SECRET || 'placeholder_client_secret';

const SF_WEBHOOK_PATH = '/api/webhooks/crm/salesforce';

const MAX_RETRIES = 2;
const RETRY_DELAY_MS = 1000;

// ─── Salesforce API Response Types ──────────────────────────────────

interface SFAuthResponse {
  access_token: string;
  refresh_token?: string;
  instance_url?: string;
  token_type: string;
  issued_at: string;
  expires_in?: number;
  scope?: string;
}

interface SFQueryResult<T> {
  totalSize: number;
  done: boolean;
  nextRecordsUrl?: string;
  records: T[];
}

interface SFAccountRecord {
  Id: string;
  Name: string;
  Website?: string;
  Industry?: string;
  Description?: string;
  NumberOfEmployees?: number;
  AnnualRevenue?: number;
  Phone?: string;
  BillingStreet?: string;
  BillingCity?: string;
  BillingState?: string;
  BillingPostalCode?: string;
  BillingCountry?: string;
  Type?: string;
  OwnerId?: string;
  Owner?: { Name?: string };
  LastModifiedDate: string;
  attributes?: Record<string, string>;
  [key: string]: unknown;
}

interface SFContactRecord {
  Id: string;
  FirstName?: string;
  LastName: string;
  Email?: string;
  Phone?: string;
  Title?: string;
  Department?: string;
  AccountId?: string;
  Account?: { Name?: string; Id?: string };
  OwnerId?: string;
  Owner?: { Name?: string };
  LastModifiedDate: string;
  attributes?: Record<string, string>;
  [key: string]: unknown;
}

interface SFOpportunityRecord {
  Id: string;
  Name: string;
  Amount?: number;
  StageName?: string;
  Probability?: number;
  CloseDate?: string;
  AccountId?: string;
  Account?: { Name?: string; Id?: string };
  ContactId?: string;
  Contact?: { Name?: string; Id?: string };
  Type?: string;
  OwnerId?: string;
  Owner?: { Name?: string };
  LastModifiedDate: string;
  attributes?: Record<string, string>;
  [key: string]: unknown;
}

// ─── HTTP Helper ───────────────────────────────────────────────────

async function sfFetchWithRetry(
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
        throw new Error('Salesforce: Authentication expired');
      }

      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter
          ? parseInt(retryAfter, 10) * 1000
          : RETRY_DELAY_MS * (i + 1);
        await new Promise(resolve => setTimeout(resolve, Math.min(delay, 5000)));
        continue;
      }

      if (!response.ok) {
        throw new Error(
          `Salesforce API returned ${response.status}: ${response.statusText}`,
        );
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

  throw lastError || new Error('Salesforce API request failed after retries');
}

// ─── Salesforce Adapter ────────────────────────────────────────────

export class SalesforceAdapter implements CRMConnector {
  readonly id = 'salesforce-rest-v1';
  readonly name = 'Salesforce REST API';
  readonly type = 'salesforce' as const;

  // ── Authentication ────────────────────────────────────────────

  async authenticate(code: string): Promise<CRMToken> {
    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: SF_CLIENT_ID,
        client_secret: SF_CLIENT_SECRET,
        redirect_uri: process.env.SALESFORCE_REDIRECT_URI || '',
      });

      const response = await fetch(SF_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(
          `Salesforce OAuth failed: ${response.status} ${response.statusText}`,
        );
      }

      const data = (await response.json()) as SFAuthResponse;

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;

      logger.info('[CRM:Salesforce] Authentication successful', {
        instanceUrl: data.instance_url,
      });

      return {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt,
        instanceUrl: data.instance_url,
        scopes: data.scope?.split(' '),
      };
    } catch (err) {
      logger.error('[CRM:Salesforce] Authentication failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async refreshToken(token: CRMToken): Promise<CRMToken> {
    if (!token.refreshToken) {
      throw new Error('Salesforce: No refresh token available');
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: SF_CLIENT_ID,
        client_secret: SF_CLIENT_SECRET,
      });

      const response = await fetch(SF_AUTH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });

      if (!response.ok) {
        throw new Error(
          `Salesforce token refresh failed: ${response.status}`,
        );
      }

      const data = (await response.json()) as SFAuthResponse;

      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;

      return {
        accessToken: data.access_token,
        refreshToken: token.refreshToken,
        expiresAt,
        instanceUrl: data.instance_url || token.instanceUrl,
        scopes: data.scope?.split(' '),
      };
    } catch (err) {
      logger.error('[CRM:Salesforce] Token refresh failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async testConnection(token: CRMToken): Promise<boolean> {
    try {
      const baseUrl = token.instanceUrl || SF_API_BASE;
      const url = `${baseUrl}/services/data/v${SF_API_VERSION}/limits`;

      const response = await sfFetchWithRetry(url, {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      });

      return response.ok;
    } catch {
      return false;
    }
  }

  // ── Data Fetching ──────────────────────────────────────────────

  async fetchAccounts(
    token: CRMToken,
    options?: CRMFetchOptions,
  ): Promise<CRMAccount[]> {
    const soqlFields = options?.fields?.length
      ? options.fields.join(', ')
      : 'Id, Name, Website, Industry, Description, NumberOfEmployees, AnnualRevenue, Phone, BillingStreet, BillingCity, BillingState, BillingPostalCode, BillingCountry, Type, OwnerId, Owner.Name, LastModifiedDate';

    let soql = `SELECT ${soqlFields} FROM Account`;

    if (options?.filter) {
      soql += ` WHERE ${options.filter}`;
    }

    if (options?.modifiedAfter) {
      soql += soql.includes('WHERE') ? ' AND' : ' WHERE';
      soql += ` LastModifiedDate > ${options.modifiedAfter}`;
    }

    soql += ' ORDER BY LastModifiedDate DESC';

    if (options?.limit) {
      soql += ` LIMIT ${options.limit}`;
    }

    const baseUrl = token.instanceUrl || SF_API_BASE;
    const queryUrl = `${baseUrl}/services/data/v${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`;

    const headers = {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DeepMindQ-Enterprise-CRM/1.0',
    };

    const records: SFAccountRecord[] = [];
    let currentUrl = queryUrl;

    try {
      // Paginate through all results
      while (currentUrl) {
        const response = await sfFetchWithRetry(currentUrl, headers);
        const result = (await response.json()) as SFQueryResult<SFAccountRecord>;

        records.push(...result.records);

        if (result.nextRecordsUrl) {
          currentUrl = `${baseUrl}${result.nextRecordsUrl}`;
        } else {
          currentUrl = '';
        }
      }

      return records.map(mapSFAccount);
    } catch (err) {
      logger.error('[CRM:Salesforce] Failed to fetch accounts', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async fetchContacts(
    token: CRMToken,
    options?: CRMFetchOptions,
  ): Promise<CRMContact[]> {
    const soqlFields = options?.fields?.length
      ? options.fields.join(', ')
      : 'Id, FirstName, LastName, Email, Phone, Title, Department, AccountId, Account.Name, OwnerId, Owner.Name, LastModifiedDate';

    let soql = `SELECT ${soqlFields} FROM Contact`;

    if (options?.filter) {
      soql += ` WHERE ${options.filter}`;
    }

    if (options?.modifiedAfter) {
      soql += soql.includes('WHERE') ? ' AND' : ' WHERE';
      soql += ` LastModifiedDate > ${options.modifiedAfter}`;
    }

    soql += ' ORDER BY LastModifiedDate DESC';

    if (options?.limit) {
      soql += ` LIMIT ${options.limit}`;
    }

    const baseUrl = token.instanceUrl || SF_API_BASE;
    const queryUrl = `${baseUrl}/services/data/v${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`;

    const headers = {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DeepMindQ-Enterprise-CRM/1.0',
    };

    const records: SFContactRecord[] = [];
    let currentUrl = queryUrl;

    try {
      while (currentUrl) {
        const response = await sfFetchWithRetry(currentUrl, headers);
        const result = (await response.json()) as SFQueryResult<SFContactRecord>;

        records.push(...result.records);

        if (result.nextRecordsUrl) {
          currentUrl = `${baseUrl}${result.nextRecordsUrl}`;
        } else {
          currentUrl = '';
        }
      }

      return records.map(mapSFContact);
    } catch (err) {
      logger.error('[CRM:Salesforce] Failed to fetch contacts', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  async fetchDeals(
    token: CRMToken,
    options?: CRMFetchOptions,
  ): Promise<CRMDeal[]> {
    const soqlFields = options?.fields?.length
      ? options.fields.join(', ')
      : 'Id, Name, Amount, StageName, Probability, CloseDate, AccountId, Account.Name, Type, OwnerId, Owner.Name, LastModifiedDate';

    let soql = `SELECT ${soqlFields} FROM Opportunity`;

    if (options?.filter) {
      soql += ` WHERE ${options.filter}`;
    }

    if (options?.modifiedAfter) {
      soql += soql.includes('WHERE') ? ' AND' : ' WHERE';
      soql += ` LastModifiedDate > ${options.modifiedAfter}`;
    }

    soql += ' ORDER BY LastModifiedDate DESC';

    if (options?.limit) {
      soql += ` LIMIT ${options.limit}`;
    }

    const baseUrl = token.instanceUrl || SF_API_BASE;
    const queryUrl = `${baseUrl}/services/data/v${SF_API_VERSION}/query?q=${encodeURIComponent(soql)}`;

    const headers = {
      Authorization: `Bearer ${token.accessToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'DeepMindQ-Enterprise-CRM/1.0',
    };

    const records: SFOpportunityRecord[] = [];
    let currentUrl = queryUrl;

    try {
      while (currentUrl) {
        const response = await sfFetchWithRetry(currentUrl, headers);
        const result = (await response.json()) as SFQueryResult<SFOpportunityRecord>;

        records.push(...result.records);

        if (result.nextRecordsUrl) {
          currentUrl = `${baseUrl}${result.nextRecordsUrl}`;
        } else {
          currentUrl = '';
        }
      }

      return records.map(mapSFDeal);
    } catch (err) {
      logger.error('[CRM:Salesforce] Failed to fetch deals', {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  // ── Data Pushing ────────────────────────────────────────────────

  async pushAccount(
    token: CRMToken,
    account: CRMExportAccount,
  ): Promise<CRMExportResult> {
    const baseUrl = token.instanceUrl || SF_API_BASE;
    const url = `${baseUrl}/services/data/v${SF_API_VERSION}/sobjects/Account`;

    try {
      const sfAccount = {
        Name: account.name,
        Website: account.domain || undefined,
        Industry: account.industry || undefined,
        Description: account.description || undefined,
        NumberOfEmployees: account.employeeCount
          ? parseInt(account.employeeCount, 10)
          : undefined,
        AnnualRevenue: account.revenue
          ? parseRevenueString(account.revenue)
          : undefined,
        Phone: account.phone || undefined,
      };

      const response = await sfFetchWithRetry(url, {
        Authorization: `Bearer ${token.accessToken}`,
        'Content-Type': 'application/json',
      });

      // PATCH for updates, POST for creates
      const method = 'POST';
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DeepMindQ-Enterprise-CRM/1.0',
        },
        body: JSON.stringify(sfAccount),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: `Salesforce push failed: ${res.status} - ${JSON.stringify(errorData)}`,
        };
      }

      const data = await res.json() as { id?: string; success?: boolean; errors?: string[] };

      if (data.success === false) {
        return {
          success: false,
          error: data.errors?.join(', ') || 'Unknown Salesforce error',
        };
      }

      return {
        success: true,
        externalId: data.id,
      };
    } catch (err) {
      logger.error('[CRM:Salesforce] Failed to push account', {
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
    const baseUrl = token.instanceUrl || SF_API_BASE;
    const url = `${baseUrl}/services/data/v${SF_API_VERSION}/sobjects/Contact`;

    try {
      const sfContact = {
        FirstName: contact.firstName,
        LastName: contact.lastName,
        Email: contact.email || undefined,
        Phone: contact.phone || undefined,
        Title: contact.title || undefined,
        AccountId: contact.accountId || undefined,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token.accessToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'DeepMindQ-Enterprise-CRM/1.0',
        },
        body: JSON.stringify(sfContact),
        signal: AbortSignal.timeout(15000),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: `Salesforce push failed: ${res.status} - ${JSON.stringify(errorData)}`,
        };
      }

      const data = await res.json() as { id?: string; success?: boolean; errors?: string[] };

      if (data.success === false) {
        return {
          success: false,
          error: data.errors?.join(', ') || 'Unknown Salesforce error',
        };
      }

      return {
        success: true,
        externalId: data.id,
      };
    } catch (err) {
      logger.error('[CRM:Salesforce] Failed to push contact', {
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
    return SF_WEBHOOK_PATH;
  }
}

// ─── Field Mappers ──────────────────────────────────────────────────

function mapSFAccount(record: SFAccountRecord): CRMAccount {
  const billingParts = [
    record.BillingStreet,
    record.BillingCity,
    record.BillingState,
    record.BillingPostalCode,
    record.BillingCountry,
  ].filter(Boolean);

  return {
    externalId: record.Id,
    name: record.Name,
    domain: record.Website || undefined,
    industry: record.Industry || undefined,
    description: record.Description || undefined,
    employeeCount: record.NumberOfEmployees || undefined,
    revenue: record.AnnualRevenue || undefined,
    phone: record.Phone || undefined,
    website: record.Website || undefined,
    billingAddress: billingParts.length > 0
      ? billingParts.join(', ')
      : undefined,
    type: record.Type || undefined,
    ownerId: record.OwnerId || undefined,
    ownerName: record.Owner?.Name || undefined,
    lastModifiedAt: record.LastModifiedDate,
  };
}

function mapSFContact(record: SFContactRecord): CRMContact {
  return {
    externalId: record.Id,
    firstName: record.FirstName || '',
    lastName: record.LastName,
    email: record.Email || undefined,
    phone: record.Phone || undefined,
    title: record.Title || undefined,
    department: record.Department || undefined,
    accountId: record.AccountId || record.Account?.Id || undefined,
    accountName: record.Account?.Name || undefined,
    ownerId: record.OwnerId || undefined,
    ownerName: record.Owner?.Name || undefined,
    lastModifiedAt: record.LastModifiedDate,
  };
}

function mapSFDeal(record: SFOpportunityRecord): CRMDeal {
  return {
    externalId: record.Id,
    name: record.Name,
    amount: record.Amount || undefined,
    stage: record.StageName || undefined,
    probability: record.Probability != null ? record.Probability / 100 : undefined,
    closeDate: record.CloseDate || undefined,
    accountId: record.AccountId || record.Account?.Id || undefined,
    accountName: record.Account?.Name || undefined,
    type: record.Type || undefined,
    ownerId: record.OwnerId || undefined,
    ownerName: record.Owner?.Name || undefined,
    lastModifiedAt: record.LastModifiedDate,
  };
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Parse a revenue string like "$10M" or "$1B+" into a numeric value.
 */
function parseRevenueString(revenue: string): number | undefined {
  if (!revenue) return undefined;

  const cleaned = revenue.replace(/[^0-9.KMB]/gi, '').toUpperCase();
  const match = cleaned.match(/^([\d.]+)\s*([KMB]?)$/);

  if (!match) return undefined;

  const num = parseFloat(match[1]);
  if (!Number.isFinite(num)) return undefined;

  const suffix = match[2];
  const multiplier: Record<string, number> = {
    '': 1,
    K: 1000,
    M: 1_000_000,
    B: 1_000_000_000,
  };

  return num * (multiplier[suffix] || 1);
}

// ── Singleton Export ───────────────────────────────────────────────

export const salesforceAdapter = new SalesforceAdapter();
