# Darwin Lab — Visual Design Notes

This document records the rationale behind the visual refresh of the
`reference-app` UI shipped alongside the ORIS / IJOS submission. The goal
is a *Q1-journal-grade artefact*: production-ready clinical UI that also
photographs well in a Figure 2 caption. Reference points: HAPI FHIR docs,
OSIPI Lexicon, Stripe docs, Linear.

## Palette

The original UI used a Tailwind-derived blue/violet/cyan accent stack on
a slate background (`#0a0e1a`, `#3b82f6`). It was readable but felt
"webapp", not "instrument". We made three palette moves:

1. **Deeper, neutral-warmer blacks.** Background dropped from `#0a0e1a`
   to `#050507`; primary surface from `#131a2b` to `#0f1117`. The deeper
   black removes blue cast and reads as a calm radiograph viewer.
2. **Accent calmed.** Replaced saturated `#3b82f6` (Tailwind blue-500)
   with `#6dc4d8` (mid-tone cyan). Lower chroma matches anatomical
   neutrals, prints cleanly in greyscale, and never fights for attention
   with the radiograph.
3. **Status palette is print-safe + WCAG-AA.** All cell statuses moved
   to a single coordinated stack: caries `#c0392b`, endo violet
   `#7e3f8c`, crowned gold `#b8860b`, restored teal `#2c7a7a`, implant
   slate `#34495e`, missing grey `#6b6b6b`, present green `#2c7a4a`,
   impacted brown `#8a4a20`, attrition khaki `#a89e58`, uncertain
   yellow `#c0a83a`, bridge grey `#7a7a7a`, post amber `#d97a3a`. Each
   is paired with a 15-18 % opacity background (the cell fill) and
   used at full opacity for stroke/text. These colours retain
   distinguishability at print contrast and survive black-and-white
   reproduction in journal proofs.

A **light-theme variant** was added (`body.theme-light`) using a
cream `#fafaf8` ground and navy `#1d4f8c` accent. It preserves the
status palette so figures stay consistent across dark/light captures.
Theme toggle is in the top-bar nav and persists through `localStorage`.
This is intended for paper figures — Figure 2 reproduces better on
white in a journal layout.

## Typography

UI font is **Inter** loaded from `rsms.me/inter`; code/numerics use
**IBM Plex Mono**. Sizing follows a 12 / 14 / 16 / 20 / 24 / 32 px
rhythm with weights restricted to 400 / 500 / 600. Crucially, every
tabular figure (FDI numbers, scores, timestamps, IDs) gets
`font-variant-numeric: tabular-nums` — without it the cell numbering
shifts as digits change shape. Reading targets like `cell-num`,
`row-score`, `composite`, history timestamps, and PMID badges all use
the mono stack. Paper readers and clinicians notice the difference
immediately.

## Spacing and tooth-cell legibility

Spacing variables collapse to a strict 4 px scale (`--sp-1`…`--sp-10`).
The *biggest* clinical change is the tooth cell:

- Old: `40 × 40+` px, dense, abbreviation hard to read at glance.
- New: `48 × 56` px (`--cell-w` / `--cell-h`), `4 px` gap, `6 px`
  border radius. Border is `1 px transparent` baseline, `1 px
  hairline` in GT row, `2 px red` (`box-shadow: inset`) for `.mismatch`.
  Status colour fills the cell at ~15 % bg opacity; the abbreviation
  sits at full opacity centred; FDI number is monospace 10 px in the
  top-right; the tooth diagram is `36 × 36 px`. Hover/focus reveal a
  cyan ring for keyboard a11y.

Modal dialogs (`tooth-picker`, `arena-add-dialog`, `confusion-box`,
`sandbox-import-box`) all gained: backdrop blur `2 px`, larger
12 px radius, `var(--shadow-lg)`, padding on a 4 px scale, and proper
focus rings.

## States and feedback

The original UI silently failed when no document was loaded or while
data was fetching. We added three primitives — `.state-empty`,
`.state-error`, and `.skeleton` (with shimmer animation). JS modules
can opt in without breaking. The `.gt-confirm-btn` was promoted to a
real *primary* action — full cyan accent fill in `.ready` state with
a soft outer glow, scale-up on hover, dimmed disabled state. This
matches the brief: "primary save button (large + accent)".

## Accessibility

Every interactive element gets a visible focus ring (`box-shadow:
0 0 0 2px var(--bg), 0 0 0 4px var(--accent-ring)`). ARIA roles were
added to `header`, `nav`, breadcrumb. The OPG image area has
`alt`-friendly markup via `aria-label`. `prefers-reduced-motion`
disables transitions/animations. The theme toggle has both a label
and a tooltip.

## Responsive

Existing `@media (max-width: 1100px)` and `960 px` breakpoints were
preserved (the sticky right detail panel collapses, then the OPG/
formulas stack). Added a `< 900 px` breakpoint per the brief that
collapses the whole layout to a single column and hides the sidebars.
The grid columns reduce to `1fr` and `methods-grid` becomes 2-up.

## Assumptions documented

A few autonomous decisions were taken without consultation:

- **Inter is loaded from rsms.me, IBM Plex Mono from Google Fonts.**
  No build step required. If the deployment target needs offline
  fonts, drop them under `/static/fonts/` and adjust the `@import`.
- **Theme persistence uses `localStorage`.** Acceptable for a
  research demo; should move to user-preference cookie if the
  authoritative app inherits this.
- **Emoji prefixes were retained in the topbar** because the brief
  says "Russian status legend ... verbatim сохранить" and the legend
  often relies on emoji distinguishers in tooltips and labels.
  Removing them risked breaking JS-rendered legends.
- **No HTML class names were removed** — only added (`theme-toggle`,
  `state-empty`, etc.) — because 14 production JS modules read
  classes like `.arena-cell`, `.row-cells`, `.gt-save-btn`, etc.
- **Light theme tokens** were tuned by hand for status legibility on
  cream rather than algorithmically derived. A more rigorous
  derivation would map every status to its WCAG-AA contrast partner
  per theme; left as future work.
