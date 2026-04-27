"""Tests for oris.parser.core."""

import pytest

from parser.core import (
    Layer,
    parse_tooth_layers,
    encode_tooth_layers,
    primary_status,
    aggregated_surfaces,
    ParseError,
)


class TestParseToothLayers:
    def test_empty_string_yields_empty_list(self):
        assert parse_tooth_layers("") == []
        assert parse_tooth_layers(None) == []

    def test_single_status_no_surfaces(self):
        layers = parse_tooth_layers("present")
        assert layers == [Layer(status="present", surfaces=())]

    def test_status_with_single_surface(self):
        layers = parse_tooth_layers("restored:o")
        assert layers == [Layer(status="restored", surfaces=("o",))]

    def test_status_with_multiple_surfaces(self):
        layers = parse_tooth_layers("restored:mod")
        assert layers == [Layer(status="restored", surfaces=("m", "d", "o"))]

    def test_canonical_surface_order(self):
        # Input surfaces in non-canonical order should be normalised
        layers = parse_tooth_layers("restored:dom")
        assert layers[0].surfaces == ("m", "d", "o")

    def test_multiple_layers(self):
        layers = parse_tooth_layers("endo:mo+post+crowned")
        assert len(layers) == 3
        assert layers[0] == Layer(status="endo", surfaces=("m", "o"))
        assert layers[1] == Layer(status="post", surfaces=())
        assert layers[2] == Layer(status="crowned", surfaces=())

    def test_complex_real_world(self):
        layers = parse_tooth_layers("crowned+caries:d")
        assert layers == [
            Layer(status="crowned", surfaces=()),
            Layer(status="caries", surfaces=("d",)),
        ]

    def test_invalid_status_raises(self):
        with pytest.raises(ParseError, match="unknown status"):
            parse_tooth_layers("bogus_status")

    def test_invalid_surface_raises(self):
        # 'b' is not a valid surface — vestibular is 'v'
        with pytest.raises(ParseError):
            parse_tooth_layers("restored:b")

    def test_empty_layer_token_raises(self):
        with pytest.raises(ParseError, match="empty layer token"):
            parse_tooth_layers("present++crowned")

    def test_non_string_input_raises(self):
        with pytest.raises(ParseError, match="expected str"):
            parse_tooth_layers(42)


class TestEncodeToothLayers:
    def test_empty_yields_empty_string(self):
        assert encode_tooth_layers([]) == ""

    def test_single_status(self):
        assert encode_tooth_layers([Layer("present")]) == "present"

    def test_status_with_surfaces(self):
        assert encode_tooth_layers([Layer("restored", ("m", "o"))]) == "restored:mo"

    def test_multiple_layers(self):
        encoded = encode_tooth_layers(
            [Layer("endo", ("m", "o")), Layer("post"), Layer("crowned")]
        )
        assert encoded == "endo:mo+post+crowned"

    def test_roundtrip_canonicalises(self):
        original = "restored:dom+caries:d"
        layers = parse_tooth_layers(original)
        # Roundtripped string has surfaces in canonical order
        assert encode_tooth_layers(layers) == "restored:mdo+caries:d"


class TestPrimaryStatus:
    def test_empty_layers(self):
        assert primary_status([]) == ""

    def test_caries_wins(self):
        layers = parse_tooth_layers("crowned+caries:d")
        assert primary_status(layers) == "caries"

    def test_endo_over_crowned(self):
        layers = parse_tooth_layers("endo:mo+post+crowned")
        assert primary_status(layers) == "endo"

    def test_present_alone(self):
        layers = parse_tooth_layers("present")
        assert primary_status(layers) == "present"


class TestAggregatedSurfaces:
    def test_no_surfaces(self):
        assert aggregated_surfaces(parse_tooth_layers("present")) == ()

    def test_single_layer_surfaces(self):
        assert aggregated_surfaces(parse_tooth_layers("restored:mod")) == (
            "m",
            "d",
            "o",
        )

    def test_multiple_layers_union(self):
        layers = parse_tooth_layers("restored:mo+caries:d")
        assert aggregated_surfaces(layers) == ("m", "d", "o")
