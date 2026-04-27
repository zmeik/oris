# Occupant types — full reference

> The 6th character of the ORIS position code is the **Occupant** — the object that occupies the dental position. ORIS v0.1 supports 13 occupants, designed to cover the principal categories of fixed and removable prosthodontic designs per ACP Glossary of Prosthodontic Terms (GPT-9, 2017; GPT-10, 2023).

## Quick reference

| Code | Name | Visual hint | Source |
|------|------|-------------|--------|
| **N** | Natural tooth | normal tooth | White & Pharoah 8e Ch. 14 |
| **F** | Fixture (implant) | endosseous screw | Misch 2020; ITI Treatment Guide |
| **T** | Transplant | autotransplanted natural tooth | Tsukiboshi 2001 |
| **B** | Bridge pontic (conventional) | pontic with full retainers | Rosenstiel 2022 Ch. 17 |
| **D** | Denture tooth | tooth in removable prosthesis (RPD/CD) | Carr & Brown 2016 |
| **H** | Hybrid prosthesis | implant-retained, often "All-on-Four" | Maló 2003 |
| **O** | Overdenture support | implant- or root-retained overdenture support | Sadowsky 2014 |
| **A** | Absent | physically missing, no replacement | ICD-10 K08.1 |
| **R** | Root remnant | root only, no coronal portion | White & Pharoah Ch. 14 |
| **S** | Supernumerary | additional tooth (e.g. mesiodens) | Anthonappa 2013 |
| **U** | Unknown | not determinable | n/a |
| **C** | Cantilever pontic | pontic cantilevered from a single abutment | ACP GPT-9 (2017) |
| **M** | Maryland-bonded retainer | resin-bonded FDP with metal/ceramic wing retainers | ACP GPT-9 (2017); Garrofé-Mejillón 2023 |
| **I** | Inlay/onlay-bonded retainer | resin-bonded FDP with inlay/onlay retainers | Garrofé-Mejillón 2023 |

## Detailed definitions

### N — Natural tooth

A natural tooth in situ, with its crown and root anatomy intact. May carry layered findings (caries, restorations, endodontic treatment, posts, crowns, etc.) on top of `occupant=N`.

**Radiographic appearance.** Distinct enamel cap (highest radiopacity), dentin (intermediate), pulp chamber (radiolucent), root canal anatomy, periodontal ligament space, lamina dura.

**Differentiation from F (Fixture).** A natural tooth has a periodontal ligament space; an implant fixture has direct bone-to-implant contact (no PDL).

### F — Fixture (implant)

An endosseous dental implant — titanium or zirconia screw — osseointegrated in alveolar bone. The `implant` block in `tooth_finding` may specify system (manufacturer/line), diameter, length, level (bone/tissue/subcrestal/supracrestal), surface treatment, occlusal restoration, marginal bone level, and complications (see [`grammar/complications.md`](../grammar/complications.md)).

**Radiographic appearance.** Highly radiopaque thread pattern; no PDL; characteristic apical contour per system.

**References.** Misch CE. *Contemporary Implant Dentistry*. 4th ed. 2020. ITI Treatment Guide series, Quintessence.

### T — Transplant

A natural tooth that has been autotransplanted from another position in the same patient (autologous transplantation). Typically a third molar transplanted to a first-molar position.

**Radiographic appearance.** Initially appears similar to N but in a non-original position. Over time may show ankylosis (fused PDL space) or external resorption.

**References.** Tsukiboshi M. *Autotransplantation of Teeth*. Quintessence; 2001.

### B — Bridge pontic (conventional)

A pontic in a conventional fixed dental prosthesis (FDP) with retainers on both sides. The `bridge_link` array of the position lists the ORIS codes of the retainer abutments. The schema also allows global `bridge_links` keyed by FDI ranges (e.g., `"1.4-1.5-1.6": "conventional"`).

**Radiographic appearance.** Pontic floats above the alveolar ridge; retainers are crowned natural teeth or implants on either side.

**References.** Rosenstiel SF, Land MF, Walter R. *Contemporary Fixed Prosthodontics*. 6th ed. 2022, Ch. 17.

### D — Denture tooth

An artificial tooth set into a removable partial denture (RPD) or complete denture (CD). On a panoramic radiograph, denture teeth typically appear less radiopaque than natural teeth (acrylic) unless they contain metal pins for retention.

