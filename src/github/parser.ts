import type {
  LabelSummary,
  PullRequestPagination,
  PullRequestSummary,
  ReviewDecision,
} from '../types';

const ROW_SELECTORS = ['.js-issue-row', '[data-testid="issue-row"]', '[id^="issue_"]'];

export interface ParsedPullRequestPage {
  currentUser: string | null;
  listElement: HTMLElement;
  pagination: PullRequestPagination | null;
  pullRequests: PullRequestSummary[];
  repository: string;
}

export function getRepositoryFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/([^/]+)\/([^/]+)\/pulls\/?$/);
  return match ? `${match[1]}/${match[2]}` : null;
}

function queryRows(document: Document): HTMLElement[] {
  const rows = ROW_SELECTORS.flatMap((selector) =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)),
  );
  return [...new Set(rows)].filter((row) => row.querySelector('a[href*="/pull/"]'));
}

function findListElement(document: Document, rows: HTMLElement[]): HTMLElement | null {
  const firstRow = rows[0];
  if (firstRow) {
    return (
      firstRow.closest<HTMLElement>('.js-navigation-container') ??
      firstRow.closest<HTMLElement>('[data-testid="issue-list"]') ??
      firstRow.parentElement
    );
  }

  return document.querySelector<HTMLElement>(
    '[data-testid="issue-list"], .js-navigation-container[aria-label*="Pull"], #js-issues-toolbar + div',
  );
}

