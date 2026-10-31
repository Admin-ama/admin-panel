import { useMemo, useState } from 'react';
import { Icon } from '@clickhouse/click-ui';
import { useQuery } from '@tanstack/react-query';
import type * as t from '@/types';
import {
  EmptyState,
  LoadingState,
  ScreenReaderAnnouncer,
  SearchInput,
} from '@/components/shared';
import {
  cn,
  formatUsd,
  getWindow,
  formatLimits,
  isUserBlocked,
  filterAndSortUsage,
} from '@/utils';
import { useAnnouncement, useCapabilities, useLocalize } from '@/hooks';
import { UsageDetailDialog } from './UsageDetailDialog';
import { usageExceptionsQueryOptions, usageListQueryOptions } from '@/server';
import { GlobalLimitsCard } from './GlobalLimitsCard';
import { SystemCapabilities } from '@/constants';
import { UsageBar } from './UsageBar';

const SORT_LABEL_KEYS: Record<t.UsageSort, string> = {
  monthly: 'com_usage_window_monthly',
  weekly: 'com_usage_window_weekly',
  fiveHour: 'com_usage_window_five_hour',
  name: 'com_usage_sort_name',
};

const WINDOW_COLUMNS: t.UsageWindowKey[] = ['fiveHour', 'weekly', 'monthly'];

const EMPTY_EXCEPTIONS: t.UsageExceptions = { users: {}, scopes: [] };

/** Human summary of an override: "Unlimited" or the caps it sets ("—" = inherited). */
function describeOverride(
  limits: t.UsageLimitsOverride,
  localize: (key: string) => string,
): string {
  if (limits.enabled === false) return localize('com_usage_unlimited');
  return formatLimits(limits);
}

