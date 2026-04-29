# ORIS v0.1 — Open Radiographic Imaging Schema

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JSON Schema Draft 2020-12](https://img.shields.io/badge/JSON%20Schema-Draft%202020--12-blue.svg)](https://json-schema.org/draft/2020-12/release-notes.html)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![Live demo](https://img.shields.io/badge/🦷%20Live%20demo-zmeik.github.io%2Foris-6dc4d8)](https://zmeik.github.io/oris/)
[![Status: v0.1 — Public Draft](https://img.shields.io/badge/status-v0.1%20public%20draft-orange.svg)]()

> 🇬🇧 **English** · [🇷🇺 На русском (README.ru.md)](README.ru.md)

> ### 🦷 [Open the live dental-formula demo →](https://zmeik.github.io/oris/)
>
> One-click static preview at **[zmeik.github.io/oris](https://zmeik.github.io/oris/)** — paper-quality 32-cell formula, three synthetic cases, layered statuses, anatomy panel, change history, EN ↔ RU and light/dark toggles, no install needed. Runs entirely in your browser.
>
> For the **fully interactive** version with click-to-edit tooth picker, dual-mode anatomy editor, magnetic snap, time-machine ground truth, and live FHIR / DICOM-SR / MIS / MMOral exports, run the Flask reference application locally (3 commands, see [Try it](#try-it--interactive-reference-application) below).

A structured digital format for the **imaging findings** section of dental panoramic radiograph (OPG) reports. Open, MIT-licensed, machine-readable, and community-targeted — the dental-panoramic analogue of the OSIPI LL-XML lexicon for perfusion MRI ([Dickie et al., *Magn Reson Med* 2023](https://doi.org/10.1002/mrm.29840)).

The acronym is **O**pen **R**adiographic **I**maging **S**chema; it is also Latin *oris* (genitive of *os*) — *"of the mouth"*.

---

## What ORIS does

ORIS provides a **structured digital format** for what radiologists describe in the *imaging findings* section of an OPG report. It covers, in one schema:

- **32 permanent + 20 primary teeth** with a universal six-character code, 13 occupant types, 18 layered statuses, and 5 surface codes
- **Anatomical landmarks** — mandibular canal, mental foramen, ramus, coronoid process, maxillary sinus, nasal cavity, incisive canal, hyoid, zygomatic arch, projection of the cervical spine
- **TMJ findings** — condyle morphology, articular eminence, joint space, pathology
- **Airway/sinus block** — pharyngeal airway dimensions, septal deviation, pneumatization, sinus pathology
- **Provenance trail** — `source` (manual / ai_prefill), `sequence_num`, `session_id` for reproducible audit

ORIS **does not** perform diagnosis. It structures the descriptive *imaging findings* component of the report (Step 5 in the 8-step ADA/AAOMR diagnostic workflow). Diagnosis remains the clinician's task and integrates anamnesis + intra-oral examination + radiographic interpretation per the ALARA principle.

## Try it — interactive reference application

A single paper-quality reference application is shipped at [`reference-app/`](reference-app/). It runs on Flask + SQLite + Pillow with synthetic data only and is the place to *click around* and feel why a layered, machine-readable schema is different from every existing dental-formula UI.

```bash
git clone https://github.com/zmeik/oris.git
cd oris/reference-app
pip install -r requirements.txt
python3 mock_app.py
# then open http://localhost:5050  →  redirects to /play (the playground)
```

The root URL redirects to **`/play`** — the interactive ORIS playground. That is the demo intended for reviewers; everything else is supporting material:

| Route | What it is | When to use it |
|---|---|---|
| **[`/play`](http://localhost:5050/play)** | The full interactive Arena: 32-cell dental formula × 3 anonymised cases (A/B/C, multi-tooth + 7 implants + bridges); tooth-picker modal with 18 layered statuses + 5 surfaces + 13 occupants; AI prefill; time-machine ground-truth history; CLAHE / Contrast / Bone / Invert filters; FDI / Universal / Palmer notation toggle; YOLO bbox overlay; bilingual EN ↔ RU toggle covering every label, including the 32 SVG cell abbreviations and the under-OPG text formula | **Headline reviewer demo.** This is what the paper is about. |
| **[`/play/anatomy/<file_id>`](http://localhost:5050/play/anatomy/1001)** | Standalone anatomy viewer/editor: 23 anatomical structures × 6 groups (Mandible, Maxilla, Cavities & sinuses, Joints & arches, Pathology, Implants), dual-mode markup (polyline + bbox), drag-to-reshape, magnetic snap, per-structure visibility toggle, group-level visibility, custom-structure +Add for Pathology / Implants, EN+RU disclaimer (152-FZ / GDPR / HIPAA Safe-Harbor). Boots in read-only Viewer; one click unlocks Editor | Clicking the **🦴 Anatomy · 👁 Viewer** button in the `/play` topbar |
| **[`/demo`](http://localhost:5050/demo)** | Static IJOS-quality demo (vanilla HTML/CSS/JS, no API calls, all SVG procedural) | Reproducible screenshots for paper **Figure 2** |
| `/darwin-lab` | Same as `/play` (legacy alias) | Backwards compatibility |

Read [`reference-app/README.md`](reference-app/README.md) for the route-by-route map, what's mocked vs. real, and how to swap in your own OPGs (under the privacy gate documented there).

⚠️ **Synthetic data only.** Three pre-seeded cases (`file_id` 1001/1002/1003) ship inside the app; uploading real patient OPGs is gated by the privacy modal documented in [PRIVACY.md](PRIVACY.md) (Russian Federal Law 152-FZ, GDPR, HIPAA-equivalent practices).

## Why a layered schema beats every existing dental-formula UI

The interactive playground at `/play` is not a static screenshot — it is the only place where the points below become tangible in a few clicks. We spell them out here because none of these are visible from the JSON or the EBNF alone:

1. **Layered status, not single-status cycling.** Existing closed platforms (Diagnocat, Pearl, Overjet, Planmeca Romexis, Carestream AI Insights, Vatech) emit one status per tooth. The reality of dental radiology is multi-finding teeth: *"endodontically treated mesio-occlusally, with a post and a crown"* needs four facts in one cell. Open `/play`, click any tooth, build `endo:mo+post+crowned` layer-by-layer, watch the ORIS JSON re-render. No other dental-formula UI lets you do this in a single editable cell.
2. **13 occupants, not 4–6.** Most charting tools collapse "what occupies this position" into ≤ 6 categories (tooth / implant / missing / pontic / unknown). ORIS encodes 13 occupants per ACP GPT-9 (2017) and Garrofé-Mejillón 2023 — including Cantilever pontic, Maryland-bonded retainer, and Inlay-bonded retainer that are diagnostically *and* radiographically distinct from a conventional bridge pontic.
3. **`v` for vestibular, not `b` for buccal.** Vestibular is universal across all 32 teeth; buccal applies only to posteriors. Click the surface picker on an anterior tooth in `/play`: you get `v`, not `b`. White & Pharoah Ch. 4. Closed platforms silently inherit the buccal-only convention from posterior charting and break on anteriors.
4. **Time-machine ground truth, not destructive overwrite.** Every save in `/play` creates a new `sequence_num` snapshot in `gt_change_history` with a `source` tag (`manual` / `ai_prefill` / `ai_prefill_then_manual`). Click the 🕐 button on any GT row to scrub back to any prior state. The AI-prefill → expert-correction trajectory is parsable training feedback by construction.
5. **Anatomy is part of the schema, not an afterthought.** Click **🦴 Anatomy · 👁 Viewer** in the topbar. You get a separate full-page anatomy editor with 23 structures (mandibular canal, mental foramina, maxillary sinuses, zygomatic arches, hyoid, hard palate, nasal cavities, occlusal & basal lines, alveolar crest, etc.) — each editable as polyline OR bbox, with magnetic snap, per-structure and per-group visibility, and reviewer-added custom structures for Pathology / Implants. Most dental tools either omit anatomy or relegate it to a free-text comment.
6. **Bilingual UI down to every SVG cell label.** The EN ↔ RU toggle in the top-right flips ~120 keys in lock-step: topbar, sandbox bar, tooth picker (group headers + 18 statuses + 5 surfaces + 13 occupants), formula row labels, GT save banner ("Saving N changes…" / "Сохраняем N изм…"), change-history strip, anatomy structure names from `data/anatomy_templates.json` ({ru,en} bilingual), AND the 1–4-char status icons painted on each tooth cell (research-grounded dental abbreviation dictionary: К ↔ C, П ↔ F, С ↔ Ca, Э ↔ E, Ш ↔ P, И ↔ I, ИК ↔ IC, ЭПК ↔ EFC, ПСК ↔ FCaC, etc., with combos auto-deriving from per-status codes). No closed platform offers this.
7. **One-click bridge to FHIR / DICOM-SR / MIS / MMOral.** The five export buttons in the `/play` topbar run `bridges/*.py` live on whatever ground truth you just edited. The MMOral mapping in particular lets your ORIS document feed the [MMOral-OPG-Bench](https://arxiv.org/abs/2509.09254) (Hao et al., NeurIPS 2025, 8 finding types × 32 teeth × 8 500 panoramas) without re-implementing the schema for every benchmark.
8. **Open MIT licence and complete formal grammar.** The full EBNF for the layered status string is at [`grammar/ebnf.txt`](grammar/ebnf.txt); the parser round-trips every example in [`examples/`](examples/) canonically and is covered by 255 pytest unit tests. Every closed competitor ships an undocumented internal format you cannot cite, audit, or version.

If after five minutes in `/play` any of these does not feel different from your current dental UI of choice, please open a [GitHub issue](https://github.com/zmeik/oris/issues) — the gap is exactly the kind of feedback v0.2 needs.

## Quick start — Python parser

```bash
pip install -e .
```

```python
from oris.parser import parse_tooth_layers, encode_tooth_layers, derive_numbering, validate_oris

# Parse a layered tooth status
layers = parse_tooth_layers("endo:mo+post+crowned")
# [Layer(status='endo', surfaces=['m','o']),
#  Layer(status='post', surfaces=[]),
#  Layer(status='crowned', surfaces=[])]

# Encode back to canonical string
encoded = encode_tooth_layers(layers)  # "endo:mo+post+crowned"

# Resolve a 6-character code to all numbering systems
nums = derive_numbering("LLCPIN")
# {'fdi': '3.1', 'universal': '24', 'palmer': '⌐1',
#  'anatomical': 'Lower Left Central Permanent Incisor', 'occupant': 'Natural'}

# Validate an ORIS document
import json
doc = json.load(open("examples/synthetic_001.json"))
errors = validate_oris(doc)
assert errors == []
```

## Repository structure

```
oris/
├── README.md ........................ this file (English)
├── README.ru.md ..................... Russian version
├── LICENSE .......................... MIT
├── PRIVACY.md ....................... data-protection statement (152-FZ, GDPR)
├── CONTRIBUTING.md, CODE_OF_CONDUCT.md, CHANGELOG.md
├── pyproject.toml, requirements.txt
├── docs/
│   ├── architecture.md .............. how ORIS fits the radiology workflow
│   ├── getting-started.md ........... end-to-end tutorial
│   ├── version-roadmap.md ........... v0.1 → v0.2 → v1.0 plan
│   └── glossary.md .................. terminology
├── schema/
│   ├── oris-v0.1.json ............... JSON Schema Draft 2020-12 (master)
│   ├── oris-anatomy-v0.1.json ....... anatomy/TMJ/airway extension schemas
│   └── README.md
├── grammar.md ....................... layered-status grammar overview (paper §5.1 entry point)
├── references.bib ................... 35 BibTeX entries cited by the paper (Vancouver-numbered)
├── CITATION.cff ..................... how to cite this software + the paper
├── dental_scene_graph.py ............ source-of-truth ontology for the three extension blocks
├── numbering/
│   ├── permanent-teeth.csv .......... 32 entries: ORIS, FDI, Universal, Palmer, anatomical (EN+RU), layperson
│   ├── primary-teeth.csv ............ 20 entries
│   └── occupants.md ................. 13 occupant types — definitions + literature
├── grammar/
│   ├── statuses.md .................. 18 layer statuses
│   ├── surfaces.md .................. 5 surfaces (m/d/o/v/l) + literature
│   ├── complications.md ............. 23-code prosthetic-complication ontology
│   ├── ebnf.txt ..................... formal EBNF
│   └── README.md
├── anatomy/
│   ├── landmarks.md ................. mandibular canal, foramina, sinus, etc.
│   ├── tmj.md ....................... condyle, articular eminence, joint space
│   ├── airway.md .................... pharyngeal airway, sinus pneumatization
│   ├── ontology.md .................. full hierarchy
│   ├── vertucci.md .................. Vertucci I–VIII canal classification (1984)
│   ├── pai.md ....................... Ørstavik Periapical Index 1–5 (1986)
│   └── furcation.md ................. Glickman Furcation grades I–IV (1953)
├── parser/ .......................... Python implementation
├── bridges/
│   ├── fhir.py ...................... FHIR R4 Bundle (Patient + Observation per tooth)
│   ├── dicom_sr.py .................. DICOM-SR XML with RadLex Dental Subset codes (RID5780, RID11907, …)
│   ├── mis.py ....................... flat MIS chart for Russian dental information systems
│   ├── mmoral.py .................... 8-class MMOral benchmark mapping
│   └── RADLEX_MAPPING.md ............ ORIS → RadLex code table
├── examples/ ........................ 28 synthetic ORIS documents (3 baseline + 25 generated variants)
├── tests/ ........................... 255 pytest unit tests (parser, numbering, schema, bridges, examples)
├── tools/
│   ├── generate_examples.py ......... deterministically regenerate the 25 generated examples
│   └── extract_case_bboxes.py ....... bake SemiT-SAM detections into reference-app/data/cases/
└── reference-app/ ................... Flask + SQLite reference application
                                       — static IJOS demo (Fig 2 source) + interactive Arena
                                       — bridges, image upload, time-machine GT history,
                                       — anatomy side panel + change-history strip (paper Fig 2)
```

## The schema in 60 seconds

A **tooth position** is encoded by a 6-character key followed by a layered status formula:

```
LLCPIN  →  status: "endo:mo+post+crowned"
║║║║║║
║║║║║╚═ Occupant   N=Natural / F=Fixture / T=Transplant / B=Bridge pontic
║║║║║                D=Denture / H=Hybrid prosth. / O=Overdenture support
║║║║║                A=Absent / R=Root remnant / S=Supernumerary / U=Unknown
║║║║║                C=Cantilever pontic / M=Maryland-bonded / I=Inlay-bonded
║║║║╚══ Class      I=Incisor / C=Canine / P=Premolar / M=Molar
║║║╚═══ Dentition  P=Permanent / D=Deciduous (primary)
║║╚════ Position   C=Central / L=Lateral / X=N/A / 1, 2, 3 (premolars/molars)
║╚═════ Side       L=Left / R=Right
╚══════ Jaw        U=Upper / L=Lower
```

The status formula is `status1:surfaces1+status2+status3`, where each layer captures one radiographic finding and `:surfaces` (any subset of `m`, `d`, `o`, `v`, `l`) optionally restricts it to specific tooth surfaces.

A complete ORIS document also contains `anatomical_landmarks`, `tmj_findings`, `airway_assessment`, `pathology[]`, `confidence{}`, and `ground_truth_meta{}` blocks. See [`schema/oris-v0.1.json`](schema/oris-v0.1.json) for the formal definition and [`examples/`](examples/) for ready-to-read documents.

## Versioning

| Version | Status | Scope |
|---------|--------|-------|
| **v0.1** | ✅ this release | Core schema, panoramic 2D, 13 occupants, 3 extension blocks, single-source AI workflow |
| v0.2 | planned (Q3 2026) | Multi-centre validation, second-rater κ, paediatric extensions, cryptographic provenance signing |
| v0.3 | planned (Q1 2027) | CBCT 3D extension, sinus / TMJ volumetric findings |
| v0.4 | planned (Q3 2027) | Peri-radicular extension (CBCT periapical, root resorption) |
| v1.0 | aspiration (Q1 2028) | Community endorsement (AAOMR / IADMFR), production-ready stable |

See [docs/version-roadmap.md](docs/version-roadmap.md) for details.

## How ORIS fits with existing standards

| Standard | Relationship |
|----------|--------------|
| **HL7 FHIR Dental** | ORIS bridges *to* FHIR via `parser.bridges.to_fhir()` — emits `DiagnosticReport` + `Observation` resources |
| **DICOM Structured Reporting** | `parser.bridges.to_dicom_sr()` emits SR using RadLex Dental Subset codes |
| **SNODENT / ICDAS / ICD-10** | Recommended mapping at *diagnosis* stage (after ORIS imaging-finding output) |
| **ISO 3950 (FDI)** | Automatic via the 52-entry mapping table in `numbering/` |
| **OSIPI LL-XML (MRI)** | Direct architectural precedent — community-endorsed open lexicon for a specific imaging modality |

## Citing ORIS

If you use ORIS in your research, please cite the foundation paper:

> Manukov SG. ORIS v0.1 — Open Radiographic Imaging Schema: A Structured Digital Format for Imaging Findings in Dental Panoramic Reports. *Manuscript submitted to International Journal of Oral Science.* 2026.

BibTeX:

```bibtex
@unpublished{manukov2026oris,
  author = {Manukov, Sergo G.},
  title  = {{ORIS v0.1} --- Open Radiographic Imaging Schema:
            A Structured Digital Format for Imaging Findings in Dental Panoramic Reports},
  note   = {Manuscript submitted to International Journal of Oral Science},
  year   = {2026},
  url    = {https://github.com/zmeik/oris}
}
```

## License

[MIT License](LICENSE) — free for commercial, academic, and clinical use, with attribution.

## Data protection and compliance

This repository contains **only synthetic data**. No real patient identifiers, no real OPG images, no protected health information.

- 🇷🇺 Compliant with **Federal Law 152-FZ** "On Personal Data" (Russian Federation)
- 🇪🇺 Compliant with **GDPR** (Regulation (EU) 2016/679)
- 🇺🇸 No PHI per **HIPAA** definitions

Read [PRIVACY.md](PRIVACY.md) before deploying ORIS in clinical settings.

## Contact

**Sergo G. Manukov** &middot; [Google Scholar](https://scholar.google.com/citations?user=3Xfn4PoAAAAJ&hl=en) &middot; [ORCID 0000-0002-7659-2677](https://orcid.org/0000-0002-7659-2677)

Affiliations:

- **RUDN University**, Moscow, Russian Federation &mdash; PhD candidate (primary affiliation, dissertation defence September 2026)
- **New Vision University**, Tbilisi, Georgia &mdash; visiting researcher

Email: <smanukov@newvision.ge> &middot; Issues and discussion: use [GitHub Issues](https://github.com/zmeik/oris/issues) for this repository.

## Acknowledgments

- The Darwin-Lab Arena project at RUDN Diagnostic Centre for the production codebase that informed v0.1
- New Vision University (Tbilisi) for visiting-researcher support during the schema design and reference-application work
- The OSIPI LL-XML lexicon authors for the architectural precedent
- The ACP for GPT-9 (2017) and GPT-10 (2023) prosthodontic terminology

---

*ORIS v0.1 — public draft, April 2026.*
