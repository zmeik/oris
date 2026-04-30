# DEPRECATED — DO NOT USE

This file lists artefacts that were used in earlier iterations of the
ORIS reference application but have been **abandoned** as visual designs.
They must **never** be re-introduced into the manuscript, the cover
letter, or any submission package, because they look unfinished and
will weaken the IJOS submission.

## Deprecated artefacts

### 1. `static/demo.html` (the original static IJOS demo)

- **Status:** DEPRECATED as of 29.04.2026.
- **Reason:** the static HTML demo was a placeholder visual for Figure 2
  before the live `/play` Flask app was built. It is now visually inferior
  to `/play`, has no working data flow, and shows an incomplete dental-
  formula layout. Multiple times it has been re-suggested or re-deployed
  by mistake; the user has explicitly asked that it never be used again.
- **Replacement:** the real Flask `/play` endpoint
  (`templates/darwin_lab.html` + 14 JS modules under
  `static/js/darwin/`), reachable at `http://localhost:5051/play` when
  the reference app is running, or the static GitHub Pages snapshot of
  it at `https://zmeik.github.io/oris/play/`.
- **Do:** keep the file in the repository for historical traceability,
  but never link to it from README, cover letter, or paper figures.

### 2. v14 inline-SVG mock-up of the Arena UI (former Fig. 2 in v14)

- **Status:** DEPRECATED as of 29.04.2026.
- **Reason:** drawn by hand as a single SVG block inside
  `PAPER_IJOS_ORIS/drafts/PAPER_0_ORIS_DRAFT_EN_v14.md` (and the RU
  twin) when the live `/play` could not be screenshotted at the moment
  of writing. The SVG looked stitched-together and did not faithfully
  represent the real interface; the user found it visually disappointing
  and has flagged it as off-limits for any future revision.
- **Replacement:** an actual screenshot captured from
  `http://localhost:5051/play` (or `https://zmeik.github.io/oris/play/`)
  at 1280×900 resolution, after the bbox-overlay clutter and the
  placeholder tooltip have been turned off. The screenshots live in
  `PAPER_IJOS_ORIS/figures/fig2_arena_ui_en.png` and
  `PAPER_IJOS_ORIS/figures/fig2_arena_ui_ru.png` from v15 onward.
- **Do not:** revive the SVG mock-up in v15 or any later draft. If the
  PNG screenshot is unavailable for some reason, drop Figure 2 entirely
  rather than fall back to the SVG.

## Policy

Any future revision pass that re-suggests either of the above artefacts
should be rejected with a pointer to this file. The two replacements
listed above are the only acceptable visualisations of the reference
application in the IJOS submission package.
