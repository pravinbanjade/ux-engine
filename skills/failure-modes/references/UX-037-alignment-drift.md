---
id: UX-037
title: One block aligned to several different axes
category: visual-hierarchy
severity: low
detection: model
appliesTo: [card, form, detail-view]
---
## Signal
Within a single block, elements settle on different horizontal alignments for
no structural reason — a centred heading above left-aligned body text, labels
on one axis and their values on another, a footer action centred beneath
left-aligned content. Nothing in the layout accounts for the change; it varies
element by element.

## Why it fails
The eye tracks a vertical edge down a block, and each change of axis breaks
that track and costs a re-acquisition. Across a screen of such blocks the
effect is an unsettled, slightly-wrong feeling that users report as looking
unfinished without being able to name the cause — and on a narrow viewport the
mixed axes produce visible ragged edges where the block reflows.

## Fix
Settle each block on one alignment axis and keep every element on it,
including headings and footer controls. Where two parts of the block need to
read differently, express that with spacing and type weight, which do not
disturb the edge the eye is tracking.

## Counter-example — when this is fine
A deliberately centred composition that owns its whole surface — an empty
state, a confirmation screen, a sign-in panel — where everything is centred
together and there is no competing axis to break.
