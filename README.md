# gitreview

Chrome extension that provides an enhanced GitHub pull requests page. It adds
an age-based review queue, focused local filters, review status, requested-team
context, and convenient navigation between newer and older PR pages.

![gitreview enhancing a GitHub pull requests page](store-assets/screenshot-review-queue-1280x800.png)

## Build

```bash
npm ci
npm run build        # bundles to .output/chrome-mv3/
npm run dev          # development build with WXT
```

## Load in Chrome

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked** and select `.output/chrome-mv3`.
3. Visit a repository pull-request page such as
   <https://github.com/evergreen-ci/evergreen/pulls>.

The age queue works without a token. Optionally open queue settings and add a
fine-grained GitHub token with read-only **Pull requests** and
**Metadata** access for reliable approval state and private requested teams.

## Tests

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

## Layout

```text
entrypoints/background.ts       GitHub API enrichment and private-team fallback
entrypoints/github.content.tsx  GitHub content script and Shadow DOM mount
entrypoints/options/            optional token settings
src/github/                     GitHub page parser and API messaging
src/domain/                     pure filtering and age-zone logic
src/storage/                    synchronized settings and tab-scoped filters
assets/                         extension styles and brand artwork
tests/                          unit, component, parser, and browser tests
```

## Privacy

gitreview has no analytics, advertising, remote code, or project-operated
server. Optional tokens stay in Chrome's local extension storage and are sent
only to GitHub. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md).

## License

[MIT](LICENSE)
