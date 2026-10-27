import { useEffect, useState } from 'react';
import { removeGitHubToken } from '../../src/settingsMessages';
import { requestGitHubDataConsent } from '../../src/storage/dataConsent';
import { loadGitHubToken, saveGitHubToken } from '../../src/storage/settings';

export function Options() {
  const [token, setToken] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadGitHubToken().then((storedToken) => {
      setConfigured(Boolean(storedToken));
    }).catch(() => {
      setError('The existing token could not be loaded.');
    }).finally(() => setLoading(false));
  }, []);

  async function save() {
    if (!token.trim()) return;
    setError(null);
    try {
      if (!await requestGitHubDataConsent()) {
        setError('Saving a token needs permission to send it and this page\'s PR numbers to GitHub.');
        return;
      }
      await saveGitHubToken(token);
      setToken('');
      setConfigured(true);
    } catch {
      setError('The token could not be saved.');
    }
  }

  async function remove() {
    setError(null);
    try {
      await removeGitHubToken();
      setConfigured(false);
    } catch {
      setError('The token could not be removed.');
    }
  }

  return (
    <main>
      <p className="eyebrow">gitreview</p>
      <h1>GitHub data</h1>
      <p className="lede">Optional review details.</p>

      <section>
        {!loading && configured ? (
          <button className="secondary" onClick={() => void remove()} type="button">Remove</button>
        ) : null}
        {!loading && !configured ? (
          <>
            <div className="token-row">
              <label className="sr-only" htmlFor="github-token">GitHub token</label>
              <input
                autoComplete="off"
                id="github-token"
                onChange={(event) => setToken(event.target.value)}
                placeholder="GitHub token"
                type="password"
                value={token}
              />
              <button disabled={!token.trim()} onClick={() => void save()} type="button">Save</button>
            </div>
            <a href="https://github.com/settings/personal-access-tokens/new" rel="noreferrer" target="_blank">
              Create token
            </a>
          </>
        ) : null}
        {error ? <p className="error" role="alert">{error}</p> : null}
      </section>
    </main>
  );
}
