# Architecture

## Runtime

gitreview is a Manifest V3 content-script extension built with WXT, React, and TypeScript.

```text
GitHub document
  -> route and DOM parser
  -> normalized PullRequestSummary values
  -> optional background GitHub API enrichment
  -> local filters
  -> age-zone grouping
  -> React UI in an open Shadow Root
```

GitHub serves two repository pull request list layouts: the classic Rails-rendered list (`.js-issue-row` rows) and the refreshed React list view (`ul[data-listview-component="items-list"]`). The parser detects the refreshed list first and falls back to the classic list, producing the same domain values for both. The GitHub / Review queue view toggle behaves identically on either layout.

The content script observes GitHub's client-side navigation and list replacement. It reparses after relevant DOM mutations and reuses the React root while its host stays connected. When GitHub replaces the native list element, the controller restores the old element, applies the current view to the new one, and moves the host in front of it without resetting queue state. If GitHub's React app removes the host, for example during hydration, the controller mounts a fresh one.

The refreshed layout renders review status after the list itself loads, and `relative-time` only gains its `datetime` attribute after hydration. Rows without a timestamp are skipped until a later mutation reparses them.

The token-free parser reads native conversation counts, best-effort review state, and GitHub's pagination links. The queue uses those links directly so search and sort qualifiers survive page navigation. When API enrichment is configured, the Manifest V3 background worker sends one aliased GraphQL query for the currently loaded PR numbers and returns aggregate review state, conversation counts, and outstanding requested people and teams. GitHub redacts private teams as null GraphQL reviewers, so the worker uses the documented REST requested-reviewers endpoint only for affected PRs. The content script never receives the token.

## Safety Boundary

`src/github/parser.ts` contains GitHub-specific selectors and converts the native list to stable domain values. Components do not query or mutate GitHub DOM.

The controller records the native list's original `hidden` state. It restores that state when switching views, navigating away, replacing the list, or unloading the content script.

## Domain

`src/domain/zones.ts` and `src/domain/filters.ts` are pure functions. Timestamps are compared in elapsed hours, independent of display timezone and daylight-saving changes.

Settings contain only:

```ts
interface Settings {
  defaultView: 'github' | 'queue';
  density: 'comfortable' | 'compact';
  thresholds: [number, number, number];
}
```

Thresholds are ascending hours in the inclusive range 1-2160. Invalid persisted settings fall back to defaults.

## Styling

The UI lives in Shadow DOM so extension rules cannot affect GitHub and GitHub selectors cannot unexpectedly style extension components. CSS custom properties still inherit through the host, allowing Primer's active light, dark, contrast, or colorblind theme to supply tokens.

## Tests

- Domain tests cover boundaries, ordering, filtering, and invalid settings.
- Parser tests use sanitized GitHub HTML fixtures for both the classic and refreshed list layouts.
- Component tests cover threshold keyboard behavior, zones, filtering, and view changes.
- Playwright loads the built extension into Chromium and verifies injection, grouping, and native-list restoration against intercepted classic and refreshed GitHub fixtures, including refreshed list replacement.

## API Layer

Review metadata uses GitHub's documented GraphQL and REST APIs behind `entrypoints/background.ts`. Authentication is optional, least-privileged, explicitly documented, and never required for the basic age queue. The token is stored in `chrome.storage.local`; interface settings remain in `chrome.storage.sync`.

The compact token form appears in queue settings but is served from `chrome-extension://.../options.html` in a web-accessible iframe. GitHub cannot inspect the iframe's token field because it has a separate origin.

The requested-review filter contains identities with an outstanding request on the loaded PRs. It does not enumerate every collaborator or team eligible to receive a future request.
