import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Options } from '../entrypoints/options/Options';

const requestGitHubDataConsent = vi.hoisted(() => vi.fn(() => Promise.resolve(true)));
const removeGitHubToken = vi.hoisted(() => vi.fn(() => Promise.resolve()));
const settings = vi.hoisted(() => ({
  loadGitHubToken: vi.fn(() => Promise.resolve('')),
  saveGitHubToken: vi.fn(() => Promise.resolve()),
}));

vi.mock('../src/storage/dataConsent', () => ({ requestGitHubDataConsent }));
vi.mock('../src/settingsMessages', () => ({ removeGitHubToken }));
vi.mock('../src/storage/settings', () => settings);

describe('Options', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestGitHubDataConsent.mockResolvedValue(true);
    settings.loadGitHubToken.mockResolvedValue('');
  });

  it('saves a token after consent', async () => {
    render(<Options />);

    fireEvent.change(await screen.findByLabelText('GitHub token'), {
      target: { value: 'github_pat_test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('button', { name: 'Remove' })).toBeInTheDocument();
    expect(requestGitHubDataConsent).toHaveBeenCalled();
    expect(settings.saveGitHubToken).toHaveBeenCalledWith('github_pat_test');
  });

  it('reports a consent request that throws', async () => {
    requestGitHubDataConsent.mockImplementation(() => {
      throw new Error('permissions is undefined');
    });
    render(<Options />);

    fireEvent.change(await screen.findByLabelText('GitHub token'), {
      target: { value: 'github_pat_test' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('The token could not be saved.');
    expect(settings.saveGitHubToken).not.toHaveBeenCalled();
  });

  it('removes the token through the background worker', async () => {
    settings.loadGitHubToken.mockResolvedValue('github_pat_test');
    render(<Options />);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));

    expect(await screen.findByLabelText('GitHub token')).toBeInTheDocument();
    expect(removeGitHubToken).toHaveBeenCalled();
  });
});
