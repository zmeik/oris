# Version Roadmap

> ORIS follows semantic versioning for the **schema specification**. Within a 0.x release line, additions are allowed; renames or removals are not. Backwards-incompatible changes only happen at major version bumps.

## v0.1 — Public Draft (current, April 2026)

✅ Released. Scope:

- 6-character universal tooth code with 13 occupants
- 18 layer statuses, 5 surface codes, layered encoding
- 52-entry numbering mapping (32 permanent + 20 primary)
- Three extension blocks: anatomical landmarks, TMJ, airway/sinus
- 23-code prosthetic complication ontology
- Root morphology library (Vertucci I-VIII, PAI Ørstavik, Furcation Glickman)
- Single-source AI prefill workflow (linear: image → AI → expert → GT → training)
- Reference implementation: Python parser, 14-module JS Arena UI (in main project), web demo, JSON Schema, FHIR/DICOM-SR/MIS/MMOral bridges

## v0.2 — Multi-centre validation + provenance (Q3 2026)

🟡 Planned.

- Multi-centre validation cohort (≥3 sites, inter-centre Cohen's κ)
- Second-rater inter-rater κ on existing single-centre cohort
- Paediatric / mixed-dentition extensions (more synthetic examples, age-group-specific occupants)
- Cryptographic provenance signing for `gt_change_history` (regulated environments)
- **Multi-source AI prefill** — OCR of patient cards + snapshot copy from prior visits of the same patient (covered by Paper 3)
- Additional occupant types under consideration: `Z` (zygomatic implant), `K` (subperiosteal framework), `P` (provisional)

## v0.3 — CBCT 3D extension (Q1 2027)

🟢 Roadmap.

- Volumetric findings: 3D bounding boxes, voxel masks
- Root canal 3D morphology (extending Vertucci into volumetric)
- Sinus pathology in 3D (e.g. mucous retention cyst volume)
- TMJ assessment requiring CBCT (joint-space measurements, condylar 3D shape)
- Backward compatibility: v0.2 documents remain valid in v0.3 readers

## v0.4 — Peri-radicular extension (Q3 2027)

🟢 Roadmap.

- CBCT periapical: 3D periapical lesion segmentation, volume estimation
- External / internal root resorption tracking
- Furcation in 3D (CBCT-based)

## v1.0 — Community endorsement, production-ready (Q1 2028)

🔵 Aspiration.

- Community endorsement (AAOMR, IADMFR, ESHNR)
- 100+ contributors, 1000+ users
- Established interoperability with major dental EHR vendors
- Independent clinical validation in ≥3 international cohorts
- Long-term support commitment, deprecation policy

## Out of scope (no current plan)

The following are intentionally NOT in scope for ORIS:

- **Diagnostic claims.** ORIS structures imaging findings; it does not perform diagnosis.
- **Treatment-planning logic.** Step 7 of the ADA workflow is the clinician's task.
- **Clinical-only findings.** Sensitivity, vitality, mobility, occlusion testing — not visible on radiographs and outside ORIS scope.
- **Non-dental structures beyond incidental cervical-spine projection.** ORIS is dental panoramic; non-dental findings should be referred to general radiology reporting standards (e.g. RSNA RadReport).

## Contributing to the roadmap

Open a GitHub Issue with the label `roadmap` to propose schema additions. The maintainer will respond with:

- ✅ Accepted for v0.x — added to the milestone
- 🟡 Under consideration — discussion thread opened
- 🔴 Out of scope — declined with rationale

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contribution flow.
