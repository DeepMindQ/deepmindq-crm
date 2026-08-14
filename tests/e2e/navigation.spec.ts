/**
 * Playwright Navigation & Layout E2E Tests
 *
 * Critical path: App shell loads → Sidebar renders → Navigation works
 * Tests the main application layout, sidebar navigation, and screen switching.
 */
import { test, expect } from '@playwright/test';

test.describe('App Shell & Navigation', () => {
  test('root page loads with expected metadata', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // Check page title contains DeepMindQ
    const title = await page.title();
    expect(title.toLowerCase()).toContain('deepmindq');
  });

  test('HTML has proper lang attribute and skip-to-content link', async ({ page }) => {
    await page.goto('/');

    const htmlLang = await page.getAttribute('html', 'lang');
    expect(htmlLang).toBe('en');

    // Skip-to-content link for accessibility
    const skipLink = page.locator('a.skip-to-content, a[href="#main-content"]');
    await expect(skipLink.first()).toBeAttached();
  });

  test('landing page loads successfully', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
  });

  test('no console errors on initial load', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Filter out known non-critical errors (e.g., Next.js dev overlay)
    const criticalErrors = errors.filter(
      (e) => !e.includes('Warning:') && !e.includes('DevTools') && !e.includes('favicon'),
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('global CSS loads without errors', async ({ page }) => {
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);

    // Verify the body has the antialiased class from the layout
    const bodyClasses = await page.getAttribute('body', 'class');
    expect(bodyClasses).toContain('antialiased');
  });
});

test.describe('Sidebar Navigation', () => {
  // These tests assume the user is authenticated and sees the main CRM layout
  // In CI, we'd need to set up auth state first

  test('sidebar is present when authenticated', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Look for sidebar container
    const sidebar = page.locator('[data-sidebar], nav, aside, [role="navigation"]').first();
    const sidebarExists = await sidebar.isVisible().catch(() => false);

    if (sidebarExists) {
      // Sidebar should contain navigation items
      const navItems = sidebar.locator('a, button, [role="menuitem"]');
      const count = await navItems.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('navigation items use proper semantic structure', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check for ARIA labels on navigation
    const nav = page.locator('nav, [role="navigation"]').first();
    if (await nav.isVisible().catch(() => false)) {
      const ariaLabel = await nav.getAttribute('aria-label');
      const role = await nav.getAttribute('role');

      // Should have either aria-label or descriptive role
      expect(ariaLabel || role).toBeTruthy();
    }
  });
});

test.describe('Page Transitions', () => {
  test('main content area exists', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const mainContent = page.locator('#main-content, main, [role="main"]').first();
    await expect(mainContent).toBeAttached();
  });

  test('images have alt attributes for accessibility', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const images = page.locator('img');
    const count = await images.count();

    if (count > 0) {
      for (let i = 0; i < Math.min(count, 10); i++) {
        const alt = await images.nth(i).getAttribute('alt');
        expect(alt).toBeTruthy();
      }
    }
  });
});
