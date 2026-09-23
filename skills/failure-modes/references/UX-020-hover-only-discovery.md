---
id: UX-020
title: Item actions exist only while the pointer is over the item
category: interaction
severity: high
detection: model
appliesTo: [table-row-actions, card, toolbar]
---
## Signal
The controls for an item are rendered under a hover condition — a
hover-scoped visibility rule, or a mouse-enter flag gating whether they mount
— and there is no equivalent path to them from the keyboard or from touch. On
a device without a hovering pointer, the actions never appear in the tree.

## Why it fails
On touch there is no hover, so the actions are unreachable: the user can see
the item and cannot act on it. From the keyboard the controls may be focusable
but invisible, which is worse — focus lands on something the user cannot see.
And for everyone, an action that only exists while the pointer rests on it is
an action nobody discovers by scanning, so the feature goes unused by people
who would have wanted it.

## Fix
Keep the actions mounted at all times, or place them behind a control that is
itself always present and reachable by keyboard and touch. Where hover is
still wanted, use it for emphasis — raising contrast on an already-visible
control — rather than for existence.

## Counter-example — when this is fine
A hover treatment that reveals a shortcut to something already reachable
elsewhere on the screen. The row's menu holds every action; hover surfaces the
most common one early for pointer users, and losing it costs a click, not the
capability.
