# ──────────────────────────────────────────────────────────────
# DeepMindQ — Production Docker Image
#
# Multi-stage build for minimal image size.
# Targets: Render, Railway, Fly.io, or self-hosted Docker.
#
# Usage:
#   docker build -t deepmindq .
#   docker run -p 3000:3000 --env-file .env deepmindq
#
# Required env vars (mount via --env-file or -e):
#   DATABASE_URL, DIRECT_DATABASE_URL, NEXTAUTH_SECRET
#
# Optional env vars:
#   GROQ_API_KEY, GEMINI_API_KEY, FIREWORKS_API_KEY,
#   NVIDIA_API_KEY, TAVILY_API_KEY,
#   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
# ──────────────────────────────────────────────────────────────

# ── Stage 1: Dependencies ────────────────────────────────────
FROM node:20-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

# ── Stage 2: Build ──────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generate Prisma client + run migrations
RUN npx prisma generate && npx prisma migrate deploy

# Build Next.js app (standalone output configured in next.config.ts)
RUN npx next build

# ── Stage 3: Production Runtime ──────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built app
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Copy Prisma for runtime DB access
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Set correct permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

# Health check — verifies the app is responding
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/api/health || exit 1

CMD ["node", "server.js"]
