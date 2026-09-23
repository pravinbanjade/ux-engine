---
id: UX-056
title: Cached figures rendered as though they were current
category: state-coverage
severity: medium
detection: model
appliesTo: [dashboard, stat-tile, chart]
---
## Signal
Values come from a cache or a polling interval, and nothing on screen records
when they were fetched. No timestamp, no refresh control, no treatment
distinguishing a figure from ten seconds ago from one from an hour ago —
during a pending refresh the old numbers continue to render as if they were
the new ones.

## Why it fails
Numbers on a dashboard are acted on: someone decides to intervene, or not to,
based on what the tile says. A figure that is quietly an hour old produces a
decision made against a world that has moved, and the user has no way to know
they should have waited. The failure is invisible by construction — a stale
number looks exactly as authoritative as a fresh one.

## Fix
Render the fetch time beside the data, in the profile's muted label
treatment, and mark the figures visibly stale while a refresh is in flight
rather than leaving the previous values looking current. Give the user a
refresh control so the choice to re-fetch is theirs when the interval is long.

## Counter-example — when this is fine
A figure that is inherently historical and labelled as such — last month's
close, yesterday's total. The period in the label already says when it is
from, and a fetch time would describe the query rather than the data.
