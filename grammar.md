# `grammar.md` — ORIS v0.1 layered status grammar (overview)

> One-page overview pointing to the four files in [`grammar/`](grammar/)
> and to the [JSON Schema](schema/oris-v0.1.json). Companion to the
> paper "ORIS v0.1 — Open Radiographic Imaging Schema", §5.1
> *Schema specification*.

---

## TL;DR

Each tooth position in an ORIS document carries a **layered status
formula** — a compact string that lists every radiographically
observable finding on that tooth, in arbitrary depth, with optional
per-layer surface markup over the five surfaces *m, d, o, v, l*
(mesial, distal, occlusal, vestibular, lingual).

Examples:

| Formula                    | Meaning |
|----------------------------|---------|
| `''` *(empty)*             | Unannotated cell |
| `present`                  | Intact natural tooth |
| `endo:mo+post+crowned`     | Endo-treated mesio-occlusally, with post and crown |
| `crowned+caries:d`         | Crown with secondary distal caries |
| `impl_restored`            | Implant with final crown |
| `restored:mo+caries:d`     | MO filling with secondary distal caries |

The grammar enforces:

1. Order of layers is preserved (left-to-right == reading order in the report).
2. Surface markup attaches to a layer with `:`, and uses each of *m d o v l* at most once per layer.
3. Statuses are drawn from a fixed enum of 18 (see below).

---

## Where to find the full spec

| Topic | File |
|-------|------|
| **Formal EBNF (ISO/IEC 14977)** | [`grammar/ebnf.txt`](grammar/ebnf.txt) |
| **The 18 statuses — definitions, literature anchors, examples** | [`grammar/statuses.md`](grammar/statuses.md) |
| **The 5 surface codes (m/d/o/v/l) — why vestibular not buccal** | [`grammar/surfaces.md`](grammar/surfaces.md) |
| **23-code prosthetic-complication ontology** | [`grammar/complications.md`](grammar/complications.md) |
| **JSON Schema enforcement** | [`schema/oris-v0.1.json`](schema/oris-v0.1.json) (see `$defs/toothFormula`) |
| **Reference Python parser/serialiser** | [`parser/core.py`](parser/core.py) (`parse_tooth_layers`, `encode_tooth_layers`) |

---

## Quick reference — the 18 statuses

| Group | Status code | One-liner |
|-------|-------------|-----------|
| Tooth-level | `present`     | Intact natural tooth |
| Tooth-level | `missing`     | Position is empty (Occupant `A`) |
| Tooth-level | `impacted`    | Unerupted / impacted |
| Tooth-level | `root`        | Root remnant only (Occupant `R`) |
| Pathology   | `caries`      | Carious lesion (surfaces specify location) |
| Treatment   | `restored`    | Direct or indirect filling (surfaces specify shape) |
| Treatment   | `endo`        | Endodontic treatment (surfaces specify access) |
| Treatment   | `post`        | Endodontic post |
| Treatment   | `crowned`     | Full-coverage crown |
| Implant     | `implant`     | Generic implant (use `impl_*` for stage) |
| Implant     | `impl_fixture`| Fixture only, no abutment |
| Implant     | `impl_healing`| Fixture + healing abutment |
| Implant     | `impl_restored`| Implant with final crown / abutment + crown |
| Bridge      | `bridge`      | Bridge pontic body |
| Bridge      | `bar`         | Bar / hybrid retainer (drag-axis) |
| Bridge      | `cantilever`  | Cantilever pontic |
| Misc        | `attrition`   | Tooth wear (severity in `tooth_notes`) |
| Misc        | `uncertain`   | Reviewer-flagged ambiguity |

Full definitions with literature anchors are in
[`grammar/statuses.md`](grammar/statuses.md).

---

## Quick reference — the 5 surfaces

```
        m       d
      ┌────┬────┐
      │ MV │ DV │     v = vestibular (NOT buccal — see grammar/surfaces.md §3)
      ├────┼────┤
      │  O   O  │     o = occlusal / incisal
      ├────┼────┤
      │ ML │ DL │
      └────┴────┘
        m       d
```

| Surface | Meaning | Applies to |
|---------|---------|-----------|
| `m` | mesial         | All teeth |
| `d` | distal         | All teeth |
| `o` | occlusal/incisal | All teeth |
| `v` | vestibular     | All teeth (covers buccal **and** labial) |
| `l` | lingual / palatal | All teeth |

The choice `v` over `b` (buccal) is deliberate: *buccal* refers to the
posterior cheek-facing surface, whereas *vestibular* covers the entire
anterior + posterior outer surface, so a single code applies uniformly
to all 32 teeth. See [`grammar/surfaces.md`](grammar/surfaces.md) §3 for
the full rationale.

---

## Round-trip property

For any valid formula string `s`:

```python
from oris.parser.core import parse_tooth_layers, encode_tooth_layers

assert encode_tooth_layers(parse_tooth_layers(s)) == s
```

This invariant is enforced by `tests/test_parser_core.py::test_round_trip_18_statuses`.
