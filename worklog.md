---
Task ID: 1
Agent: Main
Task: Rebuild Lead Intelligence & AI-Powered Outreach System per SDD and get it live

Work Log:
- Read the full SDD document (17 sections + 3 appendices) to understand exact requirements
- Deleted all old CRM code (20+ wrong screens, 40+ wrong API routes, unnecessary libs)
- Rewrote Prisma schema to match SDD data model: Contact, Company, ImportBatch, CompanyResearchCard, CompanyNote, CapabilityAsset, Draft, SendQueue, Reply, Bounce, Suppression, AuditLog
- Pushed schema to SQLite database
- Created 12 API routes (seed, dashboard, leads, companies, batches, drafts, queue, capabilities, replies, bounces, suppressions, audit)
- Built 9 screen components matching SDD Section 15: Dashboard, Import, Leads, Companies, Drafts, Queue, Capability Library, Replies, Bounces & Suppressions
- Fixed API response shape mismatches across all screens (rawName vs name, title vs jobTitle, leadScore vs score, nested data mapping)
- Seeded database with realistic mock data: 24 contacts, 6 companies, 3 batches, 8 capabilities, 6 drafts, 4 queue items, 3 replies, 2 bounces, 2 suppressions
- Verified all 9 screens render correctly via Agent Browser

Stage Summary:
- Lead Intelligence & AI-Powered Outreach System is LIVE
- Dark theme with gold accents per design system
- All screens operational: Dashboard, Import, Leads, Companies, Drafts, Send Queue, Capability Library, Replies, Bounces & Suppressions
- No runtime errors, all API routes returning 200