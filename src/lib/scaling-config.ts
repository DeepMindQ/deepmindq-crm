/**
 * DeepMindQ — Horizontal Scaling Configuration
 * 
 * Configuration and utilities for multi-instance deployment.
 */

export const SCALING_CONFIG = {
  // ── Instance Configuration ──
  instance: {
    id: process.env.INSTANCE_ID || `instance-${Date.now()}`,
    region: process.env.INSTANCE_REGION || 'us-east-1',
    maxRequestsPerSecond: parseInt(process.env.MAX_RPS || '100'),
    healthCheckIntervalMs: 15000,
    healthCheckTimeoutMs: 5000,
    drainTimeoutMs: 30000,  // Graceful shutdown drain timeout
  },

  // ── Database Configuration ──
  database: {
    poolSize: parseInt(process.env.DATABASE_POOL_SIZE || '10'),
    poolTimeoutMs: parseInt(process.env.DATABASE_POOL_TIMEOUT || '30000'),
    statementCacheSize: parseInt(process.env.PG_STATEMENT_CACHE || '100'),
    readonlyReplicaUrl: process.env.DATABASE_READ_REPLICA_URL || null,
    // Use read replica for GET requests
    useReadReplica: !!process.env.DATABASE_READ_REPLICA_URL,
  },

  // ── Cache Configuration (for Redis migration) ──
  cache: {
    redisUrl: process.env.REDIS_URL || null,
    cachePrefix: 'dmq:',
    defaultTtlMs: 300000,
    keyHashing: true,  // Hash keys for consistent sharding
  },

  // ── Queue Configuration (for background jobs) ──
  queue: {
    broker: (process.env.QUEUE_BROKER || 'memory') as 'memory' | 'redis' | 'sqs',
    redisUrl: process.env.QUEUE_REDIS_URL || process.env.REDIS_URL || null,
    sqsUrl: process.env.SQS_URL || null,
    maxConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5'),
    retryAttempts: 3,
    retryBackoffMs: 1000,
  },

  // ── Rate Limiting ──
  rateLimit: {
    windowMs: 60000,  // 1 minute
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX || '100'),
    enabled: true,
  },

  // ── Session Configuration (for multi-instance sessions) ──
  session: {
    store: (process.env.SESSION_STORE || 'database') as 'database' | 'redis' | 'cookie',
    cookieName: 'dmq_session',
    maxAge: 86400 * 7,  // 7 days
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
  },
}

// ── Health Check Handler ──
export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  instance: typeof SCALING_CONFIG.instance
  checks: {
    database: { ok: boolean; latencyMs: number }
    cache: { ok: boolean; type: string }
    memory: { usedMB: number; maxMB: number; percent: number }
    uptime: number
  }
  timestamp: string
}

export async function performHealthCheck(): Promise<HealthStatus> {
  const startTime = Date.now()
  let dbOk = false
  let dbLatency = 0
  
  try {
    const { PrismaClient } = await import('@prisma/client')
    const db = new PrismaClient()
    const dbStart = Date.now()
    await db.$queryRaw`SELECT 1`
    dbLatency = Date.now() - dbStart
    dbOk = true
  } catch {
    dbOk = false
  }
  
  const mem = process.memoryUsage()
  
  return {
    status: dbOk ? 'healthy' : 'unhealthy',
    instance: SCALING_CONFIG.instance,
    checks: {
      database: { ok: dbOk, latencyMs: dbLatency },
      cache: { ok: true, type: SCALING_CONFIG.cache.redisUrl ? 'redis' : 'memory' },
      memory: {
        usedMB: Math.round(mem.heapUsed / 1024 / 1024),
        maxMB: Math.round(mem.heapTotal / 1024 / 1024),
        percent: Math.round((mem.heapUsed / mem.heapTotal) * 100),
      },
      uptime: process.uptime(),
    },
    timestamp: new Date().toISOString(),
  }
}

// ── Graceful Shutdown Handler ──
export function setupGracefulShutdown(server: { close: (cb?: () => void) => void }) {
  let draining = false
  
  const shutdown = async (signal: string) => {
    if (draining) return
    draining = true
    console.log(`[Shutdown] Received ${signal}. Draining connections...`)
    
    // Stop accepting new connections
    server.close(() => {
      console.log('[Shutdown] Server closed. Exiting.')
      process.exit(0)
    })
    
    // Force exit after drain timeout
    setTimeout(() => {
      console.error('[Shutdown] Forced exit after drain timeout')
      process.exit(1)
    }, SCALING_CONFIG.instance.drainTimeoutMs)
  }
  
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}