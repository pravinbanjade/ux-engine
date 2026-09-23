---
id: UX-088
title: Column widths fixed to the shape of the sample data
category: data-display
severity: low
detection: model
appliesTo: [table]
---
## Signal
Column widths are set to fixed values that suit whatever data was on screen
during development. With real values, short-valued columns hold far more room
than they need while the column with the most variable content wraps to
several lines or clips — and the widest column is one whose values are two
characters long.

## Why it fails
Row heights become uneven as long values wrap, which destroys the horizontal
rhythm the eye tracks rows by, and the table grows taller so fewer rows fit on
screen. The content that matters most is usually the variable-length content,
so the layout has allocated its space in inverse proportion to importance.
Nothing about this is visible until real data arrives.

## Fix
Size columns from the values they hold: constrain the ones with bounded
content — dates, statuses, short codes — to what their widest value needs, and
let the most variable column take the remaining space. Keep row height
constant and handle overflow within the variable column rather than by growing
the row.

## Counter-example — when this is fine
A table whose columns are user-resizable and whose widths persist per user.
The initial widths are a starting point rather than a constraint, and anyone
whose data does not fit adjusts it once.
