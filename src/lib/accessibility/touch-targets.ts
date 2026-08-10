/* ═══════════════════════════════════════════════════════════════
   Touch Target Utilities — Phase 3 Task 3.8
   WCAG 2.5.8: Minimum 44x44px touch targets
   ═══════════════════════════════════════════════════════════════ */

export const TOUCH_TARGET = {
  button: 'min-h-[44px] min-w-[44px]',
  iconButton: 'min-h-[44px] min-w-[44px] inline-flex items-center justify-center',
  inlineButton: 'py-2.5 px-3 min-h-[44px] inline-flex items-center',
  navItem: 'min-h-[44px] px-3 flex items-center',
  tabItem: 'min-h-[44px] px-4 flex items-center',
  listItem: 'min-h-[44px] px-3 flex items-center',
  toggle: 'min-h-[44px] min-w-[44px] flex items-center justify-center',
  input: 'min-h-[44px]',
  select: 'min-h-[44px]',
  badge: 'min-h-[32px] px-3 py-1.5 cursor-pointer select-none',
  rowAction: 'min-h-[44px] min-w-[44px] p-0 flex items-center justify-center',
} as const;

export const TOUCH_TARGET_CSS = `
  button, a, [role="button"], [role="tab"], [role="link"],
  input[type="checkbox"], input[type="radio"],
  select, [role="switch"] {
    min-height: 44px;
    min-width: 44px;
  }
  .touch-target-compact button,
  .touch-target-compact a {
    min-height: 32px;
    min-width: 32px;
  }
`;

export function meetsTouchTarget(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect();
  return rect.width >= 44 && rect.height >= 44;
}
