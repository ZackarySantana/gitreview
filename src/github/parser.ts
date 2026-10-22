import type {
  LabelSummary,
  PullRequestPagination,
  PullRequestSummary,
  ReviewDecision,
} from '../types';

// GitHub serves two pull request list layouts: the classic Rails-rendered list
// and the refreshed React list view. Each layout has its own row parser.
const CLASSIC_ROW_SELECTORS = ['.js-issue-row', '[data-testid="issue-row"]', '[id^="issue_"]'];
const REFRESHED_LIST_SELECTOR = 'ul[data-listview-component="items-list"]';

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

function parseNumber(url: URL): number | null {
  const match = url.pathname.match(/\/pull\/(\d+)/);
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isInteger(value) ? value : null;
}

function toPullRequestUrl(row: HTMLElement, link: HTMLAnchorElement): URL {
  const origin = row.ownerDocument.defaultView?.location.origin ?? 'https://github.com';
  return new URL((link.getAttribute('href') ?? link.href).trim(), origin);
}

function mapReviewText(text: string): ReviewDecision {
  const normalized = text.toLocaleLowerCase();
  if (normalized.includes('changes requested')) return 'changes-requested';
  if (normalized.includes('approved')) return 'approved';
  if (normalized.includes('review required') || normalized.includes('review requested')) {
    return 'review-required';
  }
  return null;
}

function queryClassicRows(document: Document): HTMLElement[] {
  const rows = CLASSIC_ROW_SELECTORS.flatMap((selector) =>
    Array.from(document.querySelectorAll<HTMLElement>(selector)),
  );
  return [...new Set(rows)].filter((row) => row.querySelector('a[href*="/pull/"]'));
}

