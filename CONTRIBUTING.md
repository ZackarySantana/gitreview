# Contributing

Contributions are welcome. Keep changes focused, accessible, and safe for GitHub's native interface.

## Setup

```sh
npm ci
npm run build
```

Load `.output/chrome-mv3` as an unpacked Chrome extension. Use `npm run dev` while iterating.

## Before Opening A Pull Request

Run:

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

Run `npm run test:e2e` when changing content-script mounting, GitHub parsing, view visibility, or navigation behavior.

## Guidelines

- Preserve GitHub's native list; hide it temporarily rather than deleting or moving its rows.
- Keep GitHub selectors in `src/github/parser.ts` and add a fixture for every supported DOM shape.
- Do not add permissions, telemetry, remote services, or authentication behavior without documenting the need and privacy impact.
- Keep API tokens in local extension storage and background-worker memory; never expose them to content scripts or synchronized storage.
- Never communicate status using color alone.
- Ensure every interaction works with a keyboard and at a 360px viewport.
- Add settings migrations before changing persisted data shapes.

Please describe behavior changes and manual testing in the pull request. Do not include real private-repository HTML in fixtures.
