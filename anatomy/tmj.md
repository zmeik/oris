# TMJ Findings — temporomandibular joint

> The OPG provides limited but clinically useful information about the TMJ. ORIS records four sub-blocks: condyle (right + left), articular eminence, joint space, and pathology. Note that definitive TMJ assessment often requires CBCT or MRI; ORIS captures what is visible on a 2D panoramic projection.

## Condyle right / left

The mandibular condyle is the rounded process at the superior tip of the ramus, articulating with the glenoid fossa of the temporal bone.

| Field | Values |
|-------|--------|
| `morphology` | `normal`, `flattened`, `osteophyte`, `erosion`, `resorption`, `hypoplastic`, `hyperplastic` |
| `surface_contour` | `smooth`, `irregular`, `erosive_defect` |
| `bone_density` | `normal`, `sclerotic`, `osteoporotic` |
| `height_mm` | numeric, nullable |
| `anterior_posterior_position` | `normal`, `anteriorly_positioned`, `posteriorly_positioned` |

**Morphology guidance:**

- `normal` — rounded, smooth, symmetric to the contralateral side
- `flattened` — loss of normal convex curvature, often early TMJ-OA sign
- `osteophyte` — bony spur projecting from the articular surface, advanced TMJ-OA sign
- `erosion` — surface defect with cortical disruption
- `resorption` — significant volumetric loss
- `hypoplastic` — small for age (developmental)
- `hyperplastic` — overgrown (developmental, may cause asymmetry)

## Articular eminence

The convex articular surface of the temporal bone anterior to the glenoid fossa.

| Field | Values |
|-------|--------|
| `prominence_right` / `prominence_left` | `normal`, `prominent`, `flat` |
| `osteophyte_right` / `osteophyte_left` | boolean |

**Clinical relevance:** A flat articular eminence is associated with reduced mouth opening; a prominent eminence with anterior disc displacement and clicking.

## Joint space

| Field | Values |
|-------|--------|
| `width_anterior_right_mm` / `_left_mm` | numeric, nullable |
| `width_posterior_right_mm` / `_left_mm` | numeric, nullable |
| `symmetry` | `symmetric`, `asymmetric` |
| `assessment` | `normal`, `narrowed`, `widened` |

**Clinical relevance:** Asymmetric joint space (e.g., narrowed posteriorly) suggests anterior disc displacement. Narrowed throughout suggests degenerative joint disease.

## Pathology

| Field | Values |
|-------|--------|
| `ankylosis` | boolean |
| `disc_displacement` | `no`, `anterior`, `lateral`, `posterior`, `indeterminate` |
| `osteoarthritis_signs` | `absent`, `early`, `moderate`, `advanced` |

**`osteoarthritis_signs` interpretation:**

- `early` — flattening or minor cortical irregularity
- `moderate` — multiple flattenings, minor osteophyte, joint-space narrowing
- `advanced` — pronounced osteophytes, erosion, marked joint-space change

## What OPG cannot reliably show

The OPG is a 2D projection with significant geometric distortion at the TMJ region. It **cannot** reliably:

- Diagnose disc displacement (requires MRI)
- Quantify articular cartilage thickness (requires MRI)
- Detect early-stage osteoarthritis with high sensitivity
- Visualise the lateral pterygoid attachment

For definitive TMJ assessment, ORIS recommends recording these limitations in the `tmj_findings.pathology.disc_displacement = "indeterminate"` and `tmj_findings.osteoarthritis_signs = "absent"` (default) and seeking CBCT / MRI when clinically indicated.

## References

- AAOMR Position Paper. *Imaging of the Temporomandibular Joint*. (Various years.)
- White SC, Pharoah MJ. *Oral Radiology: Principles and Interpretation*. 8th ed. 2019. Ch. 28 (TMJ Imaging).
- Petersson A. *Dentomaxillofac Radiol*. (Various reviews on TMJ imaging.)
