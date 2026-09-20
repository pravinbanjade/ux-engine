# Resolving low-confidence fields

Ask exactly one question per low field. Write the answer into
`.ux-engine/profile.json` at the field it belongs to, and add that field's
dotted path to the profile's `resolvedByHuman` array so `detect-profile.mjs`
carries it forward on every future run instead of overwriting it.

Never write the answer into `DESIGN.md` directly, and never under its
Tokens, Components or Conventions headings specifically — those three
sections are fully regenerated from the profile on every run and whatever
you put there is discarded the next time detection runs. If you also want a
human-readable note (not just the profile value), put it under **Deliberate
Exceptions** in `DESIGN.md` — that section, like any other hand-written
section, is preserved verbatim.

## `confidence.styling` is low

This happens only when `styling.system` itself came back `null` — which
requires both of these to be true: the repo has no `.css` files anywhere,
and no known styling library (a utility-first framework, a CSS-in-JS
library, etc.) appears in the manifest. The "3 or more custom properties"
threshold is unrelated to this — it only decides which stylesheets count as
`tokenSource`, which is what separates `medium` from `high`. A repo with
CSS files but no qualifying token block still gets `system` set (falling
back to a plain-CSS reading) and lands at `medium`, not `low`.

> Where are this project's design tokens defined — which file (or files),
> and in what form: CSS custom properties, a `:root` block, a theme block
> your build tool reads, or a JS/TS object? If there's truly no styling
> approach in play yet, say so.

Record the answer as follows, and add each path you touch to
`resolvedByHuman`:

- `styling.tokenSource` — an array of every file that holds tokens. Most
  projects have one, but list every file if the tokens are split (for
  example, one file for colour and another for spacing).
- `styling.tokenSyntax` — the form: `@theme`, `:root`, a JS/TS theme object,
  or `none` if there genuinely are none yet.
- `styling.system` — the name of the styling approach itself (utility
  classes, CSS modules, a component-scoped styling library, plain CSS, etc.),
  in whatever term the project's own docs or README use.

If tokens live in a JS or TS object rather than CSS, set `tokenSyntax` to
`js-object`, transcribe the values into `tokens` by hand, and add `"tokens"`
to `resolvedByHuman` as well — re-running detection will otherwise try to
re-extract `tokens` from CSS and find nothing, since the extractor only
reads CSS custom properties out of `.css` files.

Also add the theme file's own path to `styling.tokenSource` (it's an array —
append to it rather than replacing it if other files are already listed),
and add `"styling.tokenSource"` and `"styling.tokenSyntax"` to
`resolvedByHuman` alongside `"tokens"`. This step is not optional bookkeeping:
the off-system value scanner (Task 12) excludes every file listed in
`tokenSource` from scanning, on the theory that a token source defines the
on-system values rather than using them. A JS/TS theme file left out of
`tokenSource` gets scanned like any other component file, and every literal
colour, length or duration inside it — which is to say, the project's actual
token *definitions* — gets reported back to the user as an off-system value
mistake. That is a false positive on the most authoritative file in the
project, not a missed edge case, so leaving the theme file unlisted is a
detection bug, not a simplification. Listing it in `tokenSource` also adds it
to `derivedFrom`, so an edit to the theme file correctly marks the profile
stale on the next check, the same as an edit to a CSS token file would.

## `confidence.components` is low

This happens only when `components.dir` came back `null`, which in turn
only happens when the repo has zero component files (`.tsx`/`.jsx`/`.vue`/
`.svelte`) anywhere at all. A directory that merely wins a close contest
against others is never `low` — the busiest directory always clears its own
25% band and gets picked, landing at `medium` or `high` instead. If you're
being asked this question, there is genuinely no component code for the
detector to have looked at, or the project uses a file type outside that
list.

> Which directory holds the reusable presentational components — the ones
> other screens compose, as opposed to page- or route-level components? (If
> the project uses a component file type outside `.tsx`/`.jsx`/`.vue`/
> `.svelte`, say which one.)

Record it in `components.dir`. Then open two or three files in that
directory and answer, from what you actually see, not from what the
manifest implies:

> Looking at these components, how do they express variants — a `variant`
> prop with a switch/lookup, conditional class strings, styled variants
> keyed by prop, or something else?

Set `components.variantMechanism` to that, in your own words if none of the
common patterns fit. Add both `"components.dir"` and
`"components.variantMechanism"` to `resolvedByHuman`.

## `confidence.conventions` is low

No UI framework turned up in the manifest dependencies (this is what drives
the score — a missing test runner alone only drops it to medium, never low).

> What UI framework does this project use (or none, if it's framework-free),
> and what command actually runs the tests?

Record the framework in `conventions.framework` (include the major version
if you can tell, e.g. from a lockfile) and the runner in
`conventions.testRunner`. Add both paths to `resolvedByHuman`. Leave
`a11yTarget` at its default (`WCAG 2.2 AA`) unless the project's own docs
state a different target — don't ask about it, and don't add it to
`resolvedByHuman`, unless something else already put it in doubt.
