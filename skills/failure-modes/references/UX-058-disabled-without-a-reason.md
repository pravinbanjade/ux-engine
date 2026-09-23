---
id: UX-058
title: A control is disabled and nothing says what would enable it
category: state-coverage
severity: medium
detection: model
appliesTo: [button, field, form-submit]
---
## Signal
The control renders in its disabled variant from a condition the user cannot
observe — an unmet dependency, a missing permission, an incomplete field
elsewhere on the screen, a record in the wrong status. No adjacent text, no
description and no message names the condition, and being disabled, the
control cannot be activated to find out. A control disabled only for the
duration of a request it started, carrying a busy indicator of its own, is not
this finding.

## Why it fails
The user is facing a dead end with no diagnosis. They try neighbouring
controls, reload, or conclude the feature is broken and ask someone — and
frequently the blocking condition was one field away and trivially fixable.
Disabled controls are also skipped by keyboard navigation and often announced
without explanation, so the user may never learn the control was there.

## Fix
State the blocking condition next to the control, in the profile's helper-text
treatment, phrased as the thing to do rather than the rule that failed.
Where several conditions can block it, name the one currently unmet. Where the
condition is permanent for this user, prefer explaining it in place to
rendering a control they will never be able to use.

## Counter-example — when this is fine
A control disabled for the duration of an in-flight request it started, where
the busy state visible on the same control already explains it and the
condition resolves within seconds.
