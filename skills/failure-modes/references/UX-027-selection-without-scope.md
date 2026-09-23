---
id: UX-027
title: Bulk selection never says how much is selected
category: interaction
severity: medium
detection: model
appliesTo: [table, list, toolbar]
---
## Signal
Rows carry selection controls and the toolbar offers actions that operate on
the selection, but nothing renders the number selected. There is no select-all,
and the action labels name only the verb — Delete, Export, Archive — without
the count they will apply to.

## Why it fails
The user cannot verify the scope of what they are about to do. Selections made
across a scrolled list, or surviving a filter change, include rows no longer on
screen, so pressing Delete acts on a set the user cannot see and never
counted. When the scope is wrong the discovery comes afterwards, applied to
records that were never meant to be touched.

## Fix
Render the selected count beside the bulk actions, name that count in each
action's label, and offer select-all with an explicit statement of whether it
covers the visible page or the entire filtered set. Clear or restate the
selection when the filter changes, so the count always describes rows that
still qualify.

## Counter-example — when this is fine
A selection that can hold at most one item — a radio-style choice, a single
active row driving a detail panel. The count is always one, and rendering it
is noise.
