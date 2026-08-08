/**
 * Task 4.5 — CRM Sync Service
 *
 * Orchestrates bidirectional sync between external CRM providers
 * (Salesforce, HubSpot) and the local DeepMindQ database.
 *
 * Features:
 *   - syncFromCRM: Pull accounts/contacts/deals from CRM → local DB
 *   - syncToCRM:   Push local company data → CRM
 *   - Uses company-matcher.ts for deduplication during import
 *   - Creates timeline events for every synced record
 *   - Configurable sync conflict resolution (local wins vs CRM wins)
 *   - Full sync log with timestamps and error tracking
 */

import { db } from '@/lib/db';
import { logger, childLogger } from '@/lib/logger';
import { matchCompany } from '@/lib/company-matcher';
import type {
  CRMConnector,
  CRMToken,
  CRMAccount,
  CRMContact,
  CRMDeal,
} from './crm-connector';
import { getConnectorForProvider } from './crm-connector';

// ─── Custom Field Mapping Helper ─────────────────────────────────

function applyCustomFieldMapping(
  data: Record<string, unknown>,
  fieldMapping: Record<string, string> | null | undefined,
): Record<string, unknown> {
  if (!fieldMapping || Object.keys(fieldMapping).length === 0) return data;

  const mapped = { ...data };
  for (const [targetField, sourceField] of Object.entries(fieldMapping)) {
    if (sourceField in mapped && sourceField !== targetField) {
      mapped[targetField] = mapped[sourceField];
      // Keep original field too
    }
  }
  return mapped;
}

// ─── Types ─────────────────────────────────────────────────────────

export type SyncConflictResolution = 'local_wins' | 'crm_wins' | 'skip';

export interface SyncResult {
  success: boolean;
  companiesCreated: number;
  companiesUpdated: number;
  companiesSkipped: number;
  companiesFailed: number;
  contactsCreated: number;
  contactsUpdated: number;
  contactsSkipped: number;
  contactsFailed: number;
  opportunitiesCreated: number;
  opportunitiesSkipped: number;
  opportunitiesFailed: number;
  syncDurationMs: number;
  errors: string[];
}

export interface SyncFromCRMOptions {
  /** Conflict resolution strategy (default: local_wins) */
  conflictResolution?: SyncConflictResolution;
  /** Maximum records to fetch per entity type (default: 200) */
  limit?: number;
  /** Only sync records modified after this ISO date */
  modifiedAfter?: string;
  /** Whether to sync accounts (default: true) */
  syncAccounts?: boolean;
  /** Whether to sync contacts (default: true) */
  syncContacts?: boolean;
  /** Whether to sync deals/opportunities (default: true) */
  syncDeals?: boolean;
}

// ─── Internal: External ID Tracking ─────────────────────────────────
//
// We store CRM external IDs in the Company/Contact enrichmentData JSON
// field as `crmExternalIds: { provider: externalId }`.

interface CRMExternalIds {
  [provider: string]: string;
}

function getCRMExternalIds(enrichmentData: unknown): CRMExternalIds {
  if (!enrichmentData || typeof enrichmentData !== 'object') return {};
  const data = enrichmentData as Record<string, unknown>;
  return (data.crmExternalIds as CRMExternalIds) || {};
}

function setCRMExternalIds(
  existingData: unknown,
  provider: string,
  externalId: string,
): Record<string, unknown> {
  const base =
    existingData && typeof existingData === 'object'
      ? (existingData as Record<string, unknown>)
      : {};
  const externalIds = { ...getCRMExternalIds(existingData), [provider]: externalId };
  return { ...base, crmExternalIds: externalIds };
}

// ─── Connector Registry ────────────────────────────────────────────

const connectorCache = new Map<string, CRMConnector>();

/**
 * Get or create a connector instance for a given provider type.
 * This is a separate function from the barrel export to allow
 * lazy instantiation with error handling.
 */
export function getConnector(provider: string): CRMConnector | null {
  const cached = connectorCache.get(provider);
  if (cached) return cached;

  const connector = getConnectorForProvider(provider);
  if (connector) {
    connectorCache.set(provider, connector);
  }
  return connector;
}

// ─── Token Refresh ─────────────────────────────────────────────────

