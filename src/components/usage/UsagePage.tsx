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
import { cn, filterAndSortUsage, formatUsd, getWindow, isUserBlocked } from '@/utils';
import { useAnnouncement, useCapabilities, useLocalize } from '@/hooks';
import { UsageDetailDialog } from './UsageDetailDialog';
import { usageListQueryOptions } from '@/server';
import { SystemCapabilities } from '@/constants';
import { UsageBar } from './UsageBar';

const SORT_LABEL_KEYS: Record<t.UsageSort, string> = {
  monthly: 'com_usage_window_monthly',
  weekly: 'com_usage_window_weekly',
  fiveHour: 'com_usage_window_five_hour',
  name: 'com_usage_sort_name',
};

const WINDOW_COLUMNS: t.UsageWindowKey[] = ['fiveHour', 'weekly', 'monthly'];

export function UsagePage() {
  const localize = useLocalize();
  const { hasCapability } = useCapabilities();
  const canEditLimits =
    hasCapability(SystemCapabilities.ASSIGN_CONFIGS) ||
    hasCapability(SystemCapabilities.MANAGE_CONFIGS);
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<t.UsageSort>('monthly');
  const [detailId, setDetailId] = useState<string | null>(null);
  const { message: announcement, announce } = useAnnouncement();
  const { data, isLoading, isError, error } = useQuery(usageListQueryOptions);

  const users = useMemo(() => data?.users ?? [], [data]);
  const visible = useMemo(() => filterAndSortUsage(users, search, sort), [users, search, sort]);
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
