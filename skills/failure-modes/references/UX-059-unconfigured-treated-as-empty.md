---
id: UX-059
title: A feature never set up renders the same message as one with no data
category: state-coverage
severity: medium
detection: model
appliesTo: [dashboard, settings, page]
---
## Signal
A feature that has never been configured — no source connected, no integration
authorised, no first record created — falls into the same branch as a
configured feature that happens to hold nothing, and renders the same
zero-result message. There is no setup action anywhere on the surface.

## Why it fails
These are opposite situations and they need opposite responses. A configured
feature with no data needs the user to wait or to create something; an
unconfigured one needs a setup step the user has not been told exists. Telling
a new user there is nothing to show implies the product has been set up and
found empty, so they look for data rather than for the connect button, and
some conclude the feature does not work.

## Fix
Branch the never-configured case out of the empty state and give it its own
rendering: what this feature does, and the action that sets it up, as the
primary control on the surface. Keep the zero-result message for the case
where configuration exists and the set is genuinely empty.

## Counter-example — when this is fine
A feature with nothing to configure, where the empty state is the only
possible zero case — a list of records the user creates directly, with no
connection or authorisation step in front of it.
