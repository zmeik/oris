"""Tests for oris.parser.numbering."""

import pytest

from parser.numbering import (
    derive_numbering,
    lookup_oris_from_fdi,
    all_oris_codes,
    NumberingError,
)


class TestDeriveNumbering:
    def test_lower_left_central_natural(self):
        nums = derive_numbering("LLCPIN")
        assert nums["fdi"] == "3.1"
        assert nums["universal"] == "24"
        assert "Lower Left Central Permanent Incisor" in nums["anatomical"]
        assert nums["occupant"] == "N"
        assert nums["occupant_name"] == "Natural"

    def test_upper_right_first_molar_natural(self):
        nums = derive_numbering("UR1PMN")
        assert nums["fdi"] == "1.6"
        assert nums["universal"] == "3"

    def test_implant_occupant(self):
        nums = derive_numbering("LL1PMF")
        assert nums["fdi"] == "3.6"
        assert nums["occupant"] == "F"
        assert "Fixture" in nums["occupant_name"]

    def test_primary_tooth(self):
        nums = derive_numbering("URCDIN")
        assert nums["fdi"] == "5.1"
        assert nums["universal"] == "E"

    def test_third_molar_missing(self):
        nums = derive_numbering("UR3PMA")
        assert nums["fdi"] == "1.8"
        assert nums["occupant"] == "A"
        assert nums["occupant_name"] == "Absent"

    def test_invalid_length(self):
        with pytest.raises(NumberingError, match="exactly 6 characters"):
            derive_numbering("LLCPI")

    def test_unknown_position(self):
        with pytest.raises(NumberingError, match="unknown ORIS position"):
            derive_numbering("ZZZZZN")

    def test_unknown_occupant(self):
        with pytest.raises(NumberingError, match="unknown occupant"):
            derive_numbering("LLCPIZ")


class TestLookupOrisFromFdi:
    def test_basic_lookup(self):
        assert lookup_oris_from_fdi("3.1", "N") == "LLCPIN"

    def test_default_occupant(self):
        assert lookup_oris_from_fdi("1.6") == "UR1PMN"

    def test_implant_occupant(self):
        assert lookup_oris_from_fdi("4.5", "F") == "LR2PPF"

    def test_third_molar_absent(self):
        assert lookup_oris_from_fdi("1.8", "A") == "UR3PMA"

    def test_unknown_fdi(self):
        with pytest.raises(NumberingError, match="unknown FDI"):
            lookup_oris_from_fdi("9.9")


class TestAllOrisCodes:
    def test_count(self):
        # 32 permanent + 20 primary = 52 positions
        assert len(all_oris_codes("N")) == 52

    def test_default_occupant(self):
        codes = all_oris_codes()
        assert all(code.endswith("N") for code in codes)
