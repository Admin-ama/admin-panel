/**
 * Mirrors the AMA LibreChat fork's usage contract (`TUsage*` in its
 * `librechat-data-provider`), which the published package does not include.
 */
export type UsageWindowKey = 'fiveHour' | 'weekly' | 'monthly';

export interface UsageWindow {
  key: UsageWindowKey;
  /** USD spent inside the rolling window */
  spent: number;
  /** USD cap, `null` when uncapped */
  limit: number | null;
  /** ISO date when spend drops back under the cap; `null` when under it */
  resetAt: string | null;
}

export interface UsageUser {
  id: string;
  name: string;
  email: string;
  role: string;
  lastUsedAt: string | null;
  enabled: boolean;
  windows: UsageWindow[];
}

export interface UsageListResponse {
  users: UsageUser[];
  total: number;
  limit: number;
  offset: number;
}

export interface UsageBreakdownRow {
  key: string;
  spent: number;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

export interface UsageDetail extends UsageUser {
  byModel: UsageBreakdownRow[];
  byDay: UsageBreakdownRow[];
}

/** User-scope `usageLimits` override; `null` amount = inherit from role/group/base. */
export interface UsageLimitsOverride {
  enabled: boolean | null;
  fiveHour: number | null;
  weekly: number | null;
  monthly: number | null;
}

export type UsageSort = 'monthly' | 'weekly' | 'fiveHour' | 'name';

export interface UsageBarProps {
  window: UsageWindow;
  compact?: boolean;
}

export interface UsageDetailDialogProps {
  userId: string | null;
  onClose: () => void;
  canEditLimits: boolean;
}

export interface UsageBreakdownTableProps {
  titleKey: string;
  keyLabelKey: string;
  rows: UsageBreakdownRow[];
}

export interface UsageLimitsFormProps {
  userId: string;
  canEdit: boolean;
}

export interface UsageSummaryCardProps {
  label: string;
  value: string;
  danger?: boolean;
}
