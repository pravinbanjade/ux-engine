---
id: UX-047
title: Async content has no loading state
category: state-coverage
severity: high
detection: model
appliesTo: [list, table, detail-view, form-submit]
---
## Signal
A component that fetches data or submits a request renders nothing —
literally an empty container, or the previous screen's stale content — for
the entire span between the request firing and the response landing, with no
spinner, skeleton, disabled control, or other signal that work is in
progress.

## Why it fails
Without a loading signal the user cannot distinguish "the system is working
on this" from "nothing happened" or "it's broken," which on a slow network or
a slow endpoint reliably produces a second click, a page refresh, or a
duplicate form submission — the exact failure mode a loading state exists to
prevent, at the exact moment latency makes it likely.

## Fix
Render a state that's visibly distinct from both the empty and the loaded
states — a skeleton matching the eventual layout for content fetches, or a
disabled/spinner-bearing submit control for form submissions — for any
request expected to take longer than roughly 300-500ms, so fast responses
don't flash a loader pointlessly but slow ones are never silent.

## Counter-example — when this is fine
An operation backed by an optimistic update where the UI already reflects the
expected end state immediately and the network call is reconciling in the
background with a rollback path on failure — showing a loading state there
would contradict the optimistic update's whole purpose, which is to make the
action feel instant rather than pending.
