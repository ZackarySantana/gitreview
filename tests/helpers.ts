import type { PullRequestSummary } from '../src/types';

export function makePullRequest(
  overrides: Partial<PullRequestSummary> = {},
): PullRequestSummary {
  return {
    author: 'octocat',
    commentCount: 0,
    draft: false,
    labels: [],
    number: 1,
    openedAt: '2026-08-01T12:00:00Z',
    repository: 'acme/widgets',
    reviewDecision: null,
    reviewRequests: [],
    title: 'Improve the review queue',
    url: 'https://github.com/acme/widgets/pull/1',
    ...overrides,
  };
}