export function UsagePage() {
  const localize = useLocalize();
  const { hasCapability } = useCapabilities();
  const canManageConfigs = hasCapability(SystemCapabilities.MANAGE_CONFIGS);
  const canEditLimits = hasCapability(SystemCapabilities.ASSIGN_CONFIGS) || canManageConfigs;
  const [onlyCustom, setOnlyCustom] = useState(false);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<t.UsageSort>('monthly');
  const [detailId, setDetailId] = useState<string | null>(null);
  const { message: announcement, announce } = useAnnouncement();
  const { data, isLoading, isError, error } = useQuery(usageListQueryOptions);
  const { data: exceptions = EMPTY_EXCEPTIONS } = useQuery(usageExceptionsQueryOptions);

  const users = useMemo(() => data?.users ?? [], [data]);
  const visible = useMemo(() => {
    const sorted = filterAndSortUsage(users, search, sort);
    return onlyCustom ? sorted.filter((u) => exceptions.users[u.id] != null) : sorted;
  }, [users, search, sort, onlyCustom, exceptions]);
  const totals = useMemo(
    () =>
      users.reduce(
        (acc, user) => ({
          monthly: acc.monthly + (getWindow(user, 'monthly')?.spent ?? 0),
          blocked: acc.blocked + (isUserBlocked(user) ? 1 : 0),
        }),
        { monthly: 0, blocked: 0 },
      ),
    [users],
  );

  const handleSearchChange = (value: string) => {
    setSearch(value);
    announce(
      localize('com_a11y_results_found', {
        count: filterAndSortUsage(users, value, sort).length,
      }),
    );
  };

  if (isLoading) {
    return <LoadingState />;
  }

  if (isError) {
    return (
      <EmptyState
        message={localize('com_usage_load_error', { message: (error as Error).message })}
      />
    );
  }

  return (
    <div
      role="region"
      aria-label={localize('com_nav_usage')}
      className="flex flex-1 flex-col gap-6 overflow-auto p-6"
    >
      <section aria-label={localize('com_usage_summary')} className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label={localize('com_usage_total_users')} value={String(users.length)} />
        <SummaryCard label={localize('com_usage_total_monthly')} value={formatUsd(totals.monthly)} />
        <SummaryCard
          label={localize('com_usage_blocked_users')}
          value={String(totals.blocked)}
          danger={totals.blocked > 0}
        />
      </section>

      <GlobalLimitsCard users={users} exceptions={exceptions} canEdit={canManageConfigs} />

      {exceptions.scopes.length > 0 && (
        <section
          aria-label={localize('com_usage_scope_exceptions')}
          className="flex flex-wrap items-center gap-2 text-xs text-(--cui-color-text-muted)"
        >
          <span>{localize('com_usage_scope_exceptions')}:</span>
          {exceptions.scopes.map((scope) => (
            <span
              key={`${scope.principalType}:${scope.principalId}`}
              className="badge-role inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
            >
              {scope.principalType} {scope.principalId} · {describeOverride(scope.limits, localize)}
            </span>
          ))}
        </section>
      )}

      <section aria-label={localize('com_usage_list')}>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder={localize('com_users_search')}
            className="relative flex-1"
          />
          <div className="flex gap-1" role="group" aria-label={localize('com_usage_sort_by')}>
            {(Object.keys(SORT_LABEL_KEYS) as t.UsageSort[]).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={sort === option}
                onClick={() => setSort(option)}
                className={cn(
                  'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                  sort === option
                    ? 'bg-(--cui-color-background-active) text-(--cui-color-text-default)'
                    : 'text-(--cui-color-text-muted) hover:bg-(--cui-color-background-hover) hover:text-(--cui-color-text-default)',
                )}
              >
                {localize(SORT_LABEL_KEYS[option])}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-pressed={onlyCustom}
            onClick={() => setOnlyCustom((v) => !v)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
              onlyCustom
                ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300'
                : 'text-(--cui-color-text-muted) hover:bg-(--cui-color-background-hover) hover:text-(--cui-color-text-default)',
            )}
          >
            {localize('com_usage_only_custom', {
              count: Object.keys(exceptions.users).length,
            })}
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-(--cui-color-stroke-default)">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-(--cui-color-stroke-default) bg-(--cui-color-background-muted)">
                <th scope="col" className="px-4 py-2.5 font-medium text-(--cui-color-text-muted)">
                  {localize('com_users_col_user')}
                </th>
                {WINDOW_COLUMNS.map((key) => (
                  <th
                    key={key}
                    scope="col"
                    className="px-4 py-2.5 font-medium text-(--cui-color-text-muted)"
                  >
                    {localize(SORT_LABEL_KEYS[key])}
                  </th>
                ))}
                <th scope="col" className="px-4 py-2.5 font-medium text-(--cui-color-text-muted)">
                  {localize('com_usage_col_last_used')}
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.map((user, i) => (
                <tr
                  key={user.id}
                  onClick={() => setDetailId(user.id)}
                  className={cn(
                    'cursor-pointer bg-(--cui-color-background-panel) transition-colors hover:bg-(--cui-color-background-hover)',
                    i < visible.length - 1 && 'border-b border-(--cui-color-stroke-default)',
                  )}
                >
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="flex items-center gap-1.5 font-medium text-(--cui-color-text-default)">
                        {user.name || user.email}
                        {isUserBlocked(user) && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[10px] font-medium text-red-500"
                            title={localize('com_usage_blocked')}
                          >
                            <Icon name="lock" size="xs" />
                            {localize('com_usage_blocked')}
                          </span>
                        )}
                        {exceptions.users[user.id] && (
                          <span
                            className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300"
                            title={describeOverride(exceptions.users[user.id], localize)}
                          >
                            <Icon name="pencil" size="xs" />
                            {localize('com_usage_custom_limit')}
                          </span>
                        )}
                        {!user.enabled && (
                          <span className="rounded-full bg-(--cui-color-background-secondary) px-2 py-0.5 text-[10px] text-(--cui-color-text-muted)">
                            {localize('com_usage_unlimited')}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-(--cui-color-text-muted)">{user.email}</span>
                    </div>
                  </td>
                  {WINDOW_COLUMNS.map((key) => {
                    const window = getWindow(user, key);
                    return (
                      <td key={key} className="px-4 py-3 align-top">
                        {window && <UsageBar window={window} compact />}
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-xs text-(--cui-color-text-muted)">
                    {user.lastUsedAt ? new Date(user.lastUsedAt).toLocaleString() : '—'}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={WINDOW_COLUMNS.length + 2}>
                    <EmptyState message={localize('com_users_empty')} />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <UsageDetailDialog
        userId={detailId}
        onClose={() => setDetailId(null)}
        canEditLimits={canEditLimits}
      />
      <ScreenReaderAnnouncer message={announcement} />
    </div>
  );
}

function SummaryCard({ label, value, danger = false }: t.UsageSummaryCardProps) {
  return (
    <div className="rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-4">
      <p className="text-xs text-(--cui-color-text-muted)">{label}</p>
      <p
        className={cn(
          'mt-1 text-xl font-semibold tabular-nums',
          danger ? 'text-red-500' : 'text-(--cui-color-text-default)',
        )}
      >
        {value}
      </p>
    </div>
  );
}
