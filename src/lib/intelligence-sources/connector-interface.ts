/**
 * Connector Interface (new IConnector pattern)
 *
 * Every intelligence connector implementing the new pattern must satisfy this.
 * The legacy pattern uses IIntelligenceConnector (run-only).
 *
 * New connectors (csv, excel) implement IConnector directly.
 * Legacy connectors (website, rss) use the abstract BaseConnector.run() only.
 */

import type { ConnectorAcquisitionResult, SourceType } from './types';

export interface IConnector {
  /** Unique identifier for the connector type (e.g. 'csv', 'excel') */
  readonly sourceType: SourceType;

  /** Human-readable display name */
  readonly name: string;

  /**
   * Acquire intelligence from the source.
   * @param config - Connector-specific configuration (file content, buffer, URL, etc.)
   */
  acquire(config: Record<string, unknown>): Promise<ConnectorAcquisitionResult>;

  /**
   * Validate connector configuration before a run.
   * Returns validation result with any error messages.
   */
  validateConfig(config: Record<string, unknown>): { valid: boolean; errors: string[] };

  /**
   * Test the connector connection / configuration.
   * A lighter-weight check than a full acquire().
   */
  test(config: Record<string, unknown>): Promise<{ success: boolean; message: string }>;
}

/** Legacy interface — kept for backward compatibility */
export interface IIntelligenceConnector {
  run(config: Record<string, unknown>): Promise<import('./types').ConnectorResult>;
}