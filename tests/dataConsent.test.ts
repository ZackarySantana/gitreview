import { afterEach, describe, expect, it, vi } from 'vitest';

const permissions = vi.hoisted(() => ({
  contains: vi.fn(() => Promise.resolve(false)),
  remove: vi.fn(() => Promise.resolve(true)),
  request: vi.fn(() => Promise.resolve(true)),
}));

vi.mock('wxt/browser', () => ({ browser: { permissions } }));

const {
  hasGitHubDataConsent,
  requestGitHubDataConsent,
  revokeGitHubDataConsent,
} = await import('../src/storage/dataConsent');

const dataCollection = { data_collection: ['authenticationInfo', 'websiteContent'] };

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe('GitHub data consent', () => {
  it('is implied outside Firefox', async () => {
    await expect(requestGitHubDataConsent()).resolves.toBe(true);
    await expect(hasGitHubDataConsent()).resolves.toBe(true);
    await revokeGitHubDataConsent();
    expect(permissions.request).not.toHaveBeenCalled();
    expect(permissions.remove).not.toHaveBeenCalled();
  });

  it('uses Firefox optional data collection permissions', async () => {
    vi.stubEnv('FIREFOX', 'true');

    await expect(requestGitHubDataConsent()).resolves.toBe(true);
    await expect(hasGitHubDataConsent()).resolves.toBe(false);
    await revokeGitHubDataConsent();

    expect(permissions.request).toHaveBeenCalledWith(dataCollection);
    expect(permissions.contains).toHaveBeenCalledWith(dataCollection);
    expect(permissions.remove).toHaveBeenCalledWith(dataCollection);
  });
});
