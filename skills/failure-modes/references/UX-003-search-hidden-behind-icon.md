---
id: UX-003
title: Search collapsed behind an icon with no visible input
category: information-architecture
severity: medium
detection: model
appliesTo: [toolbar, navbar, list]
---
## Signal
A magnifying-glass icon with no adjacent text input, label, or placeholder,
on a screen whose primary content is a list, catalog, or table long enough
that scanning it end to end is impractical (roughly 20+ items or paginated
content) — search only appears after a click that opens a field or overlay.

## Why it fails
Search is a high-frequency, high-intent action on any content list past a
handful of items; a user who wants to search has already decided to type, but
the icon forces an extra click to reveal what they type into, and on first
visit they may not even recognize the icon as search versus filter or zoom.
The cost compounds because the icon-only affordance also hides that search
exists at all to users scanning the toolbar quickly.

## Fix
Show the input itself — a persistent search field with a placeholder like
"Search invoices" — rather than an icon that must be clicked to reveal it.
Reserve the icon-only, expand-on-click pattern for toolbars that are
genuinely width-constrained (a dense mobile header) and even then keep the
icon labelled via `aria-label` and place it where users expect search to sit
in this codebase's existing navbar convention.

## Counter-example — when this is fine
A toolbar on a narrow viewport (a phone-width header) where every other
persistent element would be pushed off-screen by an inline field, and tapping
the icon reveals a full-width search input immediately with no additional
navigation — the collapse buys width without adding a decision step. Also
fine when the list below is short and fully visible without scrolling, where
search would be a redundant affordance over a page a user can simply scan.
