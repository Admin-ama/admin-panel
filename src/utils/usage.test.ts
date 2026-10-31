import { describe, it, expect } from 'vitest';
import type * as t from '@/types';
import {
  usagePercent,
  isUserBlocked,
  parseLimitInput,
  filterAndSortUsage,
  toUsageLimitsOverride,
} from './usage';

const makeUser = (
  name: string,
  monthly: number,
  overrides: Partial<t.UsageUser> = {},
): t.UsageUser => ({
  id: name,
  name,
  email: `${name.toLowerCase()}@ama.test`,
  role: 'USER',
  lastUsedAt: null,
  enabled: true,
  windows: [
    { key: 'fiveHour', spent: 0, limit: 2, resetAt: null },
    { key: 'weekly', spent: monthly / 2, limit: 5, resetAt: null },
    { key: 'monthly', spent: monthly, limit: 10, resetAt: null },
  ],
  ...overrides,
});

describe('usagePercent', () => {
  it('returns null for uncapped windows and clamps to 0–100', () => {
    expect(usagePercent({ key: 'weekly', spent: 3, limit: null, resetAt: null })).toBeNull();
    expect(usagePercent({ key: 'weekly', spent: 2.5, limit: 5, resetAt: null })).toBe(50);
    expect(usagePercent({ key: 'weekly', spent: 9, limit: 5, resetAt: null })).toBe(100);
    expect(usagePercent({ key: 'weekly', spent: 0, limit: 0, resetAt: null })).toBe(100);
  });
});

describe('isUserBlocked', () => {
  it('is true only when limits are enforced and a window is at its cap', () => {
    expect(isUserBlocked(makeUser('Ana', 10))).toBe(true);
    expect(isUserBlocked(makeUser('Ana', 9.99))).toBe(false);
    expect(isUserBlocked(makeUser('Ana', 10, { enabled: false }))).toBe(false);
  });
});

describe('filterAndSortUsage', () => {
  const users = [makeUser('Bruno', 1), makeUser('ana', 7), makeUser('Carla', 4)];

  it('sorts by spend descending for a window', () => {
    expect(filterAndSortUsage(users, '', 'monthly').map((u) => u.name)).toEqual([
      'ana',
      'Carla',
      'Bruno',
    ]);
  });

  it('sorts by name and filters by name or email, case-insensitively', () => {
    expect(filterAndSortUsage(users, '', 'name').map((u) => u.name)).toEqual([
      'ana',
      'Bruno',
      'Carla',
    ]);
    expect(filterAndSortUsage(users, 'CARLA@', 'monthly').map((u) => u.name)).toEqual(['Carla']);
  });
});

describe('toUsageLimitsOverride', () => {
  it('maps absent or invalid fields to inherit', () => {
    expect(toUsageLimitsOverride(undefined)).toEqual({
      enabled: null,
      fiveHour: null,
      weekly: null,
      monthly: null,
    });
    expect(toUsageLimitsOverride({ enabled: false, monthly: 20, weekly: -1 })).toEqual({
      enabled: false,
      fiveHour: null,
      weekly: null,
      monthly: 20,
    });
  });
});

describe('parseLimitInput', () => {
  it('treats empty as inherit, accepts comma decimals and rejects negatives', () => {
    expect(parseLimitInput('  ')).toBeNull();
    expect(parseLimitInput('2,5')).toBe(2.5);
    expect(parseLimitInput('10')).toBe(10);
    expect(parseLimitInput('-1')).toBeUndefined();
    expect(parseLimitInput('abc')).toBeUndefined();
  });
});
