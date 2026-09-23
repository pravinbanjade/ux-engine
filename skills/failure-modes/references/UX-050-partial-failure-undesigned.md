---
id: UX-050
title: One failed source among several takes the whole screen with it
category: state-coverage
severity: high
detection: model
appliesTo: [dashboard, list, detail-view]
---
## Signal
The screen composes several independent requests — separate tiles, panels or
sections, each with its own source — but the component holds one loading flag
and one error flag across all of them. A single rejection either blanks the
entire screen behind one error message, or is swallowed and leaves that region
rendering as though it had no data.

## Why it fails
Both outcomes are wrong in the same way: the screen has stopped
distinguishing between what it knows and what it does not. A user shown a
blank page cannot reach the four sections that loaded fine. A user shown a
zero in a tile that actually failed to load will act on that zero — report it,
plan around it, escalate it — and nothing on screen suggested the number was
never fetched.

## Fix
Give each independently-sourced region its own loading and error state, so a
failure renders in place, names which source failed, and leaves the rest of
the screen usable. Where one region's failure genuinely invalidates a figure
computed from several, mark the derived value unavailable rather than showing
it computed from a partial set.

## Counter-example — when this is fine
A screen whose regions are all projections of one request. There is only one
source, so one error state is an accurate description of what went wrong.
