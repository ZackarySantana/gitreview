import { beforeEach, describe, expect, it } from 'vitest';
import fixture from './fixtures/github-pulls.html?raw';
import { getRepositoryFromPath, parsePullRequestPage } from '../src/github/parser';

describe('GitHub PR parser', () => {
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
