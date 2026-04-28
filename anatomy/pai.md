# Periapical Index (PAI) — ORIS v0.1 reference

> Five-step ordinal scale for radiographic assessment of apical periodontitis,
> Ørstavik / Kerekes / Eriksen, *Endod Dent Traumatol* 1986. Used in
> ORIS inside `tooth.root_data[*].pai` for any tooth carrying an
> `endo`, `root`, or `caries` layer that produces periapical findings.

---

## 1. Source

Ørstavik D, Kerekes K, Eriksen HM. **The periapical index: a scoring
system for radiographic assessment of apical periodontitis.**
*Endod Dent Traumatol* 1986;2(1):20–34. DOI: 10.1111/j.1600-9657.1986.tb00119.x.

Calibrated against Brynolf 1967 histological gold standard. Has remained
the dominant ordinal scale in periapical research for four decades.

---

## 2. The five PAI grades

| PAI | Russian (used in Arena UI) | English | Radiographic appearance | Histology (Brynolf) |
|-----|------|------|------|------|
| **1** | Норма        | Healthy periapex                 | Intact periodontal ligament space, lamina dura visible | No inflammation |
| **2** | Расширение PDL | Widened PDL                      | Slight widening of PDL, lamina dura intact            | Initial inflammation, no bone loss |
| **3** | Резорбция, очаг < 2 мм | Small lesion <2 mm radiolucency | Focal radiolucency at apex, ≤ 2 mm                    | Granuloma forming |
| **4** | Очаг 2–5 мм   | Well-defined lesion 2–5 mm       | Distinct radiolucency 2–5 mm, defined borders         | Granuloma + cyst formation |
| **5** | Очаг > 5 мм   | Large lesion > 5 mm              | Radiolucent area > 5 mm, often ill-defined            | Severe periapical lesion / cyst |

Synonyms for **PAI 1** in older literature: *normal apex*, *no apical
disease*. The Arena UI label «1 — Норма» is the canonical Russian
translation used at RUDN.

---

## 3. Reliability characteristics

PAI requires calibration training. Published inter-rater κ ranges from
0.62 (untrained dentists) to 0.85 (calibrated specialists). The ORIS
schema does **not** itself enforce calibration; it just records the
expert's PAI value as scored. Multi-rater κ is computed downstream by
`parser.kappa.compute_kappa()` if multiple ORIS documents for the same
panorama exist.

---

## 4. Encoding rules in ORIS

PAI lives inside `tooth.root_data[*].pai`, one value per root. For
multi-rooted teeth, every root carries its own PAI:

```json
{
  "fdi": "4.6",
  "occupant": "N",
  "status_layers": "endo:o+restored",
  "root_data": [
    {"root": "M", "vertucci_type": "II", "fill_state": "full", "pai": 2},
    {"root": "D", "vertucci_type": "I",  "fill_state": "two-third", "pai": 4}
  ]
}
```

Allowed values: `1`–`5` (integer). Unknown / not-assessed maps to a
missing field, not to `0`. The JSON Schema enforces
`{"type":"integer","minimum":1,"maximum":5}`.

---

## 5. Visualisation in the Arena UI

The status picker offers PAI 1–5 as a dropdown when an `endo` layer is
added. Cell colour reflects PAI ≥ 3 (red border) so calibrated reviewers
can spot at-risk teeth at a glance — see
[`reference-app/static/js/darwin/tooth-svg.js`](../reference-app/static/js/darwin/tooth-svg.js)
function `paiColor()`.

---

## 6. Extensions deferred to v0.2

- CBCT PAI (CBCT-PAI by Estrela 2008) — three-dimensional version
- Periapical index for teeth with periapical surgery (Estrela 2008)
- IPS (Index of Pulp Status) for vital teeth — orthogonal to PAI

These are catalogued in [`docs/version-roadmap.md`](../docs/version-roadmap.md).
