import { PrincipalType } from 'librechat-data-provider';
import type { AdminConfig } from '@librechat/data-schemas';
import type * as t from '@/types';

export const USAGE_WINDOW_KEYS: t.UsageWindowKey[] = ['fiveHour', 'weekly', 'monthly'];

export const USAGE_LIMIT_FIELDS: Array<keyof t.UsageLimitsOverride> = [
  'enabled',
  'fiveHour',
  'weekly',
  'monthly',
];

/** Share of the monthly cap each window gets (the 2 / 5 / 10 USD rule). */
export const USAGE_WINDOW_RATIOS: Record<t.UsageWindowKey, number> = {
  fiveHour: 0.2,
  weekly: 0.5,
  monthly: 1,
};

/** Config principal id the LibreChat API uses for tenant-wide (base) overrides. */
export const BASE_PRINCIPAL_ID = '__base__';

export const USAGE_WINDOW_LABEL_KEYS: Record<t.UsageWindowKey, string> = {
  fiveHour: 'com_usage_window_five_hour',
  weekly: 'com_usage_window_weekly',
  monthly: 'com_usage_window_monthly',
};

const usdFormatter = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export const formatUsd = (amount: number): string => usdFormatter.format(amount);

/** Share of the cap used, clamped to 0–100; `null` when the window is uncapped. */
export function usagePercent(window: t.UsageWindow): number | null {
  if (window.limit == null) return null;
  if (window.limit <= 0) return 100;
  return Math.min(100, Math.max(0, (window.spent / window.limit) * 100));
}

export const isWindowBlocked = (window: t.UsageWindow): boolean =>
  window.limit != null && window.spent >= window.limit;

export const isUserBlocked = (user: t.UsageUser): boolean =>
  user.enabled && user.windows.some(isWindowBlocked);

export function getWindow(user: t.UsageUser, key: t.UsageWindowKey): t.UsageWindow | undefined {
  return user.windows.find((w) => w.key === key);
}

/** Case-insensitive name/email filter, then sort: spend descending or name ascending. */
export function filterAndSortUsage(
  users: t.UsageUser[],
  query: string,
  sort: t.UsageSort,
): t.UsageUser[] {
  const needle = query.trim().toLowerCase();
  const filtered = needle
    ? users.filter(
        (u) => u.name.toLowerCase().includes(needle) || u.email.toLowerCase().includes(needle),
      )
    : users;
  if (sort === 'name') {
    return [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }
  return [...filtered].sort(
    (a, b) => (getWindow(b, sort)?.spent ?? 0) - (getWindow(a, sort)?.spent ?? 0),
  );
}

/** Normalizes a stored `usageLimits` override (absent fields inherit). */
export function toUsageLimitsOverride(
  value: Partial<t.UsageLimitsOverride> | undefined,
): t.UsageLimitsOverride {
  const amount = (v: unknown): number | null => (typeof v === 'number' && v >= 0 ? v : null);
  return {
    enabled: typeof value?.enabled === 'boolean' ? value.enabled : null,
    fiveHour: amount(value?.fiveHour),
    weekly: amount(value?.weekly),
    monthly: amount(value?.monthly),
  };
}

/** Parses a USD text input: empty → `null` (inherit); invalid/negative → `undefined`. */
export function parseLimitInput(raw: string): number | null | undefined {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

export const roundUsd = (amount: number): number => Math.round(amount * 100) / 100;

/** Caps for every window derived from a monthly cap with {@link USAGE_WINDOW_RATIOS}. */
export function deriveLimitsFromMonthly(monthly: number): t.UsageLimits {
  return {
    fiveHour: roundUsd(monthly * USAGE_WINDOW_RATIOS.fiveHour),
    weekly: roundUsd(monthly * USAGE_WINDOW_RATIOS.weekly),
    monthly: roundUsd(monthly),
  };
}

export const formatLimits = (limits: t.UsageLimits): string =>
  USAGE_WINDOW_KEYS.map((key) => {
    const value = limits[key];
    return value == null ? '—' : formatUsd(value);
  }).join(' / ');

/** Normalizes the effective base `usageLimits` section (YAML merged with base DB overrides). */
export function toGlobalUsageLimits(
  value: Partial<t.UsageLimitsOverride> | undefined,
): t.GlobalUsageLimits {
  const { enabled, fiveHour, weekly, monthly } = toUsageLimitsOverride(value);
  return { enabled: enabled === true, fiveHour, weekly, monthly };
}

export const hasCustomLimits = (override: t.UsageLimitsOverride | undefined): boolean =>
  override != null && USAGE_LIMIT_FIELDS.some((field) => override[field] != null);

/** Splits active role/group/user config docs that override `usageLimits` (base excluded). */
export function collectUsageExceptions(configs: AdminConfig[]): t.UsageExceptions {
  const exceptions: t.UsageExceptions = { users: {}, scopes: [] };
  for (const config of configs) {
    const raw = (config.overrides as { usageLimits?: Partial<t.UsageLimitsOverride> })
      ?.usageLimits;
    if (!config.isActive || config.principalId === BASE_PRINCIPAL_ID || raw == null) continue;
    const limits = toUsageLimitsOverride(raw);
    if (!hasCustomLimits(limits)) continue;
    if (config.principalType === PrincipalType.USER) {
      exceptions.users[config.principalId] = limits;
      continue;
    }
    exceptions.scopes.push({
      principalType: config.principalType,
      principalId: config.principalId,
      limits,
    });
  }
  return exceptions;
}
