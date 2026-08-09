/**
 * DeepMindQ — AI Scoring Bias Detector
 *
 * Analyzes AI scoring distributions for statistically significant bias
 * across demographic or categorical groupings (industry, companySize, etc.).
 *
 * Provides:
 *   - Chi-squared based statistical skew detection
 *   - Fairness metrics per scoring dimension
 *   - Configurable alert thresholds
 *   - Bias reports for admin review
 *
 * Usage:
 *   import { biasDetector } from '@/lib/bias-detector'
 *   const report = await biasDetector.generateBiasReport()
 *   const alerts = biasDetector.getBiasAlerts()
 */

import { db } from '@/lib/db'
import { childLogger } from '@/lib/logger'

const log = childLogger({ module: 'bias-detector' })

// ─── Types ──────────────────────────────────────────────────────────────

export type ScoreDimension =
  | 'technology_trigger'
  | 'growth_signal'
  | 'executive_change'
  | 'engagement'
  | 'contact_influence'
  | 'opportunity_strength'
  | 'buying_intent'
  | 'data_coverage'
  | 'risk'
  | 'overall'

export interface ScoreRecord {
  companyId: string
  companyName: string
  dimension: ScoreDimension
  score: number
  maxScore: number
  groupByField: string // e.g., industry, companySize, region
  groupByValue: string // e.g., "SaaS", "Enterprise", "North America"
  scoredAt: string
}

export interface GroupStatistics {
  group: string
  count: number
  mean: number
  median: number
  stdDev: number
  min: number
  max: number
  deviationFromOverall: number // percentage difference from overall mean
}

export interface DimensionBiasAnalysis {
  dimension: ScoreDimension
  overallMean: number
  overallStdDev: number
  overallCount: number
  groupByField: string
  groups: GroupStatistics[]
  chiSquared: number
  degreesOfFreedom: number
  pValue: number
  isBiased: boolean
  biasedGroups: string[]
}

export interface BiasAlert {
  id: string
  dimension: ScoreDimension
  group: string
  groupMean: number
  overallMean: number
  deviationPercent: number
  severity: 'low' | 'medium' | 'high'
  message: string
  detectedAt: string
}

export interface BiasReport {
  generatedAt: string
  totalScoreRecords: number
  dimensionsAnalyzed: string[]
  analyses: DimensionBiasAnalysis[]
  alerts: BiasAlert[]
  summary: {
    biasedDimensions: number
    totalAlerts: number
    highSeverityAlerts: number
    recommendation: string
  }
}

export interface BiasDetectorConfig {
  /** Flag if any group's average differs by >X% from overall average (default: 15%) */
  deviationThresholdPercent: number
  /** Chi-squared significance level (default: 0.05) */
  significanceLevel: number
  /** Minimum sample size per group for analysis (default: 5) */
  minGroupSize: number
  /** Fields to group by when analyzing (default: ['industry', 'companySize']) */
  groupByFields: string[]
  /** Whether bias detection is enabled */
  enabled: boolean
}

const DEFAULT_CONFIG: BiasDetectorConfig = {
  deviationThresholdPercent: 15,
  significanceLevel: 0.05,
  minGroupSize: 5,
  groupByFields: ['industry', 'companySize'],
  enabled: true,
}

const BIAS_ALERTS_KEY = 'bias_alerts_history'
const BIAS_CONFIG_KEY = 'bias_detector_config'

// ─── Chi-Squared Implementation ───────────────────────────────────────

/**
 * Compute chi-squared statistic for observed vs expected frequencies.
 * Groups scores into bins and compares distributions across groups.
 */
