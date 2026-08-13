// Stub for persistence failure queue

export function getPersistenceFailureQueue() {
  return {
    getQueueDepth: async () => 0,
    getDeadLetterCount: async () => 0,
    getStats() {
      return {
        totalEnqueued: 0,
        totalRetried: 0,
        totalRecovered: 0,
        totalDeadLettered: 0,
        lastProcessAt: null as number | null,
      };
    },
  };
}