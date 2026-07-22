import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock fns are available inside the hoisted vi.mock factory
const {
  mockConnectorRunCreate,
  mockConnectorRunUpdate,
  mockConnectorUpdate,
  mockConnectorRunFindUnique,
  mockConnectorRunFindMany,
} = vi.hoisted(() => ({
  mockConnectorRunCreate: vi.fn(),
  mockConnectorRunUpdate: vi.fn(),
  mockConnectorUpdate: vi.fn(),
  mockConnectorRunFindUnique: vi.fn(),
  mockConnectorRunFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    connectorRun: {
      create: mockConnectorRunCreate,
      update: mockConnectorRunUpdate,
      findUnique: mockConnectorRunFindUnique,
      findMany: mockConnectorRunFindMany,
    },
    connector: {
      update: mockConnectorUpdate,
    },
  },
}))

import {
  enqueueJob,
  getJobStatus,
  getConnectorRuns,
  getPendingCount,
  isQueueProcessing,
  registerJobProcessor,
} from '../job-queue'

/** Helper: wait for the async processQueue to finish processing. */
async function drainQueue(): Promise<void> {
  // The queue runs asynchronously after enqueueJob.
  // Since all mocks resolve synchronously, a few microtask ticks are enough.
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 1))
    if (!isQueueProcessing() && getPendingCount() === 0) return
  }
  // Extra safety: wait one more tick
  await new Promise((r) => setTimeout(r, 5))
}

