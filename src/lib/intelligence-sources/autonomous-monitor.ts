/**
 * Phase 2C — Autonomous Monitoring Engine
 *
 * Continuously watches accounts for new intelligence and generates
 * alerts when significant changes are detected.
 *
 * Alert types: critical signal, new signal type, signal cluster,
 * correlation pattern, prediction.
 */

import { db } from '@/lib/db';
import { detectCorrelations, type CorrelationInsight } from './cross-signal-correlation';
import { generatePredictions, type IntelligencePrediction } from './predictive-intelligence';
import { detectCrossAccountPatterns, type CrossAccountInsight } from './cross-account-intelligence';
import { createAlert, mapMonitorSeverity, hasActiveAlert, hasActiveAlertByDedupKey } from './intelligence-alerts';
import { computeLearningInsights, shouldAlertQualityDecline, type LearningInsight } from './learning-loop';
import { logger } from '@/lib/logger';

// ─── Alert Types ───────────────────────────────────────────────

export type AlertSeverity = 'info' | 'warning' | 'urgent' | 'critical';
export type AlertType =
  | 'new_high_confidence_signal'
  | 'new_signal_type_detected'
  | 'signal_cluster_detected'
  | 'fresh_critical_signal'
  | 'correlation_pattern_found'
  | 'prediction_generated';

export interface IntelligenceAlert {
  id: string;
  companyId: string;
  companyName: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  description: string;
  signalId?: string;
  correlation?: CorrelationInsight;
  prediction?: IntelligencePrediction;
  actionRequired: string;
  createdAt: string;
}

interface MonitoringConfig {
  criticalSeverityTypes: string[];
  clusterWindowHours: number;
  clusterMinSignals: number;
}

const DEFAULT_CONFIG: MonitoringConfig = {
  criticalSeverityTypes: ['acquisition', 'funding', 'leadership_change'],
  clusterWindowHours: 48,
  clusterMinSignals: 3,
};

/**
 * Run monitoring check for a single company.
 */
