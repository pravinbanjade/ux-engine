---
id: UX-109
title: One operation called by different words on different screens
category: system-consistency
severity: medium
detection: model
appliesTo: [button, nav-item, menu]
---
## Signal
The same operation is labelled differently depending on where it appears — a
verb on one screen and a noun on another, a synonym in the navigation and a
third word in the confirmation that follows it. The strings differ; the code
path they trigger is the same.

## Why it fails
The user cannot tell whether two labels name one action or two, so they
hesitate, or they perform the operation twice believing the first was
something else. It also breaks search and support: a user looking for what the
documentation called one thing will not find the button that calls it another.
Every synonym is a term the whole audience must learn without being told it is
a synonym.

## Fix
Choose one term per operation and apply it everywhere the operation is named —
the control, the heading, the confirmation, the success message, the
documentation. Where an existing term is genuinely wrong, change it everywhere
at once rather than introducing the better word alongside the old one.

## Counter-example — when this is fine
Two labels that read differently because their grammatical position differs —
a heading naming the object and a button naming the act on it. The vocabulary
is the same; only the part of speech changed.
