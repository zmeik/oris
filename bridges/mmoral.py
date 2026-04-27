"""Bridge from ORIS to the MMOral-OPG-Bench 8-class taxonomy.

MMOral-OPG-Bench (Hao et al., NeurIPS Datasets and Benchmarks Track, 2025;
arXiv:2509.09254) is a benchmark for AI-assisted panoramic radiograph
analysis with 8 finding categories per tooth × 32 teeth.

This bridge maps the ORIS layered status per tooth onto the 8-category
binary label vector expected by MMOral-OPG-Bench evaluation scripts.

The 8 categories (per the MMOral-OPG-Bench taxonomy):
    1. caries           — carious lesion
    2. crown            — full coverage restoration
    3. filling          — direct restoration
    4. endo             — endodontic treatment
    5. implant          — endosseous implant
    6. impacted         — impacted tooth
    7. missing          — absent tooth
    8. apical_lesion    — periapical pathology
"""

from __future__ import annotations

from typing import Any

from parser.core import parse_tooth_layers


MMORAL_CATEGORIES: tuple[str, ...] = (
    "caries",
    "crown",
    "filling",
    "endo",
    "implant",
    "impacted",
    "missing",
    "apical_lesion",
)


# Map ORIS layer status → MMOral category(ies). One status can produce
# 0, 1, or 2 MMOral category flags.
_STATUS_TO_MMORAL: dict[str, tuple[str, ...]] = {
    "caries": ("caries",),
    "crowned": ("crown",),
    "restored": ("filling",),
    "endo": ("endo",),
    "implant": ("implant",),
    "impl_fixture": ("implant",),
    "impl_healing": ("implant",),
    "impl_restored": ("implant", "crown"),  # implant with final crown counts as both
    "impacted": ("impacted",),
    "missing": ("missing",),
    "root": ("missing",),  # root remnant counts as effectively missing tooth
    # Statuses with no MMOral counterpart:
    "present": (),
    "post": (),
    "bridge": (),
    "bar": (),
    "cantilever": (),
    "uncertain": (),
}


def to_mmoral_format(oris_doc: dict[str, Any]) -> dict[str, Any]:
    """Convert an ORIS document to the MMOral-OPG-Bench evaluation format.

    Returns:
        {
            "document_id": str,
            "labels": {
                "1.1": {"caries": 0, "crown": 0, ..., "apical_lesion": 0},
                "1.2": {...},
                ...
            }
        }

    Each FDI position has 8 binary flags. ORIS layered findings are decomposed
    into one or more MMOral categories per the _STATUS_TO_MMORAL map. The
    `apical_lesion` flag is set if `root_data.periapical[*].pai >= 3` (PAI
    grades 3-5 indicate visible periapical lesions per Ørstavik 1986).
    """
    teeth = oris_doc.get("teeth", {}) or {}
    labels: dict[str, dict[str, int]] = {}

    # Initialise all 32 permanent FDI positions with all-zero labels.
    for quadrant in (1, 2, 3, 4):
        for pos in range(1, 9):
            labels[f"{quadrant}.{pos}"] = {cat: 0 for cat in MMORAL_CATEGORIES}

    for tooth_code, tooth_obj in teeth.items():
        if not isinstance(tooth_obj, dict):
            continue
        fdi = tooth_obj.get("fdi")
        if not fdi or fdi not in labels:
            continue
        # Layered statuses
        layers_str = tooth_obj.get("status_layers", "") or ""
        try:
            layers = parse_tooth_layers(layers_str)
        except Exception:
            continue
        for layer in layers:
            for cat in _STATUS_TO_MMORAL.get(layer.status, ()):
                labels[fdi][cat] = 1

        # Occupant-based: if A (Absent) or R (Root remnant), mark missing
        if tooth_obj.get("occupant") in ("A", "R"):
            labels[fdi]["missing"] = 1

        # Apical lesion from root_data
        root_data = tooth_obj.get("root_data") or {}
        periapical = root_data.get("periapical", {}) or {}
        for _root_idx, pai_obj in periapical.items():
            if isinstance(pai_obj, dict):
                pai_grade = pai_obj.get("pai")
                if isinstance(pai_grade, int) and pai_grade >= 3:
                    labels[fdi]["apical_lesion"] = 1

    return {
        "document_id": oris_doc.get("document_id"),
        "labels": labels,
    }
