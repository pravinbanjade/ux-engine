---
id: UX-111
title: Approved state has no branch in the implementation
category: conformance
severity: high
detection: conformance
appliesTo: [generated-ui]
---
## Signal
The approved wireframe describes all four states, but the implementation has
no code path that produces one of them. Reading the component, the empty,
loading or error case either falls through to the populated render or is
absent from the conditional entirely — the description was written, reviewed
and agreed, and then nothing was built against it.

## Why it fails
This is worse than never having designed the state at all. The reviewer read
a description of what happens when the list is empty, agreed it was right,
and reasonably stopped thinking about it. The gap now ships with a signed-off
paper trail saying it was handled, so the next person to read the wireframe
will trust it rather than check the code, and the failure surfaces to a user
instead of to a reviewer.

## Fix
Implement the branch the wireframe describes, in the words it describes. If
the state turned out to be unbuildable as written — the data layer cannot
distinguish "no results" from "not loaded yet", say — that is a finding about
the wireframe, not a reason to drop the branch: amend the wireframe, record
the reason as a revision, and implement what the amended version says.

## Counter-example — when this is fine
The state is implemented one level up and the component under review is
correctly unaware of it: a row renderer that is never called with an empty
collection because its parent already branched to an empty state, or a leaf
that receives data as a required prop because the loading branch is resolved
by the route. The branch exists; it is just not in this file.
