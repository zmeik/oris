# Airway / Sinus Block — pharyngeal airway and sinus pneumatization

> ORIS v0.1 records airway findings to the extent visible on an OPG: pharyngeal airway projection, nasal-cavity septal alignment, and maxillary-sinus pneumatization. Definitive airway assessment requires lateral cephalometric radiograph, CBCT, or polysomnography; ORIS captures what is incidentally visible on the panoramic projection.

## Pharyngeal airway

The radiolucent shadow of the pharyngeal air column visible on an OPG, between the soft palate and the cervical spine projection.

| Field | Values |
|-------|--------|
| `width_mm` | numeric, nullable |
| `depth_mm` | numeric, nullable |
| `space_classification` | `normal`, `reduced`, `severely_compromised`, `not_assessed` |
| `obstruction_sites` | array of `soft_palate`, `base_of_tongue`, `epiglottis`, `lateral_wall` |

**Clinical relevance:** A reduced pharyngeal airway visible incidentally on an OPG is a finding worth referring for sleep-apnoea screening. The OPG is *not* the diagnostic modality for OSA; it serves as an opportunistic alert.

## Nasal cavity (extra)

This block extends the basic septal-position field already in `anatomical_landmarks.nasal_cavity` with severity grading.

| Field | Values |
|-------|--------|
| `septal_deviation` | `midline`, `deviated_right`, `deviated_left` |
| `deviation_severity` | `mild`, `moderate`, `severe`, `absent` |

## Sinus pneumatization (already in `anatomical_landmarks.maxillary_sinus`)

The Airway block does **not** duplicate the maxillary-sinus assessment that is recorded under `anatomical_landmarks.maxillary_sinus`. The pneumatization field there (`pneumatization_right` / `pneumatization_left` ∈ `normal | increased | decreased`) is the canonical location for that finding.

## What OPG cannot reliably show

- Tonsil hypertrophy (typically not visible on an OPG; lateral cephalometric or clinical exam is preferable)
- Adenoid hypertrophy (lateral cephalometric is the standard)
- Lower-airway findings (chest radiograph or CT)
- 3D airway volume (CBCT or CT)

For these, ORIS recommends `space_classification = "not_assessed"` and clinical referral.

## Clinical workflow

Incidental airway findings on an OPG should trigger:

1. Documentation under `airway_assessment.pharyngeal_airway.space_classification`
2. Free-text remark under `airway_assessment.pharyngeal_airway` if useful
3. Mention in the radiologist's narrative section as an *incidental finding warranting evaluation* (this is text outside ORIS, in the human-readable report)
4. Referral to ENT or sleep-medicine specialist as indicated

ORIS is **not** a sleep-apnoea screening tool; it is a structured radiology output format that includes the airway shadow as one of many incidental findings on the panoramic projection.

## References

- AAOMR Position Paper. *Imaging Recommendations and Considerations* (various years).
- White SC, Pharoah MJ. *Oral Radiology*. 8th ed. 2019. Ch. 11 (Maxillary Sinus and Skull Base).
