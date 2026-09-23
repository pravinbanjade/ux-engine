---
id: UX-054
title: Losing the connection is reported as a server error
category: state-coverage
severity: medium
detection: model
appliesTo: [page, form, list]
---
## Signal
Every request path assumes the network is reachable. A dropped connection
enters the same catch as a server rejection and renders the same generic
message, connectivity is never checked or reported, and user input that was
mid-flight when the connection went is discarded along with the failed
request.

## Why it fails
The two failures call for opposite responses: a server error means wait or
report it, a lost connection means reconnect and try again. Telling a user on
a train that something went wrong on the server sends them to support for a
problem that resolves itself in a tunnel's length. Losing their typed input on
top of that turns a recoverable interruption into repeated work.

## Fix
Distinguish connectivity loss from server failure in the error branch and say
which one occurred, using the profile's error treatment for both but different
copy. Hold unsent input in local state rather than discarding it, and offer to
resubmit once the connection returns, so the interruption costs a wait instead
of the work.

## Counter-example — when this is fine
A surface that only ever runs with a live connection and cannot meaningfully
continue without one — a live call, a collaborative cursor session. There the
connection is the feature, and its loss is the one error worth reporting.
