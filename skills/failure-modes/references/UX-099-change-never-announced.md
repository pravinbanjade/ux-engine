---
id: UX-099
title: Content changes with nothing announcing the change
category: accessibility
severity: medium
detection: model
appliesTo: [toast, list, status-indicator]
---
## Signal
Content appears, updates or disappears without a page load — a notification, a
result count after filtering, a validation message, a status transition — in a
region that is not marked as live. The change is rendered and nothing about it
reaches assistive technology unless the user happens to be reading that exact
region.

## Why it fails
The user is not told something happened. A filter that reduced a list to no
results reads as an unchanged screen; an error rendered at the top of a long
form is never announced; a notification appears and times out having reached
only the people looking directly at it. The interface has communicated by
appearance alone, which excludes everyone relying on anything else.

## Fix
Render the changing content inside a region marked as live, choosing the
politeness from the urgency — assertive for something that interrupts, polite
for a result count or a status. Keep the live region mounted in the tree
rather than creating it with its content, since a region that appears at the
same moment as its text is frequently not announced at all.

## Counter-example — when this is fine
A change the user initiated and is already focused on, where the new content
receives focus as part of the interaction — opening a panel, moving to the
next step. The focus move is the announcement.
