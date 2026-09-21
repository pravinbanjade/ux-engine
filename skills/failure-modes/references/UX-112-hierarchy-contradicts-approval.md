---
id: UX-112
title: Implementation contradicts the approved hierarchy
category: conformance
severity: medium
detection: conformance
appliesTo: [generated-ui]
---
## Signal
The approved wireframe ranks one element first, and the implementation gives
that rank to a different one. The signals that carry weight — size, colour,
position in the reading order, whether an action is filled or outlined, how
much space surrounds it — put the rank-2 or rank-3 element ahead of the
element the reviewer chose as the entry point.

## Why it fails
Ranking the entry point is the one judgment the review stage exists to
capture; everything else in the wireframe can be adjusted later at low cost.
When the implementation quietly re-ranks, the screen teaches users a
different primary action from the one the team agreed on, and because the
wireframe still says otherwise, the disagreement is invisible until someone
compares the two by hand — which is the work this check exists to replace.

## Fix
Move the weight back to the approved rank-1 element: make it the largest or
the most saturated of its peers, place it where the eye lands first, and give
the demoted element a quieter treatment. If implementing it revealed that the
ranking was wrong — the action cannot be primary because it is disabled until
a selection is made — amend the wireframe and record the reason, so the next
run starts from the corrected ranking.

## Counter-example — when this is fine
The rank-1 element is genuinely dominant but is not first in source order,
because the layout places it visually first by other means. Reading order in
the markup is one signal among several, and a component that puts a heading
before the primary action in the DOM for accessibility reasons while the
action still reads as the loudest thing on screen has not contradicted the
approved ranking.