describe('Job Queue', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    // Register a no-op processor by default so processQueue doesn't skip work
    registerJobProcessor(async () => {})
    // Ensure queue state is clean
    await drainQueue()
  })

  // ─── enqueueJob ────────────────────────────────────────────

  describe('enqueueJob', () => {
    it('creates a ConnectorRun record with pending status', async () => {
      mockConnectorRunCreate.mockResolvedValue({
        id: 'run-1',
        connectorId: 'conn-1',
        status: 'pending',
      })

      const runId = await enqueueJob({
        connectorId: 'conn-1',
        action: 'acquire',
        config: { fileContent: 'data' },
      })

      expect(runId).toBe('run-1')
      expect(mockConnectorRunCreate).toHaveBeenCalledWith({
        data: {
          connectorId: 'conn-1',
          status: 'pending',
        },
      })
    })

    it('returns the run ID from the database', async () => {
      mockConnectorRunCreate.mockResolvedValue({
        id: 'run-abc-123',
        connectorId: 'conn-2',
        status: 'pending',
      })

      const runId = await enqueueJob({
        connectorId: 'conn-2',
        action: 'sync',
        config: {},
      })

      expect(runId).toBe('run-abc-123')
    })

    it('triggers queue processing after enqueuing', async () => {
      mockConnectorRunCreate.mockResolvedValue({
        id: 'run-trigger',
        connectorId: 'conn-1',
        status: 'pending',
      })

      // Before enqueue, queue should be idle
      expect(isQueueProcessing()).toBe(false)

      await enqueueJob({
        connectorId: 'conn-1',
        action: 'acquire',
        config: {},
      })

      // After enqueue, processing should start (may already be done since processor is fast)
      // Let it drain then check
      await drainQueue()
      expect(isQueueProcessing()).toBe(false)
    })
  })

  // ─── Job processing (success path) ─────────────────────────

  describe('job processing — success', () => {
    it('updates run status to running then completed', async () => {
      mockConnectorRunCreate.mockResolvedValue({
        id: 'run-success',
        connectorId: 'conn-1',
        status: 'pending',
      })
      // Mock the updates to return immediately
      mockConnectorRunUpdate.mockResolvedValue({})

      // Register a processor that tracks calls
      const processor = vi.fn().mockResolvedValue(undefined)
      registerJobProcessor(processor)

      await enqueueJob({
        connectorId: 'conn-1',
        action: 'acquire',
        config: { fileContent: 'test' },
      })
      await drainQueue()

      // Should have been called with the queued job
      expect(processor).toHaveBeenCalledTimes(1)
      expect(processor).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'run-success',
          connectorId: 'conn-1',
          payload: expect.objectContaining({ action: 'acquire' }),
        }),
      )

      // Check the update calls: first running, then completed
      const updateCalls = mockConnectorRunUpdate.mock.calls
      expect(updateCalls.length).toBeGreaterThanOrEqual(2)

      // First update should be status: running
      expect(updateCalls[0][0]).toEqual({
        where: { id: 'run-success' },
        data: expect.objectContaining({ status: 'running' }),
      })

      // Second update should be status: completed
      const completedCall = updateCalls.find(
        (call) => call[0].data.status === 'completed',
      )
      expect(completedCall).toBeDefined()
    })

    it('updates connector health on success (lastRunAt, lastSuccessAt, totalRuns, reset failureCount)', async () => {
      mockConnectorRunCreate.mockResolvedValue({
        id: 'run-health',
        connectorId: 'conn-health',
        status: 'pending',
      })
      mockConnectorRunUpdate.mockResolvedValue({})
      mockConnectorUpdate.mockResolvedValue({})

      registerJobProcessor(async () => {})

      await enqueueJob({
        connectorId: 'conn-health',
        action: 'test',
        config: {},
      })
      await drainQueue()

      expect(mockConnectorUpdate).toHaveBeenCalledWith({
        where: { id: 'conn-health' },
        data: expect.objectContaining({
          lastRunAt: expect.any(Date),
          lastSuccessAt: expect.any(Date),
          totalRuns: { increment: 1 },
          failureCount: 0,
        }),
      })
    })
  })

  // ─── Job processing (failure path) ─────────────────────────

  describe('job processing — failure', () => {
    it('updates run status to failed when processor throws', async () => {
      mockConnectorRunCreate.mockResolvedValue({
        id: 'run-fail',
        connectorId: 'conn-1',
        status: 'pending',
      })
      mockConnectorRunUpdate.mockResolvedValue({})

      // Register a failing processor
      registerJobProcessor(async () => {
        throw new Error('Connection timeout')
      })

      await enqueueJob({
        connectorId: 'conn-1',
        action: 'acquire',
        config: {},
      })
      await drainQueue()

      // Should have a 'failed' status update
      const failedCall = mockConnectorRunUpdate.mock.calls.find(
        (call) => call[0].data.status === 'failed',
      )
      expect(failedCall).toBeDefined()
      expect(failedCall![0].data.errorMessage).toBe('Connection timeout')
      expect(failedCall![0].data.errorsCount).toEqual({ increment: 1 })
    })

    it('increments connector failureCount on job failure', async () => {
      mockConnectorRunCreate.mockResolvedValue({
        id: 'run-fail2',
        connectorId: 'conn-fail',
        status: 'pending',
      })
      mockConnectorRunUpdate.mockResolvedValue({})
      mockConnectorUpdate.mockResolvedValue({})

      registerJobProcessor(async () => {
        throw new Error('DB down')
      })

      await enqueueJob({
        connectorId: 'conn-fail',
        action: 'acquire',
        config: {},
      })
      await drainQueue()

      expect(mockConnectorUpdate).toHaveBeenCalledWith({
        where: { id: 'conn-fail' },
        data: expect.objectContaining({
          lastRunAt: expect.any(Date),
          totalRuns: { increment: 1 },
          failureCount: { increment: 1 },
          errorMessage: 'DB down',
        }),
      })
    })

    it('handles non-Error throws', async () => {
      mockConnectorRunCreate.mockResolvedValue({
        id: 'run-fail3',
        connectorId: 'conn-1',
        status: 'pending',
      })
      mockConnectorRunUpdate.mockResolvedValue({})

      registerJobProcessor(async () => {
        throw 'string error'
      })

      await enqueueJob({
        connectorId: 'conn-1',
        action: 'acquire',
        config: {},
      })
      await drainQueue()

      const failedCall = mockConnectorRunUpdate.mock.calls.find(
        (call) => call[0].data.status === 'failed',
      )
      expect(failedCall).toBeDefined()
      expect(failedCall![0].data.errorMessage).toBe('Unknown error')
    })
  })

  // ─── Query functions ───────────────────────────────────────

  describe('getJobStatus', () => {
    it('queries connectorRun by id', async () => {
      mockConnectorRunFindUnique.mockResolvedValue({
        id: 'run-q',
        status: 'completed',
      })

      const status = await getJobStatus('run-q')

      expect(mockConnectorRunFindUnique).toHaveBeenCalledWith({
        where: { id: 'run-q' },
      })
      expect(status).toBeDefined()
      expect(status!.status).toBe('completed')
    })
  })

  describe('getConnectorRuns', () => {
    it('queries runs for a connector with default limit', async () => {
      mockConnectorRunFindMany.mockResolvedValue([])

      await getConnectorRuns('conn-1')

      expect(mockConnectorRunFindMany).toHaveBeenCalledWith({
        where: { connectorId: 'conn-1' },
        orderBy: { createdAt: 'desc' },
        take: 20,
      })
    })

    it('uses custom limit when provided', async () => {
      mockConnectorRunFindMany.mockResolvedValue([])

      await getConnectorRuns('conn-1', 5)

      expect(mockConnectorRunFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      )
    })
  })

  // ─── In-memory state helpers ───────────────────────────────

  describe('getPendingCount', () => {
    it('returns 0 when queue is empty', () => {
      expect(getPendingCount()).toBe(0)
    })
  })

  describe('isQueueProcessing', () => {
    it('returns false when queue is idle', () => {
      expect(isQueueProcessing()).toBe(false)
    })
  })
})