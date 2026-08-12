/**
 * Deployment environment configuration.
 * No hardcoded environment references.
 * All environment-specific values read from env-config with sensible defaults.
 */

import { env } from '@/lib/env-config';

export interface DeploymentConfig {
  environment: 'development' | 'staging' | 'production';
  deploySlot: 'blue' | 'green' | 'none';
  region: string;
  buildSha: string;
  buildTimestamp: string;
  version: string;
  isCanary: boolean;
  canaryWeight: number;
}

/**
 * Returns the current deployment configuration by reading from env-config.
 * Safe to call at any point in the application lifecycle — no side effects.
 */
export function getDeploymentConfig(): DeploymentConfig {
  return {
    environment: env.deployEnvironment as DeploymentConfig['environment'],
    deploySlot: env.deploySlot as DeploymentConfig['deploySlot'],
    region: env.deployRegion,
    buildSha: env.buildSha,
    buildTimestamp: env.buildTimestamp || new Date().toISOString(),
    version: env.appVersion,
    isCanary: env.isCanary,
    canaryWeight: env.canaryWeight,
  };
}

/**
 * Returns a serializable subset of deployment config suitable for
 * inclusion in health-check responses and log context.
 */
export function getDeploymentInfo(): {
  slot: string;
  version: string;
  region: string;
  environment: string;
  buildSha: string;
} {
  const cfg = getDeploymentConfig();
  return {
    slot: cfg.deploySlot,
    version: cfg.version,
    region: cfg.region,
    environment: cfg.environment,
    buildSha: cfg.buildSha,
  };
}
