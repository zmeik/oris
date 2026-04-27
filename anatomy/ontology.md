# Anatomy Ontology — full hierarchy

> A hierarchical view of the anatomical structures recognised by ORIS v0.1.

```
ROOT
│
├── DENTITION (covered by `teeth` block — see numbering/)
│   └── 32 permanent + 20 primary positions
│
├── MAXILLA (upper jaw)
│   ├── Quadrant Q1 (upper right)
│   ├── Quadrant Q2 (upper left)
│   ├── maxillary_sinus_right        ← anatomical_landmarks.maxillary_sinus.*_right
│   ├── maxillary_sinus_left         ← anatomical_landmarks.maxillary_sinus.*_left
│   ├── nasal_cavity                 ← anatomical_landmarks.nasal_cavity
│   ├── nasal_septum                 (subset of nasal_cavity)
│   ├── incisive_canal               ← anatomical_landmarks.incisive_canal
│   ├── pterygoid_process_right      (not currently in v0.1 — v0.2 candidate)
│   ├── pterygoid_process_left       (not currently in v0.1 — v0.2 candidate)
│   └── zygomatic_arch               ← anatomical_landmarks.zygomatic_arch
│
├── MANDIBLE (lower jaw)
│   ├── Quadrant Q3 (lower left)
│   ├── Quadrant Q4 (lower right)
│   ├── mandibular_canal_right       ← anatomical_landmarks.mandibular_canal.*_right
│   ├── mandibular_canal_left        ← anatomical_landmarks.mandibular_canal.*_left
│   ├── mental_foramen_right         ← anatomical_landmarks.mental_foramen.*_right
│   ├── mental_foramen_left          ← anatomical_landmarks.mental_foramen.*_left
│   ├── chin_region                  (free-text remark in tooth_notes)
│   ├── coronoid_process_right       ← anatomical_landmarks.coronoid_process.*_right
│   ├── coronoid_process_left        ← anatomical_landmarks.coronoid_process.*_left
│   ├── ramus_right                  ← anatomical_landmarks.ramus.*_right
│   └── ramus_left                   ← anatomical_landmarks.ramus.*_left
│
├── TMJ_RIGHT
│   ├── condyle_right                ← tmj_findings.condyle_right
│   └── articular_eminence_right     ← tmj_findings.articular_eminence.*_right
│   └── joint_space (right component) ← tmj_findings.joint_space.*_right
│
├── TMJ_LEFT
│   ├── condyle_left                 ← tmj_findings.condyle_left
│   └── articular_eminence_left      ← tmj_findings.articular_eminence.*_left
│   └── joint_space (left component) ← tmj_findings.joint_space.*_left
│
├── PHARYNGEAL_AIRWAY                ← airway_assessment.pharyngeal_airway
│
├── HYOID_BONE                       (free-text remark / pathology[].location)
│
└── CERVICAL_SPINE_PROJECTION        ← anatomical_landmarks.cervical_spine_projection
```

## What is intentionally NOT in v0.1

These structures are visible on an OPG to varying degrees but are not yet first-class fields in the schema:

- **Pterygoid plates / processes** — visible posterior to the maxillary tuberosity; rarely discussed in routine OPG reports
- **Hamulus** (pterygoid hamulus) — small bony projection; reported only when relevant (e.g., catching the cheek)
- **Soft-palate shadow** — occasionally visible; not recorded in ORIS
- **Tongue dorsum shadow** — usually a non-diagnostic image artefact

If you need any of these for your use case, please open a GitHub Issue with the rationale.

## Mapping to FHIR Dental + DICOM-SR

When `bridges/fhir.py` converts an ORIS document to FHIR DiagnosticReport + Observation resources, the anatomy block produces one Observation per non-empty landmark, with the `code` field referencing RadLex Dental Subset entries where available.

When `bridges/dicom_sr.py` converts to DICOM-SR, the anatomy block produces "Concept Modifier" sequences inside the SR template (TID 1500 family for dental imaging).

See [bridges/README.md](../bridges/README.md) for details.

## References

- AAOMR Position Paper. *Normal Radiographic Anatomy of the Jaws*. 2018.
- White SC, Pharoah MJ. *Oral Radiology: Principles and Interpretation*. 8th ed. 2019.
- ICD-10 Chapter K (K00–K14) — anatomical references at the diagnosis stage.
