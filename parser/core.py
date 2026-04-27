"""Core parser: layered status formula → AST and back.

Grammar (informal):
    ToothFormula  = '' | StatusList
    StatusList    = LayerEntry ('+' LayerEntry)*
    LayerEntry    = Status (':' SurfaceList)?
    Status        ∈ {present, missing, implant, impl_fixture, impl_healing,
                     impl_restored, post, crowned, restored, caries, endo,
                     root, impacted, bridge, bar, cantilever, uncertain}
    SurfaceList   = Surface+
    Surface       ∈ {m, d, o, v, l}

See ../grammar/ebnf.txt for the formal EBNF.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field

# Canonical ordered list of statuses, matching the Darwin-Lab Arena
# `ARENA_STATUS_CYCLE` constant. Order is preserved for the picker UI cycle.
STATUSES: tuple[str, ...] = (
    "present",
    "missing",
    "implant",
    "impl_fixture",
    "impl_healing",
    "impl_restored",
    "post",
    "crowned",
    "restored",
    "caries",
    "endo",
    "root",
    "impacted",
    "bridge",
    "bar",
    "cantilever",
    "uncertain",
)

# Canonical surface order. The encoder produces surfaces in this order.
SURFACES: tuple[str, ...] = ("m", "d", "o", "v", "l")

_STATUS_SET = frozenset(STATUSES)
_SURFACE_SET = frozenset(SURFACES)

_LAYER_RE = re.compile(
    r"^(?P<status>[a-z_]+)(?::(?P<surfaces>[mdovl]+))?$"
)


class ParseError(ValueError):
    """Raised when a layered status string cannot be parsed."""


@dataclass(frozen=True, order=False)
class Layer:
    """One semantic layer of a tooth's findings.

    Attributes:
        status:   one of the 17 non-empty statuses (see STATUSES)
        surfaces: subset of {m, d, o, v, l}, optional
    """

    status: str
    surfaces: tuple[str, ...] = field(default_factory=tuple)

    def __post_init__(self) -> None:
        if self.status not in _STATUS_SET:
            raise ParseError(
                f"unknown status {self.status!r}; expected one of {sorted(_STATUS_SET)}"
            )
        for s in self.surfaces:
            if s not in _SURFACE_SET:
                raise ParseError(
                    f"unknown surface {s!r}; expected one of {sorted(_SURFACE_SET)}"
                )

    def encode(self) -> str:
        """Encode this layer as the canonical string."""
        if self.surfaces:
            ordered = tuple(s for s in SURFACES if s in self.surfaces)
            return f"{self.status}:{''.join(ordered)}"
        return self.status


def parse_tooth_layers(raw: str | None) -> list[Layer]:
    """Parse a layered status formula into a list of Layer objects.

    Empty input ('' or None) yields an empty list.
    Raises ParseError on malformed input.

    Examples:
        >>> parse_tooth_layers('')
        []
        >>> parse_tooth_layers('present')
        [Layer(status='present', surfaces=())]
        >>> parse_tooth_layers('endo:mo+post+crowned')
        [Layer(status='endo', surfaces=('m', 'o')),
         Layer(status='post', surfaces=()),
         Layer(status='crowned', surfaces=())]
    """
    if raw is None or raw == "":
        return []
    if not isinstance(raw, str):
        raise ParseError(f"expected str, got {type(raw).__name__}")

    layers: list[Layer] = []
    for token in raw.split("+"):
        token = token.strip()
        if not token:
            raise ParseError(f"empty layer token in {raw!r}")
        m = _LAYER_RE.match(token)
        if not m:
            raise ParseError(f"malformed layer token {token!r} in {raw!r}")
        status = m.group("status")
        surf_str = m.group("surfaces") or ""
        # Canonical order, dedup
        surfaces = tuple(s for s in SURFACES if s in surf_str)
        if len(surfaces) != len(set(surf_str)):
            raise ParseError(f"unknown surface in {token!r}")
        layers.append(Layer(status=status, surfaces=surfaces))
    return layers


def encode_tooth_layers(layers: list[Layer] | tuple[Layer, ...]) -> str:
    """Encode a list of Layer objects back to canonical string form.

    Examples:
        >>> encode_tooth_layers([])
        ''
        >>> encode_tooth_layers([Layer('endo', ('m','o')), Layer('post'), Layer('crowned')])
        'endo:mo+post+crowned'
    """
    if not layers:
        return ""
    return "+".join(layer.encode() for layer in layers)


def primary_status(layers: list[Layer] | tuple[Layer, ...]) -> str:
    """Return the dominant primary status of a layer list, for UI cell colouring.

    Heuristic (matching Arena UI behaviour):
      1. If 'caries' present → 'caries'
      2. Elif 'endo' present → 'endo'
      3. Elif 'crowned' present → 'crowned'
      4. Elif 'restored' present → 'restored'
      5. Elif any impl_* present → 'impl_restored' (or first impl_* found)
      6. Elif 'missing' present → 'missing'
      7. Elif 'impacted' present → 'impacted'
      8. Elif 'root' present → 'root'
      9. Elif 'present' present → 'present'
     10. Elif 'uncertain' present → 'uncertain'
     11. Else → '' (empty)
    """
    if not layers:
        return ""
    statuses = {layer.status for layer in layers}
    priority = (
        "caries", "endo", "crowned", "restored",
        "impl_restored", "impl_fixture", "impl_healing", "implant",
        "missing", "impacted", "root", "present", "uncertain",
        "bridge", "bar", "cantilever", "post",
    )
    for s in priority:
        if s in statuses:
            return s
    return ""


def aggregated_surfaces(layers: list[Layer] | tuple[Layer, ...]) -> tuple[str, ...]:
    """Return the union of surfaces across all layers, in canonical order."""
    union: set[str] = set()
    for layer in layers:
        union.update(layer.surfaces)
    return tuple(s for s in SURFACES if s in union)
