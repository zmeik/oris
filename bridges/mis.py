"""Bridge from ORIS to a flat dental chart suitable for Medical Information
Systems (MIS / EHR).

Most MIS-style dental charts represent each tooth as a single row keyed by
FDI number, with a small set of categorical fields. This bridge flattens an
ORIS document accordingly, while preserving the ORIS code as a back-reference.

This is a *suggested* mapping. Real MIS systems vary; deployers should adapt
the field names and categories to their target system.
"""

from __future__ import annotations

from typing import Any

from parser.core import parse_tooth_layers, primary_status, aggregated_surfaces


def to_mis_chart(oris_doc: dict[str, Any]) -> dict[str, Any]:
    """Flatten an ORIS document to a chart-style dict keyed by FDI.

    Returns:
        {
          "patient_id": str,
          "acquisition_date": str,
          "chart": {
            "1.1": {
                "oris_code": "URCPIN",
                "occupant": "N",
                "occupant_name": "Natural",
                "primary_status": "present",
                "surfaces": ["m", "o"],   # aggregated across all layers
                "status_layers": "endo:mo+post+crowned",
                "notes": "...",
                "confidence": 0.94,
                "source": "ORIS_v0.1_auto"
            },
            ...
          },
          "anatomy_summary": [...],
          "pathology_summary": [...]
        }
    """
    patient_obj = oris_doc.get("patient", {}) or {}
    chart: dict[str, Any] = {}

    teeth = oris_doc.get("teeth", {}) or {}
    notes = oris_doc.get("tooth_notes", {}) or {}
    confidences = oris_doc.get("confidence", {}) or {}

    occupant_names = {
        "N": "Natural",
        "F": "Fixture (implant)",
        "T": "Transplant",
        "B": "Bridge pontic (conventional)",
        "D": "Denture tooth",
        "H": "Hybrid prosthesis",
        "O": "Overdenture support",
        "A": "Absent",
        "R": "Root remnant",
        "S": "Supernumerary",
        "U": "Unknown",
        "C": "Cantilever pontic",
        "M": "Maryland-bonded retainer",
        "I": "Inlay/onlay-bonded retainer",
    }

    for tooth_code, tooth_obj in teeth.items():
        if not isinstance(tooth_obj, dict):
            continue
        fdi = tooth_obj.get("fdi")
        if not fdi:
            continue
        layers_str = tooth_obj.get("status_layers", "") or ""
        try:
            layers = parse_tooth_layers(layers_str)
        except Exception:
            layers = []
        chart[fdi] = {
            "oris_code": tooth_code,
            "occupant": tooth_obj.get("occupant", "U"),
            "occupant_name": occupant_names.get(
                tooth_obj.get("occupant", "U"), "Unknown"
            ),
            "primary_status": primary_status(layers) or "unspecified",
            "surfaces": list(aggregated_surfaces(layers)),
            "status_layers": layers_str,
            "notes": notes.get(fdi, ""),
            "confidence": confidences.get(fdi),
            "source": "ORIS_v0.1_auto",
        }

    # Anatomy summary — flatten the 9 landmark blocks into a list of
    # {block, side, finding} entries for chart annotation purposes.
    anatomy_summary: list[dict[str, Any]] = []
    landmarks = oris_doc.get("anatomical_landmarks", {}) or {}
    for block_name, block_data in landmarks.items():
        if not isinstance(block_data, dict):
            continue
        for field_name, field_value in block_data.items():
            if field_value in (None, "", False):
                continue
            anatomy_summary.append(
                {
                    "block": block_name,
                    "field": field_name,
                    "value": field_value,
                }
            )

    # Pathology summary
    pathology_summary: list[dict[str, Any]] = []
    for finding in oris_doc.get("pathology", []) or []:
        if not isinstance(finding, dict):
            continue
        pathology_summary.append(
            {
                "type": finding.get("type", "unspecified"),
                "fdi": finding.get("fdi"),
                "side": finding.get("side"),
                "size_mm": finding.get("size_mm"),
                "icd10_candidate": finding.get("icd10_candidate"),
            }
        )

    return {
        "patient_id": patient_obj.get("anonymized_id", "unknown"),
        "acquisition_date": (oris_doc.get("imaging") or {}).get("acquisition_date"),
        "chart": chart,
        "anatomy_summary": anatomy_summary,
        "pathology_summary": pathology_summary,
    }
