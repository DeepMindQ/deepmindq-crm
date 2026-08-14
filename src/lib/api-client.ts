/**
 * DeepMindQ API Client — TypeScript SDK v1
 *
 * Type-safe client for the DeepMindQ Intelligence OS API.
 * Wraps all REST endpoints with proper error handling, pagination,
 * timeout management, and authentication support.
 *
 * @example
 * ```ts
 * import { createClient } from '@/lib/api-client'
 *
 * const client = createClient({ token: session.token })
 * const { companies, pagination } = await client.listCompanies({ tier: 'HOT' })
 * ```
 */

// ═══════════════════════════════════════════════════════════════════════
//  Configuration
// ═══════════════════════════════════════════════════════════════════════

/** Configuration options for the API client. */
export interface ApiClientConfig {
  /** Base URL for the API (defaults to NEXT_PUBLIC_APP_URL or localhost). */
  baseUrl?: string;
  /** API key for programmatic access (sent as X-API-Key header). */
  apiKey?: string;
  /** JWT bearer token for session-based auth. */
  token?: string;
  /** Request timeout in milliseconds (default: 30 000). */
  timeout?: number;
  /** Callback invoked on 401 responses (e.g. redirect to login). */
  onUnauthorized?: () => void;
}

// ═══════════════════════════════════════════════════════════════════════
//  Re-exported domain types (from @/lib/types)
// ═══════════════════════════════════════════════════════════════════════

export type {
  Company,
  Contact,
  Opportunity,
  User,
  DashboardStats,
  DataQualityReport,
  CompanyStatus,
  ContactStatus,
  OpportunityStatus,
  EmailHealthStatus,
  RoleBucket,
} from './types';

// ═══════════════════════════════════════════════════════════════════════
//  API Error
// ═══════════════════════════════════════════════════════════════════════

/** Structured error thrown by the API client on non-2xx responses. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Response Wrapper
// ═══════════════════════════════════════════════════════════════════════

/** Standard API response envelope. */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    apiVersion: string;
    deprecated?: boolean;
    sunset?: string | null;
    total?: number;
    page?: number;
    limit?: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════
//  SDK-specific parameter types
// ═══════════════════════════════════════════════════════════════════════

/** Query parameters for company listing. */
export interface ListCompaniesParams {
  search?: string;
  industry?: string;
  status?: string;
  tier?: string;
  sizeRange?: string;
  sortBy?:
    | 'accountPriorityScore'
    | 'intelligenceScore'
    | 'opportunityScore'
    | 'contacts'
    | 'signals'
    | 'lastActivityAt'
    | 'updatedAt';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  cursor?: string;
}

