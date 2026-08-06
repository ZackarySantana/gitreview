import type { DraftFilter, QuickFilter, ReviewFilter } from '../types';

export interface QueueFilterState {
  draftFilter: DraftFilter;
  query: string;
  quickFilters: QuickFilter[];
  requestedFilter: string;
  reviewFilter: ReviewFilter;
}

export const DEFAULT_QUEUE_FILTERS: QueueFilterState = {
  draftFilter: 'ready',
  query: '',
  quickFilters: [],
  requestedFilter: '',
  reviewFilter: 'needs-review',
};

const draftFilters = new Set<DraftFilter>(['all', 'draft', 'ready']);
const quickFilters = new Set<QuickFilter>(['labeled', 'mine']);
const reviewFilters = new Set<ReviewFilter>([
  'all',
  'approved',
  'changes-requested',
  'needs-review',
]);

export function getQueueFilterStorageKey(repository: string, currentUrl: string): string {
  const url = new URL(currentUrl);
  url.searchParams.delete('after');
  url.searchParams.delete('before');
  url.searchParams.delete('page');
  return `gitreview:filters:${repository}:${url.searchParams.toString()}`;
}

export function loadQueueFilters(key: string): QueueFilterState {
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) ?? 'null') as Partial<QueueFilterState> | null;
    if (!value || typeof value !== 'object') return DEFAULT_QUEUE_FILTERS;
    return {
      draftFilter: draftFilters.has(value.draftFilter as DraftFilter)
        ? value.draftFilter as DraftFilter
        : DEFAULT_QUEUE_FILTERS.draftFilter,
      query: typeof value.query === 'string' ? value.query : '',
      quickFilters: Array.isArray(value.quickFilters)
        ? [...new Set(value.quickFilters.filter((filter) => quickFilters.has(filter)))]
        : [],
      requestedFilter: typeof value.requestedFilter === 'string' ? value.requestedFilter : '',
      reviewFilter: reviewFilters.has(value.reviewFilter as ReviewFilter)
        ? value.reviewFilter as ReviewFilter
        : DEFAULT_QUEUE_FILTERS.reviewFilter,
    };
  } catch {
    return DEFAULT_QUEUE_FILTERS;
  }
}

export function saveQueueFilters(key: string, filters: QueueFilterState): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(filters));
  } catch {
    // Queue filtering still works when session storage is unavailable.
  }
}
