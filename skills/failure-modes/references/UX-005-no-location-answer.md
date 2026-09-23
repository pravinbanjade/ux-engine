---
id: UX-005
title: The screen never says which screen it is
category: information-architecture
severity: medium
detection: model
appliesTo: [page, page-header, breadcrumb]
---
## Signal
The rendered tree contains no heading, title element or trail naming the
current screen. The topmost text is the product name, a toolbar of controls,
or the content itself — a table that begins with its column headers, a form
that begins with its first field. Nothing in the markup answers "what am I
looking at" except by inference from the data on display.

## Why it fails
A user arriving from a link, a notification or a browser tab restored days
later has no context to infer from. They must read the content and reconstruct
where they are, which is slow when it works and wrong when two screens render
similar data. It also removes the one landmark screen-reader users navigate
by, leaving them to traverse the whole document to work out what loaded.

## Fix
Render a page-level heading naming this screen in the words the user would
use, set in the profile's largest heading token, as the first meaningful
element after any global chrome. Where the screen is a descendant of another,
render a trail above it showing the ancestors, each one a link back.

## Counter-example — when this is fine
A single-purpose screen whose content is unmistakably its own title — a
full-bleed login form, a standalone checkout step, an onboarding panel — where
a heading would restate what the form already says and there is nowhere else
in the product the user could mistake it for.
