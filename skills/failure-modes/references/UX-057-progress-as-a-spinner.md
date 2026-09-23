---
id: UX-057
title: Known progress reported as an indeterminate spinner
category: state-coverage
severity: medium
detection: model
appliesTo: [page, modal, toast]
---
## Signal
An operation that proceeds through a known set of steps, or over a countable
set of items, reports itself with an indeterminate indicator alone. The loop
or the pipeline knows how many remain — the count is in scope — and none of it
reaches the rendered output, which spins identically at one per cent and at
ninety-nine.

## Why it fails
The user cannot distinguish slow from stuck, so they wait, then guess. Some
close the tab partway through a batch import; others sit through a hang that
ended twenty minutes ago. A long operation with no reported progress also
cannot be planned around — the user cannot decide whether to wait or come
back, which is the only decision they have during it.

## Fix
Report what the code already knows: items completed against the total, the
stage by name, or both. Where the total is discovered partway through, start
with the stage name and switch to a proportion once it is known, and keep the
indeterminate indicator only for work whose extent genuinely cannot be
established.

## Counter-example — when this is fine
An operation that completes in well under a second in normal conditions, where
the indicator exists only to cover the occasional slow response. There is no
progress to report before it has finished.
