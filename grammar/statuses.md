# Layer statuses

> ORIS v0.1 derives its layer statuses from the production constant `ARENA_STATUS_CYCLE` in the Darwin-Lab Arena codebase (18 statuses including the empty string `''`), plus 2 production-observed extensions (`impl_cover`, `attrition`) seen in real ground-truth data — together 20 statuses, of which 19 are non-empty. Each status maps to one of four semantic categories (physiological, treatment, pathological, artifact) and is anchored to authoritative literature.
>
> **Paper alignment:** Paper v9 §2.1 cites "18 statuses derived from production ARENA_STATUS_CYCLE". The 2 extension statuses below (`impl_cover`, `attrition`) are documented here as production-observed but not yet listed in the paper's main text — they are accepted by the parser/validator/bridges and exist in real K08.1 cohort GT. They will be promoted to the paper text in v0.2.

## Quick reference

| Status | Category | Meaning | Visual cue (Arena UI) |
|--------|----------|---------|------------------------|
| `''` (empty) | n/a | Not annotated | white cell |
| `present` | physiological | Intact natural tooth, no findings | white cell, dot abbreviation |
| `missing` | treatment trace | Tooth absent | dark grey cell, "A" |
| `implant` | treatment | Generic implant (no detail) | blue cell, screw icon |
| `impl_fixture` | treatment | Implant fixture only (no abutment, no crown) | blue, "F" |
| `impl_healing` | treatment | Implant with healing abutment | blue, "H" |
| `impl_restored` | treatment | Implant with final prosthetic restoration | blue, "I+K" / "IK" |
| `impl_cover` | treatment | Implant with **cover screw** sealed under mucosa (sub-mucosal, between Stage 1 and Stage 2 surgery) — **production extension** | blue, "ИЗ" / "IC" |
| `post` | treatment | Intraradicular post (metal or fibre) | green, "Ш" / "P" |
| `crowned` | treatment | Full-coverage coronal restoration | blue, "K" |
| `restored` | treatment | Filling (composite/amalgam/glass-ionomer) | orange, "П" / "F" |
| `caries` | pathological | Carious radiolucency | red, "C" / "С" |
| `endo` | treatment | Endodontic treatment (root canal filling) | green, "Э" / "E" |
| `root` | pathological | Root remnant (no coronal structure) | dark, "r" |
| `impacted` | pathological | Impacted / retained tooth | dark, "⌂" |
| `bridge` | treatment | Bridge component (pontic or retainer abutment) | grey, "B" |
| `bar` | treatment | Implant bar (overdenture with bar attachment) | grey, "—" |
| `cantilever` | treatment | Cantilever pontic (single-side retention) | grey, "↦" |
| `attrition` | pathological | Tooth wear / abrasion (TWI Lussi index) — **production extension** | yellow, "≈" |
| `uncertain` | artifact | Indeterminable (artifact / low quality) | yellow, "?" |

## Detailed definitions of production extensions

### `impl_cover` — Implant with cover screw

**Source:** ITI Treatment Guide vol. 5 (Stage 1 / Stage 2 surgical protocol).

Distinct from `impl_healing` — `impl_healing` has a healing abutment protruding through the mucosa, whereas `impl_cover` has a flat **cover screw** sealing the implant platform sub-mucosally during the osseointegration period (typically 3–6 months between Stage 1 placement and Stage 2 uncovering).

**Radiographic appearance.** Implant fixture visible with a flat radiopaque element flush with the platform (the cover screw); no abutment protruding occlusally; mucosal seal evident on intraoral imaging if available.

**Clinical relevance.** Frequent during the load-free osseointegration phase; confirms the implant is at Stage 1 → Stage 2 transition awaiting uncovery.

### `attrition` — Tooth wear

**Source:** Lussi A, Carvalho TS. "Erosive tooth wear: a multifactorial condition of growing concern and increasing knowledge." *Monogr Oral Sci* 2014;25:1-15.

Radiographically observable tooth wear / abrasion (TWI 0–4). Typically visible as flattening of cusp tips, reduced crown height, or shortened incisal edges. Often combined with other layers (e.g. `attrition+restored`).

**Clinical relevance.** Indicator of bruxism, parafunction, or erosive habits; relevant for prosthetic planning and implant longevity (high-attrition patients have higher implant complication rates per Misch 2020 Ch. 47).

## Detailed definitions

### Empty string `''`

The cell has not yet been annotated. Used as the initial state. Distinct from `present` (which asserts intactness) and `uncertain` (which asserts indeterminacy).

### `present` — Intact natural tooth

**Source:** White & Pharoah 8e Ch. 14.

A natural tooth, in occupant position `N`, with no radiologically visible treatment, restoration, or pathology. Does not exclude clinical findings invisible on radiograph (sensitivity, vitality, mobility).

### `missing` — Tooth absent

**Source:** ICD-10 K00–K08 family; ICD-10 K08.1 specifically for loss due to extraction/accident/local periodontal disease.

The dental position is empty. Pair with occupant `A` (Absent) or — if a prosthesis fills the position — with the appropriate prosthetic occupant (B/C/D/H/M/I).

### `implant` — Generic implant

**Source:** Misch CE. *Contemporary Implant Dentistry*. 4th ed. 2020.

An endosseous implant is present but the radiologist has not specified the prosthetic stage. Prefer the more specific `impl_fixture` / `impl_healing` / `impl_restored` when distinguishable.

### `impl_fixture` — Fixture only

