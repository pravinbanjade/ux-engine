---
id: UX-025
title: Focus falls to the document after the focused element is removed
category: interaction
severity: high
detection: model
appliesTo: [table-row-actions, list, button]
---
## Signal
A handler removes the element that currently holds focus — deleting its row,
collapsing its section, unmounting the card it sits in — and nothing moves
focus afterwards. The removal commits and the browser, having lost the focused
node, returns focus to the document body.

## Why it fails
A keyboard user has just been returned to the top of the page. To delete the
next item they must tab forward through the entire interface again, and they
must do it after every single deletion, so clearing five rows costs five full
traversals. For a screen-reader user it is worse: the announcement context is
gone too, so there is no confirmation that the removal even happened.

## Fix
Choose the next focus target before the removal commits and set it immediately
after — the following item, or the previous one when the removed element was
last, or the container's heading when nothing remains. Announce the removal on
a live region so the outcome is reported as well as relocated.

## Counter-example — when this is fine
A removal the user did not initiate from the keyboard and that unmounts an
element focus was never in — a background item expiring from a feed, a toast
timing out. Moving focus there would yank the user away from what they were
doing.
