# 23-code prosthetic complication ontology

> ORIS v0.1 includes a 23-code ontology for radiographically-observable prosthetic and biological complications, primarily for implant-supported restorations. The codes are categorised as **mechanical**, **biological**, **iatrogenic**, or **aesthetic** and anchored to authoritative references.

## Quick reference

| Code | Category | Definition | Reference |
|------|----------|------------|-----------|
| `SCR_LOOSE` | Mechanical | Screw loosening | Pjetursson 2012 |
| `ABT_MISFIT` | Mechanical | Abutment misfit | Misch 2008 |
| `VEN_CHIP` | Mechanical | Veneer chipping (porcelain layer) | Pjetursson 2012 |
| `RET_LOSS` | Mechanical | Retention loss (cement failure) | Misch 2008 |
| `PERI_MUC` | Biological | Peri-implant mucositis (BoP, no bone loss) | AAP 2017 |
| `PERI_EARLY` | Biological | Early peri-implantitis (bone loss < 2 mm) | AAP 2017 |
| `PERI_MOD` | Biological | Moderate peri-implantitis (2–4 mm bone loss) | AAP 2017 |
| `PERI_ADV` | Biological | Advanced peri-implantitis (> 4 mm bone loss) | AAP 2017 |
| `OSSEO_FAIL` | Biological | Osseointegration failure | Misch 2008 |
| `MALPOS` | Iatrogenic | Implant malposition | Froum 2012 |
| `OVERLOAD` | Mechanical | Occlusal overload signs | Misch 2008 |
| `FX_FIX` | Mechanical | Fixture fracture | Pjetursson 2012 |
| `FX_ABT` | Mechanical | Abutment fracture | Pjetursson 2012 |
| `FX_VEN` | Mechanical | Veneer fracture (full crown layer) | Rosenstiel 2022 |
| `MARG_LEAK` | Biological | Marginal leakage (open contact) | Pjetursson 2012 |
| `MUCOSITIS_PERSISTENT` | Biological | Mucositis persistent > 3 months | AAP 2017 |
| `RECESSION` | Biological | Soft-tissue recession | AAP 2017 |
| `EMERGENCE_POOR` | Aesthetic | Poor emergence profile | Rosenstiel 2022 |
| `BIOFILM_CALC` | Biological | Biofilm / calculus on implant surface | AAP 2017 |
| `RBL_PROGRESS` | Biological | Progressive radiographic bone loss (> 0.2 mm/yr) | Schwarz 2020 |
| `INF_ACUTE` | Biological | Acute infection (abscess) | AAP 2017 |
| `OCCL_INTERFERENCE` | Mechanical | Occlusal interference / hyperocclusion | Misch 2008 |
| `BRUX_DAMAGE` | Mechanical | Bruxism-related damage | Misch 2020 Ch. 47 |

## Detailed definitions

### Mechanical category

Mechanical complications relate to the prosthetic component physical integrity.

**`SCR_LOOSE` — Screw loosening.** The retaining screw of a screw-retained restoration has lost preload. Radiographically: gap visible at abutment-screw interface; tilting of the prosthesis. Clinical signs: micromobility at recall.

**`ABT_MISFIT` — Abutment misfit.** Gap between implant platform and abutment seat. Radiographically: visible space at the implant-abutment interface, sometimes asymmetric.

**`VEN_CHIP` — Veneer chipping.** Loss of porcelain or composite veneer material on the labial / buccal surface of the crown. Often clinically obvious; radiographically a sharp-edged radiolucent defect on the prosthetic crown.

**`RET_LOSS` — Retention loss.** A cement-retained restoration has come loose. Radiographically: cement gap, displacement.

**`OVERLOAD` — Occlusal overload signs.** Excessive bone loss pattern (cup-shaped or radiating) around an implant compatible with biomechanical overload, in the absence of biological inflammatory signs.

**`FX_FIX` — Fixture fracture.** Catastrophic structural failure of the implant body itself. Rare but reportable. Radiographic appearance: visible fracture line through the implant body.

**`FX_ABT` — Abutment fracture.** Fracture of the abutment component (between implant platform and crown).

**`FX_VEN` — Veneer fracture (full crown layer).** Larger-scale veneer loss than `VEN_CHIP`, often involving the full vestibular or occlusal layer.

