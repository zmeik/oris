"""
dental_scene_graph.py — Extension-block ontology source for ORIS v0.1
======================================================================

This module is the canonical Python source for the three extension blocks
documented in the paper §2.1 (Anatomical Landmarks, TMJ Findings,
Airway/Sinus). The literal data structures below are the source of truth
that the JSON Schema (`schema/oris-v0.1.json`) and the Markdown ontology
files (`anatomy/landmarks.md`, `anatomy/tmj.md`, `anatomy/airway.md`,
`anatomy/ontology.md`) were written from.

The paper §2.1 says:

    "These blocks are derived from the production ontology in our project
    (see dental_scene_graph.py in the repository)."

— and this is that file. It is import-only (no runtime side effects) and
deliberately shaped as plain Python dictionaries so it can be consumed
either programmatically (e.g. to auto-generate the JSON Schema enum) or
read directly as a flat reference table.

Conventions
-----------
- Every region uses snake_case identifiers that match the JSON Schema
  property names in `schema/oris-v0.1.json`.
- Side suffixes `_right` / `_left` are normalised across all regions
  (never `R/L`, never `dx/sin`).
- "v0.2 candidate" markers identify regions that are documented but
  intentionally absent from v0.1 (see `docs/version-roadmap.md`).
"""

from __future__ import annotations

from typing import Final


# ---------------------------------------------------------------------------
# 1. Anatomical Landmarks block (paper §2.1)
# ---------------------------------------------------------------------------
ANATOMICAL_LANDMARKS: Final[dict] = {
    "mandibular_canal": {
        "sides": ["right", "left"],
        "fields": {
            "visibility": ["clearly_visible", "partially_visible",
                           "not_visible", "obliterated"],
            "course":     ["normal", "lingual_loop", "anterior_loop",
                           "bifid", "trifid"],
            "distance_to_alveolar_crest_mm": "float",
        },
        "literature": ["AAOMR 2018 Position Paper", "White & Pharoah 2019 ch.7"],
    },
    "mental_foramen": {
        "sides": ["right", "left"],
        "fields": {
            "visibility":     ["clearly_visible", "partially_visible",
                               "not_visible"],
            "location_fdi":   "string (FDI of nearest tooth, e.g. 4.5)",
            "shape":          ["round", "oval", "irregular"],
        },
        "literature": ["Ngeow 2010"],
    },
    "ramus": {
        "sides": ["right", "left"],
        "fields": {
            "height_mm":            "float",
            "angulation_degrees":   "float",
            "anterior_border":      ["normal", "concave", "convex"],
            "posterior_border":     ["normal", "concave", "convex"],
        },
        "literature": ["AAOMR 2018"],
    },
    "coronoid_process": {
        "sides": ["right", "left"],
        "fields": {
            "visibility":  ["clearly_visible", "partially_visible",
                            "elongated", "fractured"],
            "height":      ["normal", "elongated", "shortened"],
        },
        "literature": ["Hossain 2014 — coronoid hyperplasia"],
    },
    "maxillary_sinus": {
        "sides": ["right", "left"],
        "fields": {
            "status":              ["normal", "mucosal_thickening",
                                    "polyp", "antrolith",
                                    "opacification", "sinusitis",
                                    "oroantral_communication"],
            "floor_integrity":     ["intact", "perforated", "uncertain"],
            "pneumatization":      ["normal", "increased", "septated"],
            "distance_to_crest_mm":"float",
        },
        "literature": ["Lawson 2008 — sinus lift planning",
                       "Bornstein 2011 sinus thickening on OPG"],
    },
    "nasal_cavity": {
        "sides": None,  # midline structure
        "fields": {
            "septum":          ["midline", "deviated_right", "deviated_left"],
            "deviation_angle": "float (degrees)",
            "airway_patency":  ["clear", "partial_obstruction",
                                "complete_obstruction"],
        },
        "literature": ["Saint-Lary 2024 OPG nasal-airway scoring"],
    },
    "incisive_canal": {
        "sides": None,
        "fields": {
            "visibility": ["clearly_visible", "partially_visible",
                           "not_visible"],
            "diameter_mm":"float",
        },
        "literature": ["Mraiwa 2004"],
    },
    "hyoid_bone": {
        "sides": None,
        "fields": {
            "visibility": ["clearly_visible", "partially_visible",
                           "not_visible"],
            "position":   ["normal", "elevated", "lowered"],
        },
        "literature": ["AAOMR 2018"],
    },
    "zygomatic_arch": {
        "sides": ["right", "left"],
        "fields": {
            "visibility": ["clearly_visible", "partially_visible",
                           "obscured_by_palate", "not_visible"],
        },
        "literature": ["AAOMR 2018"],
    },
    "cervical_spine_projection": {
        "sides": None,
        "fields": {
            "vertebrae_visible": "list[int]  # e.g. [1, 2, 3] for C1–C3",
            "alignment":         ["normal", "scoliosis", "kyphosis"],
        },
        "literature": ["AAOMR 2018"],
    },

    # v0.2 candidates (NOT enforced in v0.1)
    # "pterygoid_process": {"sides": ["right", "left"], ...},
    # "styloid_process":   {"sides": ["right", "left"], ...},
}


