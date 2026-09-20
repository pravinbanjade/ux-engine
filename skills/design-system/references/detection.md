# Resolving low-confidence fields

Ask exactly one question per low field. Write the answer back into
`.ux-engine/profile.json` and leave a note in `DESIGN.md` under Conventions.

## `confidence.styling` is low

The styling system could not be identified from the manifest, and no
stylesheet held three or more custom properties.

> Where are this project's design tokens defined — which file (or files),
> and in what form: CSS custom properties, a `:root` block, a theme block
> your build tool reads, or a JS/TS object?

Record the answer as follows:

- `styling.tokenSource` — an array of every file that holds tokens. Most
  projects have one, but list every file if the tokens are split (for
  example, one file for colour and another for spacing).
- `styling.tokenSyntax` — the form: `@theme`, `:root`, a JS/TS theme object,
  or `none` if there genuinely are none yet.
- `styling.system` — the name of the styling approach itself (utility
  classes, CSS modules, a component-scoped styling library, plain CSS, etc.),
  in whatever term the project's own docs or README use.

If tokens live in a JS or TS object rather than CSS, set `tokenSyntax` to
`js-object` and transcribe the values into `tokens` by hand — the extractor
only reads CSS custom properties out of `.css` files, so it will not have
populated this for you.

## `confidence.components` is low

No directory stood out as the component directory (no directory held enough
`.tsx`/`.jsx`/`.vue`/`.svelte` files relative to the busiest one).

> Which directory holds the reusable presentational components — the ones
> other screens compose, as opposed to page- or route-level components?

Record it in `components.dir`. Then open two or three files in that
directory and answer, from what you actually see, not from what the
manifest implies:

> Looking at these components, how do they express variants — a `variant`
> prop with a switch/lookup, conditional class strings, styled variants
> keyed by prop, or something else?

Set `components.variantMechanism` to that, in your own words if none of the
common patterns fit.

## `confidence.conventions` is low

Neither a UI framework nor a test runner turned up in the manifest
dependencies.

> What UI framework does this project use (or none, if it's framework-free),
> and what command actually runs the tests?

Record the framework in `conventions.framework` (include the major version
if you can tell, e.g. from a lockfile) and the runner in
`conventions.testRunner`. Leave `a11yTarget` at its default (`WCAG 2.2 AA`)
unless the project's own docs state a different target — don't ask about it
unless something else already put it in doubt.