**`OCCL_INTERFERENCE` — Occlusal interference / hyperocclusion.** Premature contact identified clinically; radiographically may show widened PDL on opposing tooth or stress patterns around the implant.

**`BRUX_DAMAGE` — Bruxism-related damage.** Wear facets, crown fracture pattern, or implant fixture / framework damage characteristic of parafunctional habits.

### Biological category

Biological complications relate to peri-implant tissue health.

**`PERI_MUC` — Peri-implant mucositis.** Inflammation of peri-implant soft tissue with bleeding on probing (BoP) but without bone loss. Per AAP 2017 World Workshop classification.

**`PERI_EARLY` — Early peri-implantitis.** Bone loss < 2 mm beyond the initial post-prosthetic remodeling baseline. Inflammation and BoP present.

**`PERI_MOD` — Moderate peri-implantitis.** Bone loss 2–4 mm beyond baseline.

**`PERI_ADV` — Advanced peri-implantitis.** Bone loss > 4 mm beyond baseline. May threaten implant survival.

**`OSSEO_FAIL` — Osseointegration failure.** Loss of bone-to-implant contact, mobile implant, often associated with peri-implant radiolucency suggestive of fibrous encapsulation.

**`MARG_LEAK` — Marginal leakage.** Open contact at the prosthesis-tooth interface allowing food impaction and bacterial invasion.

**`MUCOSITIS_PERSISTENT` — Persistent mucositis.** Mucositis lasting > 3 months despite intervention; risk factor for progression to peri-implantitis.

**`RECESSION` — Soft-tissue recession.** Apical migration of peri-implant mucosa, exposing the abutment or implant collar.

**`BIOFILM_CALC` — Biofilm / calculus on implant surface.** Visible accumulation on the implant collar or abutment, associated with peri-implant inflammation.

**`RBL_PROGRESS` — Progressive radiographic bone loss.** Bone loss exceeding 0.2 mm/year (Schwarz et al. 2020 criterion for peri-implantitis vs. physiological remodeling).

**`INF_ACUTE` — Acute infection.** Acute peri-implant abscess with radiographic radiolucency, often with sinus tract.

### Iatrogenic category

**`MALPOS` — Implant malposition.** Implant placed in non-ideal position (excessive angulation, crown-implant axis misalignment, encroachment on adjacent tooth or anatomic structure). Per Froum & Rosen 2012 classification.

### Aesthetic category

**`EMERGENCE_POOR` — Poor emergence profile.** The crown emerges from the gingival margin with an unaesthetic contour (typically over-contoured horizontally), risking soft-tissue inflammation and aesthetic failure.

## Multiple complications per implant

The `complications` field is an array. Multiple codes can co-occur:

```json
"implant": {
    "complications": ["PERI_MOD", "RBL_PROGRESS", "BIOFILM_CALC"]
}
```

This denotes a moderate peri-implantitis case with progressive bone loss and visible biofilm — a typical multi-finding implant in a maintenance recall.

## References

- Pjetursson BE, Brägger U, Lang NP, Zwahlen M. Comparison of survival and complication rates of tooth-supported fixed dental prostheses (FDPs) and implant-supported FDPs and single crowns (SCs). *Clin Oral Implants Res*. 2012;23 Suppl 6:22–38.
- Misch CE. *Dental Implant Prosthetics*. 2nd ed. St. Louis: Elsevier; 2008.
- Misch CE. *Contemporary Implant Dentistry*. 4th ed. St. Louis: Elsevier; 2020.
- Froum SJ, Rosen PS. A proposed classification for peri-implantitis. *Int J Periodontics Restorative Dent*. 2012;32(5):533–540.
- Berglundh T, Armitage G, Araujo MG, et al. Peri-implant diseases and conditions: Consensus report of workgroup 4 of the 2017 World Workshop on the Classification of Periodontal and Peri-Implant Diseases and Conditions. *J Clin Periodontol*. 2018;45 Suppl 20:S286–S291. (AAP 2017 reference)
- Schwarz F, Derks J, Monje A, Wang HL. Peri-implantitis. *J Clin Periodontol*. 2018;45 Suppl 20:S246–S266 (with 2020 updates).
- Rosenstiel SF, Land MF, Walter R. *Contemporary Fixed Prosthodontics*. 6th ed. St. Louis: Elsevier; 2022.
