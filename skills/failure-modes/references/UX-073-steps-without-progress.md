---
id: UX-073
title: A multi-screen form never says how far through it the user is
category: forms
severity: medium
detection: model
appliesTo: [stepper, form]
---
## Signal
A task is split across several screens, and none of them renders a position or
a total. There is no step indicator, no count, no list of what is still to
come — each screen presents its fields and a control that advances to an
unknown number of further screens.

## Why it fails
People decide whether to start and whether to continue based on how much is
left, and this form refuses to say. Users abandon partway because the sequence
feels unbounded, or they start it at a moment when they do not have time to
finish and discover that only several screens in. Without a total there is
also no way to judge whether to gather information first.

## Fix
Render the current position and the total on every screen of the sequence,
using the profile's stepper pattern, and name the remaining steps so the user
can see what they will be asked for. Where the number of steps depends on
earlier answers, show the range or update the total as it becomes known.

## Counter-example — when this is fine
A branching flow whose length genuinely cannot be known in advance — a triage
or diagnostic sequence where each answer determines whether there is another
question. Naming the current stage serves better than inventing a total.
