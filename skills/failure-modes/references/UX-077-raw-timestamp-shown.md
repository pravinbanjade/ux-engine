---
id: UX-077
title: Timestamp shown as a raw machine format instead of a human one
category: data-display
severity: low
detection: model
appliesTo: [table, list, detail-view]
---
## Signal
A date or time value renders as an ISO 8601 string, a Unix epoch integer, or
a server-default format (`2024-03-14T09:32:00Z`, `1710408720`) directly in
the UI, with no localization to the viewer's timezone or conversion to a
reading-friendly format ("Mar 14, 2024" or "3 hours ago").

## Why it fails
A raw timestamp forces the user to parse a format built for machines, and
when it's UTC without a marker it silently misreports the time in every
timezone but one — a "9:32 AM" event a user in another timezone reads as
having happened hours off from when it actually did, without any way to
notice the misread.

## Fix
Format dates and times for the viewer at render time: relative phrasing
("3 hours ago", "yesterday") for recent events where precision to the minute
matters less than recency, absolute local-timezone formatting for anything
where the exact moment matters (a contract date, an audit log), and always
convert from the stored UTC value to the viewer's local timezone rather than
displaying server time unlabeled.

## Counter-example — when this is fine
A developer-facing surface where the raw format is the actual content being
inspected — an API response viewer, a webhook payload log, a debug panel
showing the literal value the system stored — where converting the timestamp
would hide the exact detail the surface exists to show.
