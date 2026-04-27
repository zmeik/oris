# Anatomical Landmarks — non-tooth structures on OPG

> ORIS v0.1 records 9 categories of anatomical landmarks visible on a typical panoramic radiograph. Each is anchored to AAOMR Position Paper *Normal Radiographic Anatomy of the Jaws* (2018) and White & Pharoah Ch. 9–12 (2019).

## 1. Mandibular canal (нижнечелюстной канал)

The bony canal containing the inferior alveolar neurovascular bundle, running from the mandibular foramen on the medial aspect of the ramus to the mental foramen on the lateral aspect of the body.

| Field | Values |
|-------|--------|
| `visibility_right` / `visibility_left` | `clearly_visible`, `partially_visible`, `not_visible`, `obscured_by_artifact` |
| `course_right` / `course_left` | `normal`, `high`, `low`, `tortuous`, `interrupted` |
| `distance_to_alveolar_crest_mm_right` / `_left` | numeric (mm), nullable |

**Clinical relevance:** Implant planning requires ≥ 2 mm safety margin from the canal. A "low" course in the posterior mandible may permit implant placement; a "high" course constrains length.

## 2. Mental foramen (ментальное отверстие)

The exit point of the mental neurovascular bundle on the lateral aspect of the mandibular body, typically in the premolar region.

| Field | Values |
|-------|--------|
| `location_right` / `location_left` | `premolar_region`, `between_1st_2nd_premolar`, `anterior_to_1st_premolar`, `posterior_to_2nd_premolar`, `not_visible` |
| `visible_right` / `visible_left` | boolean |

**Clinical relevance:** Mental foramen position must be respected during implant placement in the posterior mandible. Anatomical variants (anterior loop) may extend the safety zone.

## 3. Maxillary sinus (верхнечелюстная пазуха)

The largest paranasal air sinus, occupying the maxillary body. Pneumatization extends inferiorly and may approach or reach the apices of posterior maxillary teeth.

| Field | Values |
|-------|--------|
| `status_right` / `status_left` | `normal`, `mucosal_thickening`, `opacification`, `polyp`, `antrolith`, `post_operative_change`, `sinusitis` |
| `floor_integrity_right` / `_left` | `intact`, `dehiscent`, `eroded` |
| `pneumatization_right` / `_left` | `normal`, `increased`, `decreased` |
| `floor_to_alveolar_crest_mm_right` / `_left` | numeric (mm), nullable |

**Clinical relevance:** Posterior-maxilla implant placement requires sufficient bone height; sinus lifts may be indicated. Mucosal thickening > 3 mm warrants attention before sinus elevation surgery.

## 4. Nasal cavity (носовая полость)

| Field | Values |
|-------|--------|
| `septum_position` | `midline`, `deviated_right`, `deviated_left` |
| `septum_deviation_angle_deg` | numeric (0–90), nullable |
| `nasal_airway_patency` | `patent`, `partially_obstructed`, `obstructed` |

**Clinical relevance:** Septal deviation may affect orthognathic planning and is a finding for ENT referral. The OPG only provides a coarse view; CBCT is required for definitive assessment.

## 5. Incisive canal (резцовый канал, nasopalatine canal)

| Field | Values |
|-------|--------|
| `visible` | boolean |
| `diameter_mm` | numeric, nullable |
| `position` | `anterior_to_incisors`, `between_central_incisors`, `not_assessed` |

**Clinical relevance:** A widened incisive canal (> 6 mm) may indicate nasopalatine duct cyst. Position constrains implant placement in the maxillary anterior region.

## 6. Ramus (ветвь нижней челюсти)

The vertical projection of the mandible posterior to the body, ending superiorly in the coronoid and condylar processes.

| Field | Values |
|-------|--------|
| `height_right_mm` / `height_left_mm` | numeric, nullable |
| `angulation_right_deg` / `_left_deg` | numeric (typically 70–80°), nullable |

**Clinical relevance:** Ramus dimensions inform orthognathic and reconstructive planning. Abnormal angulation may suggest developmental anomaly or condition affecting growth.

## 7. Coronoid process (венечный отросток)

The anterior superior projection of the ramus, attachment for the temporalis muscle.

| Field | Values |
|-------|--------|
| `visible_right` / `visible_left` | boolean |
| `height_right_mm` / `_left_mm` | numeric, nullable |

**Clinical relevance:** Coronoid hyperplasia may cause limited mouth opening; visible asymmetry warrants further imaging.

## 8. Zygomatic arch (скуловая дуга)

The arch formed by the zygomatic process of the temporal bone and the temporal process of the zygomatic bone.

| Field | Values |
|-------|--------|
| `visible_right` / `visible_left` | boolean |
| `remarks` | free text (≤ 200 chars), nullable |

**Clinical relevance:** Zygomatic arch fractures and zygomatic implant planning. Note any radiopacity overlapping the maxillary posterior teeth in interpretation.

## 9. Cervical spine projection (проекция шейного отдела позвоночника)

| Field | Values |
|-------|--------|
| `visible` | boolean |
| `remarks` | free text (≤ 200 chars), nullable |

**Clinical relevance:** Visible C1–C3 vertebrae may show calcifications (carotid, ligament) or anomalies. Use the `pathology` array for actual findings; the landmark block records only baseline visibility.

## What goes here vs. in `pathology[]`

| Item | Where to record |
|------|-----------------|
| Mandibular canal location, course, visibility | `anatomical_landmarks.mandibular_canal` |
| Mandibular fracture | `pathology[].type = "mandibular_fracture"` |
| Maxillary sinus status (normal/thickening/polyp) | `anatomical_landmarks.maxillary_sinus.status_*` |
| Periapical-related sinus involvement | `pathology[].type = "antrolith"` or related, with `fdi` reference |
| Mental foramen location | `anatomical_landmarks.mental_foramen.location_*` |
| Carotid calcification (visible at C3-C4 area) | `pathology[].type = "carotid_artery_calcification"` |

The rule: **landmarks describe baseline structure**; **pathology describes additional findings on or around landmarks**.

## References

- AAOMR Position Paper. *Normal Radiographic Anatomy of the Jaws*. 2018.
- White SC, Pharoah MJ. *Oral Radiology: Principles and Interpretation*. 8th ed. St. Louis: Elsevier; 2019. Ch. 9–12.
- Langlais RP, Langland OE, Nortjé CJ. *Diagnostic Imaging of the Jaws*. 3rd ed. Lippincott Williams & Wilkins; 2024.
