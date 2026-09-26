# UX findings

scope: path `.` · 1 high · 1 medium · 1 low

## High

- **UX-101** · `src/components/Offender.tsx:4` — Off-system colour `#3b7d4f` — nearest token `--color-primary` (distance 0.05).
  - Fix: Replace the literal with the nearest existing token from the colour group; if none of the existing tokens is semantically correct, add a new token to the source file (`styling.tokenSource`) rather than inlining a one-off value, so the palette stays the single source of truth for every colour in the UI.

## Medium

- **UX-102** · `src/components/Offender.tsx:4` — Off-system length `17px` measured against the spacing scale — nearest token `--spacing-4` (distance 0.06).
  - Fix: Snap the value to the `nearestToken` the finding names. If the layout genuinely needs a gap the spacing scale does not offer, add the step to the scale so the next component has it too, rather than special-casing this one call site.

## Low

- **UX-103** · `src/components/Offender.tsx:4` — Off-system duration `220ms` — no near token; likely a genuinely new value.
  - Fix: Replace the literal with the nearest existing duration token for that motion's weight class (fast for micro-interactions like hover, slower for larger transitions like a panel opening); if the product's motion scale doesn't yet have a step for this case, add one to the token source rather than hard-coding around the gap.

