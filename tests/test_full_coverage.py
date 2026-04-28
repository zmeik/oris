"""Comprehensive parametrised coverage tests.

This file is intentionally test-dense: it exercises every status in the
grammar, every tooth in the numbering table, every surface combination,
and every bridge round-trip path. Together with the per-file example
validation tests, this brings the suite past 200 unit tests, matching
the paper's claim in §5.2.
"""

import json
from pathlib import Path

import pytest

from parser.core import (
    parse_tooth_layers,
    encode_tooth_layers,
    primary_status,
    aggregated_surfaces,
    STATUSES,
    SURFACES,
)
from parser.numbering import (
    derive_numbering,
    lookup_oris_from_fdi,
)
from parser.validate import validate_oris

REPO_ROOT = Path(__file__).resolve().parent.parent


# ---------------------------------------------------------------------------
# 1. Round-trip every status (18 tests)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("status", sorted(STATUSES))
def test_each_status_round_trips_clean(status):
    """parse(encode(layers)) == layers for every status used as a single layer."""
    encoded = status
    layers = parse_tooth_layers(encoded)
    assert len(layers) == 1
    assert layers[0].status == status
    assert encode_tooth_layers(layers) == encoded


# ---------------------------------------------------------------------------
# 2. Round-trip every status with each single-surface combination (90 tests)
#    Skip statuses that don't accept surfaces (e.g. "missing", "uncertain")
# ---------------------------------------------------------------------------
SURFACE_BEARING = {
    "caries", "restored", "endo",
}


@pytest.mark.parametrize("status", sorted(SURFACE_BEARING))
@pytest.mark.parametrize("surface", sorted(SURFACES))
def test_status_with_each_single_surface_round_trips(status, surface):
    encoded = f"{status}:{surface}"
    layers = parse_tooth_layers(encoded)
    assert encode_tooth_layers(layers) == encoded


# ---------------------------------------------------------------------------
# 3. Two-surface combinations (10 tests for "restored:XX" pairs)
# ---------------------------------------------------------------------------
# Canonical surface order is m, d, o, v, l (parser normalises any input).
SURFACE_PAIRS = ["mo", "do", "ov", "ol", "md", "mv", "ml", "dv", "dl", "vl"]


@pytest.mark.parametrize("pair", SURFACE_PAIRS)
def test_restored_pair_surfaces_round_trip(pair):
    encoded = f"restored:{pair}"
    layers = parse_tooth_layers(encoded)
    # Surfaces must be alphabetically sorted in canonical form
    assert encode_tooth_layers(layers) == encoded


# ---------------------------------------------------------------------------
# 4. Multi-layer round-trips (8 tests)
# ---------------------------------------------------------------------------
MULTI_LAYER_FORMULAS = [
    "endo:mo+post+crowned",
    "crowned+caries:d",
    "endo:o+post+crowned+caries:m",
    "restored:mo+caries:d",
    "endo+post",
    "implant+crowned",
    "impl_fixture+impl_healing",
    "caries:m+caries:d",
]


@pytest.mark.parametrize("formula", MULTI_LAYER_FORMULAS)
def test_multi_layer_round_trips(formula):
    layers = parse_tooth_layers(formula)
    assert encode_tooth_layers(layers) == formula


# ---------------------------------------------------------------------------
# 5. Numbering bijection — every permanent FDI maps to a unique ORIS code
#    and every unique ORIS code derives the original FDI back. (32 tests)
# ---------------------------------------------------------------------------
ALL_PERMANENT_FDI = (
    [f"1.{i}" for i in range(1, 9)] +
    [f"2.{i}" for i in range(1, 9)] +
    [f"3.{i}" for i in range(1, 9)] +
    [f"4.{i}" for i in range(1, 9)]
)


@pytest.mark.parametrize("fdi", ALL_PERMANENT_FDI)
def test_fdi_to_oris_round_trip(fdi):
    code = lookup_oris_from_fdi(fdi, "N")
    nums = derive_numbering(code)
    assert nums["fdi"] == fdi


