#!/usr/bin/env python3
"""
generate_examples.py — produce 30+ synthetic ORIS documents for the repo

Generates deterministic example JSONs that exercise the schema across
demographics, pathology profiles and edge cases. The output lives in
`examples/` and is picked up automatically by
`tests/test_examples_validate.py` (one test per file via parametrize).

Run:
    python3 tools/generate_examples.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
EXAMPLES = REPO_ROOT / "examples"

sys.path.insert(0, str(REPO_ROOT))
from parser.numbering import lookup_oris_from_fdi  # canonical encoder

# 16 upper FDIs (Q2 + Q1) and 16 lower FDIs (Q4 + Q3)
ALL_FDI = (
    [f"1.{i}" for i in range(1, 9)] + [f"2.{i}" for i in range(1, 9)] +
    [f"4.{i}" for i in range(1, 9)] + [f"3.{i}" for i in range(1, 9)]
)

def oris_code(fdi: str, occupant: str) -> str:
    """Use the production encoder so codes match the JSON Schema regex exactly."""
    return lookup_oris_from_fdi(fdi, occupant)


def base_doc(doc_id: str, age: int, sex: str, kvp: int = 70,
             quality: int = 4, label: str = "") -> dict:
    return {
        "$schema": "https://github.com/zmeik/oris/schema/oris-v0.1.json",
        "oris_version": "0.1.0",
        "document_id": doc_id,
        "patient": {
            "anonymized_id": f"P_{doc_id[-4:]}_SYNTHETIC",
            "age_years": age,
            "sex": sex,
        },
        "imaging": {
            "modality": "OPG",
            "device": "Synthetic Reference Device v1",
            "acquisition_date": "2026-01-15T10:30:00Z",
            "kvp": kvp,
            "ma": 12,
            "exposure_seconds": 13.5,
            "image_quality_score": quality,
        },
        "teeth": {},
        "ground_truth_meta": {
            "source": "manual",
            "session_id": f"synth-{doc_id[-4:]}",
            "sequence_num": 1,
        },
        "notes": label,
    }


def add_tooth(doc: dict, fdi: str, status: str, occupant: str = "N",
              surfaces=None) -> None:
    code = oris_code(fdi, occupant)
    entry = {
        "fdi": fdi,
        "occupant": occupant,
        "status_layers": status,
    }
    if surfaces:
        entry["surfaces"] = list(surfaces)
    doc["teeth"][code] = entry


def fill_intact(doc: dict) -> None:
    """All 32 teeth intact (present)."""
    for fdi in ALL_FDI:
        add_tooth(doc, fdi, "present", "N")


def fill_missing(doc: dict) -> None:
    """All 32 teeth missing (edentulous)."""
    for fdi in ALL_FDI:
        add_tooth(doc, fdi, "missing", "A")


# ---------------------------------------------------------------------------
# Variant generators
# ---------------------------------------------------------------------------

def variant_demographics(idx: int, age: int, sex: str, label: str) -> dict:
    """Demographics variant — full intact dentition, just metadata changes."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_demographics", age, sex,
                   label=label)
    fill_intact(doc)
    return doc


def variant_caries_heavy(idx: int) -> dict:
    """Caries-heavy adult. Multiple lesions across both arches."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_caries", 38, "F",
                   label="Caries-heavy adult")
    fill_intact(doc)
    for fdi, surfaces in [
        ("1.6", "od"), ("1.7", "o"), ("2.6", "mod"),
        ("3.6", "od"), ("4.6", "o"), ("4.7", "do"),
    ]:
        add_tooth(doc, fdi, f"caries:{surfaces}", "N", list(surfaces))
    add_tooth(doc, "2.5", "restored:mo+caries:d", "N", ["m", "o", "d"])
    return doc


def variant_endo_heavy(idx: int) -> dict:
    """Endo-heavy adult."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_endo", 52, "M",
                   label="Endo-heavy adult: multiple RCT teeth")
    fill_intact(doc)
    for fdi, surf in [
        ("1.6", "mo"), ("2.5", "od"), ("3.6", "o"),
        ("4.5", "od"), ("4.7", "mo"),
    ]:
        add_tooth(doc, fdi, f"endo:{surf}+post+crowned", "N", list(surf))
    return doc


