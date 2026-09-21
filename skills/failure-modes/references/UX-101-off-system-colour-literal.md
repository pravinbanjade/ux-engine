---
id: UX-101
title: Hard-coded colour literal bypasses the token system
category: system-consistency
severity: high
detection: scanner
appliesTo: [any]
---
## Signal
A style declaration sets a colour using a raw literal — a hex code, an
`rgb()`/`hsl()`/`oklch()` function call, or a named CSS colour — instead of
referencing a variable from the project's colour token group — the `color`
group of tokens extracted from `styling.tokenSource`. The scanner flags any
colour value in styled code that doesn't resolve back to a declared token.

## Why it fails
A literal colour is invisible to the design system: it doesn't update when
the palette is retheme'd, doesn't respond to a dark-mode switch the tokens
already handle, and doesn't get caught by contrast audits run against the
token set. Each one is small, but they accumulate into a UI where "the brand
colour" is actually a dozen near-identical, silently-diverging values, and a
future rebrand has to be done by grep instead of by editing one variable.

## Fix
Replace the literal with the nearest existing token from the colour group; if
none of the existing tokens is semantically correct, add a new token to the
source file (`styling.tokenSource`) rather than inlining a one-off value, so
the palette stays the single source of truth for every colour in the UI.

## Counter-example — when this is fine
A one-off value with no semantic meaning to the design system at all — a
colour baked into a third-party SVG asset or an embedded chart library's
default palette that the product doesn't theme, or a literal used inside the
token definition file itself, where the literal *is* the token's source
value rather than a bypass of it.
