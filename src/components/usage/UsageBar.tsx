import type * as t from '@/types';
import { formatUsd, isWindowBlocked, usagePercent, USAGE_WINDOW_LABEL_KEYS, cn } from '@/utils';
import { useLocalize } from '@/hooks';

export function UsageBar({ window, compact = false }: t.UsageBarProps) {
  const localize = useLocalize();
  const percent = usagePercent(window);
  const label = localize(USAGE_WINDOW_LABEL_KEYS[window.key]);
  const blocked = isWindowBlocked(window);

  if (percent == null) {
    return (
      <div className="flex flex-col gap-1">
        {!compact && <span className="text-xs text-(--cui-color-text-muted)">{label}</span>}
        <span className="text-xs text-(--cui-color-text-muted)">
          {formatUsd(window.spent)} · {localize('com_usage_no_limit')}
        </span>
      </div>
    );
  }

  const barColor = blocked ? 'bg-red-500' : 'bg-green-600';

  return (
    <div className="flex min-w-32 flex-col gap-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        {!compact && <span className="text-(--cui-color-text-muted)">{label}</span>}
        <span
          className={cn(
            'tabular-nums',
            blocked ? 'font-medium text-red-500' : 'text-(--cui-color-text-default)',
          )}
        >
          {formatUsd(window.spent)} / {formatUsd(window.limit ?? 0)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(percent)}
        className="h-1.5 w-full overflow-hidden rounded-full bg-(--cui-color-background-muted)"
      >
        <div
          className={cn('h-full rounded-full', !blocked && percent >= 80 ? 'bg-amber-500' : barColor)}
          style={{ width: `${percent}%` }}
        />
      </div>
      {blocked && window.resetAt && (
        <span className="text-[11px] text-(--cui-color-text-muted)">
          {localize('com_usage_resets_at', { date: new Date(window.resetAt).toLocaleString() })}
        </span>
      )}
    </div>
  );
}
