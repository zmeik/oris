# Getting Started — ORIS v0.1

> 🇬🇧 English · 🇷🇺 [Русская версия](getting-started.ru.md)

This tutorial walks through installing ORIS, loading a synthetic example, validating it, encoding/decoding tooth findings, computing inter-rater κ, and converting to FHIR / MIS / DICOM-SR.

## 1. Installation

### Option A: from a clone (recommended for development)

```bash
git clone https://github.com/zmeik/oris.git
cd oris
pip install -e ".[dev]"
```

This installs:
- `oris.parser` (the public Python API)
- `oris.bridges` (FHIR / DICOM-SR / MIS / MMOral converters)
- Development tools (pytest, black, ruff, mypy)

### Option B: schema-only (no Python required)

If you just want the JSON Schema, copy `schema/oris-v0.1.json` and validate documents with any JSON Schema Draft 2020-12 validator (e.g., `ajv` for JavaScript, `jsonschema` for Python).

### Option C: reference application only

```bash
git clone https://github.com/zmeik/oris.git
cd oris/reference-app
pip install -r requirements.txt
python3 mock_app.py
# open http://localhost:5050
```

You will land on the static IJOS demo (paper Figure 2 source). The interactive Arena UI lives at `/darwin-lab`.

## 2. Hello, ORIS

```python
from oris.parser import parse_tooth_layers, encode_tooth_layers, derive_numbering

# Parse a layered tooth status string
layers = parse_tooth_layers("endo:mo+post+crowned")
print(layers)
# [Layer(status='endo', surfaces=('m', 'o')),
#  Layer(status='post', surfaces=()),
#  Layer(status='crowned', surfaces=())]

# Encode back to canonical form
print(encode_tooth_layers(layers))
# 'endo:mo+post+crowned'

# Resolve a 6-character ORIS code
nums = derive_numbering("LLCPIN")
print(nums["fdi"])           # '3.1'
print(nums["anatomical"])    # 'Lower Left Central Permanent Incisor'
print(nums["occupant_name"]) # 'Natural'
```

## 3. Loading and validating a synthetic example

```python
import json
from oris.parser import validate_oris

doc = json.load(open("examples/synthetic_001.json"))
errors = validate_oris(doc)

if errors:
    for e in errors:
        print(e)
else:
    print("Document is valid!")
```

Expected output: `Document is valid!`.

## 4. Building an ORIS document programmatically

```python
import json
from oris.parser import lookup_oris_from_fdi, parse_tooth_layers, encode_tooth_layers

# Build a minimal document
doc = {
    "oris_version": "0.1.0",
    "document_id": "TUTORIAL_001",
    "patient": {"anonymized_id": "P_TUTORIAL_001", "age_years": 35, "sex": "F"},
    "imaging": {
        "modality": "OPG",
        "device": "Tutorial Device",
        "acquisition_date": "2026-04-27T10:00:00Z",
        "image_quality_score": 4
    },
    "teeth": {}
}

# Add a tooth: endo + post + crown on FDI 1.6
oris_code = lookup_oris_from_fdi("1.6", occupant="N")  # "URMP1MN"
doc["teeth"][oris_code] = {
    "fdi": "1.6",
    "occupant": "N",
    "status_layers": "endo:mo+post+crowned"
}

# Add an implant on FDI 4.5
implant_code = lookup_oris_from_fdi("4.5", occupant="F")  # "LRPP2PF"
doc["teeth"][implant_code] = {
    "fdi": "4.5",
    "occupant": "F",
    "status_layers": "impl_restored",
    "implant": {
        "system": "Tutorial Implant",
        "diameter_mm": 4.0,
        "length_mm": 10.0,
        "marginal_bone_level_mm": 1.0,
        "complications": []
    }
}

print(json.dumps(doc, indent=2))
```

## 5. Computing inter-rater κ

```python
import json
from oris.parser import compute_kappa

rater_a = json.load(open("rater_a.json"))   # rater A's annotation of OPG file_id=1234
rater_b = json.load(open("rater_b.json"))   # rater B's annotation of the same OPG

kappa = compute_kappa(rater_a, rater_b)
print(f"Cohen's κ = {kappa:.3f}")
# Cohen's κ = 0.940
```

You can also compute κ over different scopes:
- `scope="primary_status"` (default): primary status per tooth (e.g. 'endo' wins over 'crowned' if both present)
- `scope="occupant"`: just the occupant character (N/F/T/B/...)
- `scope="exact"`: exact equality of `status_layers` strings

## 6. Converting to other formats

```python
import json
from oris.bridges import to_fhir, to_dicom_sr, to_mis_chart, to_mmoral_format

doc = json.load(open("examples/synthetic_001.json"))

# To FHIR R4 Bundle (DiagnosticReport + Observations)
fhir_bundle = to_fhir(doc)
json.dump(fhir_bundle, open("output_fhir.json", "w"), indent=2)

# To DICOM-SR XML stub
sr_xml = to_dicom_sr(doc)
open("output_sr.xml", "w").write(sr_xml)

# To flat MIS dental chart
chart = to_mis_chart(doc)
print(chart["chart"]["1.6"])
# {'oris_code': 'URMP1M', 'occupant': 'N', 'occupant_name': 'Natural',
#  'primary_status': 'endo', 'surfaces': ['m', 'o'],
#  'status_layers': 'endo:mo+post+crowned', ...}

# To MMOral-OPG-Bench 8-class labels
mmoral = to_mmoral_format(doc)
print(mmoral["labels"]["1.6"])
# {'caries': 0, 'crown': 1, 'filling': 0, 'endo': 1,
#  'implant': 0, 'impacted': 0, 'missing': 0, 'apical_lesion': 0}
```

## 7. Running the test suite

```bash
pytest tests/ -v
```

Expected output: all tests pass. The test suite covers:
- Parser core (parse / encode / surface canonicalisation / contradictions)
- Numbering (FDI ↔ ORIS bijection, occupant lookup)
- Validation (schema + business rules)
- Kappa (perfect agreement, partial, occupant scope)
- Bridges (FHIR / DICOM-SR / MIS / MMOral smoke tests)
- All synthetic examples validate cleanly

## 8. Next steps

- **Read the schema:** [`schema/oris-v0.1.json`](../schema/oris-v0.1.json)
- **Browse occupants and statuses:** [`numbering/occupants.md`](../numbering/occupants.md), [`grammar/statuses.md`](../grammar/statuses.md)
- **Understand the anatomy extension:** [`anatomy/landmarks.md`](../anatomy/landmarks.md), [`anatomy/tmj.md`](../anatomy/tmj.md), [`anatomy/airway.md`](../anatomy/airway.md)
- **Try the reference application:** [`reference-app/`](../reference-app/)
- **Contribute:** [`CONTRIBUTING.md`](../CONTRIBUTING.md)

For the foundational paper that motivates ORIS, see the *International Journal of Oral Science* submission (in review, 2026).
