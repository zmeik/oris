"""Cohen's kappa for inter-rater agreement on ORIS documents.

Compares two ORIS documents on the same patient/imaging study by computing
Cohen's kappa over the set of tooth-position findings.

References:
    Cohen J. A coefficient of agreement for nominal scales.
    Educ Psychol Meas. 1960;20(1):37–46.
"""

from __future__ import annotations

from .core import parse_tooth_layers, primary_status


class KappaError(ValueError):
    """Raised when kappa computation cannot proceed (e.g. document mismatch)."""


def compute_kappa(
    doc_a: dict, doc_b: dict, *, scope: str = "primary_status"
) -> float:
    """Compute Cohen's κ between two ORIS documents.

    Args:
        doc_a, doc_b: two ORIS documents on the same imaging study
                      (typically same `document_id`).
        scope: 'primary_status' (default) — compare the primary status of each
               tooth, derived via primary_status(parse_tooth_layers(...));
               'occupant' — compare the occupant character of each tooth code;
               'exact' — exact equality of status_layers strings.

    Returns:
        Cohen's κ in [-1, 1]. Higher is better; 0 = chance-level agreement;
        1.0 = perfect agreement.

    Raises:
        KappaError: if the documents do not share at least one tooth key.

    Note:
        For multi-class agreement on layered findings, this function uses the
        unweighted Cohen's κ. For ordinal layered statuses, weighted κ is more
        appropriate; that is not yet implemented in v0.1.
    """
    teeth_a = doc_a.get("teeth", {})
    teeth_b = doc_b.get("teeth", {})

    common = set(teeth_a.keys()) & set(teeth_b.keys())
    if not common:
        raise KappaError("documents share no tooth keys")

    a_labels: list[str] = []
    b_labels: list[str] = []

    for key in common:
        a_label = _extract_label(teeth_a[key], scope)
        b_label = _extract_label(teeth_b[key], scope)
        a_labels.append(a_label)
        b_labels.append(b_label)

    return _cohens_kappa(a_labels, b_labels)


def _extract_label(tooth_obj: dict, scope: str) -> str:
    if scope == "occupant":
        return tooth_obj.get("occupant", "U")
    if scope == "exact":
        return tooth_obj.get("status_layers", "") or ""
    if scope == "primary_status":
        layers = parse_tooth_layers(tooth_obj.get("status_layers", "") or "")
        return primary_status(layers) or "_empty_"
    raise KappaError(f"unknown scope {scope!r}")


def _cohens_kappa(a: list[str], b: list[str]) -> float:
    """Unweighted Cohen's kappa for two lists of equal length."""
    if len(a) != len(b) or not a:
        raise KappaError("input lists must be of equal non-zero length")

    n = len(a)
    # Build the contingency table
    classes = sorted(set(a) | set(b))
    idx = {c: i for i, c in enumerate(classes)}
    k = len(classes)
    matrix = [[0] * k for _ in range(k)]
    for x, y in zip(a, b, strict=True):
        matrix[idx[x]][idx[y]] += 1

    # Observed agreement
    p_o = sum(matrix[i][i] for i in range(k)) / n

    # Expected agreement (by chance)
    row_totals = [sum(matrix[i]) for i in range(k)]
    col_totals = [sum(matrix[i][j] for i in range(k)) for j in range(k)]
    p_e = sum(row_totals[i] * col_totals[i] for i in range(k)) / (n * n)

    if p_e == 1.0:
        # Perfect agreement on a single class — κ undefined, return 1.0 if matched
        return 1.0 if p_o == 1.0 else 0.0

    return (p_o - p_e) / (1 - p_e)
