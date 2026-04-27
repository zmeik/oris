# `bridges/` — Converters to other standards

This directory contains converters from ORIS to other dental / radiology data formats.

| Module | Target | Status |
|--------|--------|--------|
| [`fhir.py`](fhir.py) | HL7 FHIR R4 — DiagnosticReport + Observation bundle | full implementation, validates with `fhir.resources` (optional) |
| [`dicom_sr.py`](dicom_sr.py) | DICOM Structured Report XML | stub (content tree only; wrap with pydicom for transport) |
| [`mis.py`](mis.py) | Flat dental chart for MIS / EHR systems | full implementation |
| [`mmoral.py`](mmoral.py) | MMOral-OPG-Bench 8-class label vector | full implementation |

## Usage

```python
import json
from oris.bridges import to_fhir, to_dicom_sr, to_mis_chart, to_mmoral_format

doc = json.load(open("examples/synthetic_001.json"))

# FHIR R4 bundle (Python dict)
fhir_bundle = to_fhir(doc)
print(json.dumps(fhir_bundle, indent=2))

# DICOM-SR XML stub
sr_xml = to_dicom_sr(doc)
print(sr_xml)

# MIS chart (flat dict by FDI)
chart = to_mis_chart(doc)
print(json.dumps(chart, indent=2))

# MMOral-OPG-Bench 8-class labels
mmoral = to_mmoral_format(doc)
print(json.dumps(mmoral, indent=2))
```

## Adding a new bridge

To add a converter to another standard (e.g. SNODENT-coded EHR, OpenEHR archetypes, Open mHealth dental schema):

1. Create a new module `bridges/<target_name>.py`
2. Implement a single public function `to_<target_name>(oris_doc: dict) -> <target_type>`
3. Add it to `bridges/__init__.py`
4. Add tests under `tests/test_bridges_<target_name>.py`
5. Document the mapping rationale in this README

See [CONTRIBUTING.md](../CONTRIBUTING.md) for the full contribution flow.

## Mapping caveats

Cross-standard mapping is rarely lossless. Each bridge documents its assumptions:

- **`fhir.py`** loses ORIS layer ordering (FHIR Observation does not enforce array order). Multi-layer findings on one tooth become multiple Observation `component[]` entries.
- **`dicom_sr.py`** is a content-tree XML stub. Embedding into a DICOM SR dataset (with patient identity, study UID, etc.) requires wrapping via pydicom or DCMTK.
- **`mis.py`** flattens to one row per FDI. Multi-layer findings collapse to a `primary_status` plus the original `status_layers` string preserved for round-trip.
- **`mmoral.py`** uses an 8-class taxonomy; ORIS findings outside those 8 categories (e.g. `post`, `bridge`, `cantilever`) are silently dropped from the MMOral output. The bridge logs nothing — round-tripping ORIS ↔ MMOral is intentionally lossy.

Where possible, downstream pipelines should retain the original ORIS document alongside the bridged output to preserve full information.
