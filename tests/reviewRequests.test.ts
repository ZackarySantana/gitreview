import { describe, expect, it } from 'vitest';
import { mapRequestedReviewers } from '../src/github/reviewRequests';

describe('mapRequestedReviewers', () => {
  it('maps private organization teams and users from the REST response', () => {
    expect(mapRequestedReviewers('evergreen-ci', {
      teams: [{ slug: 'evg-app' }, { slug: 'evg-ui' }],
      users: [{ login: 'octocat' }],
    })).toEqual([
      { id: 'team:evergreen-ci/evg-app', label: '@evergreen-ci/evg-app', type: 'team' },
      { id: 'team:evergreen-ci/evg-ui', label: '@evergreen-ci/evg-ui', type: 'team' },
      { id: 'user:octocat', label: '@octocat', type: 'user' },
    ]);
  });

  it('ignores malformed entries', () => {
    expect(mapRequestedReviewers('acme', {
      teams: [{}],
      users: [{}],
    })).toEqual([]);
  });
});
