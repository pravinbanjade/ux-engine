---
id: UX-055
title: A user without access is told there is nothing here
category: state-coverage
severity: high
detection: model
appliesTo: [page, detail-view, list]
---
## Signal
An authorisation rejection falls through to the same branch as a zero-length
result, so the screen renders its empty state — or the rejection is unhandled
and the screen throws. Nothing distinguishes "you may not see this" from
"this does not exist", and no path to requesting access appears anywhere.

## Why it fails
The user draws the wrong conclusion and acts on it: they report missing data,
recreate a record that already exists, or tell a colleague the thing was
deleted. The person who could grant them access is never asked, because
nothing suggested access was the issue. On a shared record, a duplicate
created this way is worse than the original denial.

## Fix
Branch on authorisation separately from emptiness, state plainly that access
is the obstacle, and name what to do about it — the owner to ask, the request
control, the role required. Keep the wording free of detail the user is not
cleared to learn, which is a reason to word it carefully rather than a reason
to render nothing.

## Counter-example — when this is fine
A surface where confirming a record exists is itself a disclosure — probing
for whether an account is registered, or whether a document was ever filed.
There the indistinguishable response is deliberate.
