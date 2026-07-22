/**
 * Intelligence Sources — Barrel Export
 *
 * Public API for the intelligence acquisition layer.
 * Import from '@/lib/intelligence-sources' to access types,
 * interfaces, base classes, and connector implementations.
 */

export * from './types';
export * from './connector-interface';
export * from './base-connector';
export { CsvConnector } from './connectors/csv-connector';
export { ExcelConnector } from './connectors/excel-connector';
export { WebsiteConnector } from './connectors/website-connector';
export { RssConnector } from './connectors/rss-connector';
export { resolveCompany, confirmResolution, createUnverifiedCompany } from './company-resolution';
export { adaptToEvidence } from './evidence-adapter';
export * from './job-queue';
export * from './knowledge-fabric';
export * from './acquisition-engine';
// Sprint 2: Intelligence Fabric Layer
export * from './association-engine';
export * from './confidence-engine';
export * from './knowledge-versioning';
export * from './source-governance';
// Sprint 3: Human Intelligence, Timeline, Scheduler, Alerts, Analytics
export * from './human-intelligence';
export * from './intelligence-timeline';
export * from './connector-scheduler';
export * from './intelligence-alerts';
export * from './analytics-dashboard';