/* ═══════════════════════════════════════════════════
   Server-Safe Design Tokens Re-Export
   
   P0.3: Server-side lib modules (session.ts, ai-unified-confidence.ts)
   must NOT import from @/components/* — component bundles are
   unavailable at the server/serverless layer.
   
   This file re-exports the pure-data tokens from the canonical
   design-tokens source so that server-side code can safely
   reference token values without touching the component tree.
   
   Only the tokens object and pure-data utility functions are
   re-exported here — NO React code, NO component imports.
   ═══════════════════════════════════════════════════ */

export {
  tokens,
  getConfidenceTier,
  getTrustTier,
  getPriorityTier,
} from '@/components/intelligence-os/design-tokens'