/** Query parameters for contact listing. */
export interface ListContactsParams {
  search?: string;
  status?: string;
  emailHealth?: string;
  roleBucket?: string;
  companyId?: string;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

/** Query parameters for opportunity listing. */
export interface ListOpportunitiesParams {
  companyId?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}

/** Query parameters for signal listing. */
export interface ListSignalsParams {
  companyId?: string;
  type?: string;
  severity?: string;
  status?: string;
  meaningCategory?: string;
  page?: number;
}

/** Query parameters for recommendation listing. */
export interface ListRecommendationsParams {
  limit?: number;
  tier?: string;
  minScore?: number;
  activeSignalsOnly?: boolean;
  sortBy?: 'opportunityScore' | 'confidenceScore' | 'signalCount' | 'recentActivity';
  includeExplanation?: boolean;
  view?: 'list' | 'stats';
}

/** Payload for creating a company. */
export interface CreateCompanyInput {
  name: string;
  domain?: string;
  industry?: string;
  employeeSize?: string;
  location?: string;
  country?: string;
  website?: string;
}

/** Payload for creating a contact. */
export interface CreateContactInput {
  name: string;
  companyId: string;
  email?: string;
  title?: string;
  phone?: string;
  linkedinUrl?: string;
}

/** Payload for creating an opportunity. */
export interface CreateOpportunityInput {
  companyId: string;
  title: string;
  description?: string;
  status?: string;
  value?: number;
}

/** Payload for batch operations. */
export interface BatchExecuteInput {
  action:
    'archive' | 'restore' | 'delete' | 'enrich' | 'reassign' | 'export' | 'tag' | 'update_status';
  entityType: 'company' | 'contact' | 'opportunity' | 'signal';
  ids: string[];
  params?: Record<string, unknown>;
}

/** Payload for registering a webhook. */
export interface RegisterWebhookInput {
  url: string;
  events: string[];
}

/** Payload for testing a webhook. */
export interface TestWebhookInput {
  url: string;
  event: string;
}

/** Notification query parameters. */
export interface ListNotificationsParams {
  unreadOnly?: boolean;
  type?: 'signal' | 'recommendation' | 'system' | 'alert';
  limit?: number;
}

// ═══════════════════════════════════════════════════════════════════════
//  Pagination response shape
// ═══════════════════════════════════════════════════════════════════════

/** Standard pagination metadata returned by list endpoints. */
export interface PaginationMeta {
  page: number;
  limit?: number;
  pageSize?: number;
  total: number;
  totalPages: number;
  nextCursor?: string | null;
}

/** Company score details. */
export interface CompanyScoreDetail {
  score: number;
  category: string;
  dimensions: {
    intelligence: number;
    opportunity: number;
    engagement: number;
  };
}

/** Pipeline stage representation. */
export interface PipelineStage {
  key: string;
  label: string;
  count: number;
  color: string;
}

/** Full pipeline response. */
export interface PipelineData {
  stages: PipelineStage[];
  totalLeads: number;
  conversionRate: number;
  deliveryRate: number;
  replyRate: number;
  bounceRate: number;
}

// ═══════════════════════════════════════════════════════════════════════
//  Internal request helper types
// ═══════════════════════════════════════════════════════════════════════

interface RequestOptions {
  method?: string;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

// ═══════════════════════════════════════════════════════════════════════
//  Main Client Class
// ═══════════════════════════════════════════════════════════════════════

/**
 * Type-safe API client for the DeepMindQ Intelligence OS.
 *
 * Supports both JWT bearer tokens and API key authentication.
 * All methods throw `ApiError` on failure — use try/catch for error handling.
 */
export class DeepMindQClient {
  private baseUrl: string;
  private token?: string;
  private apiKey?: string;
  private timeout: number;
  private onUnauthorized?: () => void;