function parseNumber(url: URL): number | null {
  const match = url.pathname.match(/\/pull\/(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : null;
}

function parseLabels(row: HTMLElement): LabelSummary[] {
  const elements = row.querySelectorAll<HTMLElement>('.IssueLabel, [data-name="issue-label"]');
  return Array.from(elements).map((element) => ({
    color: element.getAttribute('data-color') ?? (element.style.backgroundColor || null),
    name: element.textContent?.trim() ?? '',
  })).filter((label) => label.name.length > 0);
}

function parseCommentCount(row: HTMLElement, number: number): number | null {
  const candidates = row.querySelectorAll<HTMLElement>(
    `a[href*="/pull/${number}"][aria-label], [data-testid*="comment" i], [aria-label*="comment" i]`,
  );
  for (const candidate of candidates) {
    const text = [
      candidate.getAttribute('aria-label'),
      candidate.getAttribute('title'),
      candidate.textContent,
    ].filter(Boolean).join(' ');
    const match = text.match(/([\d,]+)\s+comments?/i);
    if (match?.[1]) return Number(match[1].replaceAll(',', ''));
  }
  return null;
}

function parseReviewDecision(row: HTMLElement): ReviewDecision {
  const candidates = row.querySelectorAll<HTMLElement>(
    '[data-testid*="review" i], [aria-label*="review" i], [title*="review" i], [aria-label*="approved" i], [title*="approved" i]',
  );
  const text = Array.from(candidates).flatMap((candidate) => [
    candidate.getAttribute('aria-label'),
    candidate.getAttribute('title'),
    candidate.textContent,
  ]).filter(Boolean).join(' ').toLocaleLowerCase();

  if (text.includes('changes requested')) return 'changes-requested';
  if (text.includes('approved')) return 'approved';
  if (text.includes('review required') || text.includes('review requested')) return 'review-required';
  return null;
}

function parseRow(row: HTMLElement, repository: string): PullRequestSummary | null {
  const titleLink = row.querySelector<HTMLAnchorElement>(
    'a.Link--primary[href*="/pull/"], a[id^="issue_"][href*="/pull/"], a[href*="/pull/"]',
  );
  const relativeTime = row.querySelector<HTMLElement>('relative-time[datetime], time[datetime]');
  if (!titleLink || !relativeTime) return null;

  const origin = row.ownerDocument.defaultView?.location.origin ?? 'https://github.com';
  const url = new URL(titleLink.getAttribute('href') ?? titleLink.href, origin);
  const number = parseNumber(url);
  const openedAt = relativeTime.getAttribute('datetime');
  if (number === null || !openedAt) return null;

  const author = row.querySelector<HTMLAnchorElement>(
    '.opened-by a[data-hovercard-type="user"], a[data-hovercard-type="user"]',
  );
  const text = row.textContent ?? '';

  return {
    author: author?.textContent?.trim() || null,
    commentCount: parseCommentCount(row, number),
    draft: /\bdraft\b/i.test(text),
    labels: parseLabels(row),
    number,
    openedAt,
    repository,
    reviewDecision: parseReviewDecision(row),
    reviewRequests: [],
    title: titleLink.textContent?.trim() ?? `Pull request #${number}`,
    url: url.href,
  };
}

function findPaginationLink(document: Document, relation: 'next' | 'prev'): HTMLAnchorElement | null {
  const direct = document.querySelector<HTMLAnchorElement>(`a[rel="${relation}"]`);
  if (direct) return direct;

  const expectedText = relation === 'prev' ? 'previous' : 'next';
  return Array.from(document.querySelectorAll<HTMLAnchorElement>(
    'nav[aria-label*="pagination" i] a, .paginate-container a, [data-testid*="pagination" i] a',
  )).find((link) => link.textContent?.trim().toLocaleLowerCase() === expectedText) ?? null;
}

function getPageOrder(document: Document): PullRequestPagination['order'] {
  const url = new URL(document.location.href);
  const query = url.searchParams.get('q')?.toLocaleLowerCase() ?? '';
  const qualifier = query.match(/(?:^|\s)sort:([^\s]+)/)?.[1];
  const sort = qualifier ?? url.searchParams.get('sort')?.toLocaleLowerCase();
  if (!sort || sort === 'created-desc') return 'newest-first';
  if (sort === 'created-asc') return 'oldest-first';
  return 'other';
}

function parsePagination(document: Document): PullRequestPagination | null {
  const previous = findPaginationLink(document, 'prev');
  const next = findPaginationLink(document, 'next');
  if (!previous && !next) return null;

  const root = previous?.closest('nav, .paginate-container, [data-testid*="pagination" i]') ??
    next?.closest('nav, .paginate-container, [data-testid*="pagination" i]');
  const pageNumbers = Array.from(root?.querySelectorAll<HTMLElement>('a, [aria-current="page"]') ?? [])
    .map((element) => Number(element.textContent?.trim()))
    .filter((page) => Number.isInteger(page) && page > 0);
  const activePage = root?.querySelector<HTMLElement>('[aria-current="page"]');
  const urlPage = Number(new URL(document.location.href).searchParams.get('page'));
  const currentPage = Number(activePage?.textContent?.trim()) ||
    (Number.isInteger(urlPage) && urlPage > 0 ? urlPage : 1);
  const totalPages = pageNumbers.length > 0 ? Math.max(currentPage, ...pageNumbers) : null;
  const toAbsoluteUrl = (link: HTMLAnchorElement | null) => link
    ? new URL(link.getAttribute('href') ?? link.href, document.location.href).href
    : null;

  return {
    currentPage,
    nextUrl: toAbsoluteUrl(next),
    order: getPageOrder(document),
    previousUrl: toAbsoluteUrl(previous),
    totalPages,
  };
}

export function parsePullRequestPage(document: Document): ParsedPullRequestPage | null {
  const repository = getRepositoryFromPath(document.location.pathname);
  if (!repository) return null;

  const rows = queryRows(document);
  const listElement = findListElement(document, rows);
  if (!listElement) return null;

  return {
    currentUser: document.querySelector<HTMLMetaElement>('meta[name="user-login"]')?.content || null,
    listElement,
    pagination: parsePagination(document),
    pullRequests: rows
      .map((row) => parseRow(row, repository))
      .filter((pullRequest): pullRequest is PullRequestSummary => pullRequest !== null),
    repository,
  };
}
