---
id: UX-004
title: The task the product exists for sits three levels down
category: information-architecture
severity: high
detection: model
appliesTo: [navbar, nav-item, page]
---
## Signal
The route table or navigation config places the action the product exists for
three or more levels below the entry screen — reached only through a section,
then a sub-section, then a tab — while shallower slots hold administrative or
rarely-visited destinations like billing, audit logs or team settings. The
tell is a nav tree whose top level mirrors the org chart or the data model
rather than the frequency with which each destination is visited.

## Why it fails
Depth is paid on every visit, by every user, forever. A daily task behind
three clicks costs its audience minutes a week and, worse, has to be
remembered: users who visit weekly rather than daily re-derive the path each
time, and some never find it and ask someone instead. Meanwhile the rarely
used destinations occupying the top level are read, scanned and skipped past
by everyone, every time, earning their prominence from nobody.

## Fix
Promote the task to a top-level destination, or surface an entry point for it
directly on the landing screen, built from the navigation primitives the
profile already defines rather than a new pattern invented for this one case.
Demote the administrative destinations it displaces into a grouped section or
a secondary menu, ordered by how often each is actually opened.

## Counter-example — when this is fine
A destructive or high-commitment operation that is deliberately kept deep so
it cannot be reached by accident — closing an account, deleting a workspace,
rotating production credentials. Depth is the safeguard there, and the users
who need it reach it rarely and with intent.
