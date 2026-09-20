---
id: UX-014
title: Destructive action weighted equally with its safe sibling
category: interaction
severity: high
detection: model
appliesTo: [button-group, table-row-actions, form-footer]
---
## Signal
Delete, Remove, Revoke or Archive rendered with the same variant, size and
colour weight as Edit, Save or View, and placed adjacent to it in the reading
order. In a table row this usually looks like two or three identically styled
icon buttons in a trailing cell.

## Why it fails
Visual weight is a promise about consequence. When the irreversible action looks
exactly like the routine one, the user's motor memory — trained on the routine
one — carries them into the irreversible one. The cost is asymmetric: a
mis-click on Edit costs a keystroke, a mis-click on Delete costs their data.

## Fix
Demote the destructive action: a lower-weight variant (ghost or text rather than
solid), separated from the safe actions by spacing or a divider, placed last.
Reserve the destructive colour token for the confirmation step, where it carries
information, rather than the trigger, where it only attracts. Use the variant
mechanism recorded in `components.variantMechanism`.

## Counter-example — when this is fine
A screen whose only purpose is destruction — a bulk cleanup tool, a "delete
account" settings panel — where the destructive action *is* the primary action
and there is no safe sibling to confuse it with. Equal weight is also fine when
the action is trivially reversible and says so (an undo toast that actually works).
