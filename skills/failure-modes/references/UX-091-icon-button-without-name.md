---
id: UX-091
title: Icon-only button with no accessible name
category: accessibility
severity: high
detection: hybrid
appliesTo: [icon-button, toolbar, table-row-actions]
---
## Signal
A button contains only an icon (SVG or icon font glyph) with no visible text
label, and the markup gives it no `aria-label`, `aria-labelledby`, or visually
hidden text — a screen reader landing on it announces only "button" or reads
the icon's file/class name, with no indication of what the button does.

## Why it fails
A sighted user infers the action from a familiar glyph, but a screen reader
user gets nothing to infer from — they either have to activate the button to
discover what it does (risky if it's destructive) or skip it entirely,
meaning the action is functionally absent from the product for them even
though it's fully present in the DOM.

## Fix
Give every icon-only control an accessible name that states the action in
the same terms a text label would use — `aria-label="Delete invoice"`, not
`aria-label="Trash icon"` — and keep it in sync with what the icon does if
the action is conditional (a toggle's label should change with its state,
e.g. "Mute" vs. "Unmute").

## Counter-example — when this is fine
A purely decorative icon that sits next to its own visible text label and
adds no independent meaning — a checkmark icon beside the word "Verified" —
where the icon is redundant with adjacent text and should in fact be marked
`aria-hidden` rather than given its own competing label; this mode is about
icon-only controls with no visible label at all, not every icon anywhere.
