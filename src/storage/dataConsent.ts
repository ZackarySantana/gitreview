import { browser } from 'wxt/browser';

// Firefox's built-in data consent covers what the optional GitHub token sends to
// api.github.com: the token itself and the repository and PR numbers on the
// page. Other browsers have no equivalent, so consent there is implied by
// saving a token.
const GITHUB_DATA_COLLECTION = ['authenticationInfo', 'websiteContent'];

interface DataCollectionPermissions {
  data_collection: string[];
}

interface FirefoxPermissionsApi {
  contains(permissions: DataCollectionPermissions): Promise<boolean>;
  remove(permissions: DataCollectionPermissions): Promise<boolean>;
  request(permissions: DataCollectionPermissions): Promise<boolean>;
}

function firefoxPermissions(): FirefoxPermissionsApi {
  return browser.permissions as unknown as FirefoxPermissionsApi;
}

/** Must be called synchronously from a user input handler. */
export function requestGitHubDataConsent(): Promise<boolean> {
  if (!import.meta.env.FIREFOX) return Promise.resolve(true);
  return firefoxPermissions().request({ data_collection: GITHUB_DATA_COLLECTION });
}

export async function hasGitHubDataConsent(): Promise<boolean> {
  if (!import.meta.env.FIREFOX) return true;
  return firefoxPermissions().contains({ data_collection: GITHUB_DATA_COLLECTION });
}

export async function revokeGitHubDataConsent(): Promise<void> {
  if (!import.meta.env.FIREFOX) return;
  await firefoxPermissions().remove({ data_collection: GITHUB_DATA_COLLECTION });
}
