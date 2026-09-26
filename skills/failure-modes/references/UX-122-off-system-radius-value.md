---
id: UX-122
title: Hard-coded corner radius bypasses the radius scale
category: system-consistency
severity: low
detection: scanner
appliesTo: [any]
---
## Signal
A `border-radius`, one of its per-corner longhands, or a rounded-corner
arbitrary-value utility is given a literal such as `7px` or `0.6rem` that
matches no value in the `radius` token group. Pill and circle shapes written
as a very large value (`9999px`) are measured like any other radius, so a
project that uses them wants a full-round token for them to land on.

## Why it fails
Corner rounding is one of the first cues people use to tell components apart:
a card, a button and an input that share a radius read as one family, and a
button with slightly softer corners than its neighbours reads as a different
kind of control even when it is not. Stray radii accumulate quietly because
each is too small to notice in review, and the product ends up with five
corner shapes where the design had two.

## Fix
Use the `nearestToken` the finding names. If the component really needs a
distinct shape — a pill, a sheet with only its top corners rounded — express
it with a named radius token (`--radius-full`) so the exception is visible
and reusable rather than a number someone will copy by accident.

## Counter-example — when this is fine
A radius that follows geometry rather than taste: an inner element inset by
the container's padding whose radius is the outer token minus that padding,
so the two curves stay concentric, or a shape drawn to match an externally
supplied asset such as a device frame or a platform-provided app icon mask.
