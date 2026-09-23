---
id: UX-114
title: A region in the approved layout has no counterpart in the code
category: conformance
severity: high
detection: conformance
appliesTo: [generated-ui]
---
## Signal
A node in the wireframe's `layout` tree has nothing corresponding to it in the
implemented tree. It was not renamed, not folded into a sibling, not moved
elsewhere in the hierarchy — reading the two side by side, the region named in
the approved artifact is simply absent from the rendered output.

## Why it fails
The wireframe is the record of what was agreed, and a reviewer who approved it
believes the region exists. Nobody will look for it again, because the paper
trail says it was settled — so a filter bar, a summary band or a secondary
panel that someone asked for and someone agreed to disappears without any
conversation about dropping it. The gap is discovered by a user, or by the
person who requested it, long after the review that would have caught it.

## Fix
Implement the region as the `layout` node describes it, in the position the
tree gives it. Where it turned out to be unbuildable or genuinely unnecessary,
amend the wireframe and record why, so the artifact and the code agree on one
account of what this screen contains.

## Counter-example — when this is fine
A region the implementation renders conditionally on data or permission the
review scenario did not include — present in the code, absent from this render
— where the branch exists and the comparison was made against one case.
