import { describe, expect, it } from 'vitest';
import { buildZones, formatThreshold, getAgeHours } from '../src/domain/zones';
import { makePullRequest } from './helpers';

const NOW = Date.parse('2026-08-10T12:00:00Z');

function openedHoursAgo(hours: number): string {
  return new Date(NOW - hours * 60 * 60 * 1000).toISOString();
}

describe('buildZones', () => {
  it('groups PRs into the four default age ranges and orders oldest first', () => {
    const zones = buildZones([
      makePullRequest({ number: 1, openedAt: openedHoursAgo(12) }),
      makePullRequest({ number: 2, openedAt: openedHoursAgo(30) }),
      makePullRequest({ number: 3, openedAt: openedHoursAgo(72) }),
      makePullRequest({ number: 4, openedAt: openedHoursAgo(200) }),
      makePullRequest({ number: 5, openedAt: openedHoursAgo(300) }),
    ], [24, 48, 168], NOW);

    expect(zones.map((zone) => zone.id)).toEqual(['overdue', 'aging', 'recent', 'new']);
    expect(zones[0]?.pullRequests.map((pullRequest) => pullRequest.number)).toEqual([5, 4]);
  });

  it('omits empty zones and places exact boundaries in the older range', () => {
    const zones = buildZones([
      makePullRequest({ openedAt: openedHoursAgo(24) }),
    ], [24, 48, 168], NOW);

    expect(zones).toHaveLength(1);
    expect(zones[0]?.id).toBe('recent');
  });

  it('does not group invalid or future timestamps', () => {
    const zones = buildZones([
      makePullRequest({ openedAt: 'invalid' }),
      makePullRequest({ number: 2, openedAt: new Date(NOW + 1_000).toISOString() }),
    ], [24, 48, 168], NOW);

    expect(zones).toEqual([]);
    expect(getAgeHours('invalid', NOW)).toBeNull();
  });
});

describe('formatThreshold', () => {
  it('uses readable units', () => {
    expect(formatThreshold(12)).toBe('12 hours');
    expect(formatThreshold(24)).toBe('1 day');
    expect(formatThreshold(168)).toBe('1 week');
  });
});
