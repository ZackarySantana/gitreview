# Security Policy

## Reporting A Vulnerability

Please report vulnerabilities privately through the repository's GitHub security advisory feature when it is available. Do not include access tokens, private repository content, or other secrets in a public issue.

Include the affected version, reproduction steps, impact, and any suggested mitigation. Maintainers should acknowledge a report within seven days and coordinate disclosure after a fix is available.

## Security Model

- The extension uses Manifest V3.
- It does not execute remote code.
- API enrichment is optional; configured GitHub tokens are stored only in local extension storage and are used only by the background worker.
- Tokens are never synchronized, injected into GitHub pages, placed in URLs, or logged.
- Queue settings embed an extension-origin iframe; the token input is not part of GitHub's document origin.
- It limits execution to GitHub repository pull-request list pages.
- Its UI is isolated in Shadow DOM.
- A parser failure restores the native GitHub list.
- Review metadata uses GitHub's documented GraphQL and REST endpoints rather than internal web endpoints.

Dependency and permission changes should be treated as security-sensitive during review.