def variant_implants_heavy(idx: int) -> dict:
    """Multiple implants pattern."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_implants", 60, "M",
                   label="Multi-implant adult: 6 implants restored")
    fill_intact(doc)
    for fdi in ["1.4", "1.5", "1.6", "2.5", "2.6", "4.5"]:
        add_tooth(doc, fdi, "impl_restored", "F")
    return doc


def variant_full_arch_prosthesis(idx: int) -> dict:
    """All-on-X full-arch prosthesis."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_full_arch", 68, "F",
                   label="Full-arch fixed prosthesis on 4 implants per jaw")
    for fdi in ALL_FDI:
        if fdi in ["1.6", "1.3", "2.3", "2.6"]:
            add_tooth(doc, fdi, "impl_restored", "F")
        elif fdi in ["3.6", "3.3", "4.3", "4.6"]:
            add_tooth(doc, fdi, "impl_restored", "F")
        elif fdi[0] in "12":
            add_tooth(doc, fdi, "bridge", "B")
        else:
            add_tooth(doc, fdi, "bridge", "B")
    return doc


def variant_periapical_lesions(idx: int) -> dict:
    """Multiple periapical lesions on endo-treated teeth (PAI scoring is in
    notes; the schema's root_data block carries Vertucci canal classification
    and root variant only — PAI is encoded in tooth-level notes for v0.1)."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_periapical", 47, "M",
                   label="Periapical lesions on multiple endo-treated teeth")
    fill_intact(doc)
    for fdi, surf, variant, vert in [
        ("1.6", "mo", "3r", {"0": "II", "1": "I", "2": "I"}),
        ("3.6", "o",  "2r", {"0": "II", "1": "I"}),
        ("4.5", "od", "1r", {"0": "I"}),
    ]:
        code = oris_code(fdi, "N")
        doc["teeth"][code] = {
            "fdi": fdi,
            "occupant": "N",
            "status_layers": f"endo:{surf}+restored",
            "surfaces": list(surf),
            "root_data": {
                "variant": variant,
                "vertucci": vert,
            },
        }
    return doc


def variant_mixed_dentition(idx: int) -> dict:
    """Pediatric mixed dentition (ages 6-12)."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_mixed", 8, "F",
                   label="Mixed dentition, child age 8")
    # Pretend half the deciduous teeth are still in place, half exfoliated
    for fdi in ALL_FDI:
        n = int(fdi[-1])
        if n in (1, 2, 3):
            add_tooth(doc, fdi, "present", "N")    # erupting permanent
        elif n in (6, 7):
            add_tooth(doc, fdi, "impacted", "N")   # not yet erupted
        elif n == 8:
            add_tooth(doc, fdi, "missing", "A")    # wisdom not formed
        else:
            add_tooth(doc, fdi, "present", "N")
    return doc


def variant_attrition_elderly(idx: int) -> dict:
    """Severe attrition, elderly patient."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_attrition", 75, "M",
                   label="Elderly: severe attrition + selective tooth loss")
    fill_intact(doc)
    for fdi in ALL_FDI:
        if int(fdi[-1]) in (8, 7):
            add_tooth(doc, fdi, "missing", "A")
        elif int(fdi[-1]) in (4, 5, 6):
            add_tooth(doc, fdi, "attrition+restored:o", "N", ["o"])
    return doc


def variant_orthodontic(idx: int) -> dict:
    """Orthodontic patient with brackets (note in tooth_notes only)."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_orthodontic", 16, "F",
                   label="Orthodontic case with full bracket appliance")
    fill_intact(doc)
    return doc


