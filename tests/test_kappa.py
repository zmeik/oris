"""Tests for oris.parser.kappa."""

import pytest

from parser.kappa import compute_kappa, KappaError


def _doc(teeth: dict) -> dict:
    return {
        "oris_version": "0.1.0",
        "document_id": "TEST",
        "imaging": {"modality": "OPG", "acquisition_date": "2026-01-01T00:00:00Z"},
        "teeth": teeth,
    }


class TestComputeKappa:
    def test_perfect_agreement(self):
        d1 = _doc({"URCPIN": {"fdi": "1.1", "occupant": "N", "status_layers": "present"}})
        d2 = _doc({"URCPIN": {"fdi": "1.1", "occupant": "N", "status_layers": "present"}})
        assert compute_kappa(d1, d2) == pytest.approx(1.0)

    def test_partial_agreement(self):
        # 4 teeth, 3 agree
        d1 = _doc({
            "URCPIN": {"fdi": "1.1", "occupant": "N", "status_layers": "present"},
            "URLPIN": {"fdi": "1.2", "occupant": "N", "status_layers": "present"},
            "URXPCN": {"fdi": "1.3", "occupant": "N", "status_layers": "caries"},
            "URPP1PN": {"fdi": "1.4", "occupant": "N", "status_layers": "crowned"},
        })
        d2 = _doc({
            "URCPIN": {"fdi": "1.1", "occupant": "N", "status_layers": "present"},
            "URLPIN": {"fdi": "1.2", "occupant": "N", "status_layers": "present"},
            "URXPCN": {"fdi": "1.3", "occupant": "N", "status_layers": "caries"},
            "URPP1PN": {"fdi": "1.4", "occupant": "N", "status_layers": "restored:o"},
        })
        kappa = compute_kappa(d1, d2)
        # Should be in (0, 1)
        assert 0 < kappa < 1

    def test_disjoint_documents_raise(self):
        d1 = _doc({"URCPIN": {"fdi": "1.1", "occupant": "N", "status_layers": "present"}})
        d2 = _doc({"LLLPIN": {"fdi": "3.2", "occupant": "N", "status_layers": "present"}})
        with pytest.raises(KappaError, match="share no tooth keys"):
            compute_kappa(d1, d2)

    def test_occupant_scope(self):
        d1 = _doc({
            "URCPIN": {"fdi": "1.1", "occupant": "N", "status_layers": "present"},
            "URLPIN": {"fdi": "1.2", "occupant": "N", "status_layers": "present"},
        })
        d2 = _doc({
            "URCPIN": {"fdi": "1.1", "occupant": "N", "status_layers": "crowned"},
            "URLPIN": {"fdi": "1.2", "occupant": "N", "status_layers": "missing"},
        })
        # Occupant agrees on both → kappa = 1.0 in occupant scope
        assert compute_kappa(d1, d2, scope="occupant") == pytest.approx(1.0)

    def test_unknown_scope(self):
        d1 = _doc({"URCPIN": {"fdi": "1.1", "occupant": "N", "status_layers": "present"}})
        d2 = _doc({"URCPIN": {"fdi": "1.1", "occupant": "N", "status_layers": "present"}})
        with pytest.raises(KappaError, match="unknown scope"):
            compute_kappa(d1, d2, scope="bogus")
