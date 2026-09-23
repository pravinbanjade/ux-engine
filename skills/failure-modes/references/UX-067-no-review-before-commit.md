---
id: UX-067
title: A long or irreversible submission has no review step
category: forms
severity: high
detection: model
appliesTo: [form, form-footer, stepper]
---
## Signal
The final field of a long form, or of a sequence of steps, leads straight into
the mutation. There is no screen between the last entry and the commit that
renders the assembled values together, and where the form spans several steps,
the earlier steps' answers are not visible from the last one. A single form
whose every value stays on one scrolling surface above the submit control is
not this finding, however many fields it holds — what this mode looks for is
values the user can no longer see at the moment they commit.

## Why it fails
Nobody remembers what they typed four steps ago. A value mistyped early —
a transposed account number, the wrong recipient, a quantity off by a digit —
travels through the whole flow unseen and is committed. When the operation
cannot be undone, as with a payment, a submission to a third party or a bulk
change, the first time anyone sees the mistake is in its consequences.

## Fix
Insert a review step that renders every value the submission will send, in the
words the user entered them, with a path back to each field that returns to
the review afterwards. Put the commit action on that screen and label it for
the outcome, so the last thing the user reads before acting is what they are
about to cause.

## Counter-example — when this is fine
A short form whose fields are all visible at once above the submit control,
where the review step would render the same values the user is already looking
at, one scroll position higher.
