// Auto-generated stub for timer-registry
const timers: Set<ReturnType<typeof setInterval>> = new Set();
export function registerTimer(t: ReturnType<typeof setInterval>) {
  timers.add(t);
}
export function clearAllTimers() {
  timers.forEach((t) => clearInterval(t));
  timers.clear();
}
