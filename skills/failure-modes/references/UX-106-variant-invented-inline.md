---
id: UX-106
title: A call site styles its way to a variant the component could declare
category: system-consistency
severity: medium
detection: model
appliesTo: [any]
---
## Signal
A call site overrides a component's appearance with local styling — colours,
padding, borders passed in at the usage rather than selected from the
component's own options — to produce an appearance the component's declared
variant mechanism could have given it. The component exposes variants, and
this call site is not using them.

## Why it fails
The appearance now exists in a place nothing enumerates. Anyone auditing the
system's variants will not find it, anyone changing the component will not
update it, and the next call site wanting the same look writes its own version
rather than reusing this one. Repeated a dozen times, the component's declared
variants stop describing what the product actually renders.

## Fix
Add the appearance as a named variant on the component, through whatever
mechanism the profile records for this codebase, and use that variant at the
call site instead of the override. The look then has a name, appears in the
inventory, and the next call site that needs it reaches for it rather than
reinventing it.

## Counter-example — when this is fine
A genuinely one-off adjustment to fit a specific layout — a width, a margin
resolving a particular composition — that carries no appearance meaning and
would be wrong as a shared variant.
