import { Dialog } from '@clickhouse/click-ui';
import { useQuery } from '@tanstack/react-query';
import type * as t from '@/types';
import { Avatar, LoadingState } from '@/components/shared';
import { UsageBreakdownTable } from './UsageBreakdownTable';
import { usageDetailQueryOptions } from '@/server';
import { UsageLimitsForm } from './UsageLimitsForm';
import { useLocalize } from '@/hooks';
import { UsageBar } from './UsageBar';

export function UsageDetailDialog({ userId, onClose, canEditLimits }: t.UsageDetailDialogProps) {
  const localize = useLocalize();
  const { data: detail, isLoading } = useQuery({
    ...usageDetailQueryOptions(userId ?? ''),
    enabled: userId != null,
  });

  return (
    <Dialog
      open={userId != null}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <Dialog.Content
        title={localize('com_usage_detail_title')}
        showClose
        onClose={onClose}
        className="modal-frost max-w-2xl!"
      >
        {isLoading && <LoadingState />}
        {detail && userId && (
          <div className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <Avatar name={detail.name} />
              <div className="flex flex-col">
                <span className="font-medium text-(--cui-color-text-default)">{detail.name}</span>
                <span className="text-xs text-(--cui-color-text-muted)">{detail.email}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {detail.windows.map((window) => (
                <UsageBar key={window.key} window={window} />
              ))}
            </div>
            {!detail.enabled && (
              <p className="text-xs text-(--cui-color-text-muted)">
                {localize('com_usage_not_enforced')}
              </p>
            )}

            <UsageBreakdownTable
              titleKey="com_usage_by_model"
              keyLabelKey="com_usage_col_model"
              rows={detail.byModel}
            />
            <UsageBreakdownTable
              titleKey="com_usage_by_day"
              keyLabelKey="com_usage_col_day"
              rows={detail.byDay}
            />

            <UsageLimitsForm userId={userId} canEdit={canEditLimits} />
          </div>
        )}
      </Dialog.Content>
    </Dialog>
  );
}
