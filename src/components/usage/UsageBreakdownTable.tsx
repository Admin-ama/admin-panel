import type * as t from '@/types';
import { EmptyState } from '@/components/shared';
import { useLocalize } from '@/hooks';
import { formatUsd } from '@/utils';

const numberFormatter = new Intl.NumberFormat();

export function UsageBreakdownTable({ titleKey, keyLabelKey, rows }: t.UsageBreakdownTableProps) {
  const localize = useLocalize();
  const headerClass = 'px-3 py-2 font-medium text-(--cui-color-text-muted)';

  return (
    <section aria-label={localize(titleKey)} className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-(--cui-color-text-default)">{localize(titleKey)}</h3>
      <div className="max-h-56 overflow-auto rounded-lg border border-(--cui-color-stroke-default)">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-(--cui-color-background-muted)">
            <tr>
              <th scope="col" className={headerClass}>
                {localize(keyLabelKey)}
              </th>
              <th scope="col" className={`${headerClass} text-right`}>
                {localize('com_usage_col_requests')}
              </th>
              <th scope="col" className={`${headerClass} text-right`}>
                {localize('com_usage_col_tokens')}
              </th>
              <th scope="col" className={`${headerClass} text-right`}>
                {localize('com_usage_col_spent')}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-(--cui-color-stroke-default)">
                <td className="px-3 py-1.5 break-all text-(--cui-color-text-default)">{row.key}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {numberFormatter.format(row.requests)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {numberFormatter.format(row.inputTokens + row.outputTokens)}
                </td>
                <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                  {formatUsd(row.spent)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState message={localize('com_usage_no_activity')} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
