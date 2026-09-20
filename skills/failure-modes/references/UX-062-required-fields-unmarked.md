---
id: UX-062
title: Required fields carry no visible marker
category: forms
severity: medium
detection: model
appliesTo: [form, field]
---
## Signal
A form mixes required and optional fields but the labels give no visual
distinction between them — no asterisk, no "(optional)" suffix, no
consistent convention at all — so the only way to learn a field is required
is to submit and see which ones error.

## Why it fails
The user has to guess which fields matter before they've filled anything in,
so they either over-fill (wasting time on fields that didn't need it) or
under-fill and hit a wall of errors at submit that a label could have
prevented entirely. On a long form, discovering the requirement at submit
means re-opening a form they thought they'd finished.

## Fix
Pick one convention and apply it to every field in the form: mark the
minority case explicitly (an asterisk on required fields, if optional fields
are rare; "(optional)" suffixed on optional fields, if required is the rare
case) rather than marking neither, and state what the asterisk means once,
near the top of the form, for users unfamiliar with the convention.

## Counter-example — when this is fine
A form where every field is required (or every field is optional) — there's
no distinction to communicate, so a marker on every label adds visual noise
without adding information. A single sentence at the top ("All fields
required") covers it instead of decorating each field individually.