function findClassicListElement(document: Document, rows: HTMLElement[]): HTMLElement | null {
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

function parseClassicLabels(row: HTMLElement): LabelSummary[] {
  const elements = row.querySelectorAll<HTMLElement>('.IssueLabel, [data-name="issue-label"]');
  return Array.from(elements).map((element) => ({
    color: element.getAttribute('data-color') ?? (element.style.backgroundColor || null),
    name: element.textContent?.trim() ?? '',
  })).filter((label) => label.name.length > 0);
}

function parseClassicCommentCount(row: HTMLElement, number: number): number | null {
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

function parseClassicReviewDecision(row: HTMLElement): ReviewDecision {
  const candidates = row.querySelectorAll<HTMLElement>(
    '[data-testid*="review" i], [aria-label*="review" i], [title*="review" i], [aria-label*="approved" i], [title*="approved" i]',
  );
  return mapReviewText(Array.from(candidates).flatMap((candidate) => [
    candidate.getAttribute('aria-label'),
    candidate.getAttribute('title'),
    candidate.textContent,
  ]).filter(Boolean).join(' '));
}

function parseClassicRow(row: HTMLElement, repository: string): PullRequestSummary | null {
  const titleLink = row.querySelector<HTMLAnchorElement>(
    'a.Link--primary[href*="/pull/"], a[id^="issue_"][href*="/pull/"], a[href*="/pull/"]',
  );
  const relativeTime = row.querySelector<HTMLElement>('relative-time[datetime], time[datetime]');
  if (!titleLink || !relativeTime) return null;

  const url = toPullRequestUrl(row, titleLink);
  const number = parseNumber(url);
  const openedAt = relativeTime.getAttribute('datetime');
  if (number === null || !openedAt) return null;

  const author = row.querySelector<HTMLAnchorElement>(
    '.opened-by a[data-hovercard-type="user"], a[data-hovercard-type="user"]',
  );
  const text = row.textContent ?? '';

  return {
    author: author?.textContent?.trim() || null,
    commentCount: parseClassicCommentCount(row, number),
    draft: /\bdraft\b/i.test(text),
    labels: parseClassicLabels(row),
    number,
    openedAt,
    repository,
    reviewDecision: parseClassicReviewDecision(row),
    reviewRequests: [],
    title: titleLink.textContent?.trim() ?? `Pull request #${number}`,
    url: url.href,
  };
}

function parseRefreshedLabelColor(element: HTMLElement): string | null {
  const style = element.getAttribute('style') ?? '';
  const channels = ['r', 'g', 'b'].map((channel) =>
    Number(style.match(new RegExp(`--label-${channel}:\\s*(\\d+)`))?.[1] ?? Number.NaN),
  );
  const [red, green, blue] = channels;
  if (!channels.every((channel) => Number.isInteger(channel) && channel >= 0 && channel <= 255)) {
    return null;
  }
  return [red!, green!, blue!].map((channel) => channel.toString(16).padStart(2, '0')).join('');
}

function parseRefreshedLabels(row: HTMLElement): LabelSummary[] {
  const prefix = 'Filter by label ';
  const buttons = row.querySelectorAll<HTMLElement>(`button[aria-label^="${prefix}"]`);
  return Array.from(buttons).map((button) => {
    const token = button.querySelector<HTMLElement>('[class*="IssueLabel"]') ?? button;
    return {
      color: parseRefreshedLabelColor(token),
      name: button.getAttribute('aria-label')?.slice(prefix.length).trim() ||
        button.textContent?.trim() || '',
    };
  }).filter((label) => label.name.length > 0);
}

function parseRefreshedCommentCount(row: HTMLElement): number | null {
  const container = row.querySelector('svg.octicon-comment')?.parentElement;
  const match = container?.textContent?.match(/[\d,]+/);
  return match ? Number(match[0].replaceAll(',', '')) : null;
}

function parseRefreshedReviewDecision(row: HTMLElement): ReviewDecision {
  const prefix = 'Filter by review:';
  const button = row.querySelector<HTMLElement>(
    `[data-testid="review-decision-icon"] [aria-label^="${prefix}"], [aria-label^="${prefix}"]`,
  );
  if (button) return mapReviewText(button.getAttribute('aria-label')?.slice(prefix.length) ?? '');
  const container = row.querySelector<HTMLElement>('[data-testid="review-decision-icon"]');
  return mapReviewText(container?.textContent ?? '');
}

function parseRefreshedRow(row: HTMLElement, repository: string): PullRequestSummary | null {
  const titleLink = row.querySelector<HTMLAnchorElement>(
    'a[data-testid="listitem-title-link"][href*="/pull/"]',
  );
  const relativeTime = row.querySelector<HTMLElement>(
    '[data-testid="timestamp-container"] relative-time[datetime], relative-time[datetime]',
  );
  if (!titleLink || !relativeTime) return null;

  const url = toPullRequestUrl(row, titleLink);
  const number = parseNumber(url);
  const openedAt = relativeTime.getAttribute('datetime');
  if (number === null || !openedAt) return null;

  const author = row.querySelector<HTMLAnchorElement>('a[data-testid="author-filter-link"]');

  return {
    author: author?.textContent?.trim() || null,
    commentCount: parseRefreshedCommentCount(row),
    draft: row.querySelector(
      'svg.octicon-git-pull-request-draft, [aria-label="Draft pull request"]',
    ) !== null,
    labels: parseRefreshedLabels(row),
    number,
    openedAt,
    repository,
    reviewDecision: parseRefreshedReviewDecision(row),
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

function parseList(
  document: Document,
  repository: string,
): Pick<ParsedPullRequestPage, 'listElement' | 'pullRequests'> | null {
  const refreshedList = document.querySelector<HTMLElement>(REFRESHED_LIST_SELECTOR);
  if (refreshedList) {
    return {
      listElement: refreshedList,
      pullRequests: Array.from(refreshedList.children)
        .filter((row): row is HTMLElement => row instanceof HTMLElement && row.matches('li'))
        .map((row) => parseRefreshedRow(row, repository))
        .filter((pullRequest): pullRequest is PullRequestSummary => pullRequest !== null),
    };
  }

  const rows = queryClassicRows(document);
  const listElement = findClassicListElement(document, rows);
  if (!listElement) return null;
  return {
    listElement,
    pullRequests: rows
      .map((row) => parseClassicRow(row, repository))
      .filter((pullRequest): pullRequest is PullRequestSummary => pullRequest !== null),
  };
}

export function parsePullRequestPage(document: Document): ParsedPullRequestPage | null {
  const repository = getRepositoryFromPath(document.location.pathname);
  if (!repository) return null;

  const list = parseList(document, repository);
  if (!list) return null;

  return {
    currentUser: document.querySelector<HTMLMetaElement>('meta[name="user-login"]')?.content || null,
    ...list,
    pagination: parsePagination(document),
    repository,
  };
}
