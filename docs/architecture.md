# Architecture

> ORIS v0.1 is a structured digital format for the *imaging findings* section of dental panoramic radiograph (OPG) reports. This document explains how the schema fits into a typical dental diagnostic workflow.

## ORIS in the 8-step ADA/AAOMR diagnostic workflow

Per the ADA/AAOMR 2026 update *Patient Selection for Dental Radiographs* and the ADA/FDA 2012 *Recommendations for Patient Selection and Limiting Radiation Exposure*, the diagnostic workflow of a dental patient consists of 8 steps. The clinical examination ALWAYS precedes the radiograph (ALARA principle):

```
1. Anamnesis (chief complaint, medical history, dental history)
2. Extra-oral examination
3. Intra-oral examination
4. Determination of need for radiograph
5. Radiographic acquisition + interpretation     ← ORIS operates HERE
6. Diagnosis formulation
7. Treatment planning
8. Informed consent + treatment
```

ORIS structures the *output of step 5* — the descriptive imaging-findings section of the radiology report. It does NOT perform diagnosis. It does NOT replace clinical examination. It does NOT replace the radiologist's judgment.

## Three semantic levels of ORIS data

A complete ORIS document is organised on three semantic levels:

```
┌─ Patient + imaging metadata (top level)
│   • anonymized_id, age, sex (no PII)
│   • acquisition device, kVp, mA, exposure, image quality
│
├─ Per-tooth findings (32 permanent + 20 primary positions)
│   • 6-character ORIS code → status_layers + occupant + root_data + implant
│
└─ Non-tooth findings (extension blocks)
    • anatomical_landmarks (mandibular canal, sinus, foramen, ramus, etc.)
    • tmj_findings (condyle, articular eminence, joint space, pathology)
    • airway_assessment (pharyngeal airway, septal deviation)
    • pathology[] (cysts, fractures, calcifications, ICD-10 candidates)
```

## Reference implementation layers

```
┌─────────────────────────────────────────────────────────────┐
│  Reference application (Flask + SQLite + vanilla JS)       │
│  ../reference-app/   /demo (static IJOS) + /darwin-lab     │
└─────────────────────────────────────────────────────────────┘
                       ↓ produces JSON
┌─────────────────────────────────────────────────────────────┐
│  ORIS document (JSON, validated by JSON Schema 2020-12)    │
│  ../schema/oris-v0.1.json                                  │
└─────────────────────────────────────────────────────────────┘
                       ↓ parsed by
┌─────────────────────────────────────────────────────────────┐
│  Python parser/serialiser                                  │
│  ../parser/ — parse_tooth_layers, encode, derive_numbering,│
│  validate_oris, compute_kappa                              │
└─────────────────────────────────────────────────────────────┘
                       ↓ converted by
┌─────────────────────────────────────────────────────────────┐
│  Bridges to other standards                                │
│  ../bridges/                                               │
│      to_fhir()      → HL7 FHIR R4 Bundle                   │
│      to_dicom_sr()  → DICOM SR XML                         │
│      to_mis_chart() → flat dental chart for MIS / EHR      │
│      to_mmoral_format() → MMOral-OPG-Bench 8-class labels  │
└─────────────────────────────────────────────────────────────┘
```

## Single-source AI prefill workflow (Paper 0 scope)

```
Step 1 — INPUT: New OPG image (file_id=1234)
Step 2 — AI inference → initial ORIS document with confidence scores
              source: 'ai_prefill'
Step 3 — Expert validation in Arena / web demo
              radiologist accepts/corrects per-cell, fills root_data,
              records anatomical landmarks / TMJ / airway findings
Step 4 — Final GT saved
              source: 'ai_prefill_then_manual'
              JSONB stored in panorama_analysis.oris_document
              every change appended to gt_change_history (sequence_num++)
Step 5 — Training feedback
              diff (ai_prefill → final GT) = training pair for next
              AI model iteration
Step 6 — Repeat for each new OPG
              N radiographs → N ORIS documents → N training pairs → improved AI
```

Multi-source extensions (OCR of patient cards, snapshot copy from prior visits) are out of scope for ORIS v0.1; they are planned for ORIS v0.2 alongside the corresponding research paper.

## Compatibility map

| External standard | Relationship | Bridge module |
|-------------------|--------------|---------------|
| **HL7 FHIR Dental** (v2.0.0, 2024) | ORIS → FHIR DiagnosticReport + Observation | `bridges/fhir.py` |
| **DICOM Structured Reporting** | ORIS → SR XML stub | `bridges/dicom_sr.py` |
| **MIS / EHR dental chart** | ORIS → flat-by-FDI chart | `bridges/mis.py` |
| **MMOral-OPG-Bench** (Hao 2025) | ORIS → 8-class labels | `bridges/mmoral.py` |
| **SNODENT / ICDAS / ICD-10** | recommended at *diagnosis* stage (post-ORIS) | external mapping |
| **ISO 3950 (FDI) / ADA Universal / Palmer** | automatic via `numbering/*.csv` | `parser/numbering.py` |
| **OSIPI LL-XML** (MRI) | direct architectural precedent | n/a (different modality) |

## What ORIS does NOT do

- Does **not** perform diagnosis (Step 6 — clinician's task)
- Does **not** replace clinical examination (Steps 1-3)
- Does **not** decide whether a radiograph is needed (Step 4 — clinician's task per ALARA)
- Does **not** plan treatment (Step 7)
- Does **not** generate a human-readable narrative report (templates such as RSNA RadReport handle that)
- Does **not** provide AI inference (the schema is tool-agnostic; any AI / human can produce ORIS-compliant output)
- Does **not** validate clinical correctness (only schema correctness — the radiologist remains responsible for clinical judgment)

## Where ORIS fits in the broader ecosystem

```
                ┌──────────────────────────┐
                │   AI inference pipeline  │  (YOLO + SemiT-SAM, LLMs, etc.)
                └────────────┬─────────────┘
                             │ produces ORIS document
                             ▼
        ┌───────────────────────────────────────────┐
        │  ORIS v0.1 — structured digital format   │
        └────────────┬──────────────┬───────────────┘
                     │              │
                     ▼              ▼
       ┌──────────────────┐  ┌──────────────────┐
       │  FHIR / DICOM    │  │  MIS / EHR       │
       │  (interoperable  │  │  (clinical       │
       │   research data) │  │   chart prefill) │
       └──────────────────┘  └──────────────────┘
                     │              │
                     ▼              ▼
       ┌──────────────────┐  ┌──────────────────┐
       │  Cohort studies, │  │  Dentist's       │
       │  meta-analyses,  │  │  appointment     │
       │  cross-paper κ   │  │  workflow        │
       └──────────────────┘  └──────────────────┘
```
