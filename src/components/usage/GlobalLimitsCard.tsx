import { useEffect, useMemo, useState } from 'react';
import { Button } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type * as t from '@/types';
import {
  formatLimits,
  notifyError,
  notifySuccess,
  parseLimitInput,
  USAGE_WINDOW_KEYS,
  deriveLimitsFromMonthly,
} from '@/utils';
import { globalUsageLimitsQueryOptions, saveGlobalUsageLimitsFn } from '@/server';
import { ConfirmDialog } from '@/components/access';
import { UsageLimitsInputs } from './UsageLimitsInputs';
import { useLocalize } from '@/hooks';

const QUICK_STEPS = [5, 10, 20];

const toTexts = (limits: t.UsageLimits): Record<t.UsageWindowKey, string> => ({
  fiveHour: limits.fiveHour == null ? '' : String(limits.fiveHour),
  weekly: limits.weekly == null ? '' : String(limits.weekly),
  monthly: limits.monthly == null ? '' : String(limits.monthly),
});

export function GlobalLimitsCard({ users, exceptions, canEdit }: t.GlobalLimitsCardProps) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { data: current } = useQuery(globalUsageLimitsQueryOptions);
  const [auto, setAuto] = useState(true);
  const [values, setValues] = useState<Record<t.UsageWindowKey, string>>({
    fiveHour: '',
    weekly: '',
    monthly: '',
  });
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    if (current) setValues(toTexts(current));
  }, [current]);

  const parsed = Object.fromEntries(
    USAGE_WINDOW_KEYS.map((key) => [key, parseLimitInput(values[key])]),
  ) as Record<t.UsageWindowKey, number | null | undefined>;
  const next: t.UsageLimits | null = USAGE_WINDOW_KEYS.every((key) => parsed[key] != null)
    ? { fiveHour: parsed.fiveHour ?? 0, weekly: parsed.weekly ?? 0, monthly: parsed.monthly ?? 0 }
    : null;
  const unchanged =
    next != null &&
    current != null &&
    USAGE_WINDOW_KEYS.every((key) => next[key] === current[key]);

  const counts = useMemo(
    () =>
      users.reduce(
        (acc, user) => {
          if (exceptions.users[user.id]) return { ...acc, custom: acc.custom + 1 };
          if (!user.enabled) return { ...acc, unlimited: acc.unlimited + 1 };
          return { ...acc, affected: acc.affected + 1 };
        },
        { affected: 0, custom: 0, unlimited: 0 },
      ),
    [users, exceptions],
  );

  const mutation = useMutation({
    mutationFn: (limits: t.UsageLimits) =>
      saveGlobalUsageLimitsFn({
        data: {
          fiveHour: limits.fiveHour ?? 0,
          weekly: limits.weekly ?? 0,
          monthly: limits.monthly ?? 0,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usageGlobal'] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      notifySuccess(localize('com_usage_global_saved'));
      setConfirmOpen(false);
    },
    onError: (err: Error) => notifyError(err.message),
  });

  const bump = (step: number) => {
    const monthly = (parsed.monthly ?? current?.monthly ?? 0) + step;
    if (auto) {
      setValues(toTexts(deriveLimitsFromMonthly(monthly)));
      return;
    }
    setValues((prev) => ({ ...prev, monthly: String(monthly) }));
  };

  return (
    <section
      aria-label={localize('com_usage_global_title')}
      className="flex flex-col gap-4 rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-medium text-(--cui-color-text-default)">
            {localize('com_usage_global_title')}
          </h2>
          <p className="text-xs text-(--cui-color-text-muted)">
            {localize('com_usage_global_current', {
              limits: current ? formatLimits(current) : '—',
            })}
          </p>
        </div>
        <div className="flex gap-1" role="group" aria-label={localize('com_usage_quick_raise')}>
          {QUICK_STEPS.map((step) => (
            <button
              key={step}
              type="button"
              disabled={!canEdit}
              onClick={() => bump(step)}
              className="rounded-md border border-(--cui-color-stroke-default) px-2.5 py-1 text-xs font-medium text-(--cui-color-text-default) transition-colors hover:bg-(--cui-color-background-hover) disabled:cursor-not-allowed disabled:opacity-50"
            >
              +{step} USD
            </button>
          ))}
        </div>
      </div>

      <UsageLimitsInputs
        values={values}
        onChange={setValues}
        auto={auto}
        onAutoChange={setAuto}
        disabled={!canEdit}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-(--cui-color-text-muted)">
          {localize('com_usage_global_scope', counts)}
        </p>
        <Button
          type="primary"
          label={localize('com_ui_save')}
          disabled={!canEdit || next == null || unchanged || mutation.isPending}
          onClick={() => setConfirmOpen(true)}
        />
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={localize('com_usage_global_confirm_title')}
        description={localize('com_usage_global_confirm_desc', {
          from: current ? formatLimits(current) : '—',
          to: next ? formatLimits(next) : '—',
          affected: counts.affected,
          custom: counts.custom,
        })}
        confirmLabel={localize('com_ui_save')}
        confirmType="primary"
        saving={mutation.isPending}
        onConfirm={() => {
          if (next) mutation.mutate(next);
        }}
        onCancel={() => setConfirmOpen(false)}
      />
    </section>
  );
}