**Source:** ITI Treatment Guide vol. 5.

Implant body in bone with no abutment and no coronal restoration. Common in the period after first-stage surgery before second-stage uncovering.

### `impl_healing` — Healing abutment / cover screw

Implant body with healing abutment in soft tissue, or with cover screw under closed mucosa awaiting second-stage uncovering.

### `impl_restored` — Implant with final restoration

The implant carries a final prosthetic restoration (crown, bridge abutment, overdenture attachment, or hybrid framework component). Combine with the `implant` block to specify system, marginal bone level, complications, etc.

### `post` — Intraradicular post

**Source:** Rosenstiel SF, Land MF, Walter R. *Contemporary Fixed Prosthodontics*. 6th ed. 2022, Ch. 11.

A metallic or fibre-reinforced post in the root canal, typically supporting a coronal core and crown. Layered with `endo` (the post is placed in an endodontically treated root) and `crowned`. Surfaces typically `:m`, `:o`, or `:mo` to indicate post position.

### `crowned` — Full-coverage coronal restoration

**Source:** Rosenstiel et al. 2022 Ch. 18.

A full-coverage crown (PFM, all-ceramic, gold, zirconia) on the tooth. May layer over `endo`, `post`, `restored`. May also occur on implants (combine with `impl_restored`).

### `restored` — Filling

**Source:** FDI Materials Guide 2023 (radiopacity standards).

A direct restoration: composite, amalgam, glass-ionomer cement (GIC), or compomer. The filling's surface coverage is encoded after `:` (e.g. `restored:mod` for a mesial-occlusal-distal filling).

### `caries` — Carious radiolucency

**Source:** Wenzel A. *Acta Odontol Scand*. 2014;72(4):251–264. ICDAS Foundation 2019 update.

A radiolucent lesion compatible with caries. The radiograph cannot definitively diagnose caries (requires tactile / clinical confirmation), so the radiologist describes the *radiographic appearance* — `caries` here means "carious-like radiolucency", not a confirmed clinical caries diagnosis.

### `endo` — Endodontic treatment

**Source:** ESE. *Quality Guidelines for Endodontic Treatment: Consensus Report*. 2024 update.

Root canal filling material visible in the root canal system. Often layered with `post`, `crowned`. Surfaces (`:mo`, `:m`, etc.) optionally describe the access cavity. Pair with `root_data` for canal-level detail (Vertucci, fillStates, periapical findings).

### `root` — Root remnant

**Source:** White & Pharoah 8e Ch. 14.

Only the root portion remains; the coronal portion is absent. Distinct from `missing` (which means the tooth is gone entirely). Pair with occupant `R` (Root remnant).

### `impacted` — Impacted tooth

**Source:** Whaites E, Drage N. *Essentials of Dental Radiography and Radiology*. 5th ed. 2013, Ch. 23.

An unerupted or partially erupted tooth retained in the bone or under soft tissue. Most common: third molars. May overlap with `root_data` for canal/root anatomy.

### `bridge` — Bridge component

**Source:** Rosenstiel et al. 2022 Ch. 17.

The position is part of a bridge — either a pontic (coupled to occupant `B` or `C`) or a retainer abutment (coupled to occupant `N`/`F`/etc., where the bridge link is recorded in `bridge_links`).

### `bar` — Implant bar

**Source:** Sadowsky SJ. *J Prosthet Dent*. 2014;112(5):1153–1158.

A connecting bar between two or more implants, used as the retentive element for an overdenture. The bar position is typically not coincident with a tooth position; recorded for the supporting implant positions with this status.

### `cantilever` — Cantilever pontic

**Source:** ACP. *J Prosthet Dent*. 2017;117(5S):e1–e105 (GPT-9).

A pontic with single-side retention. Distinct from a conventional `bridge` pontic, which has retainers on both sides. Pair with occupant `C`.

### `uncertain` — Indeterminable

The radiograph in this region is non-diagnostic — covered by an artifact (e.g., a metallic crown projection), poorly exposed, or geometrically distorted. The radiologist defers the assessment, often recommending follow-up imaging.

## Layering rules

1. **Order of layers in the source string is preserved by the parser** but is semantically unordered. `endo+post+crowned` and `crowned+post+endo` describe the same finding.
2. **Surface qualifiers attach to a single layer** via `:`. `restored:mod+caries:d` means an MOD filling plus a distal carious lesion (likely secondary caries).
3. **Mutually exclusive layers SHOULD NOT co-occur** in a sane document — e.g., `present+missing` is contradictory. The parser does not reject these (they may be intermediate states during AI prefill review), but the validator emits a warning.
4. **Typical layer combinations:**
   - `endo:mo+post+crowned` — endodontically treated mesio-occlusally, with post and crown (Russian abbreviation: ЭШК)
   - `crowned+caries:d` — crown with secondary caries on the distal surface (КС)
   - `restored:mod` — MOD filling (П)
   - `impl_restored` — implant with final crown (ИК)
   - `present` — intact tooth (·)

## Future statuses (out of scope for v0.1)

- `veneer` — laminate veneer (currently encoded as `restored:v` if facial-only, but a dedicated status is under consideration)
- `temp_restoration` — temporary / provisional restoration
- `external_resorption` / `internal_resorption` — currently encoded in the `pathology[]` array, but tooth-level status flags are under consideration

If you have a use case requiring a new status, please open a GitHub Issue with example radiographs (synthetic only) demonstrating the finding.
