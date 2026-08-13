// Stub for deployment config

export function getDeploymentConfig() {
  return {
    deploySlot: 'primary',
    version: process.env.npm_package_version || '0.0.0',
    region: process.env.VERCEL_REGION || 'local',
    environment: process.env.NODE_ENV || 'development',
    buildSha: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    isCanary: false,
    canaryWeight: 0,
  };
}
