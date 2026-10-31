import { useEffect, useState } from 'react';
import { Button } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type * as t from '@/types';
import {
  cn,
  notifyError,
  notifySuccess,
  parseLimitInput,
  USAGE_WINDOW_KEYS,
  deriveLimitsFromMonthly,
} from '@/utils';
import { saveUserUsageLimitsFn, userUsageLimitsQueryOptions } from '@/server';
import { UsageLimitsInputs } from './UsageLimitsInputs';
import { useLocalize } from '@/hooks';

type EnabledChoice = 'inherit' | 'on' | 'off';

const ENABLED_LABEL_KEYS: Record<EnabledChoice, string> = {
  inherit: 'com_usage_inherit',
  on: 'com_usage_enforced',
  off: 'com_usage_unlimited',
};

const toChoice = (enabled: boolean | null): EnabledChoice => {
  if (enabled == null) return 'inherit';
  return enabled ? 'on' : 'off';
};

const fromChoice = (choice: EnabledChoice): boolean | null =>
  choice === 'inherit' ? null : choice === 'on';

const toText = (value: number | null): string => (value == null ? '' : String(value));

/** Auto mode fits when only the monthly cap is set or all windows follow the ratio rule. */
const followsRatio = (stored: t.UsageLimitsOverride): boolean => {
  if (stored.monthly == null) return stored.fiveHour == null && stored.weekly == null;
  const derived = deriveLimitsFromMonthly(stored.monthly);
  return stored.fiveHour === derived.fiveHour && stored.weekly === derived.weekly;
};

export function UsageLimitsForm({ userId, canEdit }: t.UsageLimitsFormProps) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const { data: stored } = useQuery(userUsageLimitsQueryOptions(userId));
  const [choice, setChoice] = useState<EnabledChoice>('inherit');
  const [auto, setAuto] = useState(true);
  const [amounts, setAmounts] = useState<Record<t.UsageWindowKey, string>>({
    fiveHour: '',
    weekly: '',
    monthly: '',
  });

  useEffect(() => {
    if (!stored) return;
    setChoice(toChoice(stored.enabled));
    setAuto(followsRatio(stored));
    setAmounts({
      fiveHour: toText(stored.fiveHour),
      weekly: toText(stored.weekly),
      monthly: toText(stored.monthly),
    });
  }, [stored]);

  const parsed = Object.fromEntries(
    USAGE_WINDOW_KEYS.map((key) => [key, parseLimitInput(amounts[key])]),
  ) as Record<t.UsageWindowKey, number | null | undefined>;
  const invalid = USAGE_WINDOW_KEYS.some((key) => parsed[key] === undefined);

  const mutation = useMutation({
    mutationFn: () =>
      saveUserUsageLimitsFn({
        data: {
          id: userId,
          limits: {
            enabled: fromChoice(choice),
            fiveHour: parsed.fiveHour ?? null,
            weekly: parsed.weekly ?? null,
            monthly: parsed.monthly ?? null,
          },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['usageLimits', userId] });
      queryClient.invalidateQueries({ queryKey: ['usage'] });
      queryClient.invalidateQueries({ queryKey: ['availableScopes'] });
      queryClient.invalidateQueries({ queryKey: ['usageExceptions'] });
      notifySuccess(localize('com_usage_limits_saved'));
    },
    onError: (err: Error) => notifyError(err.message),
  });

  return (
    <section aria-label={localize('com_usage_limits_title')} className="flex flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium text-(--cui-color-text-default)">
          {localize('com_usage_limits_title')}
        </h3>
        <p className="text-xs text-(--cui-color-text-muted)">{localize('com_usage_limits_desc')}</p>
      </div>

      <div className="flex gap-1" role="group" aria-label={localize('com_usage_limits_mode')}>
        {(Object.keys(ENABLED_LABEL_KEYS) as EnabledChoice[]).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={choice === option}
            disabled={!canEdit}
            onClick={() => setChoice(option)}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
              choice === option
                ? 'bg-(--cui-color-background-active) text-(--cui-color-text-default)'
                : 'text-(--cui-color-text-muted) hover:bg-(--cui-color-background-hover) hover:text-(--cui-color-text-default)',
            )}
          >
            {localize(ENABLED_LABEL_KEYS[option])}
          </button>
        ))}
      </div>

      <UsageLimitsInputs
        values={amounts}
        onChange={setAmounts}
        auto={auto}
        onAutoChange={setAuto}
        disabled={!canEdit || choice === 'off'}
        placeholder={localize('com_usage_inherit')}
      />

      <div className="flex justify-end">
        <Button
          type="primary"
          label={localize('com_ui_save')}
          disabled={!canEdit || invalid || mutation.isPending}
          onClick={() => mutation.mutate()}
        />
      </div>
    </section>
  );
}
