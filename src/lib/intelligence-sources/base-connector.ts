/**
 * Base Connector
 *
 * Abstract base class providing shared helper methods for all connectors.
 * Handles result construction and error wrapping so concrete connectors
 * stay focused on their specific parsing logic.
 *
 * Supports two usage patterns:
 * 1. Legacy: subclass implements `run(config)` → returns `ConnectorResult`
 *    (used by website-connector, rss-connector)
 * 2. New IConnector: subclass also implements `acquire()`, `validateConfig()`,
 *    `test()`, and provides `sourceType`/`name` readonly fields.
 *    (used by csv-connector, excel-connector)
 */

import type {
  ConnectorAcquisitionResult,
  ConnectorConfig,
  ConnectorMessage,
  ConnectorResult,
  RawIntelligenceObject,
} from './types';

export abstract class BaseConnector {
  // ─── Legacy abstract ─────────────────────────────────────────
  /** Run the connector with the given configuration. Must never throw. */
  abstract run(config: ConnectorConfig): Promise<ConnectorResult>;

  // ─── Legacy result helpers ────────────────────────────────────

  /**
   * Build a ConnectorResult for the legacy run() pattern.
   */
  protected createResult(
    status: string,
    objects: RawIntelligenceObject[],
    messages: ConnectorMessage[]
  ): ConnectorResult {
    return {
      status: status as ConnectorResult['status'],
      intelligenceObjects: objects,
      messages,
    };
  }

  /**
   * Shorthand for an error ConnectorResult (legacy pattern).
   */
  protected createErrorResult(
    message: string,
    _url?: string
  ): ConnectorResult {
    return {
      status: 'error',
      intelligenceObjects: [],
      messages: [this.msg('error', message, _url)],
    };
  }

  /**
   * Build a ConnectorMessage object.
   */
  protected msg(
    level: string,
    message: string,
    url?: string
  ): ConnectorMessage {
    return {
      level: level as ConnectorMessage['level'],
      message,
      url,
    };
  }

  // ─── New IConnector result helpers ────────────────────────────

  /**
   * Build a ConnectorAcquisitionResult with sensible defaults.
   */
  protected createAcquisitionResult(
    partial: Partial<ConnectorAcquisitionResult>
  ): ConnectorAcquisitionResult {
    return {
      success: partial.success ?? true,
      intelligenceObjects: partial.intelligenceObjects ?? [],
      errors: partial.errors ?? [],
      metadata: partial.metadata ?? {},
    };
  }

  /**
   * Shorthand for a failed acquisition with a single error message.
   */
  protected createAcquisitionErrorResult(
    error: string,
    metadata: Record<string, unknown> = {}
  ): ConnectorAcquisitionResult {
    return {
      success: false,
      intelligenceObjects: [],
      errors: [error],
      metadata,
    };
  }
}