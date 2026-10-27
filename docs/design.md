# Design Specification

The initial design direction was developed during implementation with the Claude CLI using the Claude Opus 5 model. The resulting proposal was reviewed and adapted to the extension's technical constraints.

## Product Principle

The review queue answers one question quickly: **which pull request should I review next?** Age is the primary hierarchy. Controls and metadata stay subordinate to that hierarchy.

## Page Anatomy

The extension mounts directly before GitHub's native PR list:

```text
Review toolbar
  GitHub | Review queue
  Search, result count, density, settings
  Quick filters
Settings panel, when open
Non-empty age zones, oldest first
```

GitHub's list receives the `hidden` attribute only while the queue is active and has parsed PRs. It is never removed or rearranged.

## Visual Language

- Inherit GitHub's system font and Primer theme variables.
- Use a neutral canvas for PR rows.
- Restrict zone tinting to headers and narrow patterned rails.
- Use red for overdue, orange for aging, amber for waiting, and green for new.
- Pair every color with a zone name, range, icon, count, and distinct rail pattern.
- Keep row titles visually dominant and metadata muted.

Comfortable rows show a two-line title, labels, author, number, and age. Compact rows reduce this to a single title line, number, draft state, and age.

## Zones

Zones render oldest first and disappear when empty. Defaults are 24, 48, and 168 hours. PRs within a zone are also sorted oldest first.

Each zone is a labeled section containing a semantic list. Headers include:

- Zone icon and patterned rail
- Human-readable name
- Exact range
- Visible PR count

## Toolbar

The segmented view toggle remains available at all times. Queue controls appear only in queue mode when GitHub has loaded PRs.

Search is local and covers title, number, author, labels, and loaded review requests. Readiness is one three-state segmented control: All, Ready, and Draft. Ready is selected by default. A second segmented control filters aggregate review status by Needs review, Changes requested, Approved, or All, with Needs review selected by default. Changes-requested decisions have their own category. Needs review contains review-required PRs and PRs with outstanding person or team requests. Approved contains approved PRs with no outstanding request. PRs without an explicit review state appear under All. Other quick-filter chips use `aria-pressed` and do not add checkmark icons.

When API enrichment is configured, a grouped dropdown filters by each distinct requested person or team on the loaded page, or by PRs with no outstanding request. Comfortable rows use one metadata line beginning with the author and followed by approval, changes-requested, outstanding requests, and comment information as available. Approval and an outstanding request can appear together. PR numbers remain searchable but are not shown in comfortable rows.

The interface explicitly marks result counts as page-scoped. A compact navigation row mirrors GitHub's pagination URLs at the top of the queue and labels default chronological navigation as newer or older PRs. Local queue filters persist across those page changes for the lifetime of the browser tab and are scoped to the repository and GitHub query.

## Threshold Editor

Three numbered pins define four ranges on a piecewise timeline. The scale gives most space to the first two weeks while still permitting values up to 90 days.

- Pins cannot cross and maintain at least a one-hour gap.
- Pointer dragging, arrow keys, Page Up/Down, Home/End, and numeric inputs are supported.
- Every pin exposes slider role, min/max/current values, and readable value text.
- Each boundary exposes separate days and hours inputs.
- Invalid values explain the legal range.
- Changes preview immediately and persist only after **Apply settings**.
- Reset restores 1 day, 2 days, and 1 week.

Queue settings also contain a GitHub data section with a single button: **Add PAT** opens the extension options page, where the token is entered, and **Remove PAT** clears a stored token. API errors appear directly in settings. Row density remains a toolbar action rather than a settings field.

## Responsive Behavior

Container queries respond to the available GitHub content width rather than the browser window.

- Below 768px, the view toggle takes a complete row and filters remain horizontally available.
- Below 640px, secondary row metadata and labels disappear.
- Below 480px, settings stack and threshold pins gain larger touch targets.
- The extension must not create page-level horizontal scrolling at 360px.

## Accessibility

- Complete keyboard operation and visible focus indicators
- WCAG AA text contrast in GitHub light and dark themes
- No color-only meaning
- Semantic sections, headings, lists, links, tabs, and pressed states
- Polite result-count announcements
- Reduced-motion and forced-colors support
- Native anchor behavior for opening PRs in new tabs
- No focus trap in the inline settings panel

## Failure And Empty States

- Empty zones do not render.
- If filters remove every PR, one global empty state explains that filtering covers the current page and offers **Clear filters**.
- If the repository has no PRs, GitHub's own empty state remains visible.
- If GitHub's DOM is not recognized, the extension does not mount or restores the native list.

## Deferred Design

Completed reviewer histories, commenter identities, unresolved discussions, CI state, saved filter presets, and card layouts remain later phases. They must use documented APIs rather than GitHub's internal web endpoints.
