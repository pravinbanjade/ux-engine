---
id: UX-075
title: A value the user cannot read back is collected only once
category: forms
severity: medium
detection: model
appliesTo: [field, form]
---
## Signal
The form collects a value the user has no way to check afterwards — an
obscured credential, an address used only for account recovery, a key stored
write-only — and there is neither a control to reveal what was typed nor a
second confirming entry. Whatever is submitted becomes the stored value
unseen.

## Why it fails
A typo in a value nobody can read is discovered only when it is needed, which
by definition is the moment the user is locked out or the message fails to
arrive. Recovery is then the hardest kind: the user must prove who they are
through the very channel the typo broke. The cost is wildly out of proportion
to the keystroke that caused it.

## Fix
Offer a reveal control on obscured fields so the user can check what they
typed before committing, or collect the value twice and compare, choosing
whichever fits the value's sensitivity on a shared screen. For recovery
addresses, confirm through the channel itself before treating the value as
usable.

## Counter-example — when this is fine
A value the user can verify immediately afterwards through normal use — a
display name, a setting whose effect is visible on the next screen. A mistake
is seen and corrected in seconds.