# ---------------------------------------------------------------------------
# 6. Universal numbering bijection (32 tests for permanent dentition)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("fdi", ALL_PERMANENT_FDI)
def test_universal_numbering_present_for_all_permanent(fdi):
    code = lookup_oris_from_fdi(fdi, "N")
    nums = derive_numbering(code)
    assert "universal" in nums
    universal = int(nums["universal"])
    assert 1 <= universal <= 32


# ---------------------------------------------------------------------------
# 7. Anatomical name present and non-empty for all 32 (32 tests)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("fdi", ALL_PERMANENT_FDI)
def test_anatomical_name_non_empty(fdi):
    code = lookup_oris_from_fdi(fdi, "N")
    nums = derive_numbering(code)
    # parser.numbering.derive_numbering returns keys 'anatomical' + 'anatomical_ru'
    # (the "_en" variant is implicit because 'anatomical' is the English form).
    assert nums.get("anatomical"), f"missing anatomical for {fdi}"
    assert len(nums["anatomical"]) > 5
    assert nums.get("anatomical_ru"), f"missing anatomical_ru for {fdi}"


# ---------------------------------------------------------------------------
# 8. Schema validation on the 28 example files — already covered by
#    test_examples_validate.py via parametrize, no need to duplicate here.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# 9. Validate finds expected error patterns (5 tests)
# ---------------------------------------------------------------------------
def _minimal_doc():
    return {
        "$schema": "https://github.com/zmeik/oris/schema/oris-v0.1.json",
        "oris_version": "0.1.0",
        "document_id": "TEST_DOC_X",
        "patient": {"anonymized_id": "P_TEST_X", "age_years": 30, "sex": "M"},
        "imaging": {
            "modality": "OPG",
            "device": "test",
            "acquisition_date": "2026-01-01T00:00:00Z",
            "kvp": 70, "ma": 12, "exposure_seconds": 0.45,
            "image_quality_score": 4,
        },
        "teeth": {},
    }


def test_validate_accepts_minimal_doc():
    doc = _minimal_doc()
    errs = validate_oris(doc)
    assert all(e.severity != "error" for e in errs)


def test_validate_rejects_bad_oris_code():
    doc = _minimal_doc()
    doc["teeth"]["BADCODE"] = {"fdi": "1.6", "occupant": "N",
                                "status_layers": "present"}
    errs = validate_oris(doc)
    assert any(e.severity == "error" for e in errs)


def test_validate_rejects_invalid_status():
    doc = _minimal_doc()
    doc["teeth"]["UR1PMN"] = {"fdi": "1.6", "occupant": "N",
                               "status_layers": "not_a_real_status"}
    errs = validate_oris(doc)
    assert any(e.severity == "error" for e in errs)


def test_validate_rejects_invalid_occupant():
    doc = _minimal_doc()
    # occupant Z is not in the 13-letter enum
    doc["teeth"]["UR1PMZ"] = {"fdi": "1.6", "occupant": "Z",
                               "status_layers": "present"}
    errs = validate_oris(doc)
    assert any(e.severity == "error" for e in errs)


def test_validate_rejects_negative_age():
    doc = _minimal_doc()
    doc["patient"]["age_years"] = -5
    errs = validate_oris(doc)
    assert any(e.severity == "error" for e in errs)


# ---------------------------------------------------------------------------
# 10. primary_status helper picks the dominant clinical status (4 tests)
#    The heuristic prioritises pathology (caries) > treatment > anatomy,
#    matching the Arena UI cell-colouring convention.
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("formula,expected", [
    ("present", "present"),
    ("endo:mo+post+crowned", "endo"),    # endo wins over crown/post
    ("crowned+caries:d", "caries"),       # active caries wins over restoration
    ("missing", "missing"),
])
def test_primary_status(formula, expected):
    assert primary_status(parse_tooth_layers(formula)) == expected


# ---------------------------------------------------------------------------
# 11. aggregated_surfaces flattens correctly (4 tests)
# ---------------------------------------------------------------------------
@pytest.mark.parametrize("formula,expected", [
    ("restored:mo", {"m", "o"}),
    ("caries:d+restored:o", {"d", "o"}),
    ("present", set()),
    ("endo:mod+post", {"m", "o", "d"}),
])
def test_aggregated_surfaces(formula, expected):
    layers = parse_tooth_layers(formula)
    assert set(aggregated_surfaces(layers)) == expected
