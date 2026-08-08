/**
 * Data Import Module — Task 4.6: Bulk Import/Export Pipeline
 *
 * Barrel export for the import pipeline and enhanced import features.
 */

// Original pipeline (unchanged)
export {
  createDataUpload,
  autoMapColumns,
  validateRows,
  normalizeRows,
  commitImport,
  getUploadWithDetails,
  listUploads,
} from './pipeline';

export type {
  ValidationIssue,
  SuggestedCorrection,
  AppliedCorrection,
  ValidationResult,
  NormalizationResult,
  CommitResult,
} from './pipeline';

// Enhanced import features
export {
  listImportTemplates,
  getImportTemplate,
  createImportTemplate,
  deleteImportTemplate,
  applyTemplateMapping,
  generateImportPreview,
  createImportSchedule,
  listImportSchedules,
  deleteImportSchedule,
  rollbackImport,
  incrementalImport,
} from './enhanced-import';

export type {
  ImportTemplateData,
  ImportPreviewRow,
  ImportPreviewResult,
  ImportSchedule,
  RollbackResult,
  IncrementalImportResult,
} from './enhanced-import';
