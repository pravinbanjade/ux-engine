---
id: UX-012
title: Settings rendered as one ungrouped sequence of controls
category: information-architecture
severity: medium
detection: model
appliesTo: [settings, page]
---
## Signal
The settings screen maps its options to controls in one flat sequence, with no
headings between them, no separation between the options changed weekly and
the ones touched once at setup, and no filter over option names. The order
follows the shape of the config object rather than any grouping a user would
recognise.

## Why it fails
Finding one option means reading all of them, and the list grows with every
release, so the screen gets slower to use the longer the product lives. Users
change the wrong thing because two unrelated toggles ended up adjacent, and
they cannot tell which options are safe to touch, because nothing distinguishes
a display preference from a setting that changes billing.

## Fix
Group the options under headings naming what each group governs, order the
groups by how often they are changed rather than by their order in the config,
and separate the setup-time options into their own section at the end. Where
the screen holds more than a couple of dozen controls, render a filter over
option names above the first group.

## Counter-example — when this is fine
A short settings surface of five or six related options — a single feature's
preferences panel — where headings would outnumber the things they organise
and the flat list is read in one glance.
