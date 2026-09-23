---
id: UX-094
title: The focus outline removed and not replaced
category: accessibility
severity: high
detection: hybrid
appliesTo: [button, field, link]
---
## Signal
A style rule suppresses the platform's focus indicator — most often applied
broadly across controls — with no replacement, or with a replacement whose
contrast against the surface the control sits on is too low to locate at a
glance. Tabbing through the screen produces no visible change anywhere.

## Why it fails
The focus indicator is the keyboard user's cursor. Without it there is no way
to know which control will respond to the next keystroke, so navigating means
tabbing and guessing, and activating the wrong control is the normal outcome
rather than the exception. The removal is usually made for appearance on one
screen and applied globally, so it disables keyboard use across the product.

## Fix
Render a focus treatment built from the profile's tokens, with enough contrast
to be found against every background the control appears on, and check it on
the dark surfaces as well as the light ones. Where the default outline clashes
visually, replace it with a ring or offset outline rather than removing it,
and scope the styling to the control rather than to every element.

## Counter-example — when this is fine
Suppressing the indicator for pointer activation only, while keeping it for
keyboard focus, using the platform's own distinction between the two. The
keyboard user keeps the cursor; the mouse user does not get a ring after
clicking.