**References.** Carr AB, Brown DT. *McCracken's Removable Partial Prosthodontics*. 13th ed. 2016.

### H — Hybrid prosthesis

A hybrid implant-retained prosthesis — most commonly the "All-on-Four" design — where multiple implants support a fixed full-arch prosthesis. The position is occupied by an artificial tooth that is part of the rigid prosthetic framework.

**Differentiation from O (Overdenture support).** Hybrid prostheses are fixed (only the dentist removes them). Overdentures are removable by the patient.

**References.** Maló P, Rangert B, Nobre M. *Clin Implant Dent Relat Res*. 2003. Sadowsky SJ. *J Prosthet Dent*. 2014.

### O — Overdenture support

An implant or natural-root abutment used to retain a removable overdenture, typically via locator attachments, ball abutments, magnetic anchors, or a connecting bar.

**References.** Sadowsky SJ. *J Prosthet Dent*. 2014;112(5):1153–1158.

### A — Absent

The dental position is empty — no natural tooth, no prosthetic replacement. ICD-10 K08.1 is the relevant diagnostic code at the *clinical-diagnosis* stage (recall that ORIS itself does not perform diagnosis).

### R — Root remnant

A retained root fragment, usually after coronal fracture or extensive caries, where the coronal portion has been lost but the root remains in the alveolar bone.

### S — Supernumerary

An additional (extra) tooth in the dental arch beyond the normal complement. Common locations: mesiodens (between maxillary central incisors), distomolar (distal to a third molar), paramolar (buccal/lingual to a molar).

**References.** Anthonappa RP, King NM, Rabie AB. *Eur J Orthod*. 2013;35(6):785–789.

### U — Unknown

Status cannot be determined — for example, the position is obscured by an artifact, the radiograph is non-diagnostic for that region, or the radiologist defers the assessment for follow-up imaging.

### C — Cantilever pontic

A pontic in a cantilever fixed dental prosthesis — retained on one side only. ACP GPT-9 (2017) defines a cantilever FDP as one with a retainer on only one side of the pontic.

**Differentiation from B (conventional Bridge pontic).** Cantilever has retention on one side only; conventional bridge has retainers on both sides.

**References.** ACP. *J Prosthet Dent*. 2017;117(5S):e1–e105.

### M — Maryland-bonded retainer

A resin-bonded fixed dental prosthesis (RBFDP) where the retainer takes the form of a metal or ceramic "wing" bonded to the lingual/palatal surface of the abutment tooth. ACP GPT-9 names this the "Maryland bridge" after the original design from the University of Maryland.

**Note.** The position coded `M` is the **abutment tooth** carrying the wing — not the pontic. The pontic is coded `C` (or `B` if double-sided).

**References.** ACP. *J Prosthet Dent*. 2017. Garrofé-Mejillón A et al. *J Esthet Restor Dent*. 2023;35(8):1219–1232.

### I — Inlay/onlay-bonded retainer

A resin-bonded FDP variant where the retainer has the shape of an inlay or onlay seated in a prepared cavity in the abutment tooth, instead of a wing. Provides better mechanical retention than Maryland wings in some clinical scenarios.

**References.** Garrofé-Mejillón A et al. *J Esthet Restor Dent*. 2023;35(8):1219–1232 (scoping review on RBFDP terminology).

## Choosing between similar occupants

| Question | Answer |
|----------|--------|
| Natural tooth or implant? | If PDL is visible and root anatomy is present → **N**. If thread pattern is visible and no PDL → **F**. |
| Bridge pontic — single or double-side retention? | Both sides → **B**. Single side → **C**. |
| Bridge pontic — what kind of retention? | Crown retainers → **B** or **C**. Wing retainer → **M** (the abutment). Inlay retainer → **I** (the abutment). |
| Hybrid or overdenture? | Patient cannot remove → **H**. Patient removes daily → **O**. |
| Tooth missing — replaced or not? | Replaced → use the prosthesis occupant (B/C/D/H/M/I). Not replaced → **A**. |

## Future occupant types (out of scope for v0.1)

These may be added in v0.2 or later:

- `Z` — Zygomatic implant (for severely atrophied maxilla)
- `K` — Subperiosteal framework (rare; legacy designs)
- `P` — Provisional / temporary tooth in interim restoration

If you need one of these now, please open a GitHub Issue.
