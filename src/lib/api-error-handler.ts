/**
 * WI-18.3 Global API Error Handler
 *
 * Wraps API route handlers with consistent error handling.
 * Usage in route.ts:
 *   import { withErrorHandler } from '@/lib/api-error-handler';
 *   export const GET = withErrorHandler(async (req) => { ... });
 */

import { apiErrorCode } from './apiHelpers';
import { logger } from './logger';

export type ApiHandler = (
  request: Request,
  context?: { params: Record<string, string> },
) => Promise<Response>;

export function withErrorHandler(handler: ApiHandler): ApiHandler {
  return async (request, context) => {
    try {
      return await handler(request, context);
    } catch (error) {
      // Handle specific error types
      if (error instanceof SyntaxError) {
        return apiErrorCode('INVALID_JSON', 'Malformed JSON in request body', 400);
      }

      if (error instanceof TypeError && error.message.includes('invalid')) {
        return apiErrorCode('INVALID_PARAMS', 'Invalid parameters provided', 400);
      }

      // Prisma not found
      const msg = error instanceof Error ? error.message : String(error);
      if (
        msg.includes('P2025') ||
        msg.includes('Record to update not found') ||
        msg.includes('Record to delete not found')
      ) {
        return apiErrorCode('NOT_FOUND', 'Requested resource not found', 404);
      }

      // Prisma unique constraint
      if (msg.includes('P2002') || msg.includes('Unique constraint')) {
        return apiErrorCode('DUPLICATE', 'Resource already exists', 409);
      }

      // Prisma connection errors
      if (
        msg.includes('P1001') ||
        msg.includes("Can't reach database") ||
        msg.includes('Connection')
      ) {
        logger.error('[API Error Handler] Database connection error', { error: msg });
        return apiErrorCode('DB_UNAVAILABLE', 'Database temporarily unavailable', 503);
      }

      // Unexpected errors
      logger.error('[API Error Handler] Unhandled error', {
        error: msg,
        stack: error instanceof Error ? error.stack : undefined,
      });
      return apiErrorCode('INTERNAL_ERROR', 'An unexpected error occurred', 500);
    }
  };
}
