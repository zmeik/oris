# Glossary

> Terms used in ORIS v0.1 documentation, with cross-references to the relevant specs.

| Term | Definition | Reference |
|------|------------|-----------|
| **AAOMR** | American Academy of Oral and Maxillofacial Radiology | [AAOMR position papers](../README.md) |
| **AAP** | American Academy of Periodontology — source of peri-implantitis classification | [grammar/complications.md](../grammar/complications.md) |
| **ACP** | American College of Prosthodontists — author of GPT-9 (2017) and GPT-10 (2023) | [numbering/occupants.md](../numbering/occupants.md) |
| **ADA** | American Dental Association | [docs/architecture.md](architecture.md) |
| **AIM** | Annotation and Image Markup standard (RSNA, 2011) — XML-based image annotation foundation | n/a |
| **ALARA** | "As Low As Reasonably Achievable" — radiation safety principle requiring clinical justification before each radiograph | [docs/architecture.md](architecture.md) |
| **Anatomical landmarks** | Non-tooth structures recorded in `anatomical_landmarks` block | [anatomy/landmarks.md](../anatomy/landmarks.md) |
| **Bridge link** | A reference between dental positions joined in a fixed dental prosthesis | [schema/oris-v0.1.json](../schema/oris-v0.1.json) |
| **Cantilever pontic** | Pontic with single-side retention (occupant `C`) | [numbering/occupants.md](../numbering/occupants.md) |
| **CBCT** | Cone-Beam Computed Tomography — 3D dental imaging modality (out of scope for v0.1) | n/a |
| **CDT** | Current Dental Terminology — billing codes (not used in ORIS imaging output) | n/a |
| **Cohen's κ** | Cohen's kappa coefficient — inter-rater agreement measure | [parser/kappa.py](../parser/kappa.py) |
| **DICOM-SR** | DICOM Structured Reporting — radiology report standard (XML-based) | [bridges/dicom_sr.py](../bridges/dicom_sr.py) |
| **Drift** (`mesial drift`) | Migration of a tooth toward the dental midline; common after extraction of adjacent tooth | [examples/](../examples/) |
| **EBNF** | Extended Backus-Naur Form — grammar specification syntax (ISO/IEC 14977) | [grammar/ebnf.txt](../grammar/ebnf.txt) |
| **EHR** | Electronic Health Record | [bridges/mis.py](../bridges/mis.py) |
| **FDI** | Fédération Dentaire Internationale — also the two-digit dental notation in ISO 3950 | [numbering/](../numbering/) |
| **FDP** | Fixed Dental Prosthesis (bridge) | [numbering/occupants.md](../numbering/occupants.md) |
| **FHIR** | Fast Healthcare Interoperability Resources — HL7 standard | [bridges/fhir.py](../bridges/fhir.py) |
| **FSTEC** | Federal Service for Technical and Export Control (Russia) — issued FSTEC Order № 21 (2013) on PII protection measures | [PRIVACY.md](../PRIVACY.md) |
| **GDPR** | General Data Protection Regulation (Regulation (EU) 2016/679) | [PRIVACY.md](../PRIVACY.md) |
| **GPT-9** | The Glossary of Prosthodontic Terms, 9th edition (ACP 2017) — source of cantilever / Maryland-bonded definitions | [numbering/occupants.md](../numbering/occupants.md) |
| **GPT-10** | The Glossary of Prosthodontic Terms, 10th edition (ACP 2023) | [numbering/occupants.md](../numbering/occupants.md) |
| **Ground truth (GT)** | The validated annotation of an OPG, after expert review | [docs/architecture.md](architecture.md) |
| **HIPAA** | Health Insurance Portability and Accountability Act (US Privacy Rule) | [PRIVACY.md](../PRIVACY.md) |
| **HL7** | Health Level 7 — interoperability standards organisation; produces FHIR | [bridges/fhir.py](../bridges/fhir.py) |
| **ICD-10** | International Classification of Diseases, 10th Revision; chapter K for dental disorders | [glossary.md](#) |
| **ICDAS** | International Caries Detection and Assessment System (codes 0-6 for caries) | [grammar/statuses.md](../grammar/statuses.md) |
| **Imaging findings** | Descriptive section of a radiology report — what is visible on the image (≠ diagnosis) | [docs/architecture.md](architecture.md) |
| **IRB** | Institutional Review Board (ethics committee) | [LICENSE](../LICENSE) |
| **K08.1** | ICD-10 code: "Loss of teeth due to extraction, accident or local periodontal disease" | [examples/](../examples/) |
| **Layer** | One status entry in a tooth's status_layers formula | [parser/core.py](../parser/core.py) |
| **Maryland-bonded retainer** | Resin-bonded fixed dental prosthesis with metal/ceramic wing retainers (occupant `M`) | [numbering/occupants.md](../numbering/occupants.md) |
| **MBL** | Marginal Bone Level — height of bone around an implant | [grammar/complications.md](../grammar/complications.md) |
| **MIS** | Medical Information System — broadly equivalent to EHR | [bridges/mis.py](../bridges/mis.py) |
| **MMOral-OPG-Bench** | Public benchmark dataset for AI-assisted panoramic radiograph analysis (Hao et al., NeurIPS 2025; arXiv:2509.09254) | [bridges/mmoral.py](../bridges/mmoral.py) |
| **Occupant** | The 6th character of an ORIS code, identifying what occupies the dental position (13 types) | [numbering/occupants.md](../numbering/occupants.md) |
| **OPG** | Orthopantomogram (panoramic radiograph) — same as PAN | n/a |
| **ORIS** | Open Radiographic Imaging Schema — this project. Also Latin *oris* "of the mouth" | [README.md](../README.md) |
| **OSIPI LL-XML** | Open Science Initiative for Perfusion Imaging Lexicon (ISMRM, 2023) — direct architectural precedent for ORIS in MRI modality | [docs/architecture.md](architecture.md) |
| **PAI** | Periapical Index (Ørstavik 1986) — 5-level periapical-lesion grading | [schema/oris-v0.1.json](../schema/oris-v0.1.json) |
| **PII** | Personally Identifiable Information | [PRIVACY.md](../PRIVACY.md) |
| **PHI** | Protected Health Information (HIPAA term) | [PRIVACY.md](../PRIVACY.md) |
| **Pontic** | The artificial tooth in a bridge (occupants `B`, `C`) | [numbering/occupants.md](../numbering/occupants.md) |
| **PPE / PDIA / DPIA** | Various names for Data Protection Impact Assessment | [PRIVACY.md](../PRIVACY.md) |
| **RBFDP** | Resin-Bonded Fixed Dental Prosthesis (Maryland and inlay-bonded variants) | [numbering/occupants.md](../numbering/occupants.md) |
| **RadLex** | RSNA's radiology lexicon; has a Dental Subset | n/a |
| **Roskomnadzor** | Federal Service for Supervision of Communications, Information Technology and Mass Media (Russia) — receives notifications under 152-FZ | [PRIVACY.md](../PRIVACY.md) |
| **RPD / CD** | Removable Partial Denture / Complete Denture — covered by occupant `D` | [numbering/occupants.md](../numbering/occupants.md) |
| **Septal deviation** | Lateral displacement of the nasal septum from midline | [anatomy/landmarks.md](../anatomy/landmarks.md) |
| **SNODENT** | Systematized Nomenclature of Dentistry (ANSI/ADA) | n/a |
| **TMJ** | Temporomandibular Joint | [anatomy/tmj.md](../anatomy/tmj.md) |
| **TWI** | Tooth Wear Index (Lussi) — 0-4 grading | [grammar/statuses.md](../grammar/statuses.md) |
| **Vertucci classification** | Root canal anatomy classification, types I-VIII (Vertucci 1984) | [schema/oris-v0.1.json](../schema/oris-v0.1.json) |
| **Vestibular** | Tooth surface facing the lips/cheek (= "facial" / "labial" / "buccal"); ORIS uses code `v` | [grammar/surfaces.md](../grammar/surfaces.md) |
| **152-FZ** | Russian Federal Law № 152-FZ "On Personal Data" (2006, with amendments) | [PRIVACY.md](../PRIVACY.md) |

## Russian terms

| Russian | English | Comment |
|---------|---------|---------|
| **Ветвь нижней челюсти** | Mandibular ramus | [anatomy/landmarks.md](../anatomy/landmarks.md) |
| **ВНЧС** (височно-нижнечелюстной сустав) | TMJ | [anatomy/tmj.md](../anatomy/tmj.md) |
| **Воздухоносные пути** | Airway | [anatomy/airway.md](../anatomy/airway.md) |
| **Зубная формула** | Dental formula / chart | [README.ru.md](../README.ru.md) |
| **Имплантат** | Implant (occupant `F`) | [numbering/occupants.md](../numbering/occupants.md) |
| **Кариес** | Caries (`caries`) | [grammar/statuses.md](../grammar/statuses.md) |
| **Коронка** | Crown (`crowned`) | [grammar/statuses.md](../grammar/statuses.md) |
| **Мостовидный протез** | Bridge | [numbering/occupants.md](../numbering/occupants.md) |
| **Мыщелок** | Condyle | [anatomy/tmj.md](../anatomy/tmj.md) |
| **Нижнечелюстной канал** | Mandibular canal | [anatomy/landmarks.md](../anatomy/landmarks.md) |
| **Окклюзионная поверхность** | Occlusal surface (`o`) | [grammar/surfaces.md](../grammar/surfaces.md) |
| **Пазуха верхнечелюстная** | Maxillary sinus | [anatomy/landmarks.md](../anatomy/landmarks.md) |
| **Пломба** | Filling (`restored`) | [grammar/statuses.md](../grammar/statuses.md) |
| **Эндо / Эндодонтическое лечение** | Endodontic treatment (`endo`) | [grammar/statuses.md](../grammar/statuses.md) |
