/**
 * Centralized environment variable validation and configuration.
 * All env vars accessed through this module — no direct process.env
 * references in business logic (except this module and instrumentation).
 *
 * NOTE: This is a Node.js-only module (uses process.env directly).
 * For Edge Runtime code, use process.env directly as Edge cannot
 * import this module conditionally.
 */

/**
 * Runtime-safe env var access with validation.
 * Each getter returns the env var value or a sensible default.
 */
export const env = {
  // ── Application ──────────────────────────────────────────────
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },
  get isProduction(): boolean {
    return this.nodeEnv === 'production';
  },
  get isDevelopment(): boolean {
    return this.nodeEnv === 'development';
  },
  get port(): number {
    return parseInt(process.env.PORT || '3000', 10);
  },
  get logLevel(): string {
    return process.env.LOG_LEVEL || (this.isProduction ? 'info' : 'debug');
  },

  // ── Database ─────────────────────────────────────────────────
  get databaseUrl(): string {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error('DATABASE_URL is required but not set');
    }
    return url;
  },
  get databasePoolSize(): number {
    const size = process.env.DATABASE_POOL_SIZE;
    if (size) {
      const parsed = parseInt(size, 10);
      if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }
    return 10;
  },
  get useDbPersistence(): boolean {
    return process.env.USE_DB_PERSISTENCE === 'true';
  },
  get persistenceMode(): string {
    return process.env.PERSISTENCE_MODE || 'memory';
  },

  // ── Redis ────────────────────────────────────────────────────
  get redisUrl(): string | undefined {
    return process.env.REDIS_URL;
  },

  // ── Auth / Security ──────────────────────────────────────────
  get authSecret(): string {
    return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || 'dev-secret-change-me';
  },
  get sessionMaxAgeSeconds(): number {
    return parseInt(process.env.SESSION_MAX_AGE || '86400', 10); // 24h default
  },

  // ── Sentry ───────────────────────────────────────────────────
  get sentryDsn(): string | undefined {
    return process.env.SENTRY_DSN;
  },
  get sentryEdgeDsn(): string | undefined {
    return process.env.NEXT_PUBLIC_SENTRY_DSN;
  },

  // ── OpenTelemetry ────────────────────────────────────────────
  get otelExporterEndpoint(): string | undefined {
    return process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  },
  get otelServiceName(): string {
    return process.env.OTEL_SERVICE_NAME || 'deepmindq';
  },

  // ── AI Providers ─────────────────────────────────────────────
  get nvidiaApiKey(): string | undefined {
    return process.env.NVIDIA_API_KEY;
  },
  get fireworksApiKey(): string | undefined {
    return process.env.FIREWORKS_API_KEY;
  },
  get groqApiKey(): string | undefined {
    return process.env.GROQ_API_KEY;
  },
  get geminiApiKey(): string | undefined {
    return process.env.GEMINI_API_KEY;
  },
  get tavilyApiKey(): string | undefined {
    return process.env.TAVILY_API_KEY;
  },
  get openaiApiKey(): string | undefined {
    return process.env.OPENAI_API_KEY;
  },
  get anthropicApiKey(): string | undefined {
    return process.env.ANTHROPIC_API_KEY;
  },

  // ── Email ────────────────────────────────────────────────────
  get resendApiKey(): string | undefined {
    return process.env.RESEND_API_KEY;
  },
  get emailFromAddress(): string {
    return process.env.EMAIL_FROM || 'noreply@deepmindq.com';
  },

  // ── External Integrations ────────────────────────────────────
  get clearbitApiKey(): string | undefined {
    return process.env.CLEARBIT_API_KEY;
  },
  get apolloApiKey(): string | undefined {
    return process.env.APOLLO_API_KEY;
  },
  get crunchbaseApiKey(): string | undefined {
    return process.env.CRUNCHBASE_API_KEY;
  },

  // ── Deployment ───────────────────────────────────────────────
  get deployEnvironment(): string {
    return process.env.DEPLOY_ENVIRONMENT || this.nodeEnv;
  },
  get deploySlot(): string {
    return process.env.DEPLOY_SLOT || 'none';
  },
  get deployRegion(): string {
    return process.env.DEPLOY_REGION || 'us-east-1';
  },
  get buildSha(): string {
    return process.env.NEXT_PUBLIC_BUILD_SHA || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';
  },
  get buildTimestamp(): string {
    return process.env.BUILD_TIMESTAMP || '';
  },
  get appVersion(): string {
    return process.env.NEXT_PUBLIC_APP_VERSION || process.env.npm_package_version || '0.2.0';
  },
  get isCanary(): boolean {
    return process.env.CANARY === 'true';
  },
  get canaryWeight(): number {
    return parseInt(process.env.CANARY_WEIGHT || '0', 10);
  },

  // ── Vercel / Platform ─────────────────────────────────────────
  get vercelEnv(): string | undefined {
    return process.env.VERCEL_ENV;
  },
  get vercelUrl(): string | undefined {
    return process.env.VERCEL_URL;
  },

  // ── Rate Limiting ────────────────────────────────────────────
  get rateLimitEnabled(): boolean {
    return process.env.RATE_LIMIT_DISABLED !== 'true';
  },
  get rateLimitWindowMs(): number {
    return parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
  },
  get rateLimitMax(): number {
    return parseInt(process.env.RATE_LIMIT_MAX || '100', 10);
  },
};

export type EnvConfig = typeof env;
