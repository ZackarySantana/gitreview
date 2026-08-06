import { beforeEach, describe, expect, it } from 'vitest';
import {
  getQueueFilterStorageKey,
  loadQueueFilters,
} from '../src/storage/filters';

describe('queue filter storage', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('uses the same scope across GitHub pagination URLs', () => {
    const first = getQueueFilterStorageKey(
      'acme/widgets',
      'https://github.com/acme/widgets/pulls?q=is%3Apr&page=1',
    );
    const second = getQueueFilterStorageKey(
      'acme/widgets',
      'https://github.com/acme/widgets/pulls?q=is%3Apr&page=2&after=cursor',
    );
    expect(second).toBe(first);
  });

  it('falls back safely for invalid persisted values', () => {
    window.sessionStorage.setItem('filters', JSON.stringify({
      draftFilter: 'invalid',
      query: 42,
      quickFilters: ['mine', 'invalid'],
      reviewFilter: 'invalid',
    }));
    expect(loadQueueFilters('filters')).toEqual({
      draftFilter: 'ready',
      query: '',
      quickFilters: ['mine'],
      requestedFilter: '',
      reviewFilter: 'needs-review',
    });
  });
});
