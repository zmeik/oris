"""Bridge from ORIS to HL7 FHIR Dental Data Exchange.

Produces a FHIR R4 Bundle containing:
    - one DiagnosticReport (the OPG report)
    - one Observation per non-empty tooth finding (component-style)
    - one Observation per non-empty anatomical landmark
    - one Observation per pathology entry
    - one ImagingStudy resource referencing the OPG

The output is a plain Python dict (FHIR JSON representation), suitable for
serialisation with json.dumps. It is NOT validated by this module — the
optional [fhir] extras (`pip install oris[fhir]`) provide stricter validation
via the `fhir.resources` library.

Reference: HL7 FHIR Dental Data Exchange Implementation Guide v2.0.0 (2024).
"""

from __future__ import annotations

from typing import Any
from uuid import uuid4

from parser.core import parse_tooth_layers, primary_status


def to_fhir(oris_doc: dict[str, Any]) -> dict[str, Any]:
    """Convert an ORIS document to a FHIR R4 Bundle.

    Returns:
        FHIR R4 Bundle (Python dict). Serialise with json.dumps for transport.
    """
    bundle: dict[str, Any] = {
        "resourceType": "Bundle",
        "type": "collection",
        "meta": {
            "tag": [
                {
                    "system": "https://github.com/zmeik/oris",
                    "code": "ORIS-v0.1",
                    "display": "Sourced from ORIS v0.1 document",
                }
            ]
        },
        "entry": [],
    }

    patient_id = (oris_doc.get("patient") or {}).get(
        "anonymized_id", "patient-unknown"
    )
    document_id = oris_doc.get("document_id", str(uuid4()))
    imaging = oris_doc.get("imaging", {}) or {}

    # 1. Patient resource (minimal, opaque)
    bundle["entry"].append(
        {
            "fullUrl": f"urn:uuid:patient-{patient_id}",
            "resource": {
                "resourceType": "Patient",
                "id": patient_id,
                "active": True,
                # NOTE: no `name`, `birthDate`, `address`, `telecom` — keep PII out.
            },
        }
    )

    # 2. ImagingStudy resource
    bundle["entry"].append(
        {
            "fullUrl": f"urn:uuid:study-{document_id}",
            "resource": {
                "resourceType": "ImagingStudy",
                "id": document_id,
                "status": "available",
                "subject": {"reference": f"urn:uuid:patient-{patient_id}"},
                "started": imaging.get("acquisition_date"),
                "modality": [
                    {
                        "system": "http://dicom.nema.org/resources/ontology/DCM",
                        "code": "PX",  # Panoramic X-ray
                        "display": "Panoramic X-Ray",
                    }
                ],
                "description": "Panoramic dental radiograph (OPG)",
            },
        }
    )

    # 3. DiagnosticReport (the OPG report itself)
    diag_report_id = f"oris-{document_id}"
    diag_report: dict[str, Any] = {
        "resourceType": "DiagnosticReport",
        "id": diag_report_id,
        "status": "final",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                        "code": "RAD",
                        "display": "Radiology",
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "39061-4",
                    "display": "Panoramic radiograph dental",
                }
            ]
        },
        "subject": {"reference": f"urn:uuid:patient-{patient_id}"},
        "effectiveDateTime": imaging.get("acquisition_date"),
        "imagingStudy": [{"reference": f"urn:uuid:study-{document_id}"}],
        "result": [],
    }

    # 4. Per-tooth Observations
    teeth = oris_doc.get("teeth", {}) or {}
    for tooth_code, tooth_obj in teeth.items():
        if not isinstance(tooth_obj, dict):
            continue
        layers_str = tooth_obj.get("status_layers", "") or ""
        if not layers_str and tooth_obj.get("occupant", "U") in ("U",):
            continue

        try:
            layers = parse_tooth_layers(layers_str)
        except Exception:
            layers = []
        primary = primary_status(layers) or "unspecified"

        obs_id = f"obs-tooth-{tooth_code}-{uuid4().hex[:8]}"
        obs: dict[str, Any] = {
            "resourceType": "Observation",
            "id": obs_id,
            "status": "final",
            "category": [
                {
                    "coding": [
                        {
                            "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                            "code": "imaging",
                        }
                    ]
                }
            ],
            "code": {
                "coding": [
                    {
                        "system": "https://github.com/zmeik/oris/grammar/statuses",
                        "code": primary,
                        "display": f"ORIS primary status: {primary}",
                    }
                ]
            },
            "subject": {"reference": f"urn:uuid:patient-{patient_id}"},
            "effectiveDateTime": imaging.get("acquisition_date"),
            "bodySite": {
                "coding": [
                    {
                        "system": "https://github.com/zmeik/oris/numbering",
                        "code": tooth_code,
                        "display": tooth_obj.get("anatomical")
                        or f"ORIS {tooth_code}",
                    },
                    {
                        "system": "https://www.iso.org/standard/68663.html",
                        "code": tooth_obj.get("fdi", ""),
                        "display": f"FDI {tooth_obj.get('fdi', '?')}",
                    },
                ]
            },
            "valueString": layers_str,
            "component": [],
        }
        # Add per-layer components
        for layer in layers:
            obs["component"].append(
                {
                    "code": {
                        "coding": [
                            {
                                "system": "https://github.com/zmeik/oris/grammar/statuses",
                                "code": layer.status,
                            }
                        ]
                    },
                    "valueString": (
                        f"surfaces:{''.join(layer.surfaces)}"
                        if layer.surfaces
                        else "no-surface-qualifier"
                    ),
                }
            )

        bundle["entry"].append(
            {"fullUrl": f"urn:uuid:{obs_id}", "resource": obs}
        )
        diag_report["result"].append({"reference": f"urn:uuid:{obs_id}"})

    # 5. Anatomical landmarks → one Observation per non-empty block
    landmarks = oris_doc.get("anatomical_landmarks", {}) or {}
    for block_name, block_data in landmarks.items():
        if not isinstance(block_data, dict) or not block_data:
            continue
        obs_id = f"obs-anatomy-{block_name}-{uuid4().hex[:8]}"
        bundle["entry"].append(
            {
                "fullUrl": f"urn:uuid:{obs_id}",
                "resource": {
                    "resourceType": "Observation",
                    "id": obs_id,
                    "status": "final",
                    "category": [
                        {
                            "coding": [
                                {
                                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                    "code": "imaging",
                                }
                            ]
                        }
                    ],
                    "code": {
                        "coding": [
                            {
                                "system": "https://github.com/zmeik/oris/anatomy/landmarks",
                                "code": block_name,
                            }
                        ]
                    },
                    "subject": {"reference": f"urn:uuid:patient-{patient_id}"},
                    "effectiveDateTime": imaging.get("acquisition_date"),
                    "valueString": str(block_data),
                },
            }
        )
        diag_report["result"].append({"reference": f"urn:uuid:{obs_id}"})

    # 6. Pathology array → one Observation each
    for path_finding in oris_doc.get("pathology", []) or []:
        if not isinstance(path_finding, dict):
            continue
        obs_id = f"obs-pathology-{uuid4().hex[:8]}"
        bundle["entry"].append(
            {
                "fullUrl": f"urn:uuid:{obs_id}",
                "resource": {
                    "resourceType": "Observation",
                    "id": obs_id,
                    "status": "final",
                    "category": [
                        {
                            "coding": [
                                {
                                    "system": "http://terminology.hl7.org/CodeSystem/observation-category",
                                    "code": "imaging",
                                }
                            ]
                        }
                    ],
                    "code": {
                        "coding": [
                            {
                                "system": "https://github.com/zmeik/oris/pathology",
                                "code": path_finding.get("type", "unspecified"),
                            }
                        ]
                    },
                    "subject": {"reference": f"urn:uuid:patient-{patient_id}"},
                    "effectiveDateTime": imaging.get("acquisition_date"),
                    "valueString": str(path_finding),
                },
            }
        )
        diag_report["result"].append({"reference": f"urn:uuid:{obs_id}"})

    # Insert DiagnosticReport last so all Observations precede it for clarity
    bundle["entry"].append(
        {
            "fullUrl": f"urn:uuid:diagreport-{document_id}",
            "resource": diag_report,
        }
    )

    return bundle
