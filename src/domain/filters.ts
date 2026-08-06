import type {
  DraftFilter,
  PullRequestSummary,
  QuickFilter,
  ReviewFilter,
} from '../types';

export interface FilterState {
  currentUser: string | null;
  draftFilter: DraftFilter;
  query: string;
  quickFilters: QuickFilter[];
  requestedFilter: string;
  reviewFilter: ReviewFilter;
}

export const NO_OUTSTANDING_REQUEST_FILTER = 'none:request';

export function filterPullRequests(
  pullRequests: PullRequestSummary[],
  {
    currentUser,
    draftFilter,
    query,
    quickFilters,
    requestedFilter,
    reviewFilter,
  }: FilterState,
): PullRequestSummary[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return pullRequests.filter((pullRequest) => {
    const searchable = [
      pullRequest.title,
      `#${pullRequest.number}`,
      pullRequest.author ?? '',
      ...pullRequest.labels.map((label) => label.name),
      ...pullRequest.reviewRequests.map((request) => request.label),
    ]
      .join(' ')
      .toLocaleLowerCase();

    if (normalizedQuery && !searchable.includes(normalizedQuery)) return false;
    if (quickFilters.includes('mine') && pullRequest.author !== currentUser) return false;
    if (draftFilter === 'draft' && !pullRequest.draft) return false;
    if (draftFilter === 'ready' && pullRequest.draft) return false;
    if (quickFilters.includes('labeled') && pullRequest.labels.length === 0) return false;
    if (
      reviewFilter === 'approved' &&
      (pullRequest.reviewDecision !== 'approved' || pullRequest.reviewRequests.length > 0)
    ) return false;
    if (
      reviewFilter === 'changes-requested' &&
      pullRequest.reviewDecision !== 'changes-requested'
    ) return false;
    if (
      reviewFilter === 'needs-review' &&
      (
        pullRequest.reviewDecision === 'changes-requested' ||
        (
          pullRequest.reviewDecision !== 'review-required' &&
          pullRequest.reviewRequests.length === 0
        )
      )
    ) return false;
    if (
      requestedFilter === NO_OUTSTANDING_REQUEST_FILTER &&
      pullRequest.reviewRequests.length > 0
    ) return false;
    if (
      requestedFilter &&
      requestedFilter !== NO_OUTSTANDING_REQUEST_FILTER &&
      !pullRequest.reviewRequests.some((request) => request.id === requestedFilter)
    ) return false;
    return true;
  });
}
