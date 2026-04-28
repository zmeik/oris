"""Bridge from ORIS to DICOM Structured Reporting (SR).

Produces a minimal DICOM-SR XML stub conforming to the dental imaging
templates (TID 1500 family). The output is a string containing the SR
content tree, which can be embedded in a full DICOM SR object via
pydicom or a similar library.

This is a v0.1 *stub* — full DICOM-SR generation requires the DICOM Toolkit
(DCMTK) or pydicom and is out of scope for the reference implementation.
The output here is sufficient to demonstrate the conceptual mapping AND
attaches RadLex Dental Subset codes (RSNA RadLex v4.1, 2024) on every
finding for which a published RID exists. ORIS statuses without a direct
RadLex correspondence carry the local ORIS coding scheme as fallback.

Reference: DICOM PS3.16 Structured Reporting (current); RadLex Dental Subset
v4.1 (RSNA 2024) — https://radlex.org/.
"""

from __future__ import annotations

from typing import Any
from xml.sax.saxutils import escape

from parser.core import parse_tooth_layers


# ---------------------------------------------------------------------------
# ORIS → RadLex Dental Subset mapping
# ---------------------------------------------------------------------------
# RIDs taken from RSNA RadLex 4.1 (https://radlex.org/) where a direct
# correspondence with the ORIS status exists. Statuses without a published
# RadLex code (e.g. impl_healing, bar, cantilever) emit the local
# ORIS-grammar coding scheme so downstream consumers can still resolve
# them deterministically.
ORIS_STATUS_TO_RADLEX: dict[str, dict[str, str]] = {
    # Tooth-level
    "present":       {"rid": "RID5807",  "label": "tooth"},
    "missing":       {"rid": "RID40562", "label": "absence of tooth"},
    "impacted":      {"rid": "RID5759",  "label": "impacted tooth"},
    "root":          {"rid": "RID5836",  "label": "tooth root"},

    # Pathology
    "caries":        {"rid": "RID5780",  "label": "dental caries"},
    "attrition":     {"rid": "RID5772",  "label": "tooth attrition"},

    # Treatment
    "endo":          {"rid": "RID11907", "label": "endodontically treated tooth"},
    "post":          {"rid": "RID11908", "label": "endodontic post"},
    "crowned":       {"rid": "RID5774",  "label": "dental crown"},
    "restored":      {"rid": "RID5773",  "label": "dental restoration"},

    # Implant
    "implant":       {"rid": "RID3897",  "label": "dental implant"},
    "impl_fixture":  {"rid": "RID3897",  "label": "dental implant"},
    "impl_restored": {"rid": "RID3897",  "label": "dental implant"},

    # Bridge / prosthodontics
    "bridge":        {"rid": "RID5775",  "label": "fixed dental prosthesis (bridge)"},
}

# Anatomical landmark blocks → RadLex
ORIS_LANDMARK_TO_RADLEX: dict[str, dict[str, str]] = {
    "mandibular_canal":  {"rid": "RID27117", "label": "mandibular canal"},
    "mental_foramen":    {"rid": "RID40452", "label": "mental foramen"},
    "ramus":             {"rid": "RID40459", "label": "ramus of mandible"},
    "coronoid_process":  {"rid": "RID40453", "label": "coronoid process of mandible"},
    "maxillary_sinus":   {"rid": "RID28667", "label": "maxillary sinus"},
    "nasal_cavity":      {"rid": "RID28673", "label": "nasal cavity"},
    "incisive_canal":    {"rid": "RID40461", "label": "incisive canal"},
    "hyoid_bone":        {"rid": "RID28688", "label": "hyoid bone"},
    "zygomatic_arch":    {"rid": "RID28746", "label": "zygomatic arch"},
}

# TMJ landmark
ORIS_TMJ_TO_RADLEX: dict[str, dict[str, str]] = {
    "tmj_right_condyle":      {"rid": "RID40495", "label": "head of mandible"},
    "tmj_left_condyle":       {"rid": "RID40495", "label": "head of mandible"},
    "tmj_right":              {"rid": "RID28727", "label": "temporomandibular joint"},
    "tmj_left":               {"rid": "RID28727", "label": "temporomandibular joint"},
    "articular_eminence":     {"rid": "RID28729", "label": "articular eminence"},
}


def _radlex_attr(status: str) -> str:
    """Return ' radlex_rid=\"...\" radlex_label=\"...\"' or '' if not in the map."""
    rid = ORIS_STATUS_TO_RADLEX.get(status)
    if not rid:
        return ""
    return f' radlex_rid="{rid["rid"]}" radlex_label="{escape(rid["label"])}"'


