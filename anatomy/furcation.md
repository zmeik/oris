# Furcation involvement grading — ORIS v0.1 reference

> Three-grade ordinal scale per Glickman 1953 (extended by Hamp/Nyman 1975).
> Used in ORIS inside `tooth.root_data` for multi-rooted teeth with a
> periodontal layer (`caries:furc`, `endo`, etc.) that involves the
> furcation area.

---

## 1. Source

Glickman I. **Clinical Periodontology.** 1st ed. Philadelphia: Saunders; 1953.

Subsequent refinement:
Hamp SE, Nyman S, Lindhe J. *Periodontal treatment of multirooted teeth:
Results after 5 years.* J Clin Periodontol 1975;2(3):126–135.

Glickman's I–IV scale remains the dominant clinical grading; ORIS adopts
it. The Hamp/Nyman 1975 horizontal-loss extension (F1 / F2 / F3 in
millimetres) is supported as an optional sub-field (`furc_horiz_mm`).

---

## 2. The four Glickman grades

| Code | Grade | Description | Detection on OPG |
|------|-------|-------------|------|
| `I`   | Grade I   | Incipient bone loss; furcation flute palpable but probe does not enter | Subtle widening of PDL at furca, often missed on 2D OPG |
| `II`  | Grade II  | Partial bone loss in furcation; probe enters but does not pass through | "Cup-shaped" radiolucency above furca; visible if penetration > 1 mm |
| `III` | Grade III | Through-and-through bone loss but soft-tissue still covers furcation | Clear inter-radicular radiolucency reaching opposite side |
| `IV`  | Grade IV  | Through-and-through, gingival recession exposes furcation clinically | Same as Grade III + supra-osseous radiolucency from gingival side |

OPG sensitivity for Grade I is poor (CBCT recommended); Grades II–IV
are reliably detected on a quality OPG.

---

## 3. Encoding rules in ORIS

The schema attaches Furcation grade to the **tooth**, not to individual
roots, because the furcation by definition is the region where multiple
roots converge:

```json
{
  "fdi": "1.6",
  "occupant": "N",
  "status_layers": "endo:mo+post+crowned",
  "root_data": [
    {"root": "MB", "vertucci_type": "IV", "fill_state": "full", "pai": 1},
    {"root": "DB", "vertucci_type": "I",  "fill_state": "full", "pai": 1},
    {"root": "P",  "vertucci_type": "I",  "fill_state": "two-third","pai": 2}
  ],
  "furcation_glickman": "II",
  "furc_horiz_mm": 3.5
}
```

Allowed values for `furcation_glickman`: `"I" | "II" | "III" | "IV"`.
`furc_horiz_mm` is an optional non-negative number (Hamp 1975 horizontal
component, when measured).

---

## 4. Visualisation in the Arena UI

When a multi-rooted tooth (`UP_M`, `UP_PM`, `LO_M`) is selected, the
status picker exposes a `Furcation` segmented control I/II/III/IV; the
selected grade colours the inter-radicular gap of the tooth SVG (see
[`reference-app/static/js/darwin/tooth-svg.js`](../reference-app/static/js/darwin/tooth-svg.js)
function `furcOverlay()`).

---

## 5. Extensions deferred to v0.2

- Tarnow & Fletcher 1984 vertical bone loss component
- Carnevale 1995 surgical classification
- CBCT-derived volumetric grading (in mm³)

Catalogued in [`docs/version-roadmap.md`](../docs/version-roadmap.md).
