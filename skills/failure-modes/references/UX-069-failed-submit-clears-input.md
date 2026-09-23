---
id: UX-069
title: A rejected submission returns the user to empty fields
category: forms
severity: high
detection: model
appliesTo: [form, field]
---
## Signal
The failure branch resets the form state, remounts the form, or navigates to a
route that renders it fresh. What the user typed is gone: the error message
appears above a blank form, and the values that caused the rejection are no
longer anywhere on screen. A failure branch that leaves the form mounted with
its values intact is not this finding, even where a reset call appears
elsewhere in the file on the success path.

## Why it fails
The user must retype everything to correct one thing, and they cannot see what
they originally entered, so they cannot tell what the error is about. On a
long form this is the point where people abandon the task altogether. The
harm also scales with the error's own fault — a server hiccup that should have
cost a button press costs the whole form instead.

## Fix
Keep the entered values in state across the failure path and render the error
alongside them, leaving focus on the field that needs correcting where the
failure names one. Where a route change is unavoidable, carry the values
through it, so a rejection costs a correction rather than a re-entry.

## Counter-example — when this is fine
A failure that invalidates the input itself — a session that expired and must
be re-established, a form whose underlying record was deleted while it was
open. Restoring values that can no longer be submitted only delays the news.
