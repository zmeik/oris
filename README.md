# ORIS v0.1 — Open Radiographic Imaging Schema

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JSON Schema Draft 2020-12](https://img.shields.io/badge/JSON%20Schema-Draft%202020--12-blue.svg)](https://json-schema.org/draft/2020-12/release-notes.html)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![Status: v0.1 — Public Draft](https://img.shields.io/badge/status-v0.1%20public%20draft-orange.svg)]()

> 🇬🇧 **English** · [🇷🇺 На русском (README.ru.md)](README.ru.md)

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

## Quick start — reference application

A single paper-quality reference application is shipped at [`reference-app/`](reference-app/). It runs on Flask + SQLite + Pillow with synthetic data only and serves as the source for **Figure 2 of the ORIS paper**.

```bash
git clone https://github.com/zmeik/oris.git
cd oris/reference-app
pip install -r requirements.txt
python3 mock_app.py
# then open http://localhost:5050
```

What you get:

- **`/`** and **`/demo`** — the static IJOS-quality demo (paper Figure 2 source). Fully self-contained vanilla HTML/CSS/JS, no API calls, EN/RU and light/dark theme toggles. Ideal first stop for a journal reviewer.
- **`/play`** — a minimal interactive playground for reviewers. Pick one of three anonymised OPG cases (A/B/C), click any tooth cell to cycle through ORIS statuses, watch the canonical ORIS JSON re-render live, and download FHIR R4 / DICOM-SR / MIS / MMOral via stateless `POST /api/play/export`. No DB writes — your edits stay in the browser. EN/RU + light/dark.
- **`/darwin-lab`** — the full interactive Arena UI backed by SQLite + Pillow image upload + bridges (FHIR R4, DICOM-SR, MIS, MMOral). The same three anonymised cases auto-seed on first run. Includes the production layer editor, time-machine ground-truth history, anatomy/TMJ/airway panels, and the full Darwin-Lab toolset.

Read [`reference-app/README.md`](reference-app/README.md) for the route-by-route map, what's mocked vs. real, and how to swap in your own OPGs (under the privacy gate documented there).

⚠️ **Synthetic data only.** Do not upload real patient OPGs. See [PRIVACY.md](PRIVACY.md) for compliance (Russian Federal Law 152-FZ, GDPR, HIPAA-equivalent practices).

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

- **Author:** Sergo G. Manukov ([ORCID 0000-0002-7659-2677](https://orcid.org/0000-0002-7659-2677))
- **Affiliation:** RUDN University, Moscow, Russian Federation
- **Email:** see ORCID profile
- **Issues / discussion:** use GitHub Issues for this repository

## Acknowledgments

- The Darwin-Lab Arena project at RUDN Diagnostic Centre for the production codebase that informed v0.1
- The OSIPI LL-XML lexicon authors for the architectural precedent
- The ACP for GPT-9 (2017) and GPT-10 (2023) prosthodontic terminology

---

*ORIS v0.1 — public draft, April 2026.*