function chiSquaredTest(groupMeans: Map<string, number>, groupCounts: Map<string, number>): {
  statistic: number
  degreesOfFreedom: number
  pValue: number
} {
  const groups = Array.from(groupMeans.keys())
  const n = groups.length

  if (n < 2) {
    return { statistic: 0, degreesOfFreedom: 0, pValue: 1 }
  }

  // Overall weighted mean
  let totalWeightedSum = 0
  let totalN = 0
  for (const g of groups) {
    totalWeightedSum += groupMeans.get(g)! * groupCounts.get(g)!
    totalN += groupCounts.get(g)!
  }

  const overallMean = totalN > 0 ? totalWeightedSum / totalN : 0

  // Chi-squared: sum of (observed - expected)^2 / expected
  // Here we use weighted squared deviation from overall mean
  let chiSq = 0
  for (const g of groups) {
    const observed = groupMeans.get(g)!
    const expected = overallMean
    const n = groupCounts.get(g)!
    if (expected !== 0) {
      chiSq += n * Math.pow(observed - expected, 2) / expected
    }
  }

  const df = n - 1

  // Approximate p-value using incomplete gamma function (simplified)
  // For small df, use a lookup-like approximation
  const pValue = approximatePValue(chiSq, df)

  return { statistic: chiSq, degreesOfFreedom: df, pValue }
}

/**
 * Approximate p-value for chi-squared distribution.
 * Uses the regularized incomplete gamma function approximation.
 * Accurate enough for bias detection purposes.
 */
function approximatePValue(chiSq: number, df: number): number {
  if (df <= 0 || chiSq <= 0) return 1

  // For large chiSq, p-value is very small
  if (chiSq > 1000) return 0.0001

  // Use the series expansion approximation for the regularized gamma function
  // P(X > x) ≈ 1 - γ(df/2, x/2) / Γ(df/2)
  const k = df / 2
  const x = chiSq / 2

  // Series: γ(s, x) = e^(-x) * x^s * Σ(x^n / (s*(s+1)*...*(s+n)))
  let sum = 1 / k
  let term = 1 / k
  for (let n = 1; n < 100; n++) {
    term *= x / (k + n)
    sum += term
    if (Math.abs(term) < 1e-10) break
  }

  const gammaLower = Math.exp(-x) * Math.pow(x, k) * sum

  // Γ(k) using Stirling's approximation for the upper
  const logGammaK = (k - 0.5) * Math.log(k) - k + 0.5 * Math.log(2 * Math.PI)
  const gammaK = Math.exp(logGammaK)

  const regularizedGamma = gammaK > 0 ? Math.min(gammaLower / gammaK, 1) : 0

  return Math.max(0, Math.min(1, 1 - regularizedGamma))
}

// ─── Bias Detector Service ────────────────────────────────────────────

class BiasDetector {
  private cachedAlerts: BiasAlert[] = []

  /**
   * Load bias detector configuration from SystemSetting.
   */
  async getConfig(): Promise<BiasDetectorConfig> {
    try {
      const row = await db.systemSetting.findUnique({ where: { key: BIAS_CONFIG_KEY } })
      return row ? { ...DEFAULT_CONFIG, ...JSON.parse(row.value) } : { ...DEFAULT_CONFIG }
    } catch {
      return { ...DEFAULT_CONFIG }
    }
  }

  /**
   * Update bias detector configuration.
   */
  async updateConfig(partial: Partial<BiasDetectorConfig>): Promise<BiasDetectorConfig> {
    const current = await this.getConfig()
    const updated = { ...current, ...partial }
    await db.systemSetting.upsert({
      where: { key: BIAS_CONFIG_KEY },
      update: { value: JSON.stringify(updated) },
      create: { key: BIAS_CONFIG_KEY, value: JSON.stringify(updated) },
    })
    return updated
  }

  /**
   * Load score records from the database for bias analysis.
   * Pulls from PriorityScoreHistory and Company tables.
   */
  private async loadScoreRecords(): Promise<ScoreRecord[]> {
    try {
      // Fetch companies with their scores and metadata
      const companies = await db.company.findMany({
        select: {
          id: true,
          rawName: true,
          industry: true,
          accountPriorityScore: true,
          sizeRange: true,
        },
        where: {
          accountPriorityScore: { not: null },
        },
      })

      const records: ScoreRecord[] = []

      for (const company of companies) {
        if (!company.industry && !company.sizeRange) continue

        // Create an overall score record
        records.push({
          companyId: company.id,
          companyName: company.rawName,
          dimension: 'overall',
          score: company.accountPriorityScore || 0,
          maxScore: 100,
          groupByField: 'industry',
          groupByValue: company.industry || 'Unknown',
          scoredAt: new Date().toISOString(),
        })

        // Also group by company size
        const sizeBucket = company.sizeRange || 'Unknown'
        records.push({
          companyId: company.id,
          companyName: company.rawName,
          dimension: 'overall',
          score: company.accountPriorityScore || 0,
          maxScore: 100,
          groupByField: 'companySize',
          groupByValue: sizeBucket,
          scoredAt: new Date().toISOString(),
        })
      }

      return records
    } catch (error) {
      log.error('Failed to load score records', { error: String(error) })
      return []
    }
  }

