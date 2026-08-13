// @ts-nocheck — CSRF stub: passes handler through until implementation is restored
export function withCsrf<T extends (...args: any[]) => any>(handler: T): T {
  return handler;
}
