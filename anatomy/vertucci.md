# Vertucci canal classification — ORIS v0.1 reference

> Eight root-canal morphological types per Vertucci's seminal 1984 paper [1].
> ORIS uses these codes inside `tooth.root_data[*].vertucci_type` (extension
> attached to any tooth carrying an `endo` or `root` layer).

---

## 1. Source

Vertucci FJ. **Root canal anatomy of the human permanent teeth.**
*Oral Surg Oral Med Oral Pathol* 1984;58(5):589–599.
DOI: 10.1016/0030-4220(84)90085-9.

The classification is the de-facto standard in modern endodontics and is
embedded in clinical guidelines worldwide; ORIS adopts it verbatim.

---

## 2. The eight types

| Code | Vertucci type | Description (single root, viewed from apex to crown) |
|------|---------------|------|
| `I`   | Type I    | One canal, apical to coronal — single straight canal |
| `II`  | Type II   | Two canals start at the orifice, merge to one near the apex (`2-1`) |
| `III` | Type III  | One canal at orifice, splits into two in the body, rejoins to one at apex (`1-2-1`) |
| `IV`  | Type IV   | Two separate canals, two separate apical foramina (`2`) |
| `V`   | Type V    | One canal at orifice, splits into two near the apex (`1-2`) |
| `VI`  | Type VI   | Two canals at orifice, merge in the body, split again near apex (`2-1-2`) |
| `VII` | Type VII  | One canal at orifice, splits–merges–splits to two foramina (`1-2-1-2`) |
| `VIII`| Type VIII | Three separate canals from orifice to apex (`3`) |

ORIS additionally accepts `IX` and `X` for rare anomalies documented in
later literature (Sert & Bayirli 2004), but these are out of scope for v0.1.

---

## 3. Encoding rules in ORIS

Each `tooth.root_data` entry is an array of root objects.
For multi-rooted teeth (`UP_PM` two roots, `UP_M` three roots, `LO_M` two
roots, etc.) every root gets its own object:

```json
{
  "fdi": "1.6",
  "occupant": "N",
  "status_layers": "endo:mo+post+crowned",
  "root_data": [
    {"root": "MB",  "vertucci_type": "IV", "fill_state": "full",  "pai": 1},
    {"root": "DB",  "vertucci_type": "I",  "fill_state": "full",  "pai": 1},
    {"root": "P",   "vertucci_type": "I",  "fill_state": "two-third","pai": 2}
  ]
}
```

Root identifiers (`MB`, `DB`, `P`, `M`, `D`) follow the conventions in
[`grammar/surfaces.md`](../grammar/surfaces.md#root-codes).

---

## 4. Coverage in the reference parser

`parser/numbering.py` recognises any of `["I","II","III","IV","V","VI","VII","VIII"]`
as valid `vertucci_type` and rejects unknown values via
[`schema/oris-v0.1.json`](../schema/oris-v0.1.json) `enum`.

The Arena UI offers Vertucci I–VIII as a dropdown directly inside the
status picker when an `endo` layer is added (see
[`reference-app/static/js/darwin/tooth-svg.js`](../reference-app/static/js/darwin/tooth-svg.js)
for the canal-rendering logic).

---

## 5. Extensions deferred to v0.2

- Sert–Bayirli 2004 IX–XXIII rare anomalies
- Three-root upper premolar (sub-tropical population variation)
- Curvature index per Schneider 1971 (would attach to root_data)
- C-shaped canal flag (Cooke & Cox 1979)

These are catalogued in [`docs/version-roadmap.md`](../docs/version-roadmap.md).
