# Changelog

All notable changes to ORIS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for the schema specification (the schema version, e.g. `0.1.0`, is independent of the Python package version).

## [Unreleased]

### Added

- **`reference-app/`** — single canonical reference application (Flask + SQLite + Pillow) replacing the earlier `production-arena/` clone and `web-demo/` schema test page. Serves two routes:
  - **`/`** and **`/demo`** — paper-quality static IJOS demo, source for Figure 2. Self-contained vanilla HTML/CSS/JS, EN/RU and light/dark theme toggles, no backend calls.
  - **`/darwin-lab`** — interactive Arena UI on SQLite with image upload (Pillow EXIF strip + watermark), bridges (FHIR R4, DICOM-SR, MIS, MMOral), 3 anonymised synthetic OPG cases auto-seeded, layer editor, time-machine ground-truth history.
- Public-domain / synthetic OPG samples shipped in `reference-app/static/images/`, watermarked "SYNTHETIC OPG — ORIS DEMO ONLY"
- ~60 Flask routes in `mock_app.py` covering sandboxes, ground-truth CRUD, history/rollback, image upload, bridge exports, schema/parser/numbering wrappers
- `docs/design-reference/DESIGN_HERITAGE.md` — 17-section design rationale documenting the 22-status icon taxonomy, Vertucci canal schemas, surface 5-zone polygons, time-machine ground-truth versioning, and other patterns inherited from the Darwin-Lab production system

### Changed

- README.md and README.ru.md restructured: single Quick start pointing at `reference-app/` (was: two demo options pointing at `production-arena/` and `web-demo/`)
- Removed `production-arena/` (folded into `reference-app/`)
- Removed `web-demo/` (i18n table absorbed into `reference-app/static/demo.html` as `data-i18n` attributes)

### Privacy

- All `reference-app/` content uses only synthetic data; no real OPG, no real patient identifiers, no PII
- Two genericisations preserved from the prior production clone: `"КДЦ РУДН (реальные)"` UI dropdown label → `"Synthetic Demo Sandbox"` (in `templates/darwin_lab.html` and `static/js/darwin/arena-core.js`)
- Mock backend has no PostgreSQL connection, no external network calls (except `d3js.org` for D3 library — replaceable with local copy) and no telemetry
- `mock_app.py` runs on `127.0.0.1` only; nothing leaves the machine
- User OPG upload (where enabled) goes through Pillow EXIF strip and a baked-in watermark "ORIS v0.1 reference app — synthetic / non-clinical"; the privacy_ack flag is required server-side

## [0.1.0] — 2026-04-27

### Added — schema specification

- Universal six-character tooth code: `[Jaw][Side][Position][Dentition][Class][Occupant]`
- 13 occupant types: N, F, T, B, D, H, O, A, R, S, U, C, M, I (covering ACP GPT-9 / GPT-10 prosthodontic taxonomy)
- 18 layer statuses derived from production code (`ARENA_STATUS_CYCLE`)
- 5 surface codes: m, d, o, **v** (vestibular, not buccal), l
- Layered encoding format: `status1:surfaces1+status2+status3` with example `endo:mo+post+crowned`
- 52-entry numbering mapping (32 permanent + 20 primary teeth) bijective against ISO 3950, ADA Universal, Palmer, ACP GPT-9, GPT-10
- **Anatomical Landmarks** extension block: mandibular canal, mental foramen, ramus, coronoid process, maxillary sinus, nasal cavity, incisive canal, hyoid, zygomatic arch, cervical spine projection
- **TMJ Findings** extension block: condyle morphology, articular eminence, joint space, pathology
- **Airway/Sinus** extension block: pharyngeal airway, septal deviation, pneumatization, sinus pathology
- 23-code prosthetic-complication ontology (mechanical, biological, iatrogenic categories)
- Root morphology library: Vertucci I–VIII, PAI Ørstavik, Furcation Glickman
- Provenance trail: `source` field, `sequence_num`, `session_id` for time-machine versioning

### Added — reference implementation

- Python parser/serialiser: `parse_tooth_layers`, `encode_tooth_layers`, `derive_numbering`, `validate_oris`, `compute_kappa`
- Bridges: `to_fhir`, `to_dicom_sr`, `to_mis_chart`, `to_mmoral_format`
- JSON Schema Draft 2020-12 specification
- Bilingual (EN + RU) web demo for in-browser test mode
- 3 synthetic example documents

### Added — documentation

- README in English and Russian
- PRIVACY.md with 152-FZ + GDPR + HIPAA compliance posture
- Architecture, getting-started, version-roadmap, glossary docs
- CONTRIBUTING.md and CODE_OF_CONDUCT.md

### Privacy

- All examples are synthetic; repository contains no real patient data
- Web demo runs entirely client-side with no telemetry

[Unreleased]: https://github.com/zmeik/oris/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/zmeik/oris/releases/tag/v0.1.0
