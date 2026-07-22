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