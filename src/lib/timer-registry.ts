/**
 * Central registry for module-scoped setInterval timers.
 * Allows graceful shutdown to clear all timers.
 */
const timers: ReturnType<typeof setInterval>[] = [];

export function registerTimer(timer: ReturnType<typeof setInterval>): void {
  timers.push(timer);
}

export function clearAllTimers(): void {
  for (const timer of timers) {
    clearInterval(timer);
  }
  timers.length = 0;
}

export function getTimerCount(): number {
  return timers.length;
}