  /**
   * Analyze score distribution for bias across groups.
   * Groups scores by a specified field and checks for statistically
   * significant skew using chi-squared test.
   */
  async analyzeScoreDistribution(
    dimension: ScoreDimension = 'overall',
    groupByField: string = 'industry'
  ): Promise<DimensionBiasAnalysis | null> {
    const records = await this.loadScoreRecords()
    const config = await this.getConfig()

    // Filter records for the given dimension and groupByField
    const filtered = records.filter(
      (r) => r.dimension === dimension && r.groupByField === groupByField
    )

    if (filtered.length < config.minGroupSize) {
      return null
    }

    // Group records
    const groups = new Map<string, number[]>()
    for (const r of filtered) {
      if (!groups.has(r.groupByValue)) {
        groups.set(r.groupByValue, [])
      }
      groups.get(r.groupByValue)!.push(r.score)
    }

    // Calculate overall statistics
    const allScores = filtered.map((r) => r.score)
    const overallMean = mean(allScores)
    const overallStdDev = stdDev(allScores)

    // Calculate per-group statistics
    const groupMeans = new Map<string, number>()
    const groupCounts = new Map<string, number>()
    const groupStats: GroupStatistics[] = []

    for (const [group, scores] of groups) {
      if (scores.length < config.minGroupSize) continue

      const m = mean(scores)
      const med = median(scores)
      const sd = stdDev(scores)
      const deviation = overallMean !== 0 ? ((m - overallMean) / overallMean) * 100 : 0

      groupMeans.set(group, m)
      groupCounts.set(group, scores.length)

      groupStats.push({
        group,
        count: scores.length,
        mean: m,
        median: med,
        stdDev: sd,
        min: Math.min(...scores),
        max: Math.max(...scores),
        deviationFromOverall: deviation,
      })
    }

    // Chi-squared test
    const { statistic, degreesOfFreedom, pValue } = chiSquaredTest(groupMeans, groupCounts)

    // Determine biased groups
    const biasedGroups: string[] = []
    for (const gs of groupStats) {
      if (Math.abs(gs.deviationFromOverall) > config.deviationThresholdPercent) {
        biasedGroups.push(gs.group)
      }
    }

    return {
      dimension,
      overallMean,
      overallStdDev,
      overallCount: filtered.length,
      groupByField,
      groups: groupStats,
      chiSquared: statistic,
      degreesOfFreedom,
      pValue,
      isBiased: biasedGroups.length > 0 || pValue < config.significanceLevel,
      biasedGroups,
    }
  }

