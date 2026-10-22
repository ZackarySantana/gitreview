import { beforeEach, describe, expect, it } from 'vitest';
import fixture from './fixtures/github-pulls.html?raw';
import refreshedFixture from './fixtures/github-pulls-refreshed.html?raw';
import { getRepositoryFromPath, parsePullRequestPage } from '../src/github/parser';

describe('GitHub classic PR list parser', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/acme/widgets/pulls');
    document.documentElement.innerHTML = fixture;
  });

  it('recognizes only repository pull request list paths', () => {
    expect(getRepositoryFromPath('/acme/widgets/pulls')).toBe('acme/widgets');
    expect(getRepositoryFromPath('/acme/widgets/pull/42')).toBeNull();
    expect(getRepositoryFromPath('/pulls')).toBeNull();
  });

  it('extracts stable PR data from the native list', () => {
    const page = parsePullRequestPage(document);

    expect(page?.repository).toBe('acme/widgets');
    expect(page?.currentUser).toBe('alice');
    expect(page?.pullRequests).toHaveLength(2);
    expect(page?.pullRequests[0]).toMatchObject({
      author: 'alice',
      commentCount: 3,
      draft: false,
      labels: [{ color: '1f883d', name: 'backend' }],
      number: 42,
      reviewDecision: 'approved',
      reviewRequests: [],
      title: 'Improve cache behavior',
    });
    expect(page?.pullRequests[1]?.draft).toBe(true);
    expect(page?.pullRequests[1]?.reviewDecision).toBe('review-required');
  });

  it('extracts GitHub pagination without rebuilding its URLs', () => {
    window.history.replaceState({}, '', '/acme/widgets/pulls?q=is%3Apr+is%3Aopen&page=2');
    document.body.insertAdjacentHTML('beforeend', `
      <nav aria-label="Pagination">
        <a href="/acme/widgets/pulls?q=is%3Apr+is%3Aopen&page=1" rel="prev">Previous</a>
        <a href="/acme/widgets/pulls?q=is%3Apr+is%3Aopen&page=1">1</a>
        <em aria-current="page">2</em>
        <a href="/acme/widgets/pulls?q=is%3Apr+is%3Aopen&page=3">3</a>
        <a href="/acme/widgets/pulls?q=is%3Apr+is%3Aopen&page=3" rel="next">Next</a>
      </nav>
    `);

    const pagination = parsePullRequestPage(document)?.pagination;
    expect(pagination).toMatchObject({
      currentPage: 2,
      order: 'newest-first',
      totalPages: 3,
    });
    expect(new URL(pagination?.previousUrl ?? '').searchParams.get('page')).toBe('1');
    expect(new URL(pagination?.nextUrl ?? '').searchParams.get('page')).toBe('3');
  });
});

describe('GitHub refreshed PR list parser', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/acme/widgets/pulls?q=is%3Apr+state%3Aopen&page=2');
    document.documentElement.innerHTML = refreshedFixture;
  });

  it('extracts stable PR data from the React list view', () => {
    const page = parsePullRequestPage(document);

    expect(page?.listElement).toBe(
      document.querySelector('ul[data-listview-component="items-list"]'),
    );
    expect(page?.currentUser).toBe('alice');
    expect(page?.pullRequests).toHaveLength(3);
    expect(page?.pullRequests[0]).toMatchObject({
      author: 'alice',
      commentCount: 3,
      draft: false,
      labels: [{ color: '1f883d', name: 'backend' }],
      number: 42,
      openedAt: '2026-08-01T12:00:00.000Z',
      reviewDecision: 'approved',
      reviewRequests: [],
      title: 'Improve cache behavior',
      url: 'https://github.com/acme/widgets/pull/42',
    });
    expect(page?.pullRequests[1]).toMatchObject({
      commentCount: null,
      draft: true,
      labels: [],
      reviewDecision: 'review-required',
    });
    expect(page?.pullRequests[2]).toMatchObject({
      commentCount: 1204,
      draft: false,
      reviewDecision: 'changes-requested',
    });
  });

  it('skips rows whose timestamp has not hydrated yet', () => {
    document.querySelector('relative-time')?.removeAttribute('datetime');
    const numbers = parsePullRequestPage(document)?.pullRequests.map((pr) => pr.number);
    expect(numbers).toEqual([43, 44]);
  });

  it('extracts Primer pagination', () => {
    const pagination = parsePullRequestPage(document)?.pagination;
    expect(pagination).toMatchObject({
      currentPage: 2,
      order: 'newest-first',
      totalPages: 17,
    });
    expect(new URL(pagination?.previousUrl ?? '').searchParams.get('page')).toBeNull();
    expect(new URL(pagination?.nextUrl ?? '').searchParams.get('page')).toBe('3');
  });
});
