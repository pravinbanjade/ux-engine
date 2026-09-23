---
id: UX-105
title: A primitive rebuilt instead of composed
category: system-consistency
severity: medium
detection: model
appliesTo: [any]
---
## Signal
A component is written from scratch to do what a primitive in the profile's
component inventory already does — its own markup, its own state handling, its
own styling — rather than wrapping or composing the existing one. The
inventory names the primitive and this file does not import it.

## Why it fails
Everything the primitive had already solved is now unsolved here: its focus
handling, its disabled and loading states, its keyboard behaviour, its
contrast checks. Those are exactly the parts that get omitted in a rewrite,
because they are invisible until someone relies on them. Future fixes to the
primitive reach every other call site and not this one.

## Fix
Compose the existing primitive and add only what is genuinely new, passing the
differences through its props rather than reimplementing its interior. Where
the primitive cannot express what is needed, extend the primitive itself so
every call site gains the capability rather than just this one.

## Counter-example — when this is fine
A deliberate, documented divergence where the primitive's behaviour is wrong
for this context in a way it cannot be taught — a control inside a canvas or
an embedded surface with its own event model. The reason belongs in the file.
