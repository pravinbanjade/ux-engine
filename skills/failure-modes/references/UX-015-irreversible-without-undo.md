---
id: UX-015
title: Irreversible action ships with no undo and no confirmation
category: interaction
severity: high
detection: model
appliesTo: [table-row-actions, settings, form-footer]
---
## Signal
An action that permanently destroys or overwrites data (delete, revoke,
reset-to-default, disconnect an integration) fires immediately on click or
tap, with neither an intermediate confirmation step nor a post-action undo
window — the state change is final the instant the control is activated.

## Why it fails
Users misclick, double-click, and change their mind mid-gesture more often
than interfaces credit; when the action is destructive and instant, the
system converts an ordinary human error rate into permanent data loss. The
person bears the entire cost of the interface's decision to skip a safety
net, usually discovering the loss only when they go looking for the thing
that's now gone.

## Fix
Add exactly one form of friction proportional to the blast radius: a
confirmation dialog that names what will be lost for destructive-and-rare
actions, or a short undo toast (5-10s, with the action's actual reversal
wired up, not just a dismiss) for destructive-but-common ones. Don't stack
both — a confirmed action doesn't also need an undo, and an undoable one
doesn't need a modal in front of it.

## Counter-example — when this is fine
An action that is destructive in name only because the underlying data is
trivially recoverable elsewhere — clearing a client-side filter, removing an
item from a cart that's still in the catalog, discarding an unsaved draft the
user just typed thirty seconds ago. Also fine when the action already sits
behind a dedicated confirmation flow one step earlier (a "delete account"
button that opens a full-page review-and-confirm screen) — the friction
exists, just not at this exact control.