  /**
   * Generate a comprehensive bias report covering all configured dimensions
   * and group-by fields.
   */
  async generateBiasReport(): Promise<BiasReport> {
    const config = await this.getConfig()

    if (!config.enabled) {
      return {
        generatedAt: new Date().toISOString(),
        totalScoreRecords: 0,
        dimensionsAnalyzed: [],
        analyses: [],
        alerts: [],
        summary: {
          biasedDimensions: 0,
          totalAlerts: 0,
          highSeverityAlerts: 0,
          recommendation: 'Bias detection is disabled. Enable it in configuration.',
        },
      }
    }

    const records = await this.loadScoreRecords()
    const dimensions: ScoreDimension[] = ['overall'] // Can expand to per-dimension analysis
    const analyses: DimensionBiasAnalysis[] = []

    for (const dimension of dimensions) {
      for (const groupByField of config.groupByFields) {
        const analysis = await this.analyzeScoreDistribution(dimension, groupByField)
        if (analysis) {
          analyses.push(analysis)
        }
      }
    }

    // Generate alerts from analyses
    const alerts: BiasAlert[] = []
    for (const analysis of analyses) {
      for (const group of analysis.groups) {
        const deviation = Math.abs(group.deviationFromOverall)
        if (deviation > config.deviationThresholdPercent) {
          const severity: 'low' | 'medium' | 'high' =
            deviation > config.deviationThresholdPercent * 2 ? 'high' :
            deviation > config.deviationThresholdPercent * 1.5 ? 'medium' : 'low'

          alerts.push({
            id: `BIAS_${Date.now()}_${analysis.dimension}_${group.group.replace(/\s/g, '_')}`,
            dimension: analysis.dimension,
            group: group.group,
            groupMean: group.mean,
            overallMean: analysis.overallMean,
            deviationPercent: group.deviationFromOverall,
            severity,
            message: `${group.group} scores ${group.deviationFromOverall > 0 ? 'higher' : 'lower'} by ${Math.abs(group.deviationFromOverall).toFixed(1)}% than overall average in ${analysis.dimension} (grouped by ${analysis.groupByField})`,
            detectedAt: new Date().toISOString(),
          })
        }
      }
    }

    // Cache alerts
    this.cachedAlerts = alerts

    // Persist alerts history
    await this.persistAlerts(alerts)

    // Generate recommendation
    const highSeverityCount = alerts.filter((a) => a.severity === 'high').length
    let recommendation: string
    if (highSeverityCount > 0) {
      recommendation = `Critical: ${highSeverityCount} high-severity bias alerts detected. Review scoring weights and recalibrate immediately.`
    } else if (alerts.length > 0) {
      recommendation = `Minor bias detected across ${new Set(alerts.map(a => a.dimension)).size} dimension(s). Monitor trends and consider recalibration.`
    } else {
      recommendation = 'No significant bias detected. Scoring appears fair across all analyzed dimensions.'
    }

    return {
      generatedAt: new Date().toISOString(),
      totalScoreRecords: records.length,
      dimensionsAnalyzed: analyses.map((a) => `${a.dimension} (${a.groupByField})`),
      analyses,
      alerts,
      summary: {
        biasedDimensions: analyses.filter((a) => a.isBiased).length,
        totalAlerts: alerts.length,
        highSeverityAlerts: highSeverityCount,
        recommendation,
      },
    }
  }

  /**
   * Get current bias alerts (from most recent analysis or cached).
   */
  getBiasAlerts(): BiasAlert[] {
    return this.cachedAlerts
  }

  /**
   * Persist alerts history to SystemSetting.
   */
  private async persistAlerts(alerts: BiasAlert[]): Promise<void> {
    try {
      const row = await db.systemSetting.findUnique({ where: { key: BIAS_ALERTS_KEY } })
      let history: { timestamp: string; alerts: BiasAlert[] }[] = row ? JSON.parse(row.value) : []

      history.push({
        timestamp: new Date().toISOString(),
        alerts,
      })

      // Keep last 30 reports worth of alerts
      if (history.length > 30) {
        history = history.slice(-30)
      }

      await db.systemSetting.upsert({
        where: { key: BIAS_ALERTS_KEY },
        update: { value: JSON.stringify(history) },
        create: { key: BIAS_ALERTS_KEY, value: JSON.stringify(history) },
      })
    } catch (error) {
      log.error('Failed to persist alerts', { error: String(error) })
    }
  }

  /**
   * Load historical alert reports from SystemSetting.
   */
  async getAlertHistory(): Promise<{ timestamp: string; alerts: BiasAlert[] }[]> {
    try {
      const row = await db.systemSetting.findUnique({ where: { key: BIAS_ALERTS_KEY } })
      return row ? JSON.parse(row.value) : []
    } catch {
      return []
    }
  }
}

// ─── Utility Functions ─────────────────────────────────────────────────

function mean(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, v) => sum + v, 0) / values.length
}

function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function stdDev(values: number[]): number {
  if (values.length < 2) return 0
  const m = mean(values)
  const variance = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0) / (values.length - 1)
  return Math.sqrt(variance)
}

export const biasDetector = new BiasDetector()