def _landmark_radlex_attr(block_name: str) -> str:
    base = block_name.split("_right")[0].split("_left")[0]
    rid = (ORIS_LANDMARK_TO_RADLEX.get(base) or
           ORIS_LANDMARK_TO_RADLEX.get(block_name) or
           ORIS_TMJ_TO_RADLEX.get(block_name))
    if not rid:
        return ""
    return f' radlex_rid="{rid["rid"]}" radlex_label="{escape(rid["label"])}"'


def to_dicom_sr(oris_doc: dict[str, Any]) -> str:
    """Convert an ORIS document to a DICOM-SR content tree XML stub.

    Returns:
        XML string. Wrap in a DICOM SR object via pydicom for transport.
    """
    document_id = oris_doc.get("document_id", "unknown")
    imaging = oris_doc.get("imaging", {}) or {}
    teeth = oris_doc.get("teeth", {}) or {}
    landmarks = oris_doc.get("anatomical_landmarks", {}) or {}

    lines: list[str] = []
    lines.append('<?xml version="1.0" encoding="UTF-8"?>')
    lines.append(
        '<DicomStructuredReport sopClassUID="1.2.840.10008.5.1.4.1.1.88.11" '
        'transferSyntax="1.2.840.10008.1.2.1">'
    )
    lines.append("  <!-- ORIS v0.1 → DICOM-SR stub (best-effort) -->")
    lines.append(
        '  <Container conceptName="Dental Panoramic Imaging Findings" '
        f'sourceDocument="{escape(document_id)}">'
    )

    # Imaging metadata
    lines.append('    <Container conceptName="Imaging Metadata">')
    if imaging.get("device"):
        lines.append(
            f'      <Text conceptName="Acquisition Device">{escape(str(imaging["device"]))}</Text>'
        )
    if imaging.get("acquisition_date"):
        lines.append(
            f'      <DateTime conceptName="Acquisition Date">{escape(imaging["acquisition_date"])}</DateTime>'
        )
    if imaging.get("kvp") is not None:
        lines.append(
            f'      <Num conceptName="KVP" units="kV">{imaging["kvp"]}</Num>'
        )
    if imaging.get("ma") is not None:
        lines.append(
            f'      <Num conceptName="Tube Current" units="mA">{imaging["ma"]}</Num>'
        )
    lines.append("    </Container>")

    # Per-tooth findings
    lines.append('    <Container conceptName="Tooth Findings">')
    for tooth_code, tooth_obj in teeth.items():
        if not isinstance(tooth_obj, dict):
            continue
        layers_str = tooth_obj.get("status_layers", "") or ""
        if not layers_str:
            continue
        fdi = tooth_obj.get("fdi", "?")
        lines.append(
            f'      <Container conceptName="Tooth {fdi}" '
            f'oris_code="{escape(tooth_code)}">'
        )
        lines.append(
            f'        <Text conceptName="Status Layers">{escape(layers_str)}</Text>'
        )
        lines.append(
            f'        <Code conceptName="Occupant" value="{escape(tooth_obj.get("occupant", "U"))}" '
            f'codingScheme="https://github.com/zmeik/oris/numbering/occupants" />'
        )
        for layer in parse_tooth_layers(layers_str):
            surf_attr = (
                f' surfaces="{escape("".join(layer.surfaces))}"'
                if layer.surfaces
                else ""
            )
            radlex_attr = _radlex_attr(layer.status)
            lines.append(
                f'        <Code conceptName="Layer" value="{escape(layer.status)}" '
                f'codingScheme="https://github.com/zmeik/oris/grammar/statuses"'
                f'{radlex_attr}{surf_attr} />'
            )
        lines.append("      </Container>")
    lines.append("    </Container>")

    # Anatomical landmarks
    if landmarks:
        lines.append('    <Container conceptName="Anatomical Landmarks">')
        for block_name, block_data in landmarks.items():
            if not isinstance(block_data, dict) or not block_data:
                continue
            radlex = _landmark_radlex_attr(block_name)
            lines.append(
                f'      <Container conceptName="{escape(block_name)}"{radlex}>'
            )
            for k, v in block_data.items():
                if v is None or v == "" or v is False:
                    continue
                lines.append(
                    f'        <Text conceptName="{escape(k)}">{escape(str(v))}</Text>'
                )
            lines.append("      </Container>")
        lines.append("    </Container>")

    # Pathology
    pathology = oris_doc.get("pathology", []) or []
    if pathology:
        lines.append('    <Container conceptName="Pathology Findings">')
        for i, finding in enumerate(pathology):
            if not isinstance(finding, dict):
                continue
            lines.append(
                f'      <Container conceptName="Finding {i}" type="{escape(finding.get("type", "unspecified"))}">'
            )
            for k, v in finding.items():
                if v is None or v == "":
                    continue
                lines.append(
                    f'        <Text conceptName="{escape(k)}">{escape(str(v))}</Text>'
                )
            lines.append("      </Container>")
        lines.append("    </Container>")

    lines.append("  </Container>")
    lines.append("</DicomStructuredReport>")
    return "\n".join(lines)
