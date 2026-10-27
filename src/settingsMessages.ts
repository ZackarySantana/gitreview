import { browser } from 'wxt/browser';

// Token settings requests that only the background worker can fulfil. Content
// scripts cannot open the options page, and they learn only whether a token is
// stored, never the token itself.
export type SettingsMessage =
  | { type: 'get-github-token-state' }
  | { type: 'open-options-page' }
  | { type: 'remove-github-token' };

const SETTINGS_MESSAGE_TYPES = new Set<unknown>([
  'get-github-token-state',
  'open-options-page',
  'remove-github-token',
]);

export function isSettingsMessage(message: unknown): message is SettingsMessage {
  if (!message || typeof message !== 'object') return false;
  return SETTINGS_MESSAGE_TYPES.has((message as { type?: unknown }).type);
}

/** Background replies: `ok` reports success, and `configured` is the token state. */
export interface SettingsResponse {
  configured?: boolean;
  ok: boolean;
}

async function sendSettingsMessage(message: SettingsMessage): Promise<SettingsResponse> {
  const response: SettingsResponse | undefined = await browser.runtime.sendMessage(message);
  if (!response?.ok) throw new Error(`The background worker could not handle ${message.type}.`);
  return response;
}

export async function loadGitHubTokenState(): Promise<boolean> {
  const { configured } = await sendSettingsMessage({ type: 'get-github-token-state' });
  return configured === true;
}

export async function openExtensionSettings(): Promise<void> {
  await sendSettingsMessage({ type: 'open-options-page' });
}

export async function removeGitHubToken(): Promise<void> {
  await sendSettingsMessage({ type: 'remove-github-token' });
}