# ---------------------------------------------------------------------------
# 2. TMJ Findings block (paper §2.1)
# ---------------------------------------------------------------------------
TMJ_FINDINGS: Final[dict] = {
    "condyle": {
        "sides": ["right", "left"],
        "fields": {
            "morphology":            ["normal", "flattened", "rounded",
                                      "pointed", "deformed"],
            "surface_contour":       ["smooth", "irregular", "erosive"],
            "bone_density":          ["normal", "sclerotic", "osteoporotic"],
            "height_mm":             "float",
            "anterior_posterior_pos":["centric", "anterior", "posterior"],
        },
        "literature": ["AAOMR 2009 imaging guidelines for TMJ disorders",
                       "Larheim 2015"],
    },
    "articular_eminence": {
        "sides": ["right", "left"],
        "fields": {
            "prominence":   ["normal", "flattened", "steep"],
            "osteophyte":   ["absent", "small", "large"],
        },
        "literature": ["Larheim 2015"],
    },
    "joint_space": {
        "sides": ["right", "left"],
        "fields": {
            "anterior_width_mm":  "float",
            "superior_width_mm":  "float",
            "posterior_width_mm": "float",
            "symmetry":           ["symmetric_with_contralateral",
                                   "asymmetric"],
        },
        "literature": ["Pereira 1994 joint-space measurement on OPG"],
    },
    "pathology": {
        "sides": ["right", "left", "both"],
        "fields": {
            "ankylosis":       ["absent", "fibrous", "bony"],
            "disc_displacement":["unknown_on_OPG"],   # MRI required
            "osteoarthritis":  ["absent", "early", "established", "advanced"],
            "fracture":        ["absent", "subcondylar", "head_neck",
                                "other"],
        },
        "literature": ["AAOMR 2009 guidelines"],
    },
}


# ---------------------------------------------------------------------------
# 3. Airway / Sinus block (paper §2.1)
# ---------------------------------------------------------------------------
AIRWAY_FINDINGS: Final[dict] = {
    "pharyngeal_airway": {
        "sides": None,
        "fields": {
            "anterior_posterior_diameter_mm": "float",
            "shape":                          ["normal", "narrowed",
                                               "obliterated"],
            "tongue_position":                ["normal", "elevated",
                                               "retropositioned"],
        },
        "literature": ["Saint-Lary 2024 — pharyngeal airway on OPG",
                       "AAOMS 2020 OSA imaging"],
    },
    "sinus_pneumatization_pattern": {
        "sides": ["right", "left"],
        "fields": {
            "pattern":      ["normal", "increased", "decreased",
                             "septated"],
            "pathology":    ["absent", "mucosal_thickening", "polyp",
                             "antrolith", "sinusitis",
                             "oroantral_communication"],
        },
        "literature": ["Bornstein 2011 sinus thickening prevalence on OPG"],
    },
    "nasal_septum": {
        "sides": None,
        "fields": {
            "deviation":        ["midline", "right", "left"],
            "deviation_degree": "float (degrees)",
        },
        "literature": ["Saint-Lary 2024"],
    },
}


# ---------------------------------------------------------------------------
# 4. Aggregated registry — used by the JSON Schema generator
# ---------------------------------------------------------------------------
EXTENSION_BLOCKS: Final[dict] = {
    "anatomical_landmarks": ANATOMICAL_LANDMARKS,
    "tmj_findings":         TMJ_FINDINGS,
    "airway_findings":      AIRWAY_FINDINGS,
}


def list_regions() -> list[str]:
    """Return the flat list of region keys across all three extension blocks."""
    return [
        f"{block}.{region}"
        for block, regions in EXTENSION_BLOCKS.items()
        for region in regions
    ]


def get_region_spec(block: str, region: str) -> dict:
    """Return the spec dict for a specific block.region pair, or raise KeyError."""
    return EXTENSION_BLOCKS[block][region]


__all__ = [
    "ANATOMICAL_LANDMARKS",
    "TMJ_FINDINGS",
    "AIRWAY_FINDINGS",
    "EXTENSION_BLOCKS",
    "list_regions",
    "get_region_spec",
]
