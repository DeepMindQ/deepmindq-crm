import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  typescript: {
    // TODO: 368 pre-existing TS errors across 40+ files. Fix incrementally.
    // DO NOT add new errors — fix them in the same PR that introduces them.
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  output: 'standalone',
  serverExternalPackages: ['nodemailer'],

  // API route rewrites: clean URLs → g-* group routes
  // This replaces the middleware approach which crashes on Vercel Edge.
  async rewrites() {
    return [
      // Auth
      { source: '/api/auth/:path*', destination: '/api/g-auth/auth/:path*' },

      // CRM
      { source: '/api/companies/:path*', destination: '/api/g-crm/companies/:path*' },
      { source: '/api/contacts/:path*', destination: '/api/g-crm/contacts/:path*' },
      { source: '/api/leads/:path*', destination: '/api/g-crm/leads/:path*' },
      { source: '/api/segments/:path*', destination: '/api/g-crm/segments/:path*' },
      { source: '/api/signals/:path*', destination: '/api/g-crm/signals/:path*' },
      { source: '/api/batches/:path*', destination: '/api/g-crm/batches/:path*' },
      { source: '/api/pipeline/:path*', destination: '/api/g-crm/pipeline/:path*' },
      { source: '/api/duplicates/:path*', destination: '/api/g-crm/duplicates/:path*' },
      { source: '/api/suppressions/:path*', destination: '/api/g-crm/suppressions/:path*' },
      { source: '/api/bounces/:path*', destination: '/api/g-crm/bounces/:path*' },

      // AI
      { source: '/api/ai/:path*', destination: '/api/g-ai/ai/:path*' },
      { source: '/api/research-agent/:path*', destination: '/api/g-ai/research-agent/:path*' },
      { source: '/api/command-center/:path*', destination: '/api/g-ai/command-center/:path*' },
      { source: '/api/knowledge/:path*', destination: '/api/g-ai/knowledge/:path*' },
      { source: '/api/capabilities/:path*', destination: '/api/g-ai/capabilities/:path*' },
      { source: '/api/conversation-plans/:path*', destination: '/api/g-ai/conversation-plans/:path*' },

      // Data
      { source: '/api/dashboard/:path*', destination: '/api/g-data/dashboard/:path*' },
      { source: '/api/analytics/:path*', destination: '/api/g-data/analytics/:path*' },
      { source: '/api/audit/:path*', destination: '/api/g-data/audit/:path*' },
      { source: '/api/audit-logs/:path*', destination: '/api/g-data/audit-logs/:path*' },
      { source: '/api/notifications/:path*', destination: '/api/g-data/notifications/:path*' },
      { source: '/api/ab-tests/:path*', destination: '/api/g-data/ab-tests/:path*' },
      { source: '/api/data-health/:path*', destination: '/api/g-data/data-health/:path*' },
      { source: '/api/stats/:path*', destination: '/api/g-data/stats/:path*' },
      { source: '/api/team/:path*', destination: '/api/g-data/team/:path*' },
      { source: '/api/compliance/:path*', destination: '/api/g-data/compliance/:path*' },

      // Outreach
      { source: '/api/sequences/:path*', destination: '/api/g-outreach/sequences/:path*' },
      { source: '/api/templates/:path*', destination: '/api/g-outreach/templates/:path*' },
      { source: '/api/drafts/:path*', destination: '/api/g-outreach/drafts/:path*' },
      { source: '/api/prompt-templates/:path*', destination: '/api/g-outreach/prompt-templates/:path*' },
      { source: '/api/queue/:path*', destination: '/api/g-outreach/queue/:path*' },
      { source: '/api/replies/:path*', destination: '/api/g-outreach/replies/:path*' },
      { source: '/api/tracking/:path*', destination: '/api/g-outreach/tracking/:path*' },
      { source: '/api/unsubscribe/:path*', destination: '/api/g-outreach/unsubscribe/:path*' },
      { source: '/api/verify-email/:path*', destination: '/api/g-outreach/verify-email/:path*' },
      { source: '/api/verify-queue/:path*', destination: '/api/g-outreach/verify-queue/:path*' },
      { source: '/api/email-worker/:path*', destination: '/api/g-outreach/email-worker/:path*' },
      { source: '/api/webhooks/:path*', destination: '/api/g-outreach/webhooks/:path*' },

      // Strategy
      { source: '/api/playbooks/:path*', destination: '/api/g-strategy/playbooks/:path*' },
      { source: '/api/strategy-room/:path*', destination: '/api/g-strategy/strategy-room/:path*' },

      // System
      { source: '/api/seed/:path*', destination: '/api/g-system/seed/:path*' },
      { source: '/api/settings/:path*', destination: '/api/g-system/settings/:path*' },
    ];
  },
};

export default nextConfig;