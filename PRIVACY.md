# Privacy Policy

Last updated: August 6, 2026

gitreview processes pull-request information locally in the browser.

## Data The Extension Reads

On supported GitHub repository pull-request pages, it reads information already rendered in the page, including PR titles, numbers, links, authors, labels, draft state, opening timestamps, review status, and conversation counts.

## Data The Extension Stores

It stores user interface preferences such as the selected view, row density, and age thresholds using the browser's synchronized extension storage. Local queue filters are stored in tab-scoped browser session storage and expire when that tab closes.

If the user configures a GitHub personal access token, the token is stored separately in the browser's local extension storage. It is not synchronized. The extension does not store the token in page content, URLs, or logs.

## Data The Extension Sends

The extension does not send data to the project maintainers and has no analytics, advertising, project-operated server, or remote executable code.

Chrome and Firefox may synchronize settings according to the user's browser account and privacy settings. GitHub continues to receive normal browser requests made while using its website.

When an optional token is configured, the background worker sends the current repository name and loaded PR numbers to GitHub's API. It uses GraphQL for aggregate review state and conversation counts, plus the REST requested-reviewers endpoint when GraphQL redacts a private team. The token is sent only to `https://api.github.com`. In Firefox, this sharing is covered by optional data collection permissions for authentication information and website content. Firefox asks for them when the token is saved, and the extension makes no API requests while they are withheld or revoked. Removing the token also revokes them.

gitreview does not sell user data or share it with advertisers, data brokers, or other third parties. Data is disclosed only to the browser vendor's sync service for storage synchronization and to GitHub when required to provide the extension's requested functionality.

## Removing Data

Removing the token in queue settings clears it from local storage. Uninstalling the extension removes its local data. Synchronized settings can also be removed through the browser's extension data controls.

## Contact

For privacy questions, open an issue at <https://github.com/ZackarySantana/gitreview/issues>. Do not include tokens or private repository information. Report sensitive concerns through a private GitHub security advisory.
