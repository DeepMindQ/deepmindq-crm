// Stub for apiHelpers — provides types/functions consumed by api-error-handler and api-middleware

export interface ApiErrorResponse {
  success: false;
  error: string;
  details?: unknown;
  status?: number;
  timestamp?: string;
}

export function createApiError(message: string, status?: number): ApiErrorResponse {
  return {
    success: false,
    error: message,
    status: status ?? 500,
    timestamp: new Date().toISOString(),
  };
}

export function isApiError(value: unknown): value is ApiErrorResponse {
  return (
    typeof value === 'object' && value !== null && (value as ApiErrorResponse).success === false
  );
}

// Callable form used by api-error-handler.ts — returns Response directly
export function apiErrorCode(
  code: string,
  message: string,
  status: number,
  correlationId?: string,
): Response {
  return new Response(
    JSON.stringify({
      success: false,
      error: message,
      code,
      timestamp: new Date().toISOString(),
      ...(correlationId ? { correlationId } : {}),
    }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

// Callable form used by api-middleware.ts — returns Response directly
export function apiError(message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, error: message, timestamp: new Date().toISOString() }),
    { status, headers: { 'Content-Type': 'application/json' } },
  );
}

// Standard success envelope for consistent API responses
export function apiSuccess<T>(data: T, meta?: Record<string, unknown>): Response {
  return new Response(
    JSON.stringify({
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...(meta ? { meta } : {}),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
}