export async function runMonitoringCheck(
  companyId: string,
  config: Partial<MonitoringConfig> = {}
): Promise<IntelligenceAlert[]> {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const alerts: IntelligenceAlert[] = [];
  const uid = () => `alert-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  try {
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true },
    });
    if (!company) return alerts;

    const cutoff = new Date(Date.now() - cfg.clusterWindowHours * 60 * 60 * 1000);
    const recentSignals = await db.companySignal.findMany({
      where: { companyId, status: { notIn: ['archived', 'expired'] }, createdAt: { gte: cutoff } },
      orderBy: { createdAt: 'desc' },
    });

    // Alert: Fresh critical signal
    for (const signal of recentSignals) {
      if (cfg.criticalSeverityTypes.includes(signal.signalType) && signal.severity === 'critical') {
        const ageHours = (Date.now() - new Date(signal.createdAt).getTime()) / (1000 * 60 * 60);
        if (ageHours < 24) {
          alerts.push({
            id: uid(), companyId, companyName: company.rawName,
            type: 'fresh_critical_signal', severity: 'critical',
            title: `Critical: ${signal.signalType.replace(/_/g, ' ')} at ${company.rawName}`,
            description: signal.title + (signal.description ? ` — ${signal.description}` : ''),
            signalId: signal.id,
            actionRequired: 'Immediate account team review required. Assess impact on pipeline and contracts.',
            createdAt: new Date().toISOString(),
          });
        }
      }
    }

    // Alert: Signal cluster
    if (recentSignals.length >= cfg.clusterMinSignals) {
      alerts.push({
        id: uid(), companyId, companyName: company.rawName,
        type: 'signal_cluster_detected',
        severity: recentSignals.length >= 6 ? 'urgent' : 'warning',
        title: `Signal cluster: ${recentSignals.length} signals in ${cfg.clusterWindowHours}h for ${company.rawName}`,
        description: `High signal density — ${recentSignals.length} signals in ${cfg.clusterWindowHours}h suggests significant business activity.`,
        actionRequired: 'Review all recent signals holistically. Signal clusters often indicate inflection points.',
        createdAt: new Date().toISOString(),
      });
    }

    // Alert: Cross-signal correlation
    const correlations = detectCorrelations(recentSignals);
    for (const corr of correlations) {
      if (corr.confidence >= 0.5) {
        alerts.push({
          id: uid(), companyId, companyName: company.rawName,
          type: 'correlation_pattern_found',
          severity: corr.confidence >= 0.7 ? 'urgent' : 'info',
          title: `Pattern: ${corr.pattern.replace(/_/g, ' ')} at ${company.rawName}`,
          description: `${corr.description}. ${corr.signalCount} signals across ${corr.typeDiversity} types.`,
          correlation: corr,
          actionRequired: corr.recommendedAction,
          createdAt: new Date().toISOString(),
        });
      }
    }

    // Alert: Prediction
    const predictions = generatePredictions(recentSignals);
    for (const pred of predictions) {
      if (pred.confidence >= 0.4) {
        alerts.push({
          id: uid(), companyId, companyName: company.rawName,
          type: 'prediction_generated',
          severity: pred.confidence >= 0.6 ? 'warning' : 'info',
          title: `Prediction: ${pred.type.replace(/_/g, ' ')} for ${company.rawName}`,
          description: `${pred.description}. Confidence: ${Math.round(pred.confidence * 100)}%. Timeframe: ${pred.timeframe}.`,
          prediction: pred,
          actionRequired: pred.recommendedPreparation,
          createdAt: new Date().toISOString(),
        });
      }
    }
  } catch (error) {
    logger.error(`[monitor] Check failed for ${companyId}:`, { error: error });
  }

  return alerts;
}

/**
 * Run monitoring across a batch of companies.
 */
export async function runMonitoringBatch(
  companyIds: string[],
  config?: Partial<MonitoringConfig>
): Promise<Map<string, IntelligenceAlert[]>> {
  const results = new Map<string, IntelligenceAlert[]>();
  for (const companyId of companyIds) {
    results.set(companyId, await runMonitoringCheck(companyId, config));
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return results;
}

/**
 * Run monitoring across a batch of companies AND persist generated alerts to DB.
 *
 * This is a persistence wrapper — it calls the existing runMonitoringBatch()
 * detection engine unchanged, then iterates the results and persists each
 * intelligence alert through the intelligence-alerts.ts persistence layer.
 *
 * Deduplication: checks for existing active alerts with same companyId + alertType
 * within the last 24 hours before creating a new alert.
 *
 * Detection engine (runMonitoringCheck / runMonitoringBatch) is NOT modified.
 * All DB writes go through intelligence-alerts.ts functions.
 */
export async function runMonitoringBatchWithPersistence(
  companyIds: string[],
  config?: Partial<MonitoringConfig>
): Promise<{ results: Map<string, IntelligenceAlert[]>; persistedCount: number }> {
  // Run the existing detection engine — unchanged
  const results = await runMonitoringBatch(companyIds, config);

  let persistedCount = 0;
  for (const [companyId, alerts] of results) {
    for (const alert of alerts) {
      try {
        // Deduplication: skip if active alert exists for same company + type
        const isDuplicate = await hasActiveAlert(companyId, alert.type);
        if (isDuplicate) continue;

        // Map severity from autonomous-monitor space to DB space
        const { dbSeverity, original } = mapMonitorSeverity(alert.severity);

        await createAlert({
          companyId: alert.companyId,
          severity: dbSeverity,
          alertType: alert.type,
          title: alert.title,
          description: alert.description,
          metadata: {
            source: 'autonomous-monitor',
            originalSeverity: original,
            signalId: alert.signalId ?? null,
            actionRequired: alert.actionRequired,
            correlation: alert.correlation ?? null,
            prediction: alert.prediction ?? null,
          },
        });
        persistedCount++;
      } catch (err) {
        logger.error(`[monitor] Failed to persist alert for ${companyId}:`, { error: err });
        // Continue persisting other alerts — one failure must not block the batch
      }
    }
  }

  return { results, persistedCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// WI-4: Cross-Account & Prediction Persistence Wrappers
//
// These wrappers follow the same pattern as runMonitoringBatchWithPersistence:
// - Detection engines are NOT modified (detectCrossAccountPatterns, generatePredictions)
// - All DB writes go through intelligence-alerts.ts
// - Deduplication before every createAlert() call
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Run cross-account analysis across multiple companies AND persist detected patterns.
 *
 * Calls detectCrossAccountPatterns() (pure function, untouched), then persists
 * each high-confidence pattern as an IntelligenceAlert via intelligence-alerts.ts.
 *
 * Detection engine (detectCrossAccountPatterns) is NOT modified.
 * All DB writes go through intelligence-alerts.ts functions.
 *
 * @param companyIds - Array of company IDs to analyze
 * @returns Object with insights array and count of persisted alerts
 */
export async function runCrossAccountAnalysisWithPersistence(
  companyIds: string[]
): Promise<{ insights: CrossAccountInsight[]; persistedCount: number }> {
  // Fetch companies and their signals for cross-account analysis
  const companies = await db.company.findMany({
    where: { id: { in: companyIds } },
    select: { id: true, rawName: true, industry: true },
  });

  const allSignals = await db.companySignal.findMany({
    where: { companyId: { in: companyIds }, status: { notIn: ['archived', 'expired'] } },
    orderBy: { createdAt: 'desc' },
    take: 200,
    select: { companyId: true, signalType: true, title: true, description: true, createdAt: true, confidence: true },
  });

  const companyMap = new Map(companies.map(c => [c.id, c]));
  const accountSignals = allSignals.map(s => ({
    companyId: s.companyId,
    companyName: companyMap.get(s.companyId)?.rawName || 'Unknown',
    industry: companyMap.get(s.companyId)?.industry || null,
    signalType: s.signalType,
    title: s.title,
    description: s.description,
    createdAt: s.createdAt,
    confidence: s.confidence,
  }));

  // Call the existing detection engine — unchanged
  const insights = detectCrossAccountPatterns(accountSignals);

  let persistedCount = 0;

  // Map CrossAccountPattern to alert type
  const patternToAlertType: Record<string, string> = {
    industry_trend: 'cross_account_industry_trend',
    technology_wave: 'cross_account_technology_wave',
    segment_opportunity: 'cross_account_segment_opportunity',
  };

  for (const insight of insights) {
    const alertType = patternToAlertType[insight.pattern];
    if (!alertType) continue; // Skip competitive_signal/market_timing (no generation logic)

    try {
      // Deduplication: hash affected companies + pattern type
      const companyHash = [...insight.affectedCompanyIds].sort().join('|');
      const dedupKey = `${insight.pattern}:${companyHash}`;
      const isDuplicate = await hasActiveAlertByDedupKey(dedupKey, alertType);
      if (isDuplicate) continue;

      // Severity: ≥ 5 affected companies → high, else medium
      const severity = insight.affectedCompanyIds.length >= 5 ? 'high' : 'medium';

      await createAlert({
        severity,
        alertType: alertType as any,
        title: `Cross-account: ${insight.pattern.replace(/_/g, ' ')} (${insight.affectedCompanyIds.length} accounts)`,
        description: insight.description,
        metadata: {
          source: 'cross-account-analysis',
          dedupKey,
          crossAccountInsight: insight,
          affectedCompanyIds: insight.affectedCompanyIds,
          affectedCompanyNames: insight.affectedCompanyNames,
          pattern: insight.pattern,
          confidence: insight.confidence,
          signalCount: insight.signalCount,
          businessImplication: insight.businessImplication,
          recommendedStrategy: insight.recommendedStrategy,
          industry: insight.industry ?? null,
          technology: (insight as any).technology ?? null,
        },
      });
      persistedCount++;
    } catch (err) {
      logger.error(`[monitor] Failed to persist cross-account alert:`, { error: err });
    }
  }

  return { insights, persistedCount };
}

/**
 * Run prediction generation across multiple companies AND persist high-confidence predictions.
 *
 * Calls generatePredictions() (pure function, untouched) per company, then persists
 * each high-confidence prediction (≥ 0.7) as an IntelligenceAlert.
 *
 * Detection engine (generatePredictions) is NOT modified.
 * All DB writes go through intelligence-alerts.ts functions.
 *
 * @param companyIds - Array of company IDs to analyze (typically top N by score)
 * @returns Object with predictions map and count of persisted alerts
 */
export async function runPredictionBatchWithPersistence(
  companyIds: string[]
): Promise<{ predictions: Map<string, IntelligencePrediction[]>; persistedCount: number }> {
  const predictions = new Map<string, IntelligencePrediction[]>();
  let persistedCount = 0;

  for (const companyId of companyIds) {
    try {
      const signals = await db.companySignal.findMany({
        where: { companyId, status: { notIn: ['archived', 'expired'] } },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, signalType: true, title: true, description: true, createdAt: true, signalDate: true, confidence: true, severity: true },
      });

      // Call the existing detection engine — unchanged
      const preds = generatePredictions(signals);
      predictions.set(companyId, preds);

      for (const pred of preds) {
        if (pred.confidence < 0.7) continue; // Only persist high-confidence predictions

        try {
          // Deduplication: companyId + prediction type within 24h
          const dedupKey = `${companyId}:${pred.type}`;
          const isDuplicate = await hasActiveAlertByDedupKey(dedupKey, 'high_confidence_prediction');
          if (isDuplicate) continue;

          // Severity: ≥ 0.8 → high, else medium
          const severity = pred.confidence >= 0.8 ? 'high' : 'medium';

          const company = await db.company.findUnique({
            where: { id: companyId },
            select: { rawName: true },
          });

          await createAlert({
            companyId,
            severity,
            alertType: 'high_confidence_prediction',
            title: `Prediction: ${pred.type.replace(/_/g, ' ')} for ${company?.rawName ?? 'Unknown'}`,
            description: `${pred.description}. Confidence: ${Math.round(pred.confidence * 100)}%. Timeframe: ${pred.timeframe}.`,
            metadata: {
              source: 'prediction-batch',
              dedupKey,
              prediction: pred,
              companyId,
              companyName: company?.rawName ?? 'Unknown',
              confidence: pred.confidence,
              timeframe: pred.timeframe,
              salesImplication: pred.salesImplication,
              recommendedPreparation: pred.recommendedPreparation,
            },
          });
          persistedCount++;
        } catch (err) {
          logger.error(`[monitor] Failed to persist prediction alert for ${companyId}:`, { error: err });
        }
      }
    } catch (err) {
      logger.error(`[monitor] Prediction analysis failed for ${companyId}:`, { error: err });
    }
  }

  return { predictions, persistedCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// WI-5: Learning Loop Persistence Wrapper
//
// Follows the same pattern as WI-3/WI-4 wrappers:
// - computeLearningInsights() is NOT modified (it's in learning-loop.ts)
// - All DB writes go through intelligence-alerts.ts
// - Deduplication before every createAlert() call
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Compute learning insights and persist quality-declining alerts.
 *
 * Calls computeLearningInsights() (pure analysis, untouched), then
 * persists alerts for signal types whose accuracy has dropped below
 * the quality threshold with sufficient feedback.
 *
 * @returns Object with insights array and count of persisted alerts
 */
export async function runLearningLoopWithPersistence(): Promise<{
  insights: LearningInsight[];
  persistedCount: number;
}> {
  // Call the existing analysis function — unchanged
  const insights = await computeLearningInsights();

  let persistedCount = 0;

  for (const insight of insights) {
    if (!shouldAlertQualityDecline(insight)) continue;

    try {
      // Deduplication: same signalType + alertType within 48h
      const dedupKey = `quality:${insight.signalType}`;
      const isDuplicate = await hasActiveAlertByDedupKey(dedupKey, 'signal_quality_declining', 48);
      if (isDuplicate) continue;

      // Severity: accuracy < 0.2 → high, else medium
      const severity = insight.accuracyScore < 0.2 ? 'high' : 'medium';

      await createAlert({
        severity,
        alertType: 'signal_quality_declining',
        title: `Signal quality declining: ${insight.signalType.replace(/_/g, ' ')}`,
        description: `Signal type "${insight.signalType}" has an accuracy score of ${Math.round(insight.accuracyScore * 100)}% based on ${insight.totalFeedback} feedback responses. Trend: ${insight.trend}. Consider reviewing signal classification rules for this type.`,
        metadata: {
          source: 'learning-loop',
          dedupKey,
          insight,
          signalType: insight.signalType,
          accuracyScore: insight.accuracyScore,
          relevanceScore: insight.relevanceScore,
          actionabilityScore: insight.actionabilityScore,
          totalFeedback: insight.totalFeedback,
          surpriseScore: insight.surpriseScore,
          trend: insight.trend,
        },
      });
      persistedCount++;
    } catch (err) {
      logger.error(`[monitor] Failed to persist learning quality alert for ${insight.signalType}:`, { error: err });
    }
  }

  return { insights, persistedCount };
}
