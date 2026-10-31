import { Switch, TextField } from '@clickhouse/click-ui';
import type * as t from '@/types';
import {
  formatUsd,
  parseLimitInput,
  USAGE_WINDOW_KEYS,
  USAGE_WINDOW_RATIOS,
  deriveLimitsFromMonthly,
  USAGE_WINDOW_LABEL_KEYS,
} from '@/utils';
import { useLocalize } from '@/hooks';

const toText = (value: number | null): string => (value == null ? '' : String(value));

/**
 * Three USD inputs (5 h / week / month). In auto mode only the monthly cap is
 * editable and the other windows follow {@link USAGE_WINDOW_RATIOS}.
 */
export function UsageLimitsInputs({
  values,
  onChange,
  auto,
  onAutoChange,
  disabled = false,
  placeholder,
}: t.UsageLimitsInputsProps) {
  const localize = useLocalize();

  const withDerived = (monthlyText: string): Record<t.UsageWindowKey, string> => {
    const monthly = parseLimitInput(monthlyText);
    if (monthly == null) {
      return { fiveHour: '', weekly: '', monthly: monthlyText };
    }
    const derived = deriveLimitsFromMonthly(monthly);
    return { fiveHour: toText(derived.fiveHour), weekly: toText(derived.weekly), monthly: monthlyText };
  };

  const handleChange = (key: t.UsageWindowKey, value: string) => {
    if (auto && key === 'monthly') {
      onChange(withDerived(value));
      return;
    }
    onChange({ ...values, [key]: value });
  };

  const handleAutoChange = (next: boolean) => {
    onAutoChange(next);
    if (next) onChange(withDerived(values.monthly));
  };

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-center gap-2 text-xs text-(--cui-color-text-default)">
        <Switch
          checked={auto}
          onCheckedChange={handleAutoChange}
          disabled={disabled}
          aria-label={localize('com_usage_auto_ratio')}
        />
        {localize('com_usage_auto_ratio_desc', {
          fiveHour: Math.round(USAGE_WINDOW_RATIOS.fiveHour * 100),
          weekly: Math.round(USAGE_WINDOW_RATIOS.weekly * 100),
        })}
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {USAGE_WINDOW_KEYS.map((key) => {
          const parsed = parseLimitInput(values[key]);
          const derivedLocked = auto && key !== 'monthly';
          return (
            <TextField
              key={key}
              label={`${localize(USAGE_WINDOW_LABEL_KEYS[key])} (USD)`}
              placeholder={placeholder ?? localize('com_ui_enter_value')}
              value={values[key]}
              disabled={disabled || derivedLocked}
              onChange={(value: string) => handleChange(key, value)}
              error={parsed === undefined ? localize('com_usage_invalid_amount') : undefined}
            />
          );
        })}
      </div>
      {auto && parseLimitInput(values.monthly) != null && (
        <p className="text-xs text-(--cui-color-text-muted)">
          {localize('com_usage_auto_preview', {
            fiveHour: formatUsd(Number(values.fiveHour || 0)),
            weekly: formatUsd(Number(values.weekly || 0)),
          })}
        </p>
      )}
    </div>
  );
}
