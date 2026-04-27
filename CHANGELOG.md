# Changelog

All notable changes to ORIS will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html) for the schema specification (the schema version, e.g. `0.1.0`, is independent of the Python package version).

## [Unreleased]

### Added

- **`production-arena/`** — full clone of the production Darwin-Lab Arena UI (14 JavaScript modules, 104 KB CSS, 26 KB HTML — ~1.1 MB total) with a Flask mock backend (`mock_app.py`) that runs against in-memory synthetic data. Auto-loads the 3 synthetic examples from `examples/` as 3 sandbox files (`file_id=10001-10003`). Provides the **full clinical interface** with 18-status cycle picker, surface markup, anatomy/TMJ/airway panels, algorithm comparison, time-machine GT history, and D3 evolutionary tree.
- Synthetic placeholder OPG image (`production-arena/static/images/synthetic_opg_001.png`, 2880×1450, watermarked "SYNTHETIC OPG — ORIS DEMO ONLY")
- 30+ Flask mock API endpoints in `mock_app.py` covering sandboxes, ground-truth CRUD, history/rollback, algorithm tree, tooth bboxes, card hints, AI hints, implant assessment, and more

### Changed

- README.md and README.ru.md restructured: now documents two demo options — Option 1 (production-arena, full UI) and Option 2 (web-demo, simplified)
- `CONTRIBUTING.md` does not yet cover production-arena contributions; planned for next minor release

### Privacy

- All `production-arena/` content uses only synthetic data; no real OPG, no real patient identifiers, no PII
- Two genericisations applied to copied production code: `"КДЦ РУДН (реальные)"` UI dropdown label → `"Synthetic Demo Sandbox"` (in `templates/darwin_lab.html` and `static/js/darwin/arena-core.js`)
- Mock backend has no PostgreSQL connection, no external network calls (except `d3js.org` for D3 library — replaceable with local copy)
- `mock_app.py` runs on `127.0.0.1` only; nothing leaves the machine

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
