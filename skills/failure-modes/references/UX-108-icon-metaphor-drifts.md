---
id: UX-108
title: One action represented by different glyphs in different places
category: system-consistency
severity: low
detection: model
appliesTo: [icon-button, toolbar, table-row-actions]
---
## Signal
The same operation is drawn with different glyphs depending on where it
appears — one shape in the row actions, another in the toolbar, a third in the
overflow menu. The profile's icon set contains a glyph for the action, and at
least one of the call sites is not using it.

## Why it fails
Icons work by being learned once. When a glyph is not stable, the user has to
re-read the label or hover to confirm every time, which is the entire cost the
icon was supposed to remove — and where there is no label, they guess. The
reverse error is worse: two different actions wearing the same glyph in
different places, which produces confident wrong clicks.

## Fix
Settle on one glyph per action from the profile's icon set and use it
everywhere that action appears, including its disabled and in-progress forms.
Where two actions currently share a glyph, change the less common one, so the
association each user has already built keeps holding.

## Counter-example — when this is fine
A glyph varying with the object rather than the action — a download control
showing the file type it will produce. The action is stable; what changes is a
depiction of the thing it acts on.
