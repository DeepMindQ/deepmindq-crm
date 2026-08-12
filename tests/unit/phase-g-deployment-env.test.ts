/**
 * Tests for deployment config + env-config (Phase G)
 * Tests that:
 * - env-config provides validated access to environment variables
 * - deployment.ts correctly reads from env-config
 * - Defaults are sensible
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('env-config', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  it('should return development as default nodeEnv', async () => {
    delete process.env.NODE_ENV
    const { env } = await import('@/lib/env-config')
    expect(env.nodeEnv).toBe('development')
  })

  it('should return production when NODE_ENV=production', async () => {
    process.env.NODE_ENV = 'production'
    const { env } = await import('@/lib/env-config')
    expect(env.isProduction).toBe(true)
    expect(env.isDevelopment).toBe(false)
  })

  it('should return default port 3000', async () => {
    delete process.env.PORT
    const { env } = await import('@/lib/env-config')
    expect(env.port).toBe(3000)
  })

  it('should parse custom port', async () => {
    process.env.PORT = '8080'
    const { env } = await import('@/lib/env-config')
    expect(env.port).toBe(8080)
  })

  it('should return undefined for optional keys when not set', async () => {
    delete process.env.REDIS_URL
    delete process.env.SENTRY_DSN
    const { env } = await import('@/lib/env-config')
    expect(env.redisUrl).toBeUndefined()
    expect(env.sentryDsn).toBeUndefined()
  })

  it('should return deploy config defaults', async () => {
    delete process.env.DEPLOY_SLOT
    delete process.env.DEPLOY_ENVIRONMENT
    delete process.env.DEPLOY_REGION
    const { env } = await import('@/lib/env-config')
    expect(env.deploySlot).toBe('none')
    expect(env.deployRegion).toBe('us-east-1')
    expect(env.isCanary).toBe(false)
    expect(env.canaryWeight).toBe(0)
  })

  it('should read deploy slot from env', async () => {
    process.env.DEPLOY_SLOT = 'blue'
    process.env.DEPLOY_ENVIRONMENT = 'staging'
    const { env } = await import('@/lib/env-config')
    expect(env.deploySlot).toBe('blue')
    expect(env.deployEnvironment).toBe('staging')
  })
})

describe('deployment config', () => {
  beforeEach(() => {
    process.env.DEPLOY_SLOT = 'green'
    process.env.DEPLOY_ENVIRONMENT = 'production'
    process.env.DEPLOY_REGION = 'eu-west-1'
    process.env.NEXT_PUBLIC_BUILD_SHA = 'abc123'
    process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0'
    process.env.CANARY = 'true'
    process.env.CANARY_WEIGHT = '25'
  })

  it('should return correct deployment config', async () => {
    const { getDeploymentConfig } = await import('@/lib/deployment')
    const config = getDeploymentConfig()

    expect(config.deploySlot).toBe('green')
    expect(config.environment).toBe('production')
    expect(config.region).toBe('eu-west-1')
    expect(config.buildSha).toBe('abc123')
    expect(config.version).toBe('1.0.0')
    expect(config.isCanary).toBe(true)
    expect(config.canaryWeight).toBe(25)
  })

  it('should return serializable deployment info', async () => {
    const { getDeploymentInfo } = await import('@/lib/deployment')
    const info = getDeploymentInfo()

    expect(info).toEqual({
      slot: 'green',
      version: '1.0.0',
      region: 'eu-west-1',
      environment: 'production',
      buildSha: 'abc123',
    })
  })
})
