import { browser } from 'wxt/browser';
import type { Settings } from '../types';

const STORAGE_KEY = 'gitreviewSettings';
const TOKEN_STORAGE_KEY = 'gitreviewGitHubToken';

export const DEFAULT_SETTINGS: Settings = {
  defaultView: 'queue',
  density: 'comfortable',
  thresholds: [24, 48, 168],
};

function isValidThresholds(value: unknown): value is Settings['thresholds'] {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((entry) => typeof entry === 'number' && Number.isFinite(entry)) &&
    value[0]! >= 1 &&
    value[0]! < value[1]! &&
    value[1]! < value[2]! &&
    value[2]! <= 2160
  );
}

export function normalizeSettings(value: unknown): Settings {
  if (!value || typeof value !== 'object') return DEFAULT_SETTINGS;
  const candidate = value as Partial<Settings>;

  return {
    defaultView: candidate.defaultView === 'github' ? 'github' : DEFAULT_SETTINGS.defaultView,
    density: candidate.density === 'compact' ? 'compact' : DEFAULT_SETTINGS.density,
    thresholds: isValidThresholds(candidate.thresholds)
      ? [...candidate.thresholds]
      : [...DEFAULT_SETTINGS.thresholds],
  };
}

export async function loadSettings(): Promise<Settings> {
  const stored = await browser.storage.sync.get(STORAGE_KEY);
  return normalizeSettings(stored[STORAGE_KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await browser.storage.sync.set({ [STORAGE_KEY]: settings });
}

export async function loadGitHubToken(): Promise<string> {
  const stored = await browser.storage.local.get(TOKEN_STORAGE_KEY);
  return typeof stored[TOKEN_STORAGE_KEY] === 'string' ? stored[TOKEN_STORAGE_KEY].trim() : '';
}

export async function saveGitHubToken(token: string): Promise<void> {
  const normalized = token.trim();
  if (!normalized) {
    await browser.storage.local.remove(TOKEN_STORAGE_KEY);
    return;
  }
  await browser.storage.local.set({ [TOKEN_STORAGE_KEY]: normalized });
}
