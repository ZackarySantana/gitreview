import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { loadGitHubToken, saveGitHubToken } from '../../src/storage/settings';
import './style.css';

export function Options() {
  const [token, setToken] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void loadGitHubToken().then((storedToken) => {
      const hasToken = Boolean(storedToken);
      setConfigured(hasToken);
      if (window.parent !== window) {
        window.parent.postMessage({ configured: hasToken, type: 'gitreview-token-state' }, '*');
      }
    }).catch(() => {
      setError('The existing token could not be loaded.');
    }).finally(() => setLoading(false));
  }, []);

  function notifyParent(hasToken: boolean) {
    if (window.parent !== window) {
      window.parent.postMessage({ configured: hasToken, type: 'gitreview-token-changed' }, '*');
    }
  }

  async function save() {
    if (!token.trim()) return;
    setError(null);
    try {
      await saveGitHubToken(token);
      setToken('');
      setConfigured(true);
      notifyParent(true);
    } catch {
      setError('The token could not be saved.');
    }
  }

  async function remove() {
    setError(null);
    try {
      await saveGitHubToken('');
      setConfigured(false);
      notifyParent(false);
    } catch {
      setError('The token could not be removed.');
    }
  }

  return (
    <main>
      <div className="standalone-only">
        <p className="eyebrow">gitreview</p>
        <h1>GitHub data</h1>
        <p className="lede">Optional review details.</p>
      </div>

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

const root = document.getElementById('root');
if (!root) throw new Error('Options root is missing.');
const searchParams = new URLSearchParams(window.location.search);
if (searchParams.has('embedded')) {
  document.documentElement.dataset.embedded = 'true';
  document.documentElement.dataset.theme = searchParams.get('theme') === 'dark' ? 'dark' : 'light';
}
createRoot(root).render(<Options />);
