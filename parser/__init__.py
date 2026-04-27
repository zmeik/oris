"""ORIS — Open Radiographic Imaging Schema for Dental Panoramic Reports.

Reference Python implementation of the ORIS v0.1 specification.

Public API:
    parse_tooth_layers(raw)        -> list[Layer]
    encode_tooth_layers(layers)    -> str
    derive_numbering(oris_code)    -> dict
    validate_oris(document)        -> list[ValidationError]
    compute_kappa(doc_a, doc_b)    -> float

Schema and grammar specifications: see ../schema/, ../grammar/, ../numbering/.
Bridges to FHIR / DICOM-SR / MIS: see ../bridges/.
"""

from .core import Layer, parse_tooth_layers, encode_tooth_layers, ParseError
from .numbering import derive_numbering, lookup_oris_from_fdi, NumberingError
from .validate import validate_oris, ValidationError
from .kappa import compute_kappa, KappaError

__version__ = "0.1.0"
__all__ = [
    "Layer",
    "parse_tooth_layers",
    "encode_tooth_layers",
    "ParseError",
    "derive_numbering",
    "lookup_oris_from_fdi",
    "NumberingError",
    "validate_oris",
    "ValidationError",
    "compute_kappa",
    "KappaError",
]
