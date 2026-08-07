/**
 * Task 4.5 — CRM Integration Framework: Barrel Export
 *
 * Public API for the CRM integration module.
 * Import from '@/lib/crm' to access all CRM functionality.
 */

// ─── Core Types ────────────────────────────────────────────────────
export type {
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

export { getConnectorForProvider, getRegisteredProviders } from './crm-connector';

// ─── Adapters ────────────────────────────────────────────────────
export { salesforceAdapter } from './salesforce-adapter';
export { hubSpotAdapter } from './hubspot-adapter';

// ─── Sync Service ─────────────────────────────────────────────────
export {
  syncFromCRM,
  syncToCRM,
  getSyncStats,
  getConnector,
} from './crm-sync-service';

export type {
  SyncResult,
  SyncFromCRMOptions,
  SyncConflictResolution,
} from './crm-sync-service';
