---
Task ID: 1
Agent: Main
Task: Rebrand application to DeepMindQ with dark+gold theme and fix live preview

Work Log:
- Analyzed DeepMindQ logo (deep navy #0A0E1A, blue-purple gradient, brain+speech bubble icon)
- Analyzed landing page design (dark #121212 background, gold #D4AF37 accents, minimal enterprise aesthetic)
- Copied deepmindq.png logo to /public/logo.png
- Rewrote globals.css: dark-first theme with gold (#D4AF37) as primary accent, deep navy (#0A0E1A) sidebar
- Updated layout.tsx: DeepMindQ metadata, dark as default theme, local favicon
- Completely rewrote app-shell.tsx: DeepMindQ branding, logo image, dark navy sidebar, gold accent navigation, gold avatar ring
- Rebranded all 5 screen components (dashboard, companies, contacts, company-profile, import, settings) from emerald to gold
- Fixed root cause of proxy crashes: `compress: false` in next.config.ts (bun's gzip was crashing on page responses through Caddy)
- Set up auto-restart server script for persistent serving
- Verified all routes work through Caddy proxy (page + APIs)

Stage Summary:
- Full DeepMindQ rebranding complete (dark + gold premium theme)
- Live preview working at https://preview-<bot-id>.space-z.ai/?XTransformPort=3000
- Database seeded with 25 companies, 60 contacts, 12 opportunities, 15 notes, 4 research cards
- All 15 API routes functional
- Key fix: `compress: false` required for bun+Next.js behind Caddy proxy