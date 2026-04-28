# ORIS Reference UI — Design Heritage

> Curated extract of clinical UX patterns from the production Darwin-Lab
> Arena (RUDN, ~25,000 lines of vendored JS in 14 modules) that the
> reference app for Paper 0 (IJOS submission) must inherit. Compiled for
> hand-off to Claude Cowork or future contributors so the rich domain
> logic is not flattened to a generic web UI.

This document is **prescriptive design heritage**. It does not specify
visual style — only the *semantic content and interaction patterns* that
must survive any redesign. Visual treatment is a separate concern.

---

## 1. Status taxonomy — 22 visible status icons

Russian dental shorthand is the canonical clinical convention used at
RUDN and matches the way radiology reports are dictated. Latin
shorthand is provided as a parallel column for international audience.

| Status key | Russian abbr | EN abbr | Meaning |
|---|---|---|---|
| `present`            | · | · | Intact natural tooth |
| `missing`            | О | A | Tooth absent |
| `impacted`           | Rt| It | Impacted / retained |
| `caries`             | С | Ca | Carious radiolucency |
| `attrition`          | Ст | At | Tooth wear / abrasion (TWI) |
| `root`               | R | R | Root remnant |
| `restored`           | П | F | Filling (composite/amalgam/GIC) |
| `endo`               | Э | E | Endodontic treatment |
| `impl_fixture`       | И | F | Implant fixture only |
| `impl_cover`         | ИЗ | IC | + cover screw (sealed under mucosa) |
| `impl_healing`       | ИФ | IH | + healing abutment |
| `impl_abutment`      | И | IA | + final abutment |
| `impl_temp_abut`     | И | IT | + temporary abutment |
| `impl_provisional`   | И | IP | + provisional crown |
| `impl_restored`      | ИК | IR | + final crown (definitive) |
| `post`               | Ш | P | Intraradicular post |
| `crowned`            | К | C | Full-coverage crown |
| `bridge`             | М | B | Bridge pontic |
| `bar`                | Б | Bar | Implant bar (overdenture) |
| `cantilever`         | Кн | Ct | Cantilever pontic |
| `uncertain`          | ? | ? | Indeterminable (artifact / poor quality) |
| `''` (empty)         | ✕ | ✕ | Reset / unannotated |

**Layered encoding.** Multi-finding teeth use `+`-joined layers with
optional `:`-prefixed surfaces. Order in source string is preserved by
the parser but semantically unordered.

Example: `endo:mo+post+crowned` → "endodontically treated with
mesio-occlusal access, with a post and a full-coverage crown" → Russian
clinical shorthand: **ЭШК**.

---

## 2. Composite presets — one-click multi-layer (F-key shortcuts)

Not every multi-finding tooth needs the multi-layer editor. Six
high-frequency patterns are stored as named presets with F-key
keyboard shortcuts:

| Key | Russian | English | Layered string |
|---|---|---|---|
| F1 | ЭШК | EPC | `endo+post+crowned` |
| F2 | ЭШ  | EP  | `endo+post` |
| F3 | ЭПК | EFC | `endo+restored+crowned` |
| F4 | ЭП  | EF  | `endo+restored` |
| F5 | КС  | CCa | `crowned+caries` (secondary caries under crown) |
| F6 | ПС  | FCa | `restored+caries` (secondary caries under filling) |

Presets are user-customisable via a ⚙ menu and persisted in
`localStorage`. Order is automatically reflected in F-key assignment
(F1 = first preset, etc.).

---

## 3. Status picker — 6 categorised groups, keyboard shortcuts

The picker is grouped by semantic category so the radiologist can
visually scan and dispatch. Keys 1-9 + q/w/e/r/t/y for power use:

```
СТАТУС ЗУБА     1=Интактный · 0=Отсутствует · 8=Ретинир.
ПАТОЛОГИЯ       2=Кариес · 6=Стираемость · 5=Корень
ЛЕЧЕНИЕ         3=Пломба · 4=Эндо
ИМПЛАНТАТ       q=Фикстура · w=+Заглушка · e=+Формирователь · t=+Абатмент · y=+Коронка
ПРОТЕЗ          r=Штифт · 6=Коронка · 7=Понтик · b=🌉Мост · g=═Балка · u=Консоль
СИСТЕМНЫЕ       9=Не ясно · ⌫=Сброс
```

Groups and items can be reorganised by drag-and-drop in the ⚙ editor;
custom labels survive across sessions. The picker is a popover
anchored to the clicked cell, with keyboard focus trapped while open.

---

## 4. Anatomical modelling — TOOTH_LIBRARY

Per-tooth-type SVG drawing is parameterised, not hardcoded. For each
of 11 tooth types (UP_CI, UP_LI, UP_C, UP_PM1/2, UP_M1/2/3, LO_I,
LO_C, LO_PM, LO_M1/2/3) the library stores:

- **Bilingual name** (RU / EN)
- **SVG metadata** — viewBox, dimensions, neck Y-position, neck width, crown centre X
- **Variants** with frequency statistics, e.g. UP_PM1 has five variants:
  - 1r (single root, 22%)
  - 2r_coronal (two roots, coronal split, 40%, default)
  - 2r_mid (two roots, mid split, 23%)
  - 2r_apical (two roots, apical split, 10%)
  - 3r (three roots, 5%)
- **Per-root parameters**: length (`l`), base width (`bw`), tip width
  (`tw`), curvature (`cv`), x-offset (`ox`), shape (`tapered` /
  `ovoid` / `elliptical` / `ribbon` / `fused_2` / `c_shaped` /
  `conical`)
- **Default and possible Vertucci schemas per root**

This allows one tooth cell to render anatomically-accurate root SVG
inline — a reviewer of the paper can SEE the canal anatomy, not read
about it abstractly.

---

## 5. Vertucci canal schemas — 8 systems

Standard endodontic anatomy classification (Vertucci 1984; Ahmed 2017
update). Each schema specifies orifices count, foramina count,
RU/EN description, and prevalence statistics:

| Schema | Formula | RU | Prevalence (sample) |
|---|---|---|---|
| I | 1-1 | Один канал от устья до апекса | UP CI 70%, UP M palatal >95% |
| II | 2-1 | Два канала из камеры, сливаются перед апексом | LO I 15-30%, UP M MB 5-10% |
| III | 1-2-1 | Один → два в средней трети → снова один | LO PM 1-5% |
| IV | 2-2 | Два отдельных канала, два форамена | UP PM1 62%, LO M mesial 28% |
| V | 1-2 | Один → два у апекса, два форамена | LO PM 4-8% |
| VI | 2-1-2 | Два → сливаются → снова два | LO M mesial 1-3% (rare) |
| VII | 1-2-1-2 | Один → два → один → два | <1% (very rare) |
| VIII | 3-3 | Три отдельных канала, три форамена | UP PM1 1-2% (very rare) |

When a tooth status includes `endo`, a sub-panel exposes per-root
Vertucci selector + per-root fill state (see §6).

---

## 6. Endodontic state vocabularies (FILL_STATES, PERIAPICAL_STATES, etc.)

After a tooth is marked `endo`, the editor opens specialised sub-state
selectors:

**FILL_STATES** — quality of the root canal fill, drawn as the
filled fraction of the root:
- `?` (unknown, dashed line)
- `⅓` (under-filled to one-third, red)
- `⅔` (under-filled to two-thirds, yellow)
- `OK` (fully obturated to apex, green)
- `OVR` (over-filled, extruded past apex, red, length factor 1.15)

**PERIAPICAL_STATES** — Periapical Index (Ørstavik 1986, PMID:3457698):
| Key | PAI | RU | EN | Notes |
|---|---|---|---|---|
| `none` | 1 | Норма | Normal | Intact lamina dura |
| `widened_pdl` | 2 | Расш. периодонт. щель | Widened PDL | Early inflammation/overload |
| `lesion_small` | 3 | ПП<5мм | Lesion <5mm | Bender 1961 ref |
| `lesion_large` | 4 | ПП≥5мм | Lesion ≥5mm | Natkin 1984 ref |
| `lesion_severe` | 5 | Обширное >10мм | Severe >10mm | CBCT recommended |

**TWI_STATES** — Tooth Wear Index 0-4 (Lussi 2014).

**FURCATION_STATES** — Glickman classification I-IV (1953).

**LATERAL_STATES** — vertical / horizontal / crater periodontal defects.

**ENDOPERIO_STATES** — J-shaped, halo, combined patterns.

**FRACTURE_STATES** — VRF, horizontal cervical/middle/apical (Tamse 2006;
Andreasen).

Every entry has bilingual name, colour code, optional desc and
literature reference (PMID where available). The editor surfaces
the description as a tooltip when hovering an option.

---

## 7. Per-tooth root SVG drawing

Inside each formula cell, when the tooth status includes
`endo` / `root` / `post`, an inline SVG is drawn:

- Crown body (per `TOOTH_LIBRARY[type].svg`)
- Each root path computed from its parameters (length, taper, curvature)
- Inside each root: filled area showing fill state (OK = green full
  length, ⅓ / ⅔ = partial, OVR = extends past apex)
- Periapical lesion drawn as a circle (radius from PAI key) at the apex
- Optional canal isthmus / lateral canal / fracture line annotations

This is what makes the formula cell not a colour swatch but a
mini-radiograph.

---

## 8. Surface markers (m/d/o/v/l)

Five surfaces per tooth (mesial, distal, occlusal, vestibular,
lingual). Note: paper deliberately uses `v` (vestibular) not `b`
(buccal) — see ORIS schema spec.

In the cell, surfaces are visualised as a 5-zone mini-polygon
(viewBox 24×24) where each zone fills with status colour when active.
The polygon has built-in M/D mirror logic depending on FDI quadrant
(mesial is on the LEFT side of the cell for Q2/Q3 teeth, on the RIGHT
side for Q1/Q4).

In the surface picker modal, each surface gets its own button that
toggles which status applies to that surface — multiple surfaces can
have independent status (e.g. caries:m + restored:o means mesial
caries and occlusal filling).

---

## 9. Crop carousels — 16 mini-radiograph crops per arch

Above the upper arch (and below the lower arch — symmetric, **roots
always pointing AWAY from the arch**) there is a carousel of 16
crops. Each crop is 80×56 px at rest, sourced from the OPG image at
the YOLO-detected bounding box for that FDI position.

- `roots up` for upper jaw crops (so crowns face the arch row)
- `roots down` for lower jaw crops (mirrored about the midline)
- Click on a crop → opens the **fullscreen crop editor**.

The carousel is *not* decoration. It is the radiographic ground truth
the GT row is being annotated against: the radiologist's eyes flick
between the cell (status decision) and the crop (visual evidence).

---

## 10. Fullscreen crop editor

A dedicated overlay (`#crop-fs-overlay`) for editing one tooth at a
time. Layout:

- Toolbar: **← Whole crop** (back from child focus) · **navigation
  ← → between FDIs** · annotation class buttons · undo/redo · fit /
  zoom in / zoom out · brightness / contrast sliders · current zoom
  percent
- Main canvas (900 px wide, 1200 px when in child focus mode):
  shows one tooth crop at full radiographic detail
- **Right sidebar** is the live editor for that tooth's status:
  occupant selector, layered status with per-surface markup, root
  data (Vertucci × fill state × PAI per root), implant data, etc.
- Bottom: **kbd shortcuts** ← →  navigate, Esc closes, Ctrl-Z undo,
  Ctrl-Shift-Z redo

Drilling into a child sub-object (caries lesion, periapical lesion,
filling, crown) re-frames the canvas around just that detection with
30% padding (or 80 px minimum). A "← Whole crop" button restores the
full tooth view. While focused on a child, the annotation class
buttons are filtered to the relevant ontology subset (e.g. only
caries-related when focused on a caries detection).

---

## 11. Fullscreen OPG viewer

Independently, the entire panoramic radiograph can be opened
fullscreen for context examination. Features:

- 5 preset filters (Original, CLAHE, Contrast, Bone, Sharp) + Invert
  (pixel-level, not just CSS)
- Brightness / contrast sliders 0.3–2.5 / 0.3–3.0
- Segmentation overlay toggle (off / YOLO bboxes / Expert
  annotations / Both)
- Pan + zoom (wheel + drag)
- Dimensions displayed top right
- Esc to close

---

## 12. Russian classical formula — secondary view

Beneath the FDI 32-cell grid, a collapsible panel renders the same
data in **Russian classical notation** — the format dentists in
Russia traditionally write into paper records. This is a derivative
view: parser auto-generates it from the canonical ORIS document, no
duplicate entry. Optional in the demo; useful for clinicians
familiar with the older convention.

