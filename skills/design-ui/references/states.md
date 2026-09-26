# The four states

Every screen that loads data has four. A wireframe that names them without
describing them has not designed them — the validator can only check that the
field is non-empty, so the standard below is yours to hold.

A state is described when a reader can tell what is on the screen without
asking a follow-up question.

## `empty`

Say which kind of empty it is, and give a way out.

Three kinds, and they need different screens: nothing has been created yet;
a filter or search reduced a non-empty set to nothing; the user has no
permission to see what is there. Unexplained blankness reads as broken, which
is the failure UX-046 names.

- **Not described:** "Empty state with a message."
- **Described:** "No reports yet for this portfolio, with the run button
  repeated inline as the way out."
- **Described:** "No rows match this filter, with the active filter named and
  a control that clears it."

## `loading`

Say what occupies the space and what does not move when the data arrives.

The purpose is to hold the layout still. A spinner that collapses to a
full-height table shifts every element on the screen at the moment the user
has started reading. Prefer a placeholder shaped like the real content, sized
from something you actually know — the last known row count, the requested
page size.

- **Not described:** "Show a loading spinner."
- **Described:** "Skeleton rows at the last known row count so the table does
  not collapse and jump."

## `error`

Say what failed, why as far as the system knows, and what the user can do.

An error that states a problem with no remedy is UX-063. A retry that discards
the user's selections is a second failure on top of the first.

- **Not described:** "Error message."
- **Described:** "The run failed, the reason the service gave, and a retry
  that keeps the selected portfolio."

## `populated`

Say what it looks like at the scale the intent named — not at demo scale.

This is the state most often designed for five rows and shipped to four
hundred, which is UX-049. Name the count, and name what happens past it.

- **Not described:** "The list of results."
- **Described:** "Four hundred rows paginated at fifty, newest first, with the
  count stated above the table."

## Where a state legitimately lives elsewhere

A state can be handled one level up: a route resolves loading before the
component renders, a parent branches to the empty state so the row renderer
never sees an empty collection. That is correct design, not a missing state —
but the wireframe should still describe it, because the reviewer is approving
the screen, not the file.
