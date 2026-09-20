---
id: UX-048
title: Failed request has no visible error state
category: state-coverage
severity: high
detection: model
appliesTo: [list, form, detail-view]
---
## Signal
The code path for a failed fetch or submission (a caught exception, a
non-2xx response, a rejected promise) either renders nothing distinct from
the loading or empty state, or only logs to the console — there is no
branch in the component that shows the user text explaining that the
operation did not succeed.

## Why it fails
A user staring at a screen that looks like it's still loading, or has
quietly reverted to empty, after their action failed has no way to know
whether to wait, retry, or that anything went wrong at all — they lose the
data they entered and the time they spent, without ever being told either
happened, which is a strictly worse experience than an ugly error message.

## Fix
Give failure its own rendered state, distinct from loading and empty: a
message that says what failed in the user's terms (not the raw error or
stack trace) and, wherever the failure is plausibly transient, a retry
action that re-runs the same request rather than sending the user back to
start over.

## Counter-example — when this is fine
A background sync or prefetch the user never directly triggered and whose
failure has no user-facing consequence because it retries silently and
transparently on its own schedule — surfacing every transient background
failure as a visible error would train users to ignore error messages
generally, which costs more than the silent retry saves.
