/**
 * Server functions for the usage (spend limits) module.
 *
 * Reads rolling-window spend from the AMA LibreChat fork's `/api/admin/usage`
 * endpoints and edits per-user caps as `usageLimits.*` user-scope config overrides.
 */

import { z } from 'zod';
import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { PrincipalType } from 'librechat-data-provider';
import { SystemCapabilities } from '@librechat/data-schemas/capabilities';
import type { AdminConfigResponse } from '@librechat/data-schemas';
import type * as t from '@/types';
import { USAGE_LIMIT_FIELDS, toUsageLimitsOverride } from '@/utils/usage';
import { requireAnyCapability } from './capabilities';
import { apiFetch, extractApiError } from './utils/api';

const userConfigPath = (id: string) =>
  `/api/admin/config/${PrincipalType.USER}/${encodeURIComponent(id)}`;

export const getUsageListFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<t.UsageListResponse> => {
    const response = await apiFetch('/api/admin/usage?limit=200');
    if (!response.ok) {
      await extractApiError(response, 'Failed to fetch usage');
    }
    return (await response.json()) as t.UsageListResponse;
  },
);

export const usageListQueryOptions = queryOptions({
  queryKey: ['usage'],
  queryFn: () => getUsageListFn(),
  staleTime: 30_000,
  refetchInterval: 60_000,
});

export const getUsageDetailFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<t.UsageDetail> => {
    const response = await apiFetch(`/api/admin/usage/${encodeURIComponent(data.id)}`);
    if (!response.ok) {
      await extractApiError(response, 'Failed to fetch user usage');
    }
    return (await response.json()) as t.UsageDetail;
  });

export const usageDetailQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['usage', id],
    queryFn: () => getUsageDetailFn({ data: { id } }),
    staleTime: 30_000,
  });

export const getUserUsageLimitsFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ id: z.string().min(1) }))
  .handler(async ({ data }): Promise<t.UsageLimitsOverride> => {
    const response = await apiFetch(userConfigPath(data.id));
    if (response.status === 404) {
      return toUsageLimitsOverride(undefined);
    }
    if (!response.ok) {
      await extractApiError(response, 'Failed to fetch user limits');
    }
    const { config } = (await response.json()) as AdminConfigResponse;
    const overrides = config.overrides as { usageLimits?: Partial<t.UsageLimitsOverride> };
    return toUsageLimitsOverride(overrides?.usageLimits);
  });

export const userUsageLimitsQueryOptions = (id: string) =>
  queryOptions({
    queryKey: ['usageLimits', id],
    queryFn: () => getUserUsageLimitsFn({ data: { id } }),
  });

const limitValue = z.number().nonnegative().nullable();

/**
 * Writes set values as `usageLimits.<field>` overrides on the user scope and
 * removes the override for `null` values so they inherit again.
 */
export const saveUserUsageLimitsFn = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      id: z.string().min(1),
      limits: z.object({
        enabled: z.boolean().nullable(),
        fiveHour: limitValue,
        weekly: limitValue,
        monthly: limitValue,
      }),
    }),
  )
  .handler(async ({ data }): Promise<{ success: true }> => {
    await requireAnyCapability([
      SystemCapabilities.ASSIGN_CONFIGS,
      SystemCapabilities.MANAGE_CONFIGS,
    ]);
    const path = userConfigPath(data.id);
    const entries = USAGE_LIMIT_FIELDS.filter((field) => data.limits[field] != null).map(
      (field) => ({ fieldPath: `usageLimits.${field}`, value: data.limits[field] }),
    );
    const removals = USAGE_LIMIT_FIELDS.filter((field) => data.limits[field] == null);

    if (entries.length > 0) {
      const response = await apiFetch(`${path}/fields`, {
        method: 'PATCH',
        body: JSON.stringify({ entries }),
      });
      if (!response.ok) {
        await extractApiError(response, 'Failed to save user limits');
      }
    }

    for (const field of removals) {
      const fieldPath = encodeURIComponent(`usageLimits.${field}`);
      const response = await apiFetch(`${path}/fields?fieldPath=${fieldPath}`, {
        method: 'DELETE',
      });
      if (!response.ok && response.status !== 404) {
        await extractApiError(response, 'Failed to clear user limit');
      }
    }
    return { success: true };
  });
