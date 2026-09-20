---
id: UX-049
title: Layout only designed for the demo-data row count
category: state-coverage
severity: medium
detection: model
appliesTo: [list, table, select]
---
## Signal
A list, table, or select's layout only holds together for the two or three
items visible in the design mock or seed data — no max-height with scroll, no
pagination, no truncation rule — so that a value at production scale (a
50-item dropdown, a 500-row unpaginated table, a name field with no
truncation) breaks the layout, pushes the page to an unusable length, or
locks the render on data the design never accounted for.

## Why it fails
Production data doesn't respect the demo's row count. A dropdown that's fine
with 3 options becomes an unscrollable, unsearchable wall at 80; a table with
no pagination becomes a multi-thousand-row DOM the browser struggles to
paint. The user who happens to have more data than the design assumed gets a
broken screen while everyone else gets a working one, and there's no code
path that will ever fix it for them without a design change.

## Fix
Design explicitly for both ends of the plausible range: a virtualized or
paginated list past a stated row-count threshold, a searchable combobox
instead of a plain select past roughly 10-15 options, and an explicit
truncation-with-tooltip rule for any text field with no enforced length cap.
Pick the threshold from the real data distribution, not the seed fixture.

## Counter-example — when this is fine
A collection with a hard, enforced upper bound well within what the current
layout handles comfortably — a set of exactly five plan tiers, a country
picker with a fixed, known-small list — where "at scale" is a fixed number
the design was built for, not an open-ended growth path the layout needs to
survive.
