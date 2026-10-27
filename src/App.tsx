import {
  startTransition,
  useCallback,
  useDeferredValue,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import { Icon } from './components/Icon';
import { ThresholdEditor } from './components/ThresholdEditor';
import { filterPullRequests, NO_OUTSTANDING_REQUEST_FILTER } from './domain/filters';
import { buildZones, formatDuration, getAgeHours } from './domain/zones';
import { loadReviewMetadata } from './github/reviewMetadata';
import {
  loadGitHubTokenState,
  openExtensionSettings,
  removeGitHubToken,
} from './settingsMessages';
import {
  DEFAULT_QUEUE_FILTERS,
  getQueueFilterStorageKey,
  loadQueueFilters,
  saveQueueFilters,
} from './storage/filters';
import { DEFAULT_SETTINGS, loadSettings, saveSettings } from './storage/settings';
import type {
  ExtensionView,
  DraftFilter,
  PullRequestPagination,
  PullRequestSummary,
  QuickFilter,
  ReviewMetadataResponse,
  ReviewFilter,
  ReviewRequest,
  Settings,
  ZoneId,
} from './types';

interface AppProps {
  currentUser: string | null;
  onNativeVisibilityChange: (visible: boolean) => void;
  pagination?: PullRequestPagination | null;
  pullRequests: PullRequestSummary[];
  repository: string;
}

const zoneIcons: Record<ZoneId, 'aging' | 'new' | 'overdue' | 'recent'> = {
  aging: 'aging',
  new: 'new',
  overdue: 'overdue',
  recent: 'recent',
};

const quickFilterLabels: Array<[QuickFilter, string]> = [
  ['mine', 'Mine'],
  ['labeled', 'Has labels'],
];

const draftFilterLabels: Array<[DraftFilter, string]> = [
  ['all', 'All'],
  ['ready', 'Ready'],
  ['draft', 'Draft'],
];

const reviewFilterLabels: Array<[ReviewFilter, string]> = [
  ['needs-review', 'Needs review'],
  ['changes-requested', 'Changes requested'],
  ['approved', 'Approved'],
  ['all', 'All'],
];

const INITIAL_NOW = Date.now();

function toggleQuickFilter(filters: QuickFilter[], filter: QuickFilter): QuickFilter[] {
  if (filters.includes(filter)) return filters.filter((candidate) => candidate !== filter);
  return [...filters, filter];
}

function handleSegmentedFilterKeyDown<T extends string>(
  event: KeyboardEvent<HTMLButtonElement>,
  index: number,
  options: Array<[T, string]>,
  onChange: (value: T) => void,
) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
  event.preventDefault();
  const direction = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
  const nextIndex = (index + direction + options.length) % options.length;
  const nextValue = options[nextIndex]?.[0];
  if (!nextValue) return;
  onChange(nextValue);
  const group = event.currentTarget.parentElement;
  window.requestAnimationFrame(() => {
    group?.querySelector<HTMLButtonElement>(`button[data-filter="${nextValue}"]`)?.focus();
  });
}

function formatReviewRequests(requests: ReviewRequest[]): string {
  const visible = requests.slice(0, 2).map((request) => request.label).join(', ');
  const remaining = requests.length - 2;
  return remaining > 0 ? `${visible} +${remaining}` : visible;
}

function formatRequestedFilter(filter: string): string {
  return `@${filter.replace(/^(?:team|user):/, '')}`;
}

function ReviewSummary({ pullRequest }: { pullRequest: PullRequestSummary }) {
  let reviewStatus: ReactNode = null;
  if (pullRequest.reviewDecision === 'approved') {
    reviewStatus = <span className="review-state state-approved"><Icon name="approved" />Approved</span>;
  } else if (pullRequest.reviewDecision === 'changes-requested') {
    reviewStatus = <span className="review-state state-changes"><Icon name="changes" />Changes requested</span>;
  } else if (pullRequest.reviewDecision === 'review-required') {
    reviewStatus = <span className="review-state state-waiting"><Icon name="waiting" />Review required</span>;
  }
  const requestStatus = pullRequest.reviewRequests.length > 0 ? (
    <span className="review-state state-waiting">
      <Icon name="waiting" />Waiting on {formatReviewRequests(pullRequest.reviewRequests)}
    </span>
  ) : null;

  return (
    <span className="pr-meta">
      <span className="pr-author">{pullRequest.author ? `@${pullRequest.author}` : 'Unknown author'}</span>
      {reviewStatus}
      {requestStatus}
      {pullRequest.commentCount && pullRequest.commentCount > 0 ? (
        <span className="review-state comment-count">
          <Icon name="comment" />
          {pullRequest.commentCount} {pullRequest.commentCount === 1 ? 'comment' : 'comments'}
        </span>
      ) : null}
    </span>
  );
}

