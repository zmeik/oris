"""Tests for oris.bridges (smoke tests — verify each bridge produces output)."""

import json
from pathlib import Path

import pytest

from bridges.fhir import to_fhir
from bridges.dicom_sr import to_dicom_sr
from bridges.mis import to_mis_chart
from bridges.mmoral import to_mmoral_format

EXAMPLES_DIR = Path(__file__).resolve().parent.parent / "examples"


@pytest.fixture
def doc():
    return json.loads((EXAMPLES_DIR / "synthetic_001.json").read_text(encoding="utf-8"))


class TestFhirBridge:
    def test_produces_bundle(self, doc):
        bundle = to_fhir(doc)
        assert bundle["resourceType"] == "Bundle"
        assert bundle["type"] == "collection"

    def test_contains_patient_resource(self, doc):
        bundle = to_fhir(doc)
        types = [e["resource"]["resourceType"] for e in bundle["entry"]]
        assert "Patient" in types

    def test_contains_imaging_study(self, doc):
        bundle = to_fhir(doc)
        types = [e["resource"]["resourceType"] for e in bundle["entry"]]
        assert "ImagingStudy" in types

    def test_contains_diagnostic_report(self, doc):
        bundle = to_fhir(doc)
        types = [e["resource"]["resourceType"] for e in bundle["entry"]]
        assert "DiagnosticReport" in types

    def test_no_pii_in_patient(self, doc):
        bundle = to_fhir(doc)
        patient_resources = [
            e["resource"]
            for e in bundle["entry"]
            if e["resource"]["resourceType"] == "Patient"
        ]
        for p in patient_resources:
            # Patient resource MUST NOT contain real PII fields
            assert "name" not in p
            assert "birthDate" not in p
            assert "address" not in p
            assert "telecom" not in p


class TestDicomSrBridge:
    def test_produces_xml_string(self, doc):
        sr = to_dicom_sr(doc)
        assert isinstance(sr, str)
        assert sr.startswith("<?xml")
        assert "DicomStructuredReport" in sr

    def test_contains_imaging_metadata(self, doc):
        sr = to_dicom_sr(doc)
        assert "Acquisition Device" in sr or "device" in sr.lower()

    def test_contains_tooth_findings(self, doc):
        sr = to_dicom_sr(doc)
        assert "Tooth" in sr
        # At least one ORIS code from the example should appear
        assert "UR1PMN" in sr  # tooth 1.6 natural with endo+post+crowned


class TestMisBridge:
    def test_produces_chart_dict(self, doc):
        chart = to_mis_chart(doc)
        assert "patient_id" in chart
        assert "chart" in chart
        assert isinstance(chart["chart"], dict)

    def test_chart_keyed_by_fdi(self, doc):
        chart = to_mis_chart(doc)
        assert "1.6" in chart["chart"]
        assert "4.5" in chart["chart"]

    def test_chart_entry_structure(self, doc):
        chart = to_mis_chart(doc)
        entry = chart["chart"]["1.6"]
        assert entry["oris_code"] == "UR1PMN"
        assert entry["occupant"] == "N"
        assert entry["primary_status"] == "endo"
        assert "status_layers" in entry


class TestMmoralBridge:
    def test_produces_8_class_labels(self, doc):
        result = to_mmoral_format(doc)
        assert "labels" in result
        # All 32 permanent FDI positions should be present
        assert len(result["labels"]) == 32
        # Each entry has exactly 8 categories
        for fdi, labels in result["labels"].items():
            assert len(labels) == 8
            assert all(v in (0, 1) for v in labels.values())

    def test_endo_layer_sets_endo_label(self, doc):
        result = to_mmoral_format(doc)
        # Tooth 1.6 has 'endo:mo+post+crowned' → endo=1, crown=1
        labels_16 = result["labels"]["1.6"]
        assert labels_16["endo"] == 1
        assert labels_16["crown"] == 1

    def test_implant_layer_sets_implant_label(self, doc):
        result = to_mmoral_format(doc)
        # Tooth 4.5 has occupant=F, status=impl_restored → implant=1, crown=1
        labels_45 = result["labels"]["4.5"]
        assert labels_45["implant"] == 1
        assert labels_45["crown"] == 1

    def test_missing_tooth_sets_missing_label(self, doc):
        result = to_mmoral_format(doc)
        # Tooth 1.8 is missing
        assert result["labels"]["1.8"]["missing"] == 1