async function refreshTokenIfNeeded(
  connection: { id: string; accessToken: string | null; refreshToken: string | null; tokenExpiresAt: Date | null; instanceUrl: string | null; provider: string },
  connector: CRMConnector,
  token: CRMToken,
  log: ReturnType<typeof childLogger>,
): Promise<CRMToken> {
  // If no expiry info, skip refresh check
  if (!token.expiresAt) return token;

  const now = new Date();
  const expiresAt = new Date(token.expiresAt);
  const bufferMs = 5 * 60 * 1000; // 5-minute buffer

  if (expiresAt.getTime() - bufferMs > now.getTime()) {
    return token; // Token is still valid
  }

  // Token is expired or about to expire - refresh
  log.info('[sync] Token expired or expiring, refreshing...', {
    expiresAt: token.expiresAt,
    connectionId: connection.id,
  });

  if (!token.refreshToken) {
    throw new Error(`CRM connection ${connection.id} token is expired and no refresh token available. Please re-authenticate.`);
  }

  try {
    const newToken = await connector.refreshToken(token);

    // Persist new tokens to DB
    await db.cRMConnection.update({
      where: { id: connection.id },
      data: {
        accessToken: newToken.accessToken,
        refreshToken: newToken.refreshToken || token.refreshToken,
        tokenExpiresAt: newToken.expiresAt ? new Date(newToken.expiresAt) : null,
        instanceUrl: newToken.instanceUrl || connection.instanceUrl,
      },
    });

    log.info('[sync] Token refreshed successfully', {
      connectionId: connection.id,
      newExpiresAt: newToken.expiresAt,
    });

    return newToken;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log.error('[sync] Token refresh failed', { error: msg, connectionId: connection.id });
    throw new Error(`CRM token refresh failed for connection ${connection.id}: ${msg}`);
  }
}

// ─── Sync: CRM → Local ────────────────────────────────────────────

export async function syncFromCRM(
  connectionId: string,
  options: SyncFromCRMOptions = {},
): Promise<SyncResult> {
  const startTime = Date.now();
  const log = childLogger({ module: 'crm-sync', connectionId });

  const result: SyncResult = {
    success: false,
    companiesCreated: 0,
    companiesUpdated: 0,
    companiesSkipped: 0,
    companiesFailed: 0,
    contactsCreated: 0,
    contactsUpdated: 0,
    contactsSkipped: 0,
    contactsFailed: 0,
    opportunitiesCreated: 0,
    opportunitiesSkipped: 0,
    opportunitiesFailed: 0,
    syncDurationMs: 0,
    errors: [],
  };

  const conflictResolution = options.conflictResolution || 'local_wins';
  const limit = options.limit || 200;
  const modifiedAfter = options.modifiedAfter;

  try {
    // ── Load connection ──
    const connection = await db.cRMConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection) {
      throw new Error(`CRM connection ${connectionId} not found`);
    }

    if (!connection.isActive) {
      throw new Error(`CRM connection ${connectionId} is not active`);
    }

    if (!connection.accessToken) {
      throw new Error(`CRM connection ${connectionId} has no access token`);
    }

    // ── Extract custom field mapping ──
    const fieldMapping = connection.fieldMapping as Record<string, string> | null;

    // ── Resolve connector ──
    const connector = getConnector(connection.provider);
    if (!connector) {
      throw new Error(
        `No connector available for provider: ${connection.provider}`,
      );
    }

    // ── Build token ──
    const token: CRMToken = {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken || undefined,
      expiresAt: connection.tokenExpiresAt || undefined,
      instanceUrl: connection.instanceUrl || undefined,
    };

    // ── Refresh token if needed ──
    const activeToken = await refreshTokenIfNeeded(connection, connector, token, log);

    // ── Sync accounts (companies) ──
    if (options.syncAccounts !== false) {
      log.info('[sync] Fetching accounts from CRM', { provider: connection.provider });
      await syncAccounts(
        connector,
        activeToken,
        connection,
        conflictResolution,
        limit,
        modifiedAfter,
        result,
        log,
        fieldMapping,
      );
    }

    // ── Sync contacts ──
    if (options.syncContacts !== false) {
      log.info('[sync] Fetching contacts from CRM', { provider: connection.provider });
      await syncContacts(
        connector,
        activeToken,
        connection,
        conflictResolution,
        limit,
        modifiedAfter,
        result,
        log,
      );
    }

    // ── Sync deals (opportunities) ──
    if (options.syncDeals !== false) {
      log.info('[sync] Fetching deals from CRM', { provider: connection.provider });
      await syncDeals(
        connector,
        activeToken,
        connection,
        limit,
        modifiedAfter,
        result,
        log,
      );
    }

    // ── Update lastSyncAt ──
    await db.cRMConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    });

    result.success = true;
    result.syncDurationMs = Date.now() - startTime;

    log.info('[sync] Sync completed', {
      durationMs: result.syncDurationMs,
      companiesCreated: result.companiesCreated,
      companiesUpdated: result.companiesUpdated,
      contactsCreated: result.contactsCreated,
      contactsUpdated: result.contactsUpdated,
      opportunitiesCreated: result.opportunitiesCreated,
    });

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(message);
    result.syncDurationMs = Date.now() - startTime;

    log.error('[sync] Sync failed', { error: message });

    // Log failure in sync log
    try {
      await db.cRMSyncLog.create({
        data: {
          connectionId,
          direction: 'import',
          entityType: 'system',
          action: 'failed',
          errorMessage: message,
          syncDuration: result.syncDurationMs,
        },
      });
    } catch {
      // Best-effort logging
    }

    return result;
  }
}

