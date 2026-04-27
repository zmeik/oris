"""Tests for oris.parser.validate."""

import json
from pathlib import Path

import pytest

from parser.validate import validate_oris, is_valid

EXAMPLES_DIR = Path(__file__).resolve().parent.parent / "examples"


@pytest.mark.parametrize(
    "example_file",
    [
        "synthetic_001.json",
        "synthetic_002.json",
        "synthetic_003_pediatric.json",
    ],
)
def test_synthetic_examples_validate(example_file):
    """All shipped synthetic examples must validate cleanly (no errors)."""
    doc = json.loads((EXAMPLES_DIR / example_file).read_text(encoding="utf-8"))
    errors = validate_oris(doc)
    fatal = [e for e in errors if e.severity == "error"]
    assert fatal == [], f"validation errors in {example_file}: {fatal}"


def test_minimal_document_validates():
    """A minimal valid document should validate."""
    doc = {
        "oris_version": "0.1.0",
        "document_id": "MINIMAL_TEST_001",
        "imaging": {
            "modality": "OPG",
            "acquisition_date": "2026-01-01T00:00:00Z",
        },
        "teeth": {
            "URCPIN": {"fdi": "1.1", "occupant": "N", "status_layers": "present"}
        },
    }
    errors = validate_oris(doc)
    assert all(e.severity != "error" for e in errors)
    assert is_valid(doc)


def test_invalid_status_in_layers_caught():
    """A bogus status_layers value should produce a GRAMMAR error."""
    doc = {
        "oris_version": "0.1.0",
        "document_id": "BAD_GRAMMAR_001",
        "imaging": {
            "modality": "OPG",
            "acquisition_date": "2026-01-01T00:00:00Z",
        },
        "teeth": {
            "URCPIN": {
                "fdi": "1.1",
                "occupant": "N",
                "status_layers": "this_is_not_a_status",
            }
        },
    }
    errors = validate_oris(doc)
    grammar_errors = [e for e in errors if e.code == "GRAMMAR"]
    assert grammar_errors, "expected GRAMMAR error for invalid status"


def test_contradictory_layers_warn():
    """`present + missing` should produce a CONTRADICTION warning."""
    doc = {
        "oris_version": "0.1.0",
        "document_id": "CONTRADICTION_001",
        "imaging": {
            "modality": "OPG",
            "acquisition_date": "2026-01-01T00:00:00Z",
        },
        "teeth": {
            "URCPIN": {
                "fdi": "1.1",
                "occupant": "N",
                "status_layers": "present+missing",
            }
        },
    }
    errors = validate_oris(doc)
    contradictions = [e for e in errors if e.code == "CONTRADICTION"]
    assert contradictions, "expected CONTRADICTION warning"
    # Document is still valid (warnings don't fail is_valid)
    assert is_valid(doc)


def test_missing_required_field_caught():
    """Missing `oris_version` should produce a SCHEMA error."""
    doc = {
        # "oris_version" missing
        "document_id": "MISSING_VERSION_001",
        "imaging": {
            "modality": "OPG",
            "acquisition_date": "2026-01-01T00:00:00Z",
        },
        "teeth": {},
    }
    errors = validate_oris(doc)
    schema_errors = [e for e in errors if e.code == "SCHEMA"]
    assert schema_errors


def test_bridge_link_to_unknown_tooth_warns():
    """A bridge_link pointing to a tooth not in `teeth{}` should warn."""
    doc = {
        "oris_version": "0.1.0",
        "document_id": "BRIDGE_REF_001",
        "imaging": {
            "modality": "OPG",
            "acquisition_date": "2026-01-01T00:00:00Z",
        },
        "teeth": {
            "URCPIN": {
                "fdi": "1.1",
                "occupant": "N",
                "status_layers": "bridge",
                "bridge_link": ["LLLPIN"],  # not in teeth{}
            }
        },
    }
    errors = validate_oris(doc)
    bridge_warnings = [e for e in errors if e.code == "BRIDGE_REF"]
    assert bridge_warnings
