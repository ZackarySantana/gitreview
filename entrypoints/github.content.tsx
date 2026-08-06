import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { App } from '../src/App';
import { parsePullRequestPage } from '../src/github/parser';
import { getQueueFilterStorageKey } from '../src/storage/filters';
import styles from '../assets/review-queue.css?inline';

export default defineContentScript({
  matches: ['https://github.com/*/*/pulls*'],
  runAt: 'document_idle',
  main() {
    let host: HTMLElement | null = null;
    let reactRoot: Root | null = null;
    let nativeList: HTMLElement | null = null;
    let nativeListWasHidden = false;
    let syncTimer: number | null = null;

    function cleanup() {
      if (nativeList?.isConnected) nativeList.hidden = nativeListWasHidden;
      reactRoot?.unmount();
      host?.remove();
      host = null;
      reactRoot = null;
      nativeList = null;
    }

    function mount() {
      const page = parsePullRequestPage(document);
      if (!page) {
        cleanup();
        return;
      }

      if (!host?.isConnected || nativeList !== page.listElement) {
        cleanup();
        nativeList = page.listElement;
        nativeListWasHidden = nativeList.hidden;
        host = document.createElement('div');
        host.id = 'gitreview-extension';
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = styles;
        const appRoot = document.createElement('div');
        shadowRoot.append(style, appRoot);
        nativeList.parentElement?.insertBefore(host, nativeList);
        reactRoot = createRoot(appRoot);
      }

      reactRoot?.render(
        <React.StrictMode>
          <App
            currentUser={page.currentUser}
            key={getQueueFilterStorageKey(page.repository, window.location.href)}
            onNativeVisibilityChange={(visible) => {
              if (nativeList?.isConnected) nativeList.hidden = visible ? nativeListWasHidden : true;
            }}
            pagination={page.pagination}
            pullRequests={page.pullRequests}
            repository={page.repository}
          />
        </React.StrictMode>,
      );
    }

    function scheduleMount() {
      if (syncTimer !== null) window.clearTimeout(syncTimer);
      syncTimer = window.setTimeout(mount, 80);
    }

    const observer = new MutationObserver(scheduleMount);
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('turbo:load', scheduleMount);
    window.addEventListener('popstate', scheduleMount);
    mount();

    return () => {
      observer.disconnect();
      document.removeEventListener('turbo:load', scheduleMount);
      window.removeEventListener('popstate', scheduleMount);
      if (syncTimer !== null) window.clearTimeout(syncTimer);
      cleanup();
    };
  },
});
