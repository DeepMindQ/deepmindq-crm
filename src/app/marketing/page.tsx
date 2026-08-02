import type { Metadata } from 'next';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * Static Marketing Landing Page
 *
 * Rendered at /marketing as a proper Next.js static page with full SSR.
 * Content is sourced from public/landing-page.html (no redesign).
 *
 * This serves as the SEO-optimized, crawler-friendly version of the
 * DeepMindQ marketing site. Build-time static generation → zero
 * serverless function invocations.
 *
 * The root / route also shows this content (via iframe wrapper) for
 * unauthenticated visitors, but this page provides proper SSR metadata.
 */
export const metadata: Metadata = {
  metadataBase: new URL('https://deepmindq.com'),
  title: 'DeepMindQ — Enterprise Intelligence Platform',
  description:
    'AI-powered Enterprise Intelligence Platform. Understand before you sell — dedicated deployment, customer-owned infrastructure, complete data isolation.',
  keywords: [
    'enterprise intelligence platform',
    'AI reasoning',
    'dedicated deployment',
    'revenue intelligence',
    'account intelligence',
    'customer-owned infrastructure',
    'signal detection',
    'buying committee intelligence',
  ],
  icons: {
    icon: '/favicon.ico',
    apple: '/apple-touch-icon.png',
  },
  openGraph: {
    title: 'DeepMindQ — Enterprise Intelligence Platform',
    description:
      'AI-powered Enterprise Intelligence Platform. Dedicated deployment. Customer-owned infrastructure.',
    type: 'website',
    siteName: 'DeepMindQ',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DeepMindQ — Enterprise Intelligence Platform',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DeepMindQ — Enterprise Intelligence Platform',
    description:
      'AI-powered Enterprise Intelligence Platform for enterprise teams.',
    images: ['/og-image.png'],
  },
  robots: { index: true, follow: true },
  alternates: {
    canonical: 'https://deepmindq.com',
  },
};

async function getLandingPageHtml(): Promise<{
  styles: string;
  body: string;
  scripts: string;
  fonts: string;
}> {
  const filePath = path.join(process.cwd(), 'public', 'landing-page.html');
  const raw = await fs.readFile(filePath, 'utf-8');

  // Extract all <style> blocks from <head>
  const styleMatches = raw.match(/<style>([\s\S]*?)<\/style>/gi);
  const styles = styleMatches ? styleMatches.join('\n') : '';

  // Extract body content
  const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyRaw = bodyMatch ? bodyMatch[1].trim() : '';

  // Extract and separate <script> blocks
  const scriptMatches = bodyRaw.match(/<script>([\s\S]*?)<\/script>/gi);
  const scripts = scriptMatches ? scriptMatches.join('\n') : '';
  const body = bodyRaw.replace(/<script[\s\S]*?<\/script>/gi, '').trim();

  // Extract Google Fonts <link> tags
  const fontMatches: string[] = [];
  const fontRegex =
    /<link[^>]*href=["']https:\/\/fonts\.googleapis\.com[^"']*["'][^>]*>/gi;
  let fontMatch;
  while ((fontMatch = fontRegex.exec(raw)) !== null) {
    fontMatches.push(fontMatch[0]);
  }
  const fonts = fontMatches.join('\n');

  return { styles, body, scripts, fonts };
}

export default async function MarketingStaticPage() {
  const { styles, body, scripts, fonts } = await getLandingPageHtml();

  return (
    <>
      {/* External fonts — preconnected for performance */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <div dangerouslySetInnerHTML={{ __html: fonts }} />

      {/* All landing page CSS */}
      <style dangerouslySetInnerHTML={{ __html: styles }} />

      {/* Landing page body content — rendered directly in DOM (no iframe) */}
      <div dangerouslySetInnerHTML={{ __html: body }} />

      {/* Landing page scripts — counters, tilt effects, animations */}
      <script dangerouslySetInnerHTML={{ __html: scripts }} />
    </>
  );
}
