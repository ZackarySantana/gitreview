import type { ReviewRequest } from '../types';

export interface RequestedReviewersPayload {
  teams?: Array<{ slug?: string }>;
  users?: Array<{ login?: string }>;
}

export function mapRequestedReviewers(
  owner: string,
  payload: RequestedReviewersPayload,
): ReviewRequest[] {
  const teams: ReviewRequest[] = (payload.teams ?? []).flatMap((team) => {
    if (!team.slug) return [];
    const slug = `${owner}/${team.slug}`;
    return [{ id: `team:${slug}`, label: `@${slug}`, type: 'team' }];
  });
  const users: ReviewRequest[] = (payload.users ?? []).flatMap((user) => {
    if (!user.login) return [];
    return [{ id: `user:${user.login}`, label: `@${user.login}`, type: 'user' }];
  });
  return [...teams, ...users];
}
