---
id: UX-001
title: Every data field rendered as its own table column
category: information-architecture
severity: high
detection: model
appliesTo: [table, list, detail-view]
---
## Signal
A table or list renders one column per field the underlying record exposes —
eight, twelve, twenty columns — rather than the three or four a task actually
needs, and the remainder require horizontal scroll or are so narrow the values
truncate. The tell is that the column set matches the schema, not a job the
user is doing on this screen.

## Why it fails
The user came to compare or find something, not to inventory the record. Every
extra column competes for the same horizontal scan and pushes the columns that
matter further right, past the fold or into scroll. They either miss the field
they needed (it truncated) or pay a scanning tax on every row for fields they
never read.

## Fix
Pick the columns that answer the one or two questions this view exists to
answer, and move the rest behind a row-expand, a detail panel, or the
detail-view route. If the schema genuinely has many fields users switch
between, make column selection a per-view, saved preference rather than a
fixed superset — but ship a narrow default, not an opt-out-of-everything one.

## Counter-example — when this is fine
A dense operational grid built for one expert audience that lives in it all
day — a trading blotter, an admin data table with an explicit "all columns"
mode the user chose — where the user's job genuinely is auditing the full
record and horizontal scanning at that density is faster than clicking into
each row. Density is also fine when the table is the export preview for a
CSV the user is about to download as-is.
