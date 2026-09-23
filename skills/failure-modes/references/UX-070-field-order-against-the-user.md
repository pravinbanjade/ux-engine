---
id: UX-070
title: Fields ordered by the record's schema rather than the user's source
category: forms
severity: low
detection: model
appliesTo: [form, field]
---
## Signal
The field sequence matches the declaration order of the backing record or
type, so unrelated concerns interleave: an address line, then a preference
toggle, then the rest of the address, then an identifier. Nothing groups the
fields a user would read off the same document.

## Why it fails
People fill forms from sources — a card, an invoice, a letter, their memory of
one topic at a time. An order that jumps between concerns makes them put the
source down and pick it up repeatedly, and each switch is a chance to enter a
value in the wrong field. The form feels longer than it is, because attention
is being reset at every step.

## Fix
Order the fields the way the user holds the information, keeping everything
they will read from one source together and moving between topics only once.
Where the backing record's order matters to the code, map it at the boundary
rather than exposing it in the layout.

## Counter-example — when this is fine
A form whose order is fixed by an external process the user is following
alongside it — a regulatory return, a customs declaration, a paper form being
transcribed field by field. Matching that document is the correct order.
