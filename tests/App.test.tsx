import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../src/App';
import { NO_OUTSTANDING_REQUEST_FILTER } from '../src/domain/filters';
import { DEFAULT_SETTINGS } from '../src/storage/settings';
import { makePullRequest } from './helpers';

const reviewMetadataMock = vi.hoisted(() => vi.fn());
const settingsMessages = vi.hoisted(() => ({
  loadGitHubTokenState: vi.fn(() => Promise.resolve(false)),
  openExtensionSettings: vi.fn(() => Promise.resolve()),
  removeGitHubToken: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/storage/settings', () => ({
  DEFAULT_SETTINGS: {
    defaultView: 'queue',
    density: 'comfortable',
    thresholds: [24, 48, 168],
  },
  loadSettings: vi.fn(() => Promise.resolve(DEFAULT_SETTINGS)),
  saveSettings: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/github/reviewMetadata', () => ({
  loadReviewMetadata: reviewMetadataMock,
}));

vi.mock('../src/settingsMessages', () => settingsMessages);

describe('App', () => {
  beforeEach(() => {
    vi.useRealTimers();
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/acme/widgets/pulls?q=is%3Apr+is%3Aopen');
    reviewMetadataMock.mockReset();
    reviewMetadataMock.mockResolvedValue({ status: 'not-configured' });
    settingsMessages.loadGitHubTokenState.mockReset();
    settingsMessages.loadGitHubTokenState.mockResolvedValue(false);
    settingsMessages.openExtensionSettings.mockClear();
    settingsMessages.removeGitHubToken.mockClear();
  });

  it('renders only non-empty zones and restores GitHub view on toggle', async () => {
    const now = Date.now();
    const onNativeVisibilityChange = vi.fn();
    render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={onNativeVisibilityChange}
        pullRequests={[
          makePullRequest({
            openedAt: new Date(now - 8 * 24 * 60 * 60 * 1000).toISOString(),
            reviewDecision: 'review-required',
          }),
          makePullRequest({
            number: 2,
            openedAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
            reviewDecision: 'review-required',
            url: 'https://github.com/acme/widgets/pull/2',
          }),
        ]}
        repository="acme/widgets"
      />,
    );

    expect(screen.getByRole('heading', { name: 'Overdue' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'New' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Aging' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: 'GitHub' }));
    await waitFor(() => expect(onNativeVisibilityChange).toHaveBeenLastCalledWith(true));
  });

  it('shows one global empty state when filters remove every PR', () => {
    render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={() => undefined}
        pullRequests={[makePullRequest({ author: 'bob' })]}
        repository="acme/widgets"
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Mine' }));
    expect(screen.getByRole('heading', { name: 'No loaded PRs match' })).toBeInTheDocument();
  });

  it('defaults to ready and uses a three-state control without checkmarks', () => {
    render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={() => undefined}
        pullRequests={[
          makePullRequest({ number: 1, reviewDecision: 'review-required', title: 'Ready change' }),
          makePullRequest({
            draft: true,
            number: 2,
            reviewDecision: 'review-required',
            title: 'Draft change',
            url: 'https://github.com/acme/widgets/pull/2',
          }),
        ]}
        repository="acme/widgets"
      />,
    );

    const readiness = within(screen.getByRole('radiogroup', { name: 'Pull request readiness' }));
    expect(readiness.getByRole('radio', { name: 'Ready' })).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Ready change')).toBeInTheDocument();
    expect(screen.queryByText('Draft change')).not.toBeInTheDocument();

    fireEvent.click(readiness.getByRole('radio', { name: 'All' }));
    expect(screen.getByText('Draft change')).toBeInTheDocument();
  });

  it('shows page-scoped chronological navigation at the top', () => {
    render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={() => undefined}
        pagination={{
          currentPage: 1,
          nextUrl: 'https://github.com/acme/widgets/pulls?page=2',
          order: 'newest-first',
          previousUrl: null,
          totalPages: 3,
        }}
        pullRequests={[makePullRequest({ reviewDecision: 'review-required' })]}
        repository="acme/widgets"
      />,
    );

    const pagination = screen.getByRole('navigation', { name: 'Pull request pages' });
    expect(within(pagination).getByText('Newer PRs')).toHaveAttribute('aria-disabled', 'true');
    expect(within(pagination).getByRole('link', { name: 'Older PRs' }))
      .toHaveAttribute('href', 'https://github.com/acme/widgets/pulls?page=2');
    expect(within(pagination).getByText('Page 1 of 3')).toBeInTheDocument();
    expect(screen.getByText('1 of 1 on page')).toBeInTheDocument();
  });

  it('restores local filters after navigating to another GitHub page', () => {
    window.history.replaceState({}, '', '/acme/widgets/pulls?q=is%3Apr+is%3Aopen&page=1');
    const firstPage = render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={() => undefined}
        pullRequests={[makePullRequest()]}
        repository="acme/widgets"
      />,
    );

    fireEvent.change(screen.getByPlaceholderText('Filter loaded PRs'), {
      target: { value: 'cache' },
    });
    const firstReviewStatus = within(screen.getByRole('radiogroup', { name: 'Review status' }));
    fireEvent.click(firstReviewStatus.getByRole('radio', { name: 'Approved' }));
    firstPage.unmount();

    window.history.replaceState({}, '', '/acme/widgets/pulls?q=is%3Apr+is%3Aopen&page=2');
    render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={() => undefined}
        pullRequests={[makePullRequest({ number: 2 })]}
        repository="acme/widgets"
      />,
    );

    expect(screen.getByPlaceholderText('Filter loaded PRs')).toHaveValue('cache');
    const secondReviewStatus = within(screen.getByRole('radiogroup', { name: 'Review status' }));
    expect(secondReviewStatus.getByRole('radio', { name: 'Approved' }))
      .toHaveAttribute('aria-checked', 'true');
  });

  it('uses exclusive needs-review, changes-requested, and approved filters', () => {
    render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={() => undefined}
        pullRequests={[
          makePullRequest({ number: 1, reviewDecision: 'approved', title: 'Approved change' }),
          makePullRequest({
            number: 2,
            reviewDecision: 'changes-requested',
            title: 'Needs changes',
            url: 'https://github.com/acme/widgets/pull/2',
          }),
          makePullRequest({
            number: 3,
            reviewDecision: 'review-required',
            title: 'Needs a reviewer',
            url: 'https://github.com/acme/widgets/pull/3',
          }),
        ]}
        repository="acme/widgets"
      />,
    );

    const reviewStatus = within(screen.getByRole('radiogroup', { name: 'Review status' }));
    expect(reviewStatus.getByRole('radio', { name: 'Needs review' }))
      .toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Needs a reviewer')).toBeInTheDocument();
    expect(screen.queryByText('Needs changes')).not.toBeInTheDocument();
    expect(screen.queryByText('Approved change')).not.toBeInTheDocument();

    fireEvent.click(reviewStatus.getByRole('radio', { name: 'Changes requested' }));
    expect(screen.getByText('Needs changes')).toBeInTheDocument();
    expect(screen.queryByText('Needs a reviewer')).not.toBeInTheDocument();

    fireEvent.click(reviewStatus.getByRole('radio', { name: 'Approved' }));
    expect(screen.getByText('Approved change')).toBeInTheDocument();
    expect(screen.queryByText('Needs changes')).not.toBeInTheDocument();
  });

  it('shows review status and filters by requested team', async () => {
    reviewMetadataMock.mockResolvedValue({
      metadata: {
        1: {
          commentCount: 4,
          reviewDecision: 'approved',
          reviewRequests: [{ id: 'team:acme/platform', label: '@acme/platform', type: 'team' }],
        },
        2: {
          commentCount: 0,
          reviewDecision: 'approved',
          reviewRequests: [],
        },
      },
      status: 'available',
    });
    render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={() => undefined}
        pullRequests={[
          makePullRequest({ author: 'alice', number: 1, title: 'Needs platform' }),
          makePullRequest({
            author: 'bob',
            number: 2,
            title: 'Already approved',
            url: 'https://github.com/acme/widgets/pull/2',
          }),
        ]}
        repository="acme/widgets"
      />,
    );

    expect(await screen.findByText('Waiting on @acme/platform')).toBeInTheDocument();
    expect(screen.getByText('Approved', { selector: '.state-approved' })).toBeInTheDocument();
    expect(screen.getByText('4 comments')).toBeInTheDocument();
    const people = screen.getByRole('group', { name: 'People' });
    expect(within(people).getByRole('option', { name: 'None on this page' })).toBeDisabled();
    expect(screen.getByRole('group', { name: 'Teams' })).toBeInTheDocument();
    const reviewStatus = within(screen.getByRole('radiogroup', { name: 'Review status' }));
    fireEvent.click(reviewStatus.getByRole('radio', { name: 'All' }));
    expect(screen.getAllByText('Approved', { selector: '.state-approved' })).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Filter by requested reviewer or team'), {
      target: { value: NO_OUTSTANDING_REQUEST_FILTER },
    });
    expect(screen.queryByText('Needs platform')).not.toBeInTheDocument();
    expect(screen.getByText('Already approved')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Filter by requested reviewer or team'), {
      target: { value: 'team:acme/platform' },
    });
    expect(screen.getByText('Needs platform')).toBeInTheDocument();
    expect(screen.queryByText('Already approved')).not.toBeInTheDocument();
  });

  it('opens the extension settings to add a PAT', async () => {
    render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={() => undefined}
        pullRequests={[makePullRequest()]}
        repository="acme/widgets"
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'GitHub data' }));
    expect(screen.getByRole('dialog', { name: 'Review queue settings' })).toBeInTheDocument();
    expect(screen.queryByText('Row density')).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: 'Add PAT' }));
    expect(settingsMessages.openExtensionSettings).toHaveBeenCalled();
  });

  it('removes a PAT and reloads review details', async () => {
    settingsMessages.loadGitHubTokenState.mockResolvedValue(true);
    reviewMetadataMock.mockResolvedValue({ message: 'Bad credentials', status: 'error' });
    render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={() => undefined}
        pullRequests={[makePullRequest()]}
        repository="acme/widgets"
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'GitHub data' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove PAT' }));

    expect(await screen.findByRole('button', { name: 'Add PAT' })).toBeInTheDocument();
    expect(settingsMessages.removeGitHubToken).toHaveBeenCalled();
    await waitFor(() => expect(reviewMetadataMock).toHaveBeenCalledTimes(2));
  });

  it('shows the GitHub API error inside queue settings', async () => {
    reviewMetadataMock.mockResolvedValue({
      message: 'Bad credentials',
      status: 'error',
    });
    render(
      <App
        currentUser="alice"
        onNativeVisibilityChange={() => undefined}
        pullRequests={[makePullRequest()]}
        repository="acme/widgets"
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: 'GitHub data' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Bad credentials');
  });
});