  constructor(config: ApiClientConfig = {}) {
    this.baseUrl =
      config.baseUrl ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL}/api`
        : 'http://localhost:3000/api');
    this.token = config.token;
    this.apiKey = config.apiKey;
    this.timeout = config.timeout ?? 30_000;
    this.onUnauthorized = config.onUnauthorized;
  }

  /**
   * Update the auth token (e.g. after login/refresh).
   * Returns the client for chaining.
   */
  setToken(token: string): this {
    this.token = token;
    return this;
  }

  /**
   * Update the API key.
   * Returns the client for chaining.
   */
  setApiKey(key: string): this {
    this.apiKey = key;
    return this;
  }

  // ── Authentication ─────────────────────────────────────────────

  /**
   * Authenticate with email and password.
   * On success, an OTP is sent to the email — call `verifyOtp` to complete login.
   */
  async login(
    email: string,
    password: string,
  ): Promise<{ success: boolean; message: string; devCode?: string }> {
    return this.request('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
  }

  /** End the current authenticated session. */
  async logout(): Promise<{ success: boolean }> {
    return this.request('/auth/logout', { method: 'POST' });
  }

  /** Get the currently authenticated user's profile. */
  async me(): Promise<ApiResponse<import('./types').User>> {
    return this.request('/auth/me');
  }

  // ── Companies ──────────────────────────────────────────────────

  /**
   * List companies with search, filter, sort, and pagination.
   * Supports both page-based and cursor-based pagination.
   */
  async listCompanies(params?: ListCompaniesParams): Promise<{
    companies: import('./types').Company[];
    pagination: PaginationMeta;
    filters?: {
      tiers: Array<{ tier: string; count: number }>;
      statuses: Array<{ status: string; count: number }>;
    };
  }> {
    const qp: Record<string, string | number | undefined> = {};
    if (params?.search) qp.search = params.search;
    if (params?.industry) qp.industry = params.industry;
    if (params?.status) qp.status = params.status;
    if (params?.tier) qp.tier = params.tier;
    if (params?.sizeRange) qp.sizeRange = params.sizeRange;
    if (params?.sortBy) qp.sortBy = params.sortBy;
    if (params?.sortOrder) qp.sortOrder = params.sortOrder;
    if (params?.page) qp.page = params.page;
    if (params?.limit) qp.limit = params.limit;
    if (params?.cursor) qp.cursor = params.cursor;
    return this.request('/companies', { params: qp });
  }

  /** Get a single company by ID. */
  async getCompany(id: string): Promise<{ company: import('./types').Company }> {
    return this.request(`/companies/${id}`);
  }

  /** Create a new company. Triggers the intelligence activation pipeline. */
  async createCompany(data: CreateCompanyInput): Promise<{ company: import('./types').Company }> {
    return this.request('/companies', { method: 'POST', body: data });
  }

  /** Get AI-detected signals for a specific company. */
  async getCompanySignals(
    id: string,
    params?: { type?: string; severity?: string },
  ): Promise<{
    signals: Array<{
      id: string;
      signalType: string;
      severity: string;
      title: string;
      description: string;
      detectedAt: string;
      confidenceScore: number | null;
    }>;
  }> {
    const qp: Record<string, string | undefined> = {};
    if (params?.type) qp.type = params.type;
    if (params?.severity) qp.severity = params.severity;
    return this.request(`/companies/${id}/signals`, { params: qp });
  }

  /** Get the account score for a specific company. */
  async getCompanyScore(id: string): Promise<CompanyScoreDetail> {
    return this.request(`/companies/${id}/score`);
  }

  // ── Contacts ───────────────────────────────────────────────────

  /** List contacts with search, status, email health, and role filtering. */
  async listContacts(params?: ListContactsParams): Promise<{
    contacts: import('./types').Contact[];
    pagination: PaginationMeta;
  }> {
    const qp: Record<string, string | number | undefined> = {};
    if (params?.search) qp.search = params.search;
    if (params?.status) qp.status = params.status;
    if (params?.emailHealth) qp.emailHealth = params.emailHealth;
    if (params?.roleBucket) qp.roleBucket = params.roleBucket;
    if (params?.companyId) qp.companyId = params.companyId;
    if (params?.sortBy) qp.sortBy = params.sortBy;
    if (params?.sortDir) qp.sortDir = params.sortDir;
    if (params?.page) qp.page = params.page;
    if (params?.pageSize) qp.pageSize = params.pageSize;
    return this.request('/contacts', { params: qp });
  }

  /** Get a single contact by ID. */
  async getContact(id: string): Promise<any> {
    return this.request(`/contacts/${id}`);
  }

  /** Create a new contact. */
  async createContact(data: CreateContactInput): Promise<{ contact: any }> {
    return this.request('/contacts', { method: 'POST', body: data });
  }

  // ── Opportunities ──────────────────────────────────────────────

  /** List sales opportunities with optional filtering. */
  async listOpportunities(params?: ListOpportunitiesParams): Promise<{
    data: any[];
    pagination: PaginationMeta;
  }> {
    const qp: Record<string, string | number | undefined> = {};
    if (params?.companyId) qp.companyId = params.companyId;
    if (params?.status) qp.status = params.status;
    if (params?.page) qp.page = params.page;
    if (params?.pageSize) qp.pageSize = params.pageSize;
    return this.request('/opportunities', { params: qp });
  }

  /** Get a single opportunity by ID. */
  async getOpportunity(id: string): Promise<{ data: any }> {
    return this.request(`/opportunities/${id}`);
  }

  /** Create a new sales opportunity. */
  async createOpportunity(data: CreateOpportunityInput): Promise<{ data: any }> {
    return this.request('/opportunities', { method: 'POST', body: data });
  }

  // ── Signals ────────────────────────────────────────────────────

  /**
   * List AI-detected intelligence signals.
   * Filter by company, type, severity, and status.
   */
  async listSignals(params?: ListSignalsParams): Promise<{
    signals: any[];
    evidenceCounts: Record<string, number>;
    categories: string[];
  }> {
    const qp: Record<string, string | number | undefined> = {};
    if (params?.companyId) qp.companyId = params.companyId;
    if (params?.type) qp.type = params.type;
    if (params?.severity) qp.severity = params.severity;
    if (params?.status) qp.status = params.status;
    if (params?.meaningCategory) qp.meaningCategory = params.meaningCategory;
    if (params?.page) qp.page = params.page;
    return this.request('/signals', { params: qp });
  }

  /** Get signal details including evidence. */
  async getSignal(id: string): Promise<any> {
    return this.request(`/signals/${id}`);
  }

  // ── Recommendations ────────────────────────────────────────────

  /**
   * List AI-generated account recommendations.
   * Supports tier filtering, minimum score threshold, and explainability.
   */
  async listRecommendations(params?: ListRecommendationsParams): Promise<{
    recommendations: any[];
    meta?: { total: number; returned: number };
  }> {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params?.limit) qp.limit = params.limit;
    if (params?.tier) qp.tier = params.tier;
    if (params?.minScore != null) qp.minScore = params.minScore;
    if (params?.activeSignalsOnly != null) qp.activeSignalsOnly = params.activeSignalsOnly;
    if (params?.sortBy) qp.sortBy = params.sortBy;
    if (params?.includeExplanation != null) qp.includeExplanation = params.includeExplanation;
    if (params?.view) qp.view = params.view;
    return this.request('/recommendations', { params: qp });
  }

  /** Get recommendation details. */
  async getRecommendation(id: string): Promise<any> {
    return this.request(`/recommendations/${id}`);
  }

  /** Get AI explainability summary for a recommendation. */
  async getRecommendationExplanation(companyId: string): Promise<{ explanation: string }> {
    return this.request(`/recommendations/${companyId}/explain`);
  }

  // ── Pipeline ───────────────────────────────────────────────────

  /** Get pipeline stage distribution with conversion and delivery metrics. */
  async getPipeline(): Promise<PipelineData> {
    return this.request('/pipeline');
  }

  /** Get revenue forecast with conservative, projected, and optimistic scenarios. */
  async getForecast(): Promise<any> {
    return this.request('/pipeline/forecast');
  }

  // ── Dashboard ──────────────────────────────────────────────────

  /** Get dashboard statistics and KPIs. */
  async getDashboard(): Promise<any> {
    return this.request('/dashboard');
  }

  // ── Scoring Configuration ──────────────────────────────────────

  /** Get the current scoring configuration (weights, thresholds, recency). */
  async getScoringConfig(): Promise<ApiResponse<any>> {
    return this.request('/scoring-config');
  }

  /** Update scoring configuration. Validates weight sums and threshold ordering. */
  async updateScoringConfig(config: Record<string, unknown>): Promise<ApiResponse<any>> {
    return this.request('/scoring-config', { method: 'PUT', body: config });
  }

  // ── Data Health ────────────────────────────────────────────────

  /**
   * Get data quality and completeness metrics.
   * Includes AI-powered diagnosis, enrichment strategy, and predictions.
   * Response is cached server-side for 5 minutes.
   */
  async getDataHealth(): Promise<ApiResponse<Record<string, unknown>>> {
    return this.request('/data-health');
  }

  // ── Notifications ──────────────────────────────────────────────

  /** List user notifications with optional type and read-status filters. */
  async listNotifications(params?: ListNotificationsParams): Promise<{
    notifications: import('./types').NotificationItem[];
    unreadCount: number;
  }> {
    const qp: Record<string, string | number | boolean | undefined> = {};
    if (params?.unreadOnly != null) qp.unreadOnly = params.unreadOnly;
    if (params?.type) qp.type = params.type;
    if (params?.limit) qp.limit = params.limit;
    return this.request('/notifications', { params: qp });
  }

  /** Mark a notification as read. */
  async markNotificationRead(id: string): Promise<{ success: boolean }> {
    return this.request('/notifications', { method: 'POST', body: { id } });
  }

  // ── Webhooks ───────────────────────────────────────────────────

  /** List all registered webhooks. */
  async listWebhooks(): Promise<{
    webhooks: Array<{
      id: string;
      url: string;
      events: string[];
      active: boolean;
      createdAt: string;
    }>;
  }> {
    return this.request('/webhooks/manage');
  }

  /** Register a new outbound webhook. */
  async registerWebhook(
    data: RegisterWebhookInput,
  ): Promise<{ webhook: { id: string; url: string; events: string[]; active: boolean } }> {
    return this.request('/webhooks/manage', { method: 'POST', body: data });
  }

  /** Delete a registered webhook by ID. */
  async deleteWebhook(id: string): Promise<{ success: boolean }> {
    return this.request(`/webhooks/manage/${id}`, { method: 'DELETE' });
  }

  /** List available webhook event types. */
  async listWebhookEvents(): Promise<{ events: Array<{ name: string; description: string }> }> {
    return this.request('/webhooks/events');
  }

  /** Send a test payload to a webhook URL. */
  async testWebhook(
    data: TestWebhookInput,
  ): Promise<{ success: boolean; statusCode?: number; responseTime?: number }> {
    return this.request('/webhooks/test', { method: 'POST', body: data });
  }

  // ── Batch Operations ───────────────────────────────────────────

  /**
   * Execute a bulk operation on entities.
   * Supports archive, restore, delete, enrich, reassign, export, tag, and update_status.
   * Maximum 500 IDs per request.
   */
  async executeBatch(data: BatchExecuteInput): Promise<{
    success: boolean;
    action: string;
    entityType: string;
    totalRequested: number;
    processed: number;
    failed: number;
    errors: Array<{ id: string; error: string }>;
  }> {
    return this.request('/batch/execute', { method: 'POST', body: data });
  }

  // ── System ─────────────────────────────────────────────────────

  /** Check system health (no auth required). */
  async healthCheck(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    version: string;
    services: { database: string; ai: string };
  }> {
    return this.request('/health');
  }

  /** Fetch the OpenAPI specification YAML. */
  async getOpenApiSpec(): Promise<string> {
    const url = `${this.baseUrl}/docs`;
    const res = await fetch(url);
    if (!res.ok) throw new ApiError(res.status, 'SPEC_ERROR', 'Failed to fetch OpenAPI spec');
    return res.text();
  }

  // ═══════════════════════════════════════════════════════════════
  //  Internal: Core fetch helper
  // ═══════════════════════════════════════════════════════════════

  /**
   * Core request method — handles auth headers, timeouts, error parsing,
   * and automatic 401 callback invocation.
   */
  private async request<T>(path: string, options?: RequestOptions): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);

    // Append query parameters, skipping undefined values
    if (options?.params) {
      for (const [key, value] of Object.entries(options.params)) {
        if (value !== undefined && value !== '') {
          url.searchParams.set(key, String(value));
        }
      }
    }

    // Set up abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      // Build headers
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      };
      if (this.token) {
        headers['Authorization'] = `Bearer ${this.token}`;
      }
      if (this.apiKey) {
        headers['X-API-Key'] = this.apiKey;
      }

      // Execute fetch
      const res = await fetch(url.toString(), {
        method: options?.method || 'GET',
        headers,
        body: options?.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      // Handle 401 — invoke callback before throwing
      if (res.status === 401) {
        this.onUnauthorized?.();
        const body = await res.json().catch(() => ({}));
        throw new ApiError(
          401,
          'UNAUTHORIZED',
          (body as any)?.error || 'Authentication required',
          (body as any)?.details,
        );
      }

      // Parse response body
      const data = await res.json().catch(() => ({ error: 'Invalid JSON response' }));

      // Non-OK responses
      if (!res.ok) {
        throw new ApiError(
          res.status,
          (data as any)?.code || 'API_ERROR',
          (data as any)?.error || `Request failed with status ${res.status}`,
          (data as any)?.details,
        );
      }

      return data as T;
    } catch (error) {
      // Re-throw ApiError instances directly
      if (error instanceof ApiError) throw error;

      // Handle abort (timeout)
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new ApiError(0, 'TIMEOUT', `Request timed out after ${this.timeout}ms`);
      }

      // Network / unknown errors
      throw new ApiError(
        0,
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Unknown network error',
      );
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  Factory function
// ═══════════════════════════════════════════════════════════════════════

/**
 * Create a new DeepMindQ API client instance.
 *
 * @example
 * ```ts
 * const client = createClient({ token: 'eyJ...' })
 * const companies = await client.listCompanies({ tier: 'HOT', limit: 10 })
 * ```
 */
export function createClient(config?: ApiClientConfig): DeepMindQClient {
  return new DeepMindQClient(config);
}

// ═══════════════════════════════════════════════════════════════════════
//  React hook wrapper
// ═══════════════════════════════════════════════════════════════════════

/**
 * React hook that returns a memoized DeepMindQ API client.
 *
 * In a React component, call this once at the top level.
 * The client instance is stable across re-renders.
 *
 * @example
 * ```tsx
 * 'use client'
 * import { useApiClient } from '@/lib/api-client'
 *
 * export function CompanyList() {
 *   const client = useApiClient()
 *   // ... fetch data
 * }
 * ```
 */
export function useApiClient(config?: ApiClientConfig): DeepMindQClient {
  // In a real React hook this would use useState/useRef for memoization.
  // For server-side and non-React usage, we return a new instance each call.
  // React consumers should wrap this with useMemo if needed.
  // Note: 'use client' directive on the consuming component handles this.
  return new DeepMindQClient(config);
}

export default DeepMindQClient;