// ─── Sync: Local → CRM ─────────────────────────────────────────────

export async function syncToCRM(
  connectionId: string,
  companyId: string,
): Promise<{ success: boolean; externalId?: string; error?: string }> {
  const log = childLogger({ module: 'crm-sync', connectionId, companyId });
  const startTime = Date.now();

  try {
    // ── Load connection ──
    const connection = await db.cRMConnection.findUnique({
      where: { id: connectionId },
    });

    if (!connection || !connection.isActive) {
      return { success: false, error: 'CRM connection not found or inactive' };
    }

    // ── Load company ──
    const company = await db.company.findUnique({
      where: { id: companyId },
      include: { contacts: { take: 1 } },
    });

    if (!company) {
      return { success: false, error: `Company ${companyId} not found` };
    }

    // ── Resolve connector ──
    const connector = getConnector(connection.provider);
    if (!connector) {
      return { success: false, error: `No connector for ${connection.provider}` };
    }

    // ── Build token ──
    if (!connection.accessToken) {
      return { success: false, error: 'No access token available' };
    }

    const token: CRMToken = {
      accessToken: connection.accessToken,
      refreshToken: connection.refreshToken || undefined,
      expiresAt: connection.tokenExpiresAt || undefined,
      instanceUrl: connection.instanceUrl || undefined,
    };

    // ── Refresh token if needed ──
    const activeToken = await refreshTokenIfNeeded(connection, connector, token, log);

    // ── Push account ──
    const pushResult = await connector.pushAccount(activeToken, {
      name: company.rawName,
      domain: company.domain || undefined,
      industry: company.industry || undefined,
      website: company.website || undefined,
    });

    const syncDuration = Date.now() - startTime;

    // ── Log sync result ──
    await db.cRMSyncLog.create({
      data: {
        connectionId,
        direction: 'export',
        entityType: 'company',
        entityId: companyId,
        crmExternalId: pushResult.externalId,
        action: pushResult.success ? 'created' : 'failed',
        syncDuration,
        errorMessage: pushResult.error,
      },
    });

    // ── Update CRM external ID on company ──
    if (pushResult.success && pushResult.externalId) {
      const existingEnrichmentData = (company as unknown as { enrichmentData?: unknown }).enrichmentData;
      // We store CRM external IDs in tags or we can extend the model
      // For now, log a timeline event
      await db.companyTimelineEvent.create({
        data: {
          companyId,
          eventType: 'enrichment',
          title: `Pushed to ${connection.provider}`,
          description: `Company exported to CRM with external ID ${pushResult.externalId}`,
          metadata: {
            crmProvider: connection.provider,
            crmExternalId: pushResult.externalId,
            connectionId,
          } as unknown as Record<string, string | number | boolean | null | undefined>,
        },
      });
    }

    log.info('[sync:push] Company pushed to CRM', {
      success: pushResult.success,
      externalId: pushResult.externalId,
      durationMs: syncDuration,
    });

    return {
      success: pushResult.success,
      externalId: pushResult.externalId,
      error: pushResult.error,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('[sync:push] Push failed', { error: message });

    return { success: false, error: message };
  }
}

// ─── Internal: Sync Accounts ────────────────────────────────────────

async function syncAccounts(
  connector: CRMConnector,
  token: CRMToken,
  connection: { id: string; provider: string },
  conflictResolution: SyncConflictResolution,
  limit: number,
  modifiedAfter: string | undefined,
  result: SyncResult,
  log: ReturnType<typeof childLogger>,
  fieldMapping?: Record<string, string> | null,
): Promise<void> {
  try {
    const accounts = await connector.fetchAccounts(token, {
      limit,
      modifiedAfter,
    });

    log.info('[sync:accounts] Fetched accounts from CRM', {
      count: accounts.length,
    });

    for (const account of accounts) {
      const entityStart = Date.now();

      try {
        await processCRMAccount(
          account,
          connection,
          conflictResolution,
          result,
          log,
          fieldMapping,
        );
      } catch (err) {
        result.companiesFailed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Account ${account.externalId}: ${errorMsg}`);
        log.error('[sync:accounts] Failed to process account', {
          externalId: account.externalId,
          error: errorMsg,
        });

        await db.cRMSyncLog.create({
          data: {
            connectionId: connection.id,
            direction: 'import',
            entityType: 'company',
            crmExternalId: account.externalId,
            action: 'failed',
            syncDuration: Date.now() - entityStart,
            errorMessage: errorMsg,
          },
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to fetch accounts: ${message}`);
    log.error('[sync:accounts] Fetch failed', { error: message });
  }
}

async function processCRMAccount(
  account: CRMAccount,
  connection: { id: string; provider: string },
  conflictResolution: SyncConflictResolution,
  result: SyncResult,
  log: ReturnType<typeof childLogger>,
  fieldMapping?: Record<string, string> | null,
): Promise<void> {
  // ── Step 1: Check if a matching company already exists ──
  const existingByExternalId = await db.company.findFirst({
    where: {
      tags: {
        path: '$.crmExternalIds',
        string_contains: account.externalId,
      },
    },
  });

  if (existingByExternalId) {
    // Company already linked to this CRM record
    if (conflictResolution === 'skip') {
      result.companiesSkipped++;
      await logSyncEntry(connection.id, 'import', 'company', existingByExternalId.id, account.externalId, 'skipped');
      return;
    }

    if (conflictResolution === 'crm_wins') {
      // Update local record with CRM data
      await db.company.update({
        where: { id: existingByExternalId.id },
        data: {
          industry: account.industry || existingByExternalId.industry,
          location: account.billingAddress || existingByExternalId.location,
          sizeRange: account.employeeCount
            ? String(account.employeeCount)
            : existingByExternalId.sizeRange,
          lastActivityAt: new Date(),
        },
      });

      result.companiesUpdated++;
      await createTimelineEvent(
        existingByExternalId.id,
        connection.provider,
        `Updated from ${connection.provider}`,
        `Company data refreshed from CRM sync (account ${account.name})`,
      );
      await logSyncEntry(connection.id, 'import', 'company', existingByExternalId.id, account.externalId, 'updated');
      return;
    }

    // local_wins: skip
    result.companiesSkipped++;
    await logSyncEntry(connection.id, 'import', 'company', existingByExternalId.id, account.externalId, 'skipped');
    return;
  }

  // ── Step 2: Try company-matcher for dedup ──
  const match = await matchCompany({
    companyName: account.name,
    website: account.domain || account.website,
  });

  if (match.matched && match.match) {
    // Existing company matched — update with CRM source
    const existingCompany = await db.company.findUnique({
      where: { id: match.match.companyId },
      select: { tags: true },
    });

    await db.company.update({
      where: { id: match.match.companyId },
      data: {
        source: 'crm',
        lastActivityAt: new Date(),
        tags: (existingCompany?.tags as string[]) || [],
      },
    });

    await createTimelineEvent(
      match.match.companyId,
      connection.provider,
      `Linked to ${connection.provider}`,
      `Matched and linked to ${connection.provider} account: ${account.name}`,
    );

    result.companiesUpdated++;
    await logSyncEntry(connection.id, 'import', 'company', match.match.companyId, account.externalId, 'updated');
    return;
  }

  // ── Step 3: Create new company ──
  // Apply custom field mapping to account data before creating
  const accountData = applyCustomFieldMapping(
    {
      name: account.name,
      domain: account.domain || null,
      industry: account.industry || null,
      billingAddress: account.billingAddress || null,
      employeeCount: account.employeeCount ? String(account.employeeCount) : null,
      website: account.website || null,
    },
    fieldMapping,
  );

  const newCompany = await db.company.create({
    data: {
      rawName: (accountData.name as string) || account.name,
      normalizedName: ((accountData.name as string) || account.name).trim().toLowerCase(),
      domain: (accountData.domain as string) || null,
      industry: (accountData.industry as string) || null,
      location: (accountData.billingAddress as string) || null,
      sizeRange: (accountData.employeeCount as string) || null,
      website: (accountData.website as string) || null,
      source: 'crm',
      status: 'prospect',
      lastEnrichedAt: new Date(),
      lastActivityAt: new Date(),
    },
  });

  await createTimelineEvent(
    newCompany.id,
    connection.provider,
    `Imported from ${connection.provider}`,
    `Company imported from CRM: ${account.name}${account.industry ? ` (${account.industry})` : ''}`,
  );

  result.companiesCreated++;
  await logSyncEntry(connection.id, 'import', 'company', newCompany.id, account.externalId, 'created');
}

// ─── Internal: Sync Contacts ───────────────────────────────────────

async function syncContacts(
  connector: CRMConnector,
  token: CRMToken,
  connection: { id: string; provider: string },
  conflictResolution: SyncConflictResolution,
  limit: number,
  modifiedAfter: string | undefined,
  result: SyncResult,
  log: ReturnType<typeof childLogger>,
): Promise<void> {
  try {
    const contacts = await connector.fetchContacts(token, {
      limit,
      modifiedAfter,
    });

    log.info('[sync:contacts] Fetched contacts from CRM', {
      count: contacts.length,
    });

    for (const contact of contacts) {
      const entityStart = Date.now();

      try {
        await processCRMContact(
          contact,
          connection,
          conflictResolution,
          result,
          log,
        );
      } catch (err) {
        result.contactsFailed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Contact ${contact.externalId}: ${errorMsg}`);
        log.error('[sync:contacts] Failed to process contact', {
          externalId: contact.externalId,
          error: errorMsg,
        });

        await db.cRMSyncLog.create({
          data: {
            connectionId: connection.id,
            direction: 'import',
            entityType: 'contact',
            crmExternalId: contact.externalId,
            action: 'failed',
            syncDuration: Date.now() - entityStart,
            errorMessage: errorMsg,
          },
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to fetch contacts: ${message}`);
    log.error('[sync:contacts] Fetch failed', { error: message });
  }
}

async function processCRMContact(
  contact: CRMContact,
  connection: { id: string; provider: string },
  conflictResolution: SyncConflictResolution,
  result: SyncResult,
  log: ReturnType<typeof childLogger>,
): Promise<void> {
  const fullName = `${contact.firstName} ${contact.lastName}`.trim();

  // ── Find the parent company ──
  let companyId: string | null = null;

  if (contact.accountId) {
    // Look up by CRM account name match
    // In a full implementation, we'd maintain an externalId → companyId map
    const companyByExternalId = await db.company.findFirst({
      where: {
        tags: {
          path: '$.crmExternalIds',
          string_contains: contact.accountId,
        },
      },
    });

    if (companyByExternalId) {
      companyId = companyByExternalId.id;
    }
  }

  if (!companyId && contact.accountName) {
    const companyMatch = await matchCompany({
      companyName: contact.accountName,
      email: contact.email,
    });

    if (companyMatch.matched && companyMatch.match) {
      companyId = companyMatch.match.companyId;
    }
  }

  if (!companyId) {
    // No company found — skip this contact (contacts require a company)
    result.contactsSkipped++;
    await logSyncEntry(connection.id, 'import', 'contact', undefined, contact.externalId, 'skipped');
    log.info('[sync:contacts] Skipped contact — no matching company', {
      contact: fullName,
      accountName: contact.accountName,
    });
    return;
  }

  // ── Check if contact already exists by email ──
  if (contact.email) {
    const existingContact = await db.contact.findUnique({
      where: { email: contact.email },
    });

    if (existingContact) {
      if (conflictResolution === 'local_wins' || conflictResolution === 'skip') {
        result.contactsSkipped++;
        await logSyncEntry(connection.id, 'import', 'contact', existingContact.id, contact.externalId, 'skipped');
        return;
      }

      // crm_wins: update
      await db.contact.update({
        where: { id: existingContact.id },
        data: {
          title: contact.title || existingContact.title,
          phone: contact.phone || existingContact.phone,
          location: contact.department || existingContact.location,
          lastCheckedAt: new Date(),
        },
      });

      result.contactsUpdated++;
      await logSyncEntry(connection.id, 'import', 'contact', existingContact.id, contact.externalId, 'updated');
      return;
    }
  }

  // ── Find a batch to associate the contact with ──
  // CRM imports get a dedicated batch
  let batch = await db.importBatch.findFirst({
    where: { status: 'completed', fileName: `crm-${connection.provider}` },
    orderBy: { createdAt: 'desc' },
  });

  if (!batch) {
    batch = await db.importBatch.create({
      data: {
        fileName: `crm-${connection.provider}`,
        fileHash: `crm-${connection.id}-${Date.now()}`,
        totalRows: 0,
        acceptedRows: 0,
        duplicateRows: 0,
        invalidRows: 0,
        questionableRows: 0,
        status: 'completed',
      },
    });
  }

  // ── Create new contact ──
  await db.contact.create({
    data: {
      rawName: fullName,
      normalizedName: fullName.toLowerCase(),
      email: contact.email || `${contact.externalId}@crm-placeholder.invalid`,
      title: contact.title || null,
      phone: contact.phone || null,
      companyId,
      batchId: batch.id,
      source: 'manual',
      status: 'imported',
      enrichmentData: {
        crmProvider: connection.provider,
        crmExternalId: contact.externalId,
        department: contact.department,
      },
    },
  });

  await db.importBatch.update({
    where: { id: batch.id },
    data: { totalRows: { increment: 1 }, acceptedRows: { increment: 1 } },
  });

  await createTimelineEvent(
    companyId,
    connection.provider,
    `Contact imported from ${connection.provider}`,
    `Contact ${fullName} imported from CRM sync`,
  );

  result.contactsCreated++;
  await logSyncEntry(connection.id, 'import', 'contact', undefined, contact.externalId, 'created');
}

// ─── Internal: Sync Deals ─────────────────────────────────────────

async function syncDeals(
  connector: CRMConnector,
  token: CRMToken,
  connection: { id: string; provider: string },
  limit: number,
  modifiedAfter: string | undefined,
  result: SyncResult,
  log: ReturnType<typeof childLogger>,
): Promise<void> {
  try {
    const deals = await connector.fetchDeals(token, {
      limit,
      modifiedAfter,
    });

    log.info('[sync:deals] Fetched deals from CRM', {
      count: deals.length,
    });

    for (const deal of deals) {
      const entityStart = Date.now();

      try {
        await processCRMDeal(deal, connection, result, log);
      } catch (err) {
        result.opportunitiesFailed++;
        const errorMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`Deal ${deal.externalId}: ${errorMsg}`);
        log.error('[sync:deals] Failed to process deal', {
          externalId: deal.externalId,
          error: errorMsg,
        });

        await db.cRMSyncLog.create({
          data: {
            connectionId: connection.id,
            direction: 'import',
            entityType: 'opportunity',
            crmExternalId: deal.externalId,
            action: 'failed',
            syncDuration: Date.now() - entityStart,
            errorMessage: errorMsg,
          },
        });
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    result.errors.push(`Failed to fetch deals: ${message}`);
    log.error('[sync:deals] Fetch failed', { error: message });
  }
}

async function processCRMDeal(
  deal: CRMDeal,
  connection: { id: string; provider: string },
  result: SyncResult,
  log: ReturnType<typeof childLogger>,
): Promise<void> {
  // ── Find the parent company ──
  let companyId: string | null = null;

  if (deal.accountId) {
    const companyByExternalId = await db.company.findFirst({
      where: {
        tags: {
          path: '$.crmExternalIds',
          string_contains: deal.accountId,
        },
      },
    });

    if (companyByExternalId) {
      companyId = companyByExternalId.id;
    }
  }

  if (!companyId && deal.accountName) {
    const companyMatch = await matchCompany({ companyName: deal.accountName });
    if (companyMatch.matched && companyMatch.match) {
      companyId = companyMatch.match.companyId;
    }
  }

  if (!companyId) {
    result.opportunitiesSkipped++;
    await logSyncEntry(connection.id, 'import', 'opportunity', undefined, deal.externalId, 'skipped');
    log.info('[sync:deals] Skipped deal — no matching company', {
      deal: deal.name,
      accountName: deal.accountName,
    });
    return;
  }

  // ── Create a timeline event for the deal ──
  await createTimelineEvent(
    companyId,
    connection.provider,
    `Deal synced from ${connection.provider}`,
    `Deal "${deal.name}" — Stage: ${deal.stage || 'Unknown'}, Amount: ${deal.amount ? `$${deal.amount.toLocaleString()}` : 'Unknown'}, Probability: ${deal.probability != null ? `${deal.probability}%` : 'Unknown'}, Close: ${deal.closeDate || 'TBD'}`,
    {
      crmProvider: connection.provider,
      crmExternalId: deal.externalId,
      dealStage: deal.stage,
      dealAmount: deal.amount,
      dealProbability: deal.probability,
      dealCloseDate: deal.closeDate,
      dealType: deal.type,
    },
  );

  // ── Also create an OpportunityRecommendation if possible ──
  await createOpportunityFromCRMDeal(companyId, deal, connection, log);

  result.opportunitiesCreated++;
  await logSyncEntry(connection.id, 'import', 'opportunity', undefined, deal.externalId, 'created');
}

// ─── Helpers ───────────────────────────────────────────────────────

/**
 * Create an OpportunityRecommendation from a CRM deal.
 * Since OpportunityRecommendation requires signalId and capabilityMatchId,
 * we create lightweight placeholder records to satisfy the FK constraints.
 */
async function createOpportunityFromCRMDeal(
  companyId: string,
  deal: CRMDeal,
  connection: { id: string; provider: string },
  log: ReturnType<typeof childLogger>,
): Promise<void> {
  try {
    // Check if an OpportunityRecommendation already exists for this CRM deal
    const existing = await db.opportunityRecommendation.findFirst({
      where: {
        companyId,
        opportunityTitle: `CRM Deal: ${deal.name}`,
      },
    });

    if (existing) {
      log.info('[sync:deals] OpportunityRecommendation already exists for deal', {
        deal: deal.name,
        opportunityId: existing.id,
      });
      return;
    }

    // ── Step 1: Create a placeholder signal for this company ──
    let signal = await db.companySignal.findFirst({
      where: {
        companyId,
        signalType: 'news',
        source: { contains: connection.provider },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!signal) {
      signal = await db.companySignal.create({
        data: {
          companyId,
          signalType: 'news',
          title: `CRM Deal: ${deal.name}`,
          description: `Deal imported from ${connection.provider}: ${deal.name} (Stage: ${deal.stage || 'Unknown'})`,
          source: `${connection.provider}_crm`,
          severity: 'medium',
          impact: deal.amount && deal.amount > 50000 ? 'high' : 'medium',
          confidence: deal.probability ? deal.probability / 100 : 0.5,
          evidenceIds: JSON.stringify({
            crmProvider: connection.provider,
            crmExternalId: deal.externalId,
            dealStage: deal.stage,
            dealAmount: deal.amount,
            dealProbability: deal.probability,
            dealCloseDate: deal.closeDate,
          }),
          isRead: true,
          status: 'active',
        },
      });
    }

    // ── Step 2: Create a placeholder capability match ──
    // Look for an existing one first
    let capMatch = await db.signalCapabilityMatch.findFirst({
      where: {
        companyId,
        signalId: signal.id,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!capMatch) {
      // Find any capability asset to use as a placeholder
      const anyCapability = await db.capabilityAsset.findFirst({
        select: { id: true },
      });

      if (!anyCapability) {
        // No capability assets exist yet — we cannot create the
        // OpportunityRecommendation without a capability match FK.
        // The timeline event already records the deal data.
        log.info('[sync:deals] No CapabilityAsset found; skipping OpportunityRecommendation creation', {
          deal: deal.name,
        });
        return;
      }

      capMatch = await db.signalCapabilityMatch.create({
        data: {
          companyId,
          signalId: signal.id,
          capabilityId: anyCapability.id,
          matchScore: deal.probability ? deal.probability / 100 : 0.3,
          reason: `CRM deal "${deal.name}" imported from ${connection.provider}`,
          businessProblem: deal.name,
          expectedOutcome: deal.amount ? `Revenue opportunity: $${deal.amount.toLocaleString()}` : 'Revenue opportunity from CRM deal',
          salesAngle: deal.type || 'General engagement',
        },
      });
    }

    // ── Step 3: Create the OpportunityRecommendation ──
    const probability = deal.probability ?? 50;
    const amount = deal.amount ?? 0;

    await db.opportunityRecommendation.create({
      data: {
        companyId,
        signalId: signal.id,
        capabilityMatchId: capMatch.id,
        opportunityTitle: `CRM Deal: ${deal.name}`,
        businessTrigger: `Deal imported from ${connection.provider}`,
        whyNow: deal.closeDate
          ? `Deal close date: ${deal.closeDate}`
          : `Active ${deal.stage || 'open'} deal in ${connection.provider}`,
        businessProblem: deal.name,
        recommendedCapability: deal.type || 'General',
        recommendedStakeholders: JSON.stringify(
          deal.contactName ? [deal.contactName] : [],
        ),
        suggestedConversation: `Discuss the ${deal.name} deal — currently at ${deal.stage || 'unknown'} stage${deal.amount ? ` with $${deal.amount.toLocaleString()} value` : ''}`,
        confidenceScore: probability / 100,
        freshnessScore: 80,
        matchScore: probability / 100,
        opportunityScore: Math.round(probability * 0.8 + (amount > 100000 ? 20 : amount > 50000 ? 10 : 0)),
        priority: probability >= 70 ? 'high' : probability >= 40 ? 'medium' : 'low',
        status: 'pending_review',
        evidenceIds: JSON.stringify({
          crmProvider: connection.provider,
          crmExternalId: deal.externalId,
          dealStage: deal.stage,
          dealAmount: amount,
          dealProbability: probability,
          dealCloseDate: deal.closeDate,
          dealType: deal.type,
        }),
      },
    });

    log.info('[sync:deals] Created OpportunityRecommendation from CRM deal', {
      deal: deal.name,
      companyId,
    });
  } catch (err) {
    // Best-effort: don't let OpportunityRecommendation creation failure
    // break the overall deal sync — the timeline event already captured it
    const msg = err instanceof Error ? err.message : String(err);
    log.warn('[sync:deals] Failed to create OpportunityRecommendation, continuing with timeline event only', {
      deal: deal.name,
      error: msg,
    });
  }
}

// ─── Logging Helpers ──────────────────────────────────────────────

async function logSyncEntry(
  connectionId: string,
  direction: 'import' | 'export',
  entityType: string,
  entityId: string | undefined,
  crmExternalId: string | undefined,
  action: 'created' | 'updated' | 'skipped' | 'failed',
  syncDuration?: number,
  errorMessage?: string,
): Promise<void> {
  try {
    await db.cRMSyncLog.create({
      data: {
        connectionId,
        direction,
        entityType,
        entityId: entityId || null,
        crmExternalId: crmExternalId || null,
        action,
        syncDuration,
        errorMessage,
      },
    });
  } catch (err) {
    logger.error('[crm-sync] Failed to create sync log entry', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function createTimelineEvent(
  companyId: string,
  provider: string,
  title: string,
  description: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.companyTimelineEvent.create({
      data: {
        companyId,
        eventType: 'enrichment',
        title,
        description,
        metadata: (metadata || {
          crmProvider: provider,
        }) as unknown as Record<string, string | number | boolean | null | undefined>,
      },
    });
  } catch (err) {
    logger.error('[crm-sync] Failed to create timeline event', {
      companyId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─── Get Sync Statistics ───────────────────────────────────────────

export async function getSyncStats(connectionId: string) {
  const connection = await db.cRMConnection.findUnique({
    where: { id: connectionId },
    include: {
      syncLogs: {
        orderBy: { syncedAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!connection) return null;

  // Compute aggregate stats
  const logs = await db.cRMSyncLog.findMany({
    where: { connectionId },
  });

  const stats = {
    totalSyncs: logs.length,
    created: logs.filter(l => l.action === 'created').length,
    updated: logs.filter(l => l.action === 'updated').length,
    skipped: logs.filter(l => l.action === 'skipped').length,
    failed: logs.filter(l => l.action === 'failed').length,
    imports: logs.filter(l => l.direction === 'import').length,
    exports: logs.filter(l => l.direction === 'export').length,
    byEntity: {
      company: logs.filter(l => l.entityType === 'company').length,
      contact: logs.filter(l => l.entityType === 'contact').length,
      opportunity: logs.filter(l => l.entityType === 'opportunity').length,
    },
    lastSyncAt: connection.lastSyncAt,
    avgSyncDurationMs:
      logs.length > 0
        ? Math.round(logs.reduce((sum, l) => sum + (l.syncDuration || 0), 0) / logs.length)
        : 0,
  };

  return { connection, stats };
}
