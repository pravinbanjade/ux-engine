---
id: UX-060
title: The error state offers no way to retry
category: state-coverage
severity: high
detection: model
appliesTo: [page, list, detail-view]
---
## Signal
The component has an error branch — a caught rejection, an `error` field from
the data layer, a boolean flag — and what it renders is terminal: a message,
an icon, perhaps an apology, and no control that re-runs the request. The
fetching function is in scope and callable, but nothing in the rendered tree
calls it. Reloading the whole page is the only path forward the interface
leaves open.

## Why it fails
Most failures the user meets are transient: a dropped connection, a request
that timed out, a service that was restarting. The user knows this, which is
why their instinct is to try again — and the interface has taken that away,
leaving a full page reload as the only remedy, which discards scroll position,
filter state and anything half-typed elsewhere on the screen. A one-second
inconvenience becomes a restart of the whole task.

## Fix
Render a retry control inside the error state that re-invokes the same fetch,
styled from the profile's secondary action variant rather than a new one, and
keep the surrounding layout mounted so filters, scroll position and unsaved
input survive the retry. Where repeated attempts are likely to keep failing,
back the control with a limit and change the message once it is reached.

## Counter-example — when this is fine
An error that retrying cannot resolve: a 404 for a record that does not exist,
a validation rejection of data the user must change first, or an authorisation
failure. Offering retry there invites the user to press a button that is
guaranteed to fail, which is worse than the honest dead end.
