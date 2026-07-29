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
    console.error(`[monitor] Check failed for ${companyId}:`, error);
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
