---
id: UX-123
title: Hard-coded font size or line height bypasses the type scale
category: system-consistency
severity: medium
detection: scanner
appliesTo: [any]
---
## Signal
A `font-size`, `line-height` or `letter-spacing`, or the matching text,
leading or tracking arbitrary-value utility, is set to a literal such as
`13px`, `15px` or `-0.04em` that matches no value in the `type` token group.
Unitless line-height ratios are not length literals and are not reported;
only sizes and spacings written with a unit are.

## Why it fails
A type ramp is a ranking: each step says how important a piece of text is
relative to the text around it. A 13px label beside a 12px caption and a
14px body line is three ranks where the design meant two, and nobody reading
the screen can tell which is supposed to matter more. Off-ramp sizes are
also where accessibility slips — a 10px or 11px literal is usually the text
someone shrank to make a layout fit, below any size the ramp would permit.

## Fix
Replace the literal with the `nearestToken` the finding names, choosing the
ramp step by the text's role (caption, body, heading) rather than by which
number is closest. If the ramp truly lacks a size the product needs, add a
named step for that role so it ranks consistently everywhere it is used.

## Counter-example — when this is fine
Text whose size is set by something other than the product's hierarchy: a
monospace code block sized to fit a fixed column count, fluid display type
computed from the viewport with a clamp, or text inside an embedded chart or
canvas drawn by a library that takes a pixel size and cannot read a token.