export function App({
  currentUser,
  onNativeVisibilityChange,
  pagination = null,
  pullRequests,
  repository,
}: AppProps) {
  const filterStorageKey = getQueueFilterStorageKey(repository, window.location.href);
  const [initialFilters] = useState(() => loadQueueFilters(filterStorageKey));
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [view, setView] = useState<ExtensionView>(DEFAULT_SETTINGS.defaultView);
  const [query, setQuery] = useState(initialFilters.query);
  const deferredQuery = useDeferredValue(query);
  const [draftFilter, setDraftFilter] = useState<DraftFilter>(initialFilters.draftFilter);
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>(initialFilters.reviewFilter);
  const [quickFilters, setQuickFilters] = useState<QuickFilter[]>(initialFilters.quickFilters);
  const [requestedFilter, setRequestedFilter] = useState(initialFilters.requestedFilter);
  const [reviewMetadata, setReviewMetadata] = useState<ReviewMetadataResponse | null>(null);
  const [reviewMetadataVersion, setReviewMetadataVersion] = useState(0);
  const [tokenConfigured, setTokenConfigured] = useState<boolean | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [draftSettings, setDraftSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [now, setNow] = useState(INITIAL_NOW);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const pullRequestKey = pullRequests.map((pullRequest) => pullRequest.number).join(',');
  const tokenConfiguredRef = useRef<boolean | null>(null);

  useEffect(() => {
    let active = true;
    void loadSettings().then((storedSettings) => {
      if (!active) return;
      setSettings(storedSettings);
      setDraftSettings(storedSettings);
      setView(storedSettings.defaultView);
    }).catch(() => {
      if (active) setSettingsError('Settings could not be loaded. Defaults are active.');
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    saveQueueFilters(filterStorageKey, {
      draftFilter,
      query,
      quickFilters,
      requestedFilter,
      reviewFilter,
    });
  }, [draftFilter, filterStorageKey, query, quickFilters, requestedFilter, reviewFilter]);

  useEffect(() => {
    if (!pullRequestKey) return;
    let active = true;
    void loadReviewMetadata(
      repository,
      pullRequestKey.split(',').map(Number),
    ).then((response) => {
      if (active) setReviewMetadata(response);
    }).catch((error: unknown) => {
      if (!active) return;
      setReviewMetadata({
        message: error instanceof Error ? error.message : 'Review details could not be loaded.',
        status: 'error',
      });
    });
    return () => { active = false; };
  }, [pullRequestKey, repository, reviewMetadataVersion]);

  useEffect(() => {
    onNativeVisibilityChange(view === 'github' || pullRequests.length === 0);
  }, [onNativeVisibilityChange, pullRequests.length, view]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!settingsOpen) return;
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setSettingsOpen(false);
      settingsButtonRef.current?.focus();
    }
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [settingsOpen]);

  const applyTokenState = useCallback((configured: boolean) => {
    const previous = tokenConfiguredRef.current;
    tokenConfiguredRef.current = configured;
    setTokenConfigured(configured);
    if (previous === null || previous === configured) return;
    setReviewMetadata(null);
    setReviewMetadataVersion((version) => version + 1);
  }, []);

  // The token is added on the extension settings page, so check again whenever
  // the user comes back to this tab.
  useEffect(() => {
    let active = true;
    function refreshTokenState() {
      if (document.visibilityState !== 'visible') return;
      void loadGitHubTokenState().then((configured) => {
        if (active) applyTokenState(configured);
      }).catch(() => undefined);
    }

    refreshTokenState();
    document.addEventListener('visibilitychange', refreshTokenState);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', refreshTokenState);
    };
  }, [applyTokenState]);

  function addToken() {
    setTokenError(null);
    openExtensionSettings().catch(() => {
      setTokenError('The extension settings could not be opened.');
    });
  }

  function removeToken() {
    setTokenError(null);
    removeGitHubToken().then(() => applyTokenState(false)).catch(() => {
      setTokenError('The token could not be removed.');
    });
  }

  const activeSettings = settingsOpen ? draftSettings : settings;
  const enrichedPullRequests = pullRequests.map((pullRequest) => {
    if (reviewMetadata?.status !== 'available') return pullRequest;
    const metadata = reviewMetadata.metadata[String(pullRequest.number)];
    return metadata ? { ...pullRequest, ...metadata } : pullRequest;
  });
  const requestedOptions = new Map<string, ReviewRequest>();
  for (const pullRequest of enrichedPullRequests) {
    for (const request of pullRequest.reviewRequests) requestedOptions.set(request.id, request);
  }
  const requestedUsers = [...requestedOptions.values()]
    .filter((request) => request.type === 'user')
    .sort((left, right) => left.label.localeCompare(right.label));
  const requestedTeams = [...requestedOptions.values()]
    .filter((request) => request.type === 'team')
    .sort((left, right) => left.label.localeCompare(right.label));
  const selectedRequestMissing =
    requestedFilter !== '' &&
    requestedFilter !== NO_OUTSTANDING_REQUEST_FILTER &&
    !requestedOptions.has(requestedFilter);
  const filteredPullRequests = filterPullRequests(enrichedPullRequests, {
    currentUser,
    draftFilter,
    query: deferredQuery,
    quickFilters,
    requestedFilter,
    reviewFilter,
  });
  const zones = buildZones(filteredPullRequests, activeSettings.thresholds, now);
  const filtersActive =
    query.trim().length > 0 ||
    quickFilters.length > 0 ||
    draftFilter !== DEFAULT_QUEUE_FILTERS.draftFilter ||
    requestedFilter !== '' ||
    reviewFilter !== DEFAULT_QUEUE_FILTERS.reviewFilter;
  const previousPageLabel = pagination?.order === 'newest-first'
    ? 'Newer PRs'
    : pagination?.order === 'oldest-first' ? 'Older PRs' : 'Previous page';
  const nextPageLabel = pagination?.order === 'newest-first'
    ? 'Older PRs'
    : pagination?.order === 'oldest-first' ? 'Newer PRs' : 'Next page';

  function persist(nextSettings: Settings) {
    setSettings(nextSettings);
    setDraftSettings(nextSettings);
    setSettingsError(null);
    void saveSettings(nextSettings).catch(() => {
      setSettingsError('Settings could not be saved. Check browser sync permissions.');
    });
  }

  function changeView(nextView: ExtensionView) {
    setView(nextView);
    persist({ ...settings, defaultView: nextView });
  }

  function openSettings() {
    setDraftSettings(settings);
    setSettingsOpen(true);
  }

  function applySettings() {
    persist(draftSettings);
    setSettingsOpen(false);
    settingsButtonRef.current?.focus();
  }

  function clearFilters() {
    setQuery(DEFAULT_QUEUE_FILTERS.query);
    setDraftFilter(DEFAULT_QUEUE_FILTERS.draftFilter);
    setQuickFilters([]);
    setRequestedFilter(DEFAULT_QUEUE_FILTERS.requestedFilter);
    setReviewFilter(DEFAULT_QUEUE_FILTERS.reviewFilter);
  }

  return (
    <div className={`review-queue density-${activeSettings.density}`} data-repository={repository}>
      <div className="queue-toolbar">
        <div aria-label="Pull request view" className="view-toggle" role="tablist">
          <button aria-selected={view === 'github'} onClick={() => changeView('github')} role="tab" type="button">
            GitHub
          </button>
          <button aria-selected={view === 'queue'} onClick={() => changeView('queue')} role="tab" type="button">
            Review queue
          </button>
        </div>

        {view === 'queue' && pullRequests.length > 0 ? (
          <>
            <label className="search-field">
              <Icon name="search" />
              <span className="sr-only">Filter loaded pull requests</span>
              <input
                onChange={(event) => {
                  const nextQuery = event.target.value;
                  startTransition(() => setQuery(nextQuery));
                }}
                placeholder="Filter loaded PRs"
                type="search"
                value={query}
              />
              {query ? (
                <button aria-label="Clear search" onClick={() => setQuery('')} type="button">
                  <Icon name="x" />
                </button>
              ) : null}
            </label>
            <span aria-live="polite" className="result-count">
              {filteredPullRequests.length} of {pullRequests.length} on page
            </span>
            <button
              aria-label={`Use ${activeSettings.density === 'comfortable' ? 'compact' : 'comfortable'} rows`}
              className="icon-button"
              onClick={() => persist({
                ...settings,
                density: settings.density === 'comfortable' ? 'compact' : 'comfortable',
              })}
              title="Change row density"
              type="button"
            >
              <Icon name="density" />
            </button>
          </>
        ) : null}

        <button
          aria-expanded={settingsOpen}
          aria-label="Review queue settings"
          className="icon-button"
          onClick={() => settingsOpen ? setSettingsOpen(false) : openSettings()}
          ref={settingsButtonRef}
          type="button"
        >
          <Icon name="settings" />
        </button>

        {view === 'queue' && pullRequests.length > 0 ? (
          <div aria-label="Quick filters" className="quick-filters">
            <div aria-label="Pull request readiness" className="draft-switch" role="radiogroup">
              {draftFilterLabels.map(([filter, label], index) => (
                <button
                  aria-checked={draftFilter === filter}
                  data-filter={filter}
                  key={filter}
                  onKeyDown={(event) => handleSegmentedFilterKeyDown(
                    event,
                    index,
                    draftFilterLabels,
                    setDraftFilter,
                  )}
                  onClick={() => setDraftFilter(filter)}
                  role="radio"
                  tabIndex={draftFilter === filter ? 0 : -1}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            <div aria-label="Review status" className="review-switch" role="radiogroup">
              {reviewFilterLabels.map(([filter, label], index) => (
                <button
                  aria-checked={reviewFilter === filter}
                  data-filter={filter}
                  key={filter}
                  onKeyDown={(event) => handleSegmentedFilterKeyDown(
                    event,
                    index,
                    reviewFilterLabels,
                    setReviewFilter,
                  )}
                  onClick={() => setReviewFilter(filter)}
                  role="radio"
                  tabIndex={reviewFilter === filter ? 0 : -1}
                  type="button"
                >
                  {label}
                </button>
              ))}
            </div>
            {quickFilterLabels.map(([filter, label]) => {
              const active = quickFilters.includes(filter);
              const disabled = filter === 'mine' && !currentUser;
              return (
                <button
                  aria-pressed={active}
                  className="filter-chip"
                  disabled={disabled}
                  key={filter}
                  onClick={() => setQuickFilters((current) => toggleQuickFilter(current, filter))}
                  title={disabled ? 'GitHub login could not be detected' : undefined}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
            <label className="request-filter">
              <span className="sr-only">Filter by requested reviewer or team</span>
              <select
                disabled={reviewMetadata?.status !== 'available'}
                onChange={(event) => setRequestedFilter(event.target.value)}
                value={requestedFilter}
              >
                <option value="">
                  {reviewMetadata === null
                    ? 'Loading requests...'
                    : reviewMetadata.status === 'available'
                      ? 'Review request: all'
                      : 'Requests unavailable'}
                </option>
                <option value={NO_OUTSTANDING_REQUEST_FILTER}>No outstanding request</option>
                {selectedRequestMissing ? (
                  <option value={requestedFilter}>
                    Requested: {formatRequestedFilter(requestedFilter)}
                  </option>
                ) : null}
                <optgroup label="People">
                  {requestedUsers.length > 0 ? requestedUsers.map((request) => (
                    <option key={request.id} value={request.id}>{request.label}</option>
                  )) : (
                    <option disabled value="empty:people">None on this page</option>
                  )}
                </optgroup>
                <optgroup label="Teams">
                  {requestedTeams.length > 0 ? requestedTeams.map((request) => (
                    <option key={request.id} value={request.id}>{request.label}</option>
                  )) : (
                    <option disabled value="empty:teams">None on this page</option>
                  )}
                </optgroup>
              </select>
            </label>
            {reviewMetadata?.status === 'not-configured' || reviewMetadata?.status === 'error' ? (
              <button
                className="text-button"
                onClick={openSettings}
                type="button"
              >
                GitHub data
              </button>
            ) : null}
            {filtersActive ? (
              <button className="text-button" onClick={clearFilters} type="button">Clear</button>
            ) : null}
          </div>
        ) : null}

        {view === 'queue' && pullRequests.length > 0 && pagination ? (
          <nav aria-label="Pull request pages" className="queue-pagination">
            {pagination.previousUrl ? (
              <a className="page-link" href={pagination.previousUrl} rel="prev">
                {previousPageLabel}
              </a>
            ) : (
              <span aria-disabled="true" className="page-link page-link-disabled">
                {previousPageLabel}
              </span>
            )}
            <span className="page-indicator">
              Page {pagination.currentPage}
              {pagination.totalPages ? ` of ${pagination.totalPages}` : ''}
            </span>
            {pagination.nextUrl ? (
              <a className="page-link" href={pagination.nextUrl} rel="next">
                {nextPageLabel}
              </a>
            ) : (
              <span aria-disabled="true" className="page-link page-link-disabled">
                {nextPageLabel}
              </span>
            )}
          </nav>
        ) : null}
      </div>

      {settingsOpen ? (
        <section aria-label="Review queue settings" className="settings-panel" role="dialog">
          <div className="settings-panel-heading">
            <div>
              <h2>Queue settings</h2>
              <p>Changes preview immediately.</p>
            </div>
            <button aria-label="Close settings" className="icon-button" onClick={() => setSettingsOpen(false)} type="button">
              <Icon name="x" />
            </button>
          </div>

          <ThresholdEditor
            onChange={(thresholds) => setDraftSettings({ ...draftSettings, thresholds })}
            value={draftSettings.thresholds}
          />

          <section aria-labelledby="github-data-title" className="github-data-settings">
            <h3 id="github-data-title">GitHub data</h3>
            {reviewMetadata?.status === 'error' ? (
              <p className="github-data-error" role="alert">{reviewMetadata.message}</p>
            ) : null}
            {tokenError ? (
              <p className="github-data-error" role="alert">{tokenError}</p>
            ) : null}
            {tokenConfigured === true ? (
              <button className="secondary-button github-data-action" onClick={removeToken} type="button">
                Remove PAT
              </button>
            ) : null}
            {tokenConfigured === false ? (
              <button className="primary-button github-data-action" onClick={addToken} type="button">
                Add PAT
              </button>
            ) : null}
          </section>

          <div className="settings-actions">
            <button className="secondary-button" onClick={() => {
              setDraftSettings(settings);
              setSettingsOpen(false);
            }} type="button">Cancel</button>
            <button className="primary-button" onClick={applySettings} type="button">Apply settings</button>
          </div>
        </section>
      ) : null}

      {settingsError ? <p className="inline-warning" role="status">{settingsError}</p> : null}

      {view === 'queue' && pullRequests.length > 0 ? (
        <main className="zone-list">
          {zones.map((zone) => (
            <section aria-labelledby={`zone-${zone.id}`} className={`zone zone-${zone.id}`} key={zone.id}>
              <header className="zone-header">
                <span aria-hidden="true" className="zone-pattern" />
                <Icon name={zoneIcons[zone.id]} />
                <h2 id={`zone-${zone.id}`}>{zone.label}</h2>
                <span>{zone.description}</span>
                <span className="zone-count">{zone.pullRequests.length}</span>
              </header>
              <ul>
                {zone.pullRequests.map((pullRequest) => {
                  const age = getAgeHours(pullRequest.openedAt, now) ?? 0;
                  return (
                    <li key={pullRequest.url}>
                      <a className="pr-row" href={pullRequest.url}>
                        <Icon className="pr-icon" name="pull" />
                        <div className="pr-content">
                          <div className="pr-title-line">
                            <strong title={pullRequest.title}>{pullRequest.title}</strong>
                            {pullRequest.draft ? <span className="draft-badge">Draft</span> : null}
                            <span className="label-list">
                              {pullRequest.labels.slice(0, 3).map((label) => (
                                <span className="label" key={label.name}>{label.name}</span>
                              ))}
                              {pullRequest.labels.length > 3 ? <span className="label">+{pullRequest.labels.length - 3}</span> : null}
                            </span>
                          </div>
                          <ReviewSummary pullRequest={pullRequest} />
                        </div>
                        <time className="pr-age" dateTime={pullRequest.openedAt} title={new Date(pullRequest.openedAt).toLocaleString()}>
                          {formatDuration(age)}
                        </time>
                      </a>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}

          {zones.length === 0 ? (
            <div className="empty-state">
              <Icon name="search" />
              <h2>No loaded PRs match</h2>
              <p>Search and filters apply only to pull requests on this GitHub page.</p>
              <button className="secondary-button" onClick={clearFilters} type="button">Clear filters</button>
            </div>
          ) : null}
        </main>
      ) : null}
    </div>
  );
}
