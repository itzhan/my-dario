/**
 * Mirrors of dario's wire shapes. These are dario's *internal* contracts
 * (not a stable public API), so every consumer parses defensively — missing
 * fields degrade, they don't crash. Pinned against dario v4.8.x.
 */

export interface DarioStatus {
  authenticated: boolean;
  status: "healthy" | "expiring" | "expired" | "broken" | "none";
  expiresAt?: number;
  expiresIn?: string;
  canRefresh?: boolean;
  refreshFailures?: number;
  lastRefreshError?: string;
}

export interface RequestRecord {
  timestamp: number;
  account: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreateTokens: number;
  thinkingTokens: number;
  claim: string;
  util5h: number;
  util7d: number;
  overageUtil: number;
  latencyMs: number;
  status: number;
  isStream: boolean;
  isOpenAI: boolean;
}

export type BillingBucket =
  | "subscription"
  | "subscription_fallback"
  | "extra_usage"
  | "api"
  | "unknown";

export interface WindowStats {
  totalInputTokens: number;
  totalOutputTokens: number;
  totalThinkingTokens: number;
  estimatedCost: number;
  avgLatencyMs: number;
  errorRate: number;
  claimBreakdown: Record<string, number>;
  billingBucketBreakdown: Record<BillingBucket, number>;
  subscriptionPercent: number;
}

export interface PerModelStat {
  requests: number;
  avgInputTokens: number;
  avgOutputTokens: number;
  avgThinkingTokens: number;
  estimatedCost: number;
}

export interface PerAccountStat {
  requests: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  currentUtil5h: number;
  currentUtil7d: number;
  lastClaim: string;
}

export interface AnalyticsSummary {
  window: { minutes: number; requests: number } & WindowStats;
  allTime: { requests: number } & WindowStats;
  perAccount: Record<string, PerAccountStat>;
  perModel: Record<string, PerModelStat>;
  utilization: Array<{
    timestamp: number;
    avgUtil5h: number;
    avgUtil7d: number;
    requests: number;
  }>;
  predictions: {
    estimatedExhaustionMinutes: number | null;
    tokenBurnRate: number;
    costBurnRate: number;
  };
}

export interface PoolAccountView {
  alias: string;
  util5h: number;
  util7d: number;
  claim: string;
  status: string;
  requestCount: number;
  expiresInMs: number;
  lastAuthFailureAt?: number;
  consecutiveAuthFailures?: number;
  cooldownMs?: number;
}

export interface AccountsResponse {
  mode: "single-account" | "pool";
  accounts: number | PoolAccountView[];
  stickyBindings?: number;
  // pool.status() spreads additional fields; kept loose.
  [k: string]: unknown;
}

export interface HaltState {
  since: number;
  reason: string;
  account?: string;
  model?: string;
  cooldownMs?: number;
}

export interface OverageGuardStatus {
  halted: boolean;
  state?: HaltState | null;
  [k: string]: unknown;
}

export interface ModelsResponse {
  data: Array<{ id: string; object?: string; owned_by?: string }>;
}
