---
id: UX-023
title: A reversible action is gated behind a confirmation
category: interaction
severity: low
detection: model
appliesTo: [modal, button]
---
## Signal
An action the user could undo themselves in one step — archiving, marking
read, toggling a flag, removing something from a list it can be re-added to —
opens a dialog asking them to confirm before it runs. The dialog's text names
no consequence that outlasts the next click.

## Why it fails
Confirmation spends the user's attention, and spending it on the harmless
teaches them to dismiss dialogs without reading. That habit is then carried to
the dialog that mattered, which is dismissed just as fast. A product that
confirms everything has, in practice, confirmed nothing — and it has made its
most ordinary actions twice as slow in the process.

## Fix
Let the action run immediately and offer to reverse it afterwards, through an
undo affordance that stays available long enough to be noticed and acted on.
Keep confirmation for the operations that genuinely cannot be taken back, so
the dialog means something when it does appear.

## Counter-example — when this is fine
A reversible action whose side effects are not — unarchiving restores the
record but the archive already notified a customer, or sent a webhook another
system acted on. What cannot be undone there is the consequence, not the row.
