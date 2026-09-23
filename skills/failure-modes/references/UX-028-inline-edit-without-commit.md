---
id: UX-028
title: An inline edit never says whether it saved
category: interaction
severity: medium
detection: model
appliesTo: [table, field, detail-view]
---
## Signal
A value becomes editable in place on click or focus, and the component renders
no explicit commit, no cancel, and no indication of the value's state
afterwards. Whether the change persisted depends on a blur handler or a
debounce the user cannot see, and the displayed value looks identical before
and after any write.

## Why it fails
The user is left guessing whether their edit survived, and the only way to
check is to leave the screen and come back. They do that, or they retype the
value, or they assume it saved and it did not — and a silently dropped edit is
found later by someone who trusted the number. The absence of a cancel also
means an accidental keystroke in a table cell has no exit that restores the
original.

## Fix
Give the inline editor an explicit commit and an explicit cancel, both
reachable from the keyboard, and render the value's state after commit using
the profile's own saved and pending treatments. On failure, restore the
previous value and say what happened rather than leaving the typed text in
place as though it had been accepted.

## Counter-example — when this is fine
A field whose effect is immediately visible in the same view — renaming a
column whose header updates as you type, editing a label the chart beside it
redraws from. The result is the confirmation.
