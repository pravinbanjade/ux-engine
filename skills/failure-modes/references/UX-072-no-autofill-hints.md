---
id: UX-072
title: Standard fields carry no autofill hint
category: forms
severity: low
detection: model
appliesTo: [field, form]
---
## Signal
Inputs collecting values the platform already knows how to supply — a person's
name, an email address, a postal address, a one-time code, a stored credential
— carry no autocomplete annotation. The browser and password manager have no
way to identify what each field wants, so nothing is offered.

## Why it fails
Every user retypes what their device was holding for them, on every form, on
every device. Typing an address on a phone is slow and error-prone, and typing
a generated credential by hand is worse — long values entered manually are
where transcription errors come from, and those errors surface as failed
sign-ins rather than as form problems. Users with motor impairments pay the
largest share of this.

## Fix
Annotate each standard field with the autocomplete token naming what it
collects, using the compound tokens for grouped values such as address lines
so the platform can fill the group in one action. Keep the field's name, type
and token consistent so a manager that stored a value can recognise it again.

## Counter-example — when this is fine
A field collecting something specific to this record rather than to the person
— a reference for this one order, a note, a project name. There is nothing
stored for the platform to offer, and an incorrect token invites it to fill in
something wrong.
