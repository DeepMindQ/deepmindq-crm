/**
 * Tests for Redis Pub/Sub (Phase F)
 * Tests that:
 * - publishSSEEvent emits to local eventBus
 * - publishSSEEvent publishes to Redis when available
 * - Falls back gracefully when Redis is unavailable
 * - subscribeToSSEChannel works
 * - initPubSub / shutdownPubSub lifecycle
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock event-bus
const emittedEvents: Array<{ type: string; data: unknown }> = []
vi.mock('@/lib/event-bus', () => ({
  eventBus: {
    emit: vi.fn((type: string, data: unknown) => {
      emittedEvents.push({ type, data })
    }),
    on: vi.fn((event: string, handler: Function) => {
      // Store handler for later testing
      return () => {}
    }),
    onAny: vi.fn(),
  },
}))

// Mock redis-client
const mockRedisClient = {
  publish: vi.fn().mockResolvedValue(1),
  eval: vi.fn().mockResolvedValue(1),
  on: vi.fn(),
  ping: vi.fn().mockResolvedValue('PONG'),
}

vi.mock('@/lib/redis-client', () => ({
  getRedisClient: vi.fn(),
  getClientType: vi.fn().mockReturnValue('none'),
}))

const { publishSSEEvent, subscribeToSSEChannel, isPubSubActive, initPubSub, shutdownPubSub } = await import('@/lib/redis-pubsub')
const { getRedisClient, getClientType } = await import('@/lib/redis-client')

describe('redis-pubsub', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emittedEvents.length = 0
  })

  describe('publishSSEEvent', () => {
    it('should always emit to local eventBus', async () => {
      // Redis not available
      vi.mocked(getRedisClient).mockResolvedValue(null)

      await publishSSEEvent('notification', { message: 'hello' })

      expect(emittedEvents).toHaveLength(1)
      expect(emittedEvents[0]).toEqual({
        type: 'notification',
        data: { message: 'hello' },
      })
    })

    it('should publish to Redis when client is available (ioredis)', async () => {
      vi.mocked(getRedisClient).mockResolvedValue(mockRedisClient)
      vi.mocked(getClientType).mockReturnValue('ioredis')

      await publishSSEEvent('company_update', { id: '123' })

      // Should have called Redis PUBLISH
      expect(mockRedisClient.publish).toHaveBeenCalledWith(
        'dmq:sse:events',
        JSON.stringify({ type: 'company_update', data: { id: '123' } }),
      )

      // AND emitted locally
      expect(emittedEvents).toHaveLength(1)
    })

    it('should publish to Redis queue when using Upstash', async () => {
      vi.mocked(getRedisClient).mockResolvedValue(mockRedisClient)
      vi.mocked(getClientType).mockReturnValue('upstash')

      await publishSSEEvent('notification', { alert: true })

      // Should have called Redis EVAL (LPUSH + LTRIM)
      expect(mockRedisClient.eval).toHaveBeenCalled()
      expect(emittedEvents).toHaveLength(1)
    })

    it('should not fail when Redis publish throws', async () => {
      vi.mocked(getRedisClient).mockResolvedValue(mockRedisClient)
      vi.mocked(getClientType).mockReturnValue('ioredis')
      vi.mocked(mockRedisClient.publish).mockRejectedValue(new Error('Redis down'))

      // Should not throw
      await publishSSEEvent('notification', { test: true })

      // Should still have emitted locally
      expect(emittedEvents).toHaveLength(1)
    })
  })

  describe('subscribeToSSEChannel', () => {
    it('should register a callback and return unsubscribe function', () => {
      const callback = vi.fn()
      const unsub = subscribeToSSEChannel(callback)

      // Verify the callback was registered (by checking internal state indirectly)
      expect(typeof unsub).toBe('function')

      // Unsubscribe should work
      unsub()
    })
  })

  describe('initPubSub / shutdownPubSub', () => {
    it('should handle init when Redis is unavailable', async () => {
      vi.mocked(getRedisClient).mockResolvedValue(null)

      await initPubSub()
      // Should not throw, pubSub stays inactive
      expect(isPubSubActive()).toBe(false)
    })

    it('should handle shutdown gracefully even if not initialized', async () => {
      await shutdownPubSub()
      expect(isPubSubActive()).toBe(false)
    })
  })
})
