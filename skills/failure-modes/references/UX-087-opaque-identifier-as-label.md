---
id: UX-087
title: A generated identifier shown where the record has a name
category: data-display
severity: medium
detection: model
appliesTo: [table, list, detail-view]
---
## Signal
A column or field renders a surrogate key — a generated identifier, an
internal code, a hash — as the record's primary text, while the object being
rendered also carries a human-readable name. The identifier is what the join
returned, and it went to the screen unchanged.

## Why it fails
Identifiers cannot be recognised, remembered or compared by eye. A user
scanning for one record among fifty reads thirty-odd indistinguishable
characters per row and misses it, or matches the wrong one on a shared prefix.
Discussing the record with anyone means reading the identifier aloud. The
information needed to avoid all of this was on the object the whole time.

## Fix
Render the human name as the primary text, and keep the identifier available
where it is genuinely needed — as secondary text in a detail view, as a
copyable value, or in exports for support and reconciliation. Where no name
exists, derive a recognisable label from the record's distinguishing fields
rather than falling back to the key.

## Counter-example — when this is fine
A surface whose users work in identifiers — a support console where the ticket
reference is what customers quote, a reconciliation view matching transaction
references. There the identifier is the name.
