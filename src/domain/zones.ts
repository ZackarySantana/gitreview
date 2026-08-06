import type { PullRequestSummary, PullRequestZone, Settings, ZoneId } from '../types';

const HOUR_MS = 60 * 60 * 1000;

interface ZoneDefinition {
  description: string;
  id: ZoneId;
  label: string;
}

export function getAgeHours(openedAt: string, now: number): number | null {
  const timestamp = Date.parse(openedAt);
  if (!Number.isFinite(timestamp) || timestamp > now) return null;
  return (now - timestamp) / HOUR_MS;
}

export function formatDuration(hours: number): string {
  if (hours < 1) return 'less than an hour';
  if (hours < 24) return `${Math.floor(hours)}h`;

  const days = Math.floor(hours / 24);
  if (days < 14) return `${days}d`;

  const weeks = Math.floor(days / 7);
  return `${weeks}w`;
}

export function formatThreshold(hours: number): string {
  if (hours % 168 === 0) {
    const weeks = hours / 168;
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'}`;
  }
  if (hours % 24 === 0) {
    const days = hours / 24;
    return `${days} ${days === 1 ? 'day' : 'days'}`;
  }
  return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
}

export function buildZones(
  pullRequests: PullRequestSummary[],
  thresholds: Settings['thresholds'],
  now = Date.now(),
): PullRequestZone[] {
  const [freshLimit, recentLimit, agingLimit] = thresholds;
  const definitions: ZoneDefinition[] = [
    { id: 'overdue', label: 'Overdue', description: `${formatThreshold(agingLimit)} or older` },
    {
      id: 'aging',
      label: 'Aging',
      description: `${formatThreshold(recentLimit)} to ${formatThreshold(agingLimit)}`,
    },
    {
      id: 'recent',
      label: 'Waiting',
      description: `${formatThreshold(freshLimit)} to ${formatThreshold(recentLimit)}`,
    },
    { id: 'new', label: 'New', description: `Under ${formatThreshold(freshLimit)}` },
  ];

  const grouped = new Map<ZoneId, PullRequestSummary[]>();
  for (const definition of definitions) grouped.set(definition.id, []);

  for (const pullRequest of pullRequests) {
    const age = getAgeHours(pullRequest.openedAt, now);
    if (age === null) continue;

    const zoneId: ZoneId =
      age >= agingLimit
        ? 'overdue'
        : age >= recentLimit
          ? 'aging'
          : age >= freshLimit
            ? 'recent'
            : 'new';
    grouped.get(zoneId)?.push(pullRequest);
  }

  return definitions
    .map((definition) => ({
      ...definition,
      pullRequests: [...(grouped.get(definition.id) ?? [])].sort(
        (left, right) => Date.parse(left.openedAt) - Date.parse(right.openedAt),
      ),
    }))
    .filter((zone) => zone.pullRequests.length > 0);
}
