---
id: UX-006
title: Sections grouped by backing system rather than by user question
category: information-architecture
severity: medium
detection: model
appliesTo: [page, dashboard, detail-view]
---
## Signal
Section headings name services, database tables or API endpoints — "Billing
Service", "CRM Sync", "Inventory API" — or the component tree maps one section
per data source. A single question the user came to answer requires reading
across two or more of those sections and holding values from one in mind while
looking at another.

## Why it fails
The user does not know or care which service owns which field; they arrived
with a question, and the layout has scattered its answer across boundaries
that exist for engineering reasons. Every cross-section lookup is a working
memory cost, and the grouping actively misleads: it implies the fields inside
a section belong together, when what they share is a maintainer, not a meaning.

## Fix
Regroup the sections around the questions this screen exists to answer, and
place the fields that answer each question together under a heading phrased as
that question's subject — regardless of which service supplied them. Where one
source genuinely maps to one user concern, the grouping survives the rewrite
under a name the user recognises.

## Counter-example — when this is fine
An operational or integration screen whose audience is the person managing
those systems: a sync status page, a connector health dashboard, a developer
console. There the service boundary is the user's mental model, and naming it
is the clearest possible grouping.