---

## 13. Anatomy is anatomy, teeth are teeth

In the production app the **anatomy editor is a separate page**, not
a side panel of the formula. The structure (`anatomy_templates.json`)
defines 23 anatomical structures across 6 groups — mandibula,
maxilla, sinuses, joints, pathology, implants — each as a normalised
0-1 polygon over the OPG.

The **anatomical landmarks block** in the ORIS schema (per Paper 0
caption Figure 2) is the *finding-level* layer:
mandibular_canal.visibility, mental_foramen.location,
maxillary_sinus.status, TMJ.condyle_morphology, etc. — semantic
fields, not pixel polygons.

Both layers should exist in the demo as separate concerns:

- **Per-cell context** in the formula stays focused on the tooth
- **Anatomy page** is reachable via a top-level link, renders
  the anatomy_templates polygons *and* the structured findings

---

## 14. Time-machine ground-truth versioning

Every change to the GT row is recorded in `gt_change_history` with
fields: `sequence_num` (monotonic int), `source` (`manual` /
`ai_prefill` / `ai_prefill_then_manual`), `session_id`, `created_at`,
`change_type` (`single_cell` / `bulk_prefill` / `rollback`),
`diff_summary` (e.g. `"1.6: 'endo:mo+post' → 'endo:mo+post+crowned'"`),
`snapshot_json` (full snapshot for rollback).

The demo must show:
- A **strip of the last 5-7 entries** (compact, always visible)
- A **modal "View all"** with full session history
- **Source badges** colour-coded: manual = grey, ai_prefill = purple,
  ai_prefill_then_manual = teal
- **Rollback button** per row

This is the visible manifestation of paper "Advances in knowledge"
point #4 — the ai_prefill → expert correction trajectory.

---

## 15. Theming and i18n — both at once

The reference app must ship **two themes** (light and dark) **and
both languages** (English and Russian) simultaneously, with mid-page
toggles in the topbar:

- Light theme: cream `#fafaf8` ground + navy `#1d4f8c` accent.
  Print-friendly, used for journal Figure 2 reproduction.
- Dark theme: deep `#050507` ground + cyan `#6dc4d8` accent.
  Default for clinical work; reduces glare next to a radiograph.
- EN → RU toggle: every visible label has a translation. Russian
  clinical short codes in the legend (Инт./Кар./Эн./etc.) are the
  primary canonical form per RUDN convention; English long forms are
  shown alongside.

Both toggles persist via `localStorage`.

---

## 16. Out of scope for Paper 0 demo

These features exist in the production app but are not relevant to
the Figure 2 caption and should be omitted:

- Multi-row algorithm comparison (ETALON / YOLOv9 / Mask R-CNN /
  ResNet-FDI rows). This is the Evolution Lab — Paper A territory.
- Mismatch alerts and inter-algorithm metrics.
- Algorithm sources / provenance lists.
- AGREEMENT % progress bar.
- Implant-Lab 4-method assessment (MBL / Gray Value / Fractal /
  Radiolucency).
- Sandbox import / new sandbox / batch GT prefill.
- Cohort / Run / SEED / N= experiment metadata.

The Paper 0 demo is one document, edited by one expert, viewed in
isolation.

---

## 17. Existing assets that the demo must use

- `examples/synthetic_001.json` (or case_A/B/C) — already contains
  full `anatomical_landmarks`, `tmj_findings`, `airway_assessment`
- `numbering/permanent-teeth.csv` — bijective FDI ↔ Universal ↔
  Palmer ↔ ACP GPT-9 ↔ ACP GPT-10 mapping
- `parser/core.py` — canonical layered-status grammar (Python; the
  HTML demo can reimplement parse logic in JS, but must not
  diverge from the Python reference)
- `bridges/{fhir,dicom_sr,mis,mmoral}.py` — output formats for
  Export button (paper §4 use cases 1-4)
- `patient_viewer/anatomy_templates.json` — 23 anatomical
  polygons in normalised 0-1 coordinates (see §13 above)

---

*This document is the bridge between four years of clinical UX
research at RUDN and a Q1-journal paper-companion demo. Designers
working on the demo are asked to read it once before drafting, and
to treat any deviation as a deliberate trade-off rather than a clean
slate.*