def variant_root_remnants(idx: int) -> dict:
    """Several root remnants."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_root_remnants", 64, "M",
                   label="Multiple root remnants requiring extraction planning")
    fill_intact(doc)
    for fdi in ["1.6", "2.6", "3.6", "4.6"]:
        add_tooth(doc, fdi, "root", "R")
    for fdi in ["1.7", "2.7"]:
        add_tooth(doc, fdi, "missing", "A")
    return doc


def variant_bridge_zones(idx: int) -> dict:
    """Conventional bridge spans."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_bridge", 55, "F",
                   label="Two conventional bridges, 3-unit each")
    fill_intact(doc)
    add_tooth(doc, "1.4", "crowned", "N")            # abutment
    add_tooth(doc, "1.5", "bridge", "B")             # pontic
    add_tooth(doc, "1.6", "crowned", "N")            # abutment
    add_tooth(doc, "3.5", "crowned", "N")
    add_tooth(doc, "3.6", "bridge", "B")
    add_tooth(doc, "3.7", "crowned", "N")
    return doc


def variant_uncertain_only(idx: int) -> dict:
    """Edge case: image quality so low everything is `uncertain`."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_low_quality", 50, "U",
                   quality=1, label="Severely degraded image — uncertain everywhere")
    for fdi in ALL_FDI:
        add_tooth(doc, fdi, "uncertain", "U")
    return doc


def variant_empty(idx: int) -> dict:
    """Edge case: empty document — no teeth annotated."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_empty", 30, "M",
                   label="Empty annotation (test of degenerate case)")
    return doc


def variant_single_tooth(idx: int, fdi: str, status: str,
                         occupant: str = "N") -> dict:
    """Single-tooth examples — one annotated tooth, rest unannotated.
    Useful as fixture for unit tests of isolated statuses."""
    doc = base_doc(f"SYNTHETIC_OPG_{idx:03d}_single_{fdi.replace('.','')}",
                   40, "M",
                   label=f"Isolated tooth {fdi} = {status} (test fixture)")
    add_tooth(doc, fdi, status, occupant)
    return doc


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    docs: list[dict] = []

    # 4 demographic intact variants
    docs.append(variant_demographics(10, 25, "M", "Young adult, intact dentition"))
    docs.append(variant_demographics(11, 35, "F", "Adult female, intact dentition"))
    docs.append(variant_demographics(12, 55, "M", "Adult male, intact dentition"))
    docs.append(variant_demographics(13, 70, "F", "Senior, intact dentition baseline"))

    # 9 pathology / treatment profile variants
    docs.append(variant_caries_heavy(20))
    docs.append(variant_endo_heavy(21))
    docs.append(variant_implants_heavy(22))
    docs.append(variant_full_arch_prosthesis(23))
    docs.append(variant_periapical_lesions(24))
    docs.append(variant_mixed_dentition(25))
    docs.append(variant_attrition_elderly(26))
    docs.append(variant_orthodontic(27))
    docs.append(variant_root_remnants(28))
    docs.append(variant_bridge_zones(29))

    # 2 edge cases
    docs.append(variant_uncertain_only(30))
    docs.append(variant_empty(31))

    # 9 single-tooth fixtures (one per representative status)
    fixtures = [
        ("1.6", "endo:mo+post+crowned", "N"),
        ("1.6", "impl_restored", "F"),
        ("1.7", "caries:od", "N"),
        ("2.5", "restored:mo", "N"),
        ("3.6", "missing", "A"),
        ("3.8", "impacted", "N"),
        ("1.6", "root", "R"),
        ("1.5", "bridge", "B"),
        ("4.6", "endo:mod+post+crowned+caries:d", "N"),
    ]
    for i, (fdi, status, occ) in enumerate(fixtures, start=40):
        docs.append(variant_single_tooth(i, fdi, status, occ))

    # Write all
    written = 0
    for doc in docs:
        path = EXAMPLES / f"{doc['document_id'].lower()}.json"
        path.write_text(json.dumps(doc, ensure_ascii=False, indent=2),
                        encoding="utf-8")
        written += 1
        print(f"  ✓ {path.relative_to(REPO_ROOT)}")

    print(f"\nGenerated {written} examples → examples/")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
