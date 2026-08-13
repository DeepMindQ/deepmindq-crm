// Stub for API logging middleware

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withApiLogging<T extends (...args: any[]) => any>(handler: T, _route?: string): T {
  return handler;
}
