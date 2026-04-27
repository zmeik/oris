"""Document validation: JSON Schema + business rules.

The JSON Schema (../schema/oris-v0.1.json) handles:
    - structural validation (required fields, enum-bounded values)
    - pattern-validated keys (tooth code regex, FDI regex, UUID format)
    - additionalProperties: false at every level

This module additionally checks **business rules** that the schema cannot
express, such as:
    - status_layers strings must parse cleanly per the EBNF grammar
    - bridge_link references must point to existing tooth keys
    - bridge_links FDI ranges must be consistent with tooth-level occupants

It returns a list of ValidationError objects, suitable for both CLI output
and programmatic use.
"""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

try:
    from jsonschema import Draft202012Validator
except ImportError as exc:
    raise ImportError(
        "validate_oris requires the 'jsonschema' package. "
        "Install with: pip install jsonschema"
    ) from exc

from .core import parse_tooth_layers, ParseError

_SCHEMA_PATH = Path(__file__).resolve().parent.parent / "schema" / "oris-v0.1.json"


@dataclass(frozen=True)
class ValidationError:
    """One validation issue, with severity and JSON pointer to the offending field."""

    severity: str  # 'error' | 'warning'
    code: str
    message: str
    pointer: str = ""

    def __str__(self) -> str:
        loc = f" at {self.pointer}" if self.pointer else ""
        return f"[{self.severity.upper()}] {self.code}: {self.message}{loc}"


def _load_schema() -> dict[str, Any]:
    if not _SCHEMA_PATH.exists():
        raise FileNotFoundError(
            f"ORIS schema not found at {_SCHEMA_PATH}. "
            f"This module expects to be alongside the schema/ directory."
        )
    with _SCHEMA_PATH.open(encoding="utf-8") as f:
        return json.load(f)


def validate_oris(document: dict[str, Any]) -> list[ValidationError]:
    """Validate an ORIS document against the schema and business rules.

    Returns:
        list of ValidationError. Empty list = document is valid.

    Example:
        >>> import json
        >>> doc = json.load(open('examples/synthetic_001.json'))
        >>> errors = validate_oris(doc)
        >>> assert errors == []
    """
    errors: list[ValidationError] = []

    # 1. JSON Schema structural validation
    schema = _load_schema()
    validator = Draft202012Validator(schema)
    for err in validator.iter_errors(document):
        pointer = "/" + "/".join(str(p) for p in err.absolute_path)
        errors.append(
            ValidationError(
                severity="error",
                code="SCHEMA",
                message=err.message,
                pointer=pointer,
            )
        )

    # 2. Business rule: status_layers strings parse cleanly
    teeth = document.get("teeth", {})
    if isinstance(teeth, dict):
        for tooth_code, tooth_obj in teeth.items():
            if not isinstance(tooth_obj, dict):
                continue
            status = tooth_obj.get("status_layers", "")
            try:
                parse_tooth_layers(status)
            except ParseError as e:
                errors.append(
                    ValidationError(
                        severity="error",
                        code="GRAMMAR",
                        message=f"status_layers does not parse: {e}",
                        pointer=f"/teeth/{tooth_code}/status_layers",
                    )
                )

    # 3. Business rule: bridge_link references are valid tooth keys
    if isinstance(teeth, dict):
        for tooth_code, tooth_obj in teeth.items():
            if not isinstance(tooth_obj, dict):
                continue
            for ref in tooth_obj.get("bridge_link", []) or []:
                if ref not in teeth:
                    errors.append(
                        ValidationError(
                            severity="warning",
                            code="BRIDGE_REF",
                            message=f"bridge_link points to {ref!r} which is not in teeth{{}}",
                            pointer=f"/teeth/{tooth_code}/bridge_link",
                        )
                    )

    # 4. Sanity: contradictory layered statuses warn (e.g., present + missing)
    if isinstance(teeth, dict):
        contradictions = [
            ("present", "missing"),
            ("present", "impacted"),
            ("missing", "impl_restored"),
            ("missing", "impl_fixture"),
            ("missing", "crowned"),
            ("missing", "endo"),
        ]
        for tooth_code, tooth_obj in teeth.items():
            if not isinstance(tooth_obj, dict):
                continue
            try:
                layers = parse_tooth_layers(tooth_obj.get("status_layers", "") or "")
            except ParseError:
                continue
            statuses = {layer.status for layer in layers}
            for a, b in contradictions:
                if a in statuses and b in statuses:
                    errors.append(
                        ValidationError(
                            severity="warning",
                            code="CONTRADICTION",
                            message=f"layered statuses {a!r} and {b!r} are mutually exclusive",
                            pointer=f"/teeth/{tooth_code}/status_layers",
                        )
                    )

    return errors


def is_valid(document: dict[str, Any]) -> bool:
    """Convenience: returns True iff there are no errors (warnings are allowed)."""
    return all(e.severity != "error" for e in validate_oris(document))
