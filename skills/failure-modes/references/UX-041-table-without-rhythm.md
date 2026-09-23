---
id: UX-041
title: A dense table gives the eye nothing to track a row by
category: visual-hierarchy
severity: medium
detection: model
appliesTo: [table]
---
## Signal
Rows render at minimal vertical padding with no separators, no alternating
background, and no grouping, across enough columns that the leftmost and
rightmost values are far apart. Row height varies with content, so the rows do
not even share a rhythm the eye could lock onto.

## Why it fails
Reading a value in the last column and attributing it to the right record
depends entirely on holding a horizontal line across the screen. With nothing
marking the row, the eye drifts a line up or down — most often on the widest
tables, which are the ones where the error costs the most. Users compensate by
running a finger or cursor across the screen, which is slow and still wrong
sometimes.

## Fix
Give rows a consistent height from the profile's spacing scale, and add either
a separator rule or an alternating row background — one of the two, not both.
Where the data has natural groups, introduce a group header row so the eye has
a landmark every few lines rather than an unbroken field.

## Counter-example — when this is fine
A short table of three or four rows, where the whole set is taken in at once
and row-tracking never arises. Striping there is decoration that implies more
data than exists.
