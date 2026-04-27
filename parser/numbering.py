"""Numbering-system mapping: ORIS 6-character code ↔ FDI ↔ Universal ↔ Palmer ↔ anatomical.

Loads the canonical 52-entry mapping from the CSV files in ../numbering/.
Provides:

    derive_numbering(oris_code) -> dict
    lookup_oris_from_fdi(fdi)   -> str
"""

from __future__ import annotations

import csv
from functools import lru_cache
from pathlib import Path

# Locate the numbering CSV files relative to this module.
_NUMBERING_DIR = Path(__file__).resolve().parent.parent / "numbering"
_PERMANENT_CSV = _NUMBERING_DIR / "permanent-teeth.csv"
_PRIMARY_CSV = _NUMBERING_DIR / "primary-teeth.csv"


class NumberingError(KeyError):
    """Raised when a numbering lookup fails."""


@lru_cache(maxsize=1)
def _load_table() -> tuple[dict[str, dict[str, str]], dict[str, str]]:
    """Load the numbering table once, return (oris_to_full, fdi_to_oris)."""
    oris_to_full: dict[str, dict[str, str]] = {}
    fdi_to_oris: dict[str, str] = {}

    for csv_path in (_PERMANENT_CSV, _PRIMARY_CSV):
        if not csv_path.exists():
            raise FileNotFoundError(
                f"Numbering table not found: {csv_path}. "
                f"This module expects to be installed alongside the numbering/ directory."
            )
        with csv_path.open(encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                # The mapping uses a 5-character "position code" plus a 1-character occupant.
                # We store the full row keyed by the position code; the caller appends the
                # occupant to recover the 6-character ORIS code at lookup time.
                pos_code = row["oris_position_code"]
                fdi = row["fdi"]
                oris_to_full[pos_code] = row
                fdi_to_oris[fdi] = pos_code

    return oris_to_full, fdi_to_oris


# Occupant code -> human-readable name (used for derived `occupant` field).
OCCUPANT_NAMES: dict[str, str] = {
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


def derive_numbering(oris_code: str) -> dict[str, str]:
    """Resolve a 6-character ORIS code to FDI / Universal / Palmer / anatomical.

    Args:
        oris_code: 6-character code, e.g. 'LLCPIN' (Lower Left Central Permanent
                   Incisor, Natural tooth).

    Returns:
        dict with keys:
            'oris_code'      : the input
            'oris_position'  : first 5 characters
            'fdi'            : '3.1'
            'universal'      : '24'
            'palmer'         : '⌐̲1' (or similar, may include combining marks)
            'anatomical'     : 'Lower Left Central Permanent Incisor'
            'anatomical_ru'  : 'Нижний левый центральный постоянный резец'
            'layperson'      : 'lower left central incisor'
            'layperson_ru'   : 'нижний левый центральный резец'
            'occupant'       : 'N'
            'occupant_name'  : 'Natural'

    Raises:
        NumberingError: if the position code or occupant is unknown.
    """
    if len(oris_code) != 6:
        raise NumberingError(
            f"ORIS code must be exactly 6 characters; got {len(oris_code)} ({oris_code!r})"
        )

    pos_code = oris_code[:5]
    occupant = oris_code[5]

    if occupant not in OCCUPANT_NAMES:
        raise NumberingError(
            f"unknown occupant {occupant!r} in {oris_code!r}; "
            f"expected one of {sorted(OCCUPANT_NAMES)}"
        )

    oris_to_full, _ = _load_table()
    if pos_code not in oris_to_full:
        raise NumberingError(
            f"unknown ORIS position code {pos_code!r} in {oris_code!r}"
        )

    row = oris_to_full[pos_code]
    return {
        "oris_code": oris_code,
        "oris_position": pos_code,
        "fdi": row["fdi"],
        "universal": row["universal"],
        "palmer": row["palmer"],
        "anatomical": row["anatomical_en"],
        "anatomical_ru": row["anatomical_ru"],
        "layperson": row["layperson_en"],
        "layperson_ru": row["layperson_ru"],
        "occupant": occupant,
        "occupant_name": OCCUPANT_NAMES[occupant],
    }


def lookup_oris_from_fdi(fdi: str, occupant: str = "N") -> str:
    """Build the 6-character ORIS code from an FDI number and occupant.

    Args:
        fdi: FDI two-digit notation, e.g. '3.1'
        occupant: one of the 13 occupant codes (default 'N' for Natural)

    Returns:
        6-character ORIS code, e.g. 'LLCPIN'

    Raises:
        NumberingError: if FDI is unknown or occupant is invalid.
    """
    if occupant not in OCCUPANT_NAMES:
        raise NumberingError(f"unknown occupant {occupant!r}")
    _, fdi_to_oris = _load_table()
    if fdi not in fdi_to_oris:
        raise NumberingError(f"unknown FDI {fdi!r}")
    return fdi_to_oris[fdi] + occupant


def all_oris_codes(occupant: str = "N") -> list[str]:
    """Return all 52 ORIS codes (32 permanent + 20 primary) with the given occupant."""
    if occupant not in OCCUPANT_NAMES:
        raise NumberingError(f"unknown occupant {occupant!r}")
    oris_to_full, _ = _load_table()
    return [pos + occupant for pos in oris_to_full]
