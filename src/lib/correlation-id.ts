import { randomUUID } from 'crypto'

const CORRELATION_HEADER = 'x-correlation-id'

export function getCorrelationId(req: Request): string {
  return req.headers.get(CORRELATION_HEADER) || randomUUID()
}

export function createResponseHeaders(correlationId: string): Record<string, string> {
  return {
    'x-correlation-id': correlationId,
  }
}

export { CORRELATION_HEADER }