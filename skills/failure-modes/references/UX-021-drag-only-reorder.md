---
id: UX-021
title: Order can only be changed by dragging
category: interaction
severity: medium
detection: model
appliesTo: [list, table]
---
## Signal
Reordering is wired exclusively to pointer drag handlers. There is no move-up
or move-down control, no editable position value, and no keyboard path that
produces the same result — the ordering state changes only in response to a
drop event.

## Why it fails
Dragging demands sustained pointer precision: press, hold, travel, release,
all without slipping. Anyone with a tremor, a trackpad, a touch screen in a
moving vehicle, or no pointer at all is excluded from a capability the
interface offers everyone else. Long lists make it worse, since dragging an
item past the viewport edge depends on an auto-scroll that is rarely tuned.

## Fix
Pair the drag affordance with a discrete alternative: move controls on each
item, or an editable position number that reorders on commit. Both should
operate on the same ordering state the drop handler writes, so the two paths
cannot drift, and both should be reachable by keyboard.

## Counter-example — when this is fine
A spatial arrangement where position carries meaning beyond sequence — a
canvas, a seating plan, a kanban board with two axes. There the drag is not a
shortcut for an ordinal, and the discrete equivalent would be a different
feature rather than a second path to the same one.
