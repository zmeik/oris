"""Bridges from ORIS to other dental / radiology standards.

Public API:
    to_fhir(oris_doc)         -> dict   (FHIR DiagnosticReport + Observation bundle)
    to_dicom_sr(oris_doc)     -> str    (DICOM Structured Report XML stub)
    to_mis_chart(oris_doc)    -> dict   (flat dental chart for MIS / EHR systems)
    to_mmoral_format(oris_doc) -> dict  (mapping to MMOral-OPG-Bench 8-class taxonomy)

Each bridge is best-effort — it produces a structurally correct artefact for
the target standard, with the caveat that finer-grained semantic alignment
across standards is an active area of research and may require institutional
mapping rules.
"""

from .fhir import to_fhir
from .dicom_sr import to_dicom_sr
from .mis import to_mis_chart
from .mmoral import to_mmoral_format

__all__ = [
    "to_fhir",
    "to_dicom_sr",
    "to_mis_chart",
    "to_mmoral_format",
]
