import { describe, expect, it } from 'vitest';
import {
  filterPullRequests,
  NO_OUTSTANDING_REQUEST_FILTER,
  type FilterState,
} from '../src/domain/filters';
import { makePullRequest } from './helpers';

describe('filterPullRequests', () => {
  const pullRequests = [
    makePullRequest({ author: 'alice', labels: [{ color: null, name: 'backend' }], number: 42 }),
    makePullRequest({ author: 'bob', draft: true, number: 77, title: 'Draft the new interface' }),
  ];

  it('searches titles, numbers, authors, and labels', () => {
    for (const query of ['interface', '#42', 'alice', 'backend']) {
      expect(filterPullRequests(pullRequests, {
        currentUser: 'alice',
        draftFilter: 'all',
        query,
        quickFilters: [],
        requestedFilter: '',
        reviewFilter: 'all',
      })).toHaveLength(1);
    }
  });

  it('combines quick filters', () => {
    expect(filterPullRequests(pullRequests, {
      currentUser: 'alice',
      draftFilter: 'ready',
      query: '',
      quickFilters: ['mine', 'labeled'],
      requestedFilter: '',
      reviewFilter: 'all',
    })).toEqual([pullRequests[0]]);
  });

  it('filters by an outstanding user or team request', () => {
    const requested = makePullRequest({
      reviewRequests: [{ id: 'team:acme/platform', label: '@acme/platform', type: 'team' }],
    });
    expect(filterPullRequests([requested, pullRequests[1]!], {
      currentUser: 'alice',
      draftFilter: 'all',
      query: '',
      quickFilters: [],
      requestedFilter: 'team:acme/platform',
      reviewFilter: 'all',
    })).toEqual([requested]);
  });

  it('filters PRs without any outstanding review request', () => {
    const teamRequested = makePullRequest({
      number: 1,
      reviewRequests: [{ id: 'team:acme/platform', label: '@acme/platform', type: 'team' }],
    });
    const userRequested = makePullRequest({
      number: 2,
      reviewRequests: [{ id: 'user:alice', label: '@alice', type: 'user' }],
    });
    const nobodyRequested = makePullRequest({ number: 3 });

    expect(filterPullRequests([teamRequested, userRequested, nobodyRequested], {
      currentUser: 'alice',
      draftFilter: 'all',
      query: '',
      quickFilters: [],
      requestedFilter: NO_OUTSTANDING_REQUEST_FILTER,
      reviewFilter: 'all',
    })).toEqual([nobodyRequested]);
  });

  it('keeps aggregate review filters exclusive', () => {
    const approved = makePullRequest({ reviewDecision: 'approved' });
    const approvedRequested = makePullRequest({
      number: 2,
      reviewDecision: 'approved',
      reviewRequests: [{ id: 'user:alice', label: '@alice', type: 'user' }],
    });
    const changes = makePullRequest({
      number: 3,
      reviewDecision: 'changes-requested',
    });
    const required = makePullRequest({
      number: 4,
      reviewDecision: 'review-required',
    });
    const requested = makePullRequest({
      number: 5,
      reviewRequests: [{ id: 'user:alice', label: '@alice', type: 'user' }],
    });
    const undecided = makePullRequest({ number: 6 });
    const pullRequests = [approved, approvedRequested, changes, required, requested, undecided];
    const filterState: Omit<FilterState, 'reviewFilter'> = {
      currentUser: 'alice',
      draftFilter: 'all',
      query: '',
      quickFilters: [],
      requestedFilter: '',
    };

    expect(filterPullRequests(pullRequests, {
      ...filterState,
      reviewFilter: 'needs-review',
    })).toEqual([approvedRequested, required, requested]);
    expect(filterPullRequests(pullRequests, {
      ...filterState,
      reviewFilter: 'changes-requested',
    })).toEqual([changes]);
    expect(filterPullRequests(pullRequests, {
      ...filterState,
      reviewFilter: 'approved',
    })).toEqual([approved]);
  });
});
