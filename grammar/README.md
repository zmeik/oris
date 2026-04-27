# `grammar/` — Layered status formula grammar

This directory contains the formal grammar specification of ORIS v0.1.

## Files

| File | Purpose |
|------|---------|
| [`ebnf.txt`](ebnf.txt) | Formal EBNF grammar (ISO/IEC 14977) |
| [`statuses.md`](statuses.md) | The 18 layer statuses — full definitions + literature anchors |
| [`surfaces.md`](surfaces.md) | The 5 surface codes (m/d/o/v/l) — definitions, combinations, why vestibular and not buccal |
| [`complications.md`](complications.md) | The 23-code prosthetic-complication ontology |

## Examples

| Encoded string | Meaning |
|----------------|---------|
| `''` (empty) | Unannotated |
| `present` | Intact natural tooth |
| `endo:mo+post+crowned` | Endo treated mesio-occlusally + post + crown |
| `crowned+caries:d` | Crown with secondary distal caries |
| `restored:mod` | MOD filling |
| `impl_restored` | Implant with final crown |
| `impacted` | Impacted tooth |
| `root` | Root remnant |
| `restored:mo+caries:d` | MO filling with secondary distal caries |
