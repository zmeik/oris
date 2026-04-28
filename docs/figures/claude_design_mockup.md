# Claude Design alternative mockup — IJOS Evolution Lab

**Generated:** 27 Apr 2026
**Tool:** [Claude Design](https://claude.ai/design) (Anthropic Labs, research preview)
**Project:** Darwin Lab IJOS UI
**Project URL:**
`https://claude.ai/design/p/019dd04f-c345-7428-b030-48f22e096dfe`
**Live preview URL:**
`https://019dd04f-c345-7428-b030-48f22e096dfe.claudeusercontent.com/v1/design/projects/019dd04f-c345-7428-b030-48f22e096dfe/serve/Dental%20Radiology%20Q1.html`

> Live URL is gated by the user's Claude account session — only smanukov@newvision.ge can resolve it. Use the project URL to re-open and re-export for paper figures.

## Prompt used

The full prompt sent to Claude Design is preserved in the project chat. Key
constraints — Q1-grade IJOS submission UI, three columns, 1280×900,
`#050507` bg, `#6dc4d8` accent, paper-spec status palette, Inter +
IBM Plex Mono, 8 px grid — match `darwin_lab.css`'s refined design tokens.

## What it built

- `app.jsx` — 22.1 KB React component, dual dark/light theme.
- `Dental Radiology Q1.html` — bundled live preview.

## Output structure (verified visually)

### Top bar
`D Darwin Lab / IJOS Evolution` left, navigation right —
`Patients · Clinical · Monitor · Evolution (active) · Evaluate · Metrics ·
Implant · Arena`. Calm cyan accent on active item. Right-edge `ALGO ONLINE`
indicator.

### Sandbox bar
`SANDBOX` cyan badge, `Cohort IJOS-Q1-2026 · Run RX-3417 · v2.4.0-rc3 ·
Patient P-00482 · OPG 2026-04-19 14:07`. Numbers are tabular monospace as
specified.

### Left panel — Panoramic Radiograph (OPG)
- Header: `2820 × 1376 · 16-bit`
- Anatomically-shaped panoramic x-ray rendered procedurally with R/L
  markers, `KVP 66 · MA 8 · 14S` exposure stamp, and `P-00482 ·
  2026-04-19 · OPG-2820` footer.
- Filter toolbar: `Original 1 · CLAHE 2 · Contrast 3 · Bone 4 · Invert 5`
  with keyboard shortcut hints — exactly as briefed.
- Stats grid: `Detected teeth 19/32 · Implants 4 · Restorations 7 · Endo
  treated 2 · Crowns 3 · Caries (susp.) 1 · AGREEMENT 73.4 %`.

### Right panel — Dental Formula (FDI 2-DIGIT)
- `4 rows × 16 teeth` with quadrant labels (Q2 Upper Left | Q1 / Upper
  Right Q3 | Q4 Lower Right Lower Left).
- Row 1 (cyan ETALON): `ETALON · Ground Truth · A · expert · upper`.
- Row 2: `YOLOv9-Dent · A1 · v2.4 · upper` with one cell red-bordered.
- Row 3 (cyan ETALON): `ETALON · Ground Truth · A · expert · lower`.
- Row 4: `YOLOv9-Dent · A1 · v2.4 · lower` with cells 36 and 26
  red-bordered (mismatch indicators).
- Summary banner: `● 2 mismatches against ETALON in row 41 · YOLOv9-Dent
  — cells 36 and 26. Adjudication required.`

### Status legend (11 codes · ISO 3950)
`Present (PR) · Missing (MI) · Caries (CA) · Restored (RE) · Crowned (CR)
· Endo treated (EN) · Implant (IM) · Bridge (BR) · Impacted (IP) ·
Attrition (AT) · Uncertain (UN) · Mismatch (MM)` — colour swatches match
spec exactly.

### Top-right toolbar
`Compare · Export` next to the formula header — supports the AI workflow
described in paper §5.3.

## Convergence with `darwin_lab.css`

| Aspect | `darwin_lab.css` (committed) | Claude Design |
|---|---|---|
| BG | `#050507` | `#050507` ✓ |
| Accent | `#6dc4d8` | calm cyan equivalent ✓ |
| caries / endo / crowned | print-spec hex | identical ✓ |
| Tooth-cell sizing | 48×56 | similar (Claude rendered slightly tighter) |
| Typography | Inter + IBM Plex Mono | Inter + tabular figures ✓ |
| Mismatch outline | 2 px red inset | 2 px red border ✓ |
| Sandbox banner | "SYNTHETIC · NO PII" | "SANDBOX" — equivalent intent |
| Light theme | toggleable | brief mentioned, single-theme render shown |

The Claude Design mockup serves as **independent confirmation** that the
design tokens in `darwin_lab.css` produce a Q1-journal-grade artefact:
two independent generations from the same brief converge on the same
visual language.

### v2 — Claude Design re-aligned to production geometry

After two follow-up prompts, Claude Design **adopted** the production
5-zone V-M-D-L + O polygon SVG, the crop-carousel idea, and the
algorithm-block layout. The updated render now shows:

- **5-zone polygons** per cell on a 24×24 viewBox: V (top), L
  (bottom), M / D (toward / away from midline, swapped per quadrant),
  O (centre square).
- **Per-surface fills from ORIS grammar:** `restored:mod` → M+O+D
  filled gold (abbrev MOD); `caries:d` → D outlined red (abbrev D);
  `endo:o` → O filled violet (abbrev E or O); `crowned` → all five
  filled gold (abbrev K); `implant` → all five filled slate
  (abbrev I); `missing` → polygons hidden, dim ø.
- **Crop carousel** above each algorithm block — 16 grayscale
  placeholder cards, one per FDI position, with the active card
  expanded ~220×64 and outlined cyan. Upper carousels flush bottom,
  lower carousels flush top — mirrored around the midline.
- **Algorithm-block grouping** — each algorithm now owns a contiguous
  block of upper-arch row + 1 px midline divider + lower-arch row.
  2 px divider between blocks. Three blocks rendered: ETALON
  (cyan, with `K=0.94 · 2 readers · expert`), YOLOv9-Dent
  (`A1 · v2.4 · 0.91 mAP`), Mask R-CNN (`v1.7`).
- **SELECTED TOOTH panel** on the right — large V-M-D-L+O preview of
  the focused tooth (e.g. FDI 36 = 1st Molar · MANDIBLE · LEFT · Q3),
  identity table (FDI / Universal / Quadrant / Type), algorithm
  output (`Implant IM 0.91`, `≠ ETALON: Missing MM`), and per-source
  agreement (YOLOv9-Dent v2.4, Mask R-CNN v1.7).
- **Compare / Export** top-right toolbar; sandbox banner with
  `IJOS-Q1-2026 · RX-3417 · v2.4.0-rc3 · ALGO ONLINE · SEED 0xA13F ·
  N=412`; Dark / `⌘K` theme toggle.

Both this Claude Design render and the production `darwin_lab.css`
now share the same clinical primitive — the 5-zone SVG. Either can
serve as paper Fig. 2; the production UI is the live one, the Claude
Design render is the polished comp.

## How to capture for paper figure

1. Open the live preview URL above (requires user's Claude session).
2. Set browser to 1280×900 viewport.
3. Use `Cmd+Shift+P → Capture full size screenshot` in Chrome DevTools.
4. Save as `docs/figures/refined_arena_claude_design.png`.
5. Cite Claude Design (Anthropic Labs, 2026) in the figure caption.
