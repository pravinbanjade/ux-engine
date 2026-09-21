# UX Engine

A Claude Code plugin that gives coding agents design reasoning: it detects the
design system a repo already has, then audits and reviews UI against a catalog
of named UX failure modes.

## Install

```
/plugin marketplace add pravin/ux-engine
```

## Use

1. `/ux-design-system` — once per repo. Detects the stack, asks about anything
   it could not determine, and writes `.ux-engine/profile.json` and `DESIGN.md`.
2. `/ux-audit [path]` — audit existing UI. Read-only.
3. `/ux-review [base]` — audit only what the working diff touched. Cheap enough
   to run before every commit; exits non-zero on a high-severity finding.

## What it writes into your repo

| Path | What it is |
| --- | --- |
| `.ux-engine/profile.json` | Machine-readable design system: tokens, components, conventions, and the hashes it was derived from. |
| `DESIGN.md` | The same thing for humans, plus a **Deliberate Exceptions** section you edit by hand. |
| `.ux-engine/findings.json` | The most recent audit or review, in the findings envelope format. |

## Deliberate exceptions

Add one line per exception under `## Deliberate Exceptions` in `DESIGN.md`:

```
UX-101 | src/legacy/** | pre-migration theme, scheduled for removal
*      | src/vendor/** | third-party, not ours to restyle
```

Matching findings stop being reported and are counted in the report summary.

## The failure-mode library

`skills/failure-modes/references/` holds one file per named failure mode, each
with a Signal, why it fails, a fix, and a counter-example saying when it is
fine. `INDEX.md` is the one-line-per-mode index the audit reads first.

## Development

```
npm test              # node --test over tests/
npm run lint:library  # every mode file well-formed and indexed
```

Zero dependencies, runtime and dev. See `docs/superpowers/specs/` for the
design.
