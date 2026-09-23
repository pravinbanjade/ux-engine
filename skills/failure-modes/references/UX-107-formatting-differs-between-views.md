---
id: UX-107
title: The same quantity formatted differently on different screens
category: system-consistency
severity: medium
detection: model
appliesTo: [table, detail-view, stat-tile]
---
## Signal
One quantity or date is formatted by each call site independently, so the same
underlying value renders differently depending on the screen — two decimals
here and none there, one date order in a table and another in the detail view,
grouping separators on one surface and not the next.

## Why it fails
The user cannot tell whether they are looking at the same number. A figure
that reads as one value on the list and another on the detail is checked,
re-checked and eventually reported as a bug, and where the difference is a
date order rather than a precision, it is not caught at all — it is simply
misread. Each call site also has to be found and changed whenever the format
changes.

## Fix
Format through one shared helper per quantity type and call it from every
site, so the format is defined once and a change reaches every screen at the
same time. Keep the raw value in the data and the formatting at the boundary,
so no screen is formatting a value another screen already formatted.

## Counter-example — when this is fine
A deliberate difference in density between contexts — a compact form in a
tight column and a full form in the detail view — where both come from the
same helper through a named option rather than from separate local code.
