import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/storage/settings';

describe('normalizeSettings', () => {
  it('accepts valid persisted settings', () => {
    expect(normalizeSettings({
      defaultView: 'github',
      density: 'compact',
      thresholds: [12, 72, 240],
    })).toEqual({
      defaultView: 'github',
      density: 'compact',
      thresholds: [12, 72, 240],
    });
  });

  it('replaces invalid thresholds with defaults', () => {
    expect(normalizeSettings({ thresholds: [48, 24, 168] }).thresholds)
      .toEqual(DEFAULT_SETTINGS.thresholds);
  });
});
