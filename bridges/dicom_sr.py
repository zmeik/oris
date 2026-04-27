"""Bridge from ORIS to DICOM Structured Reporting (SR).

Produces a minimal DICOM-SR XML stub conforming to the dental imaging
templates (TID 1500 family). The output is a string containing the SR
content tree, which can be embedded in a full DICOM SR object via
pydicom or a similar library.

This is a v0.1 *stub* — full DICOM-SR generation requires the DICOM Toolkit
(DCMTK) or pydicom and is out of scope for the reference implementation.
The output here is sufficient to demonstrate the conceptual mapping.

Reference: DICOM PS3.16 Structured Reporting (current); RadLex Dental Subset
v4.1 (RSNA 2024) for code values.
"""

from __future__ import annotations

from typing import Any
from xml.sax.saxutils import escape

from parser.core import parse_tooth_layers


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
            lines.append(
                f'        <Code conceptName="Layer" value="{escape(layer.status)}" '
                f'codingScheme="https://github.com/zmeik/oris/grammar/statuses"{surf_attr} />'
            )
        lines.append("      </Container>")
    lines.append("    </Container>")

    # Anatomical landmarks
    if landmarks:
        lines.append('    <Container conceptName="Anatomical Landmarks">')
        for block_name, block_data in landmarks.items():
            if not isinstance(block_data, dict) or not block_data:
                continue
            lines.append(
                f'      <Container conceptName="{escape(block_name)}">'
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
