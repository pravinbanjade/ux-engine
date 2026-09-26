# UX Engine

A Claude Code plugin that gives coding agents design reasoning: it detects the
design system a repo already has, then audits and reviews UI against a catalog
of named UX failure modes.

## Install

In Claude Code:

```
/plugin marketplace add pravinbanjade/ux-engine
/plugin install ux-engine@ux-engine
```

The scripts need Node.js 20 or later on your `PATH`.

## Use

1. `/ux-design-system` — once per repo. Detects the stack, asks about anything
   it could not determine, and writes `.ux-engine/profile.json` and `DESIGN.md`.
2. `/ux-design <what you are building>` — generate new UI. Asks five questions
   about who uses it and at what scale, produces a wireframe you approve, then
   writes the code and checks it against both the failure-mode library and the
   wireframe you approved.
3. `/ux-audit [path]` — audit existing UI. Read-only.
4. `/ux-review [base]` — audit only what the working diff touched. Cheap enough
   to run before every commit; exits non-zero on a high-severity finding.
5. `/ux-restyle [path]` — repair what an audit found. After you approve the
   plan, a script replaces an off-system literal with a token only when the
   page would look the same afterwards. The colour has to match to within
   about the smallest visible difference. The token has to suit the property
   (a text token for text) and must not be a status, component-specific or
   theme-varying token. Everything else is proposed with a suggested token,
   not applied. With `--adopt-theme`, which the command offers and never
   assumes, a theme-varying token is applied too when it matches the default
   theme. The plan shows what each element becomes in the other themes.

## What it writes into your repo

| Path | What it is |
| --- | --- |
| `.ux-engine/profile.json` | Machine-readable design system: tokens, components, conventions, and the hashes it was derived from. |
| `DESIGN.md` | The same thing for humans, plus a **Deliberate Exceptions** section you edit by hand. |
| `.ux-engine/findings.json` | The most recent audit or review, in the findings envelope format. |
| `.ux-engine/report.md` | The same audit or review as a readable report. A long one is summarised in the conversation, and this file holds it in full. |
| `.ux-engine/wireframes/<slug>.json` | One per screen `/ux-design` has built: the intent you answered, the structure you approved, and every correction you made. |

## What it runs

The commands run the Node.js scripts in `scripts/` against your working tree.
They read your source files, run `git diff`, `git ls-files` and
`git status` to scope a review or check a restyle, and write only the paths in
the table above — plus your source files during `/ux-restyle`, after you
approve the plan. Nothing is fetched, installed, or sent over the network, and
the plugin declares no hooks and no MCP servers.

## Deliberate exceptions

Add one line per exception under `## Deliberate Exceptions` in `DESIGN.md`:

```
UX-101 | src/legacy/** | pre-migration theme, scheduled for removal
*      | src/vendor/** | third-party, not ours to restyle
```

Matching findings stop being reported and are counted in the report summary.

## When the scanner offers no token

A suggestion the reader cannot act on is worse than none, so the scanner
withholds one in two situations and reports each with a count.

**The group is too thin to be a scale.** A mode whose advice is "snap to the
nearest step" has nothing to offer when the group it would snap to holds fewer
than three distinct values:

```
UX-102 suppressed for spacing — 2 distinct values, not a scale (775 literals)
```

The remedy is to add tokens, or to correct `styling.tokenSource` if the real
ones were never found.

**The literal's context names no group.** A length is measured only against the
group its surrounding code identifies — `padding:` means spacing, `rounded-[`
means radius, `font-size:` means type. Where nothing recognisable precedes it,
as in a `box-shadow` offset or a `blur()` radius, no group applies:

```
UX-102 suppressed for 69 length(s) whose surrounding code does not say which token group they belong to — no scale was applied, so no substitution was offered
```

This is why a shadow offset is never handed a border-radius token whose value
happens to match. The trade is that a length whose property is not in the
scanner's hint table is not checked at all, so the table is the thing that has
to be right. The suppression lists what its lengths were written after:

```
  - Written after: `border` (×120), `box-shadow` (×49), `border-bottom` (×25), …
```

Border widths, shadows and transforms belong there, because no token scale
covers them. A spacing, sizing, radius or type property in that list is a gap
in the hint table and worth reporting.

Durations follow the same rule. A number followed by `s` counts only inside a
transition or animation, next to an easing keyword, or in a variable named for a
duration. Otherwise it is usually a status code in a test name (`404s`), a
timeout in prose, or an environment value:

```
UX-103 suppressed for 22 duration-shaped value(s) outside any transition or animation — most are timeouts, status codes or prose, so none was measured against the motion scale
```

Each length scale reports under its own mode: spacing under `UX-102`, sizing
under `UX-121`, radius under `UX-122` and type under `UX-123`. When the sizing
group is empty, the suppression also names any spacing tokens that were filed
there because of their value rather than their name, since those are the likely
place a repository's container tokens went.

A suppression is not a pass in either case.

## Why `/ux-design` asks five questions first

Because the answers change the design, and a command that skips them has
nothing to design against but the data model — which is how a settings screen
becomes a form with one field per column.

- **Who uses this** decides how much the screen explains.
- **How often** decides density, and whether confirmation is worth its friction.
- **The single action that matters most** becomes the one element that reads as
  the entry point.
- **What happens when it fails** decides how loud the error state is.
- **What the data looks like at scale** decides pagination, filtering, and
  whether the populated state survives contact with real data.

The gate is mechanical: nothing is generated until all five are answered. It
checks that you answered, not how well — the rest is a judgment the skill makes
while asking.

## The failure-mode library

`skills/failure-modes/references/` holds one file per named failure mode —
**123 of them**, IDs `UX-001` to `UX-123` — each with a Signal, why it fails, a
fix, and a counter-example saying when it is fine. Every ID sits in a range that
declares its category, which lint enforces:

| Category | IDs |
|---|---|
| information-architecture | 001-013 |
| interaction | 014-030 |
| visual-hierarchy | 031-045 |
| state-coverage | 046-060 |
| forms | 061-075 |
| data-display | 076-090 |
| accessibility | 091-100 |
| system-consistency | 101-110, 121-123 |
| conformance | 111-120 |

IDs are published: they appear in findings files, exceptions and approved
design docs. So a category that outgrows its range takes a new range at the end
of the catalog, and no existing ID is renumbered.

`INDEX.md` is the one-line-per-mode catalog. Nothing reads it whole: an audit
names the surfaces in front of it and asks for the modes that could apply.

```
npm run select -- --kinds table,list --exclude-detection scanner,conformance
```

The surface vocabulary is closed — `APPLIES_TO` in `scripts/lib/library.mjs` —
so a mistyped kind exits 2 and says so, rather than returning nothing and
letting the caller conclude no mode applies.

## Development

```
npm test              # node --test over tests/
npm run lint:library  # every mode file well-formed, in range, and indexed
npm run select -- --kinds table,form   # the modes that could apply to a surface
```

Zero dependencies, runtime and dev.

## License

[MIT](LICENSE)
