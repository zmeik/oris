# `examples/` — Synthetic ORIS documents

> ⚠️ **All documents in this directory are synthetic.** Patient identifiers are formatted as `P_NNNN_SYNTHETIC`. No real patient data, no real radiographs. See [PRIVACY.md](../PRIVACY.md) for the full data-protection statement.

## Available examples

| File | Patient profile | Findings highlight |
|------|-----------------|---------------------|
| [`synthetic_001.json`](synthetic_001.json) | 45y M | Endo+post+crown on 1.6, single implant on 4.5, 2 missing third molars + 1 missing 4.6, 2 impacted third molars |
| [`synthetic_002.json`](synthetic_002.json) | 62y F | Multiple implants (1 with peri-implantitis), 2 conventional bridges, endo retreatment case with PAI grade 3 lesion, mucosal sinus thickening, septal deviation, early TMJ-OA, incidental carotid calcification |
| [`synthetic_003_pediatric.json`](synthetic_003_pediatric.json) | 8y F | Mixed dentition: 4 permanent first molars + permanent incisors erupted, most other permanent teeth uncertain (developing), 4 exfoliated primary lower incisors, 2 primary occlusal fillings |

## Validating

```bash
pip install jsonschema
python -c "
import json
from jsonschema import Draft202012Validator
schema = json.load(open('schema/oris-v0.1.json'))
for f in ['synthetic_001.json', 'synthetic_002.json', 'synthetic_003_pediatric.json']:
    doc = json.load(open(f'examples/{f}'))
    errors = list(Draft202012Validator(schema).iter_errors(doc))
    print(f'{f}: {\"OK\" if not errors else f\"{len(errors)} errors\"}')
"
```

Or via the parser:

```python
from oris.parser import validate_oris
import json
for name in ['synthetic_001.json', 'synthetic_002.json', 'synthetic_003_pediatric.json']:
    doc = json.load(open(f'examples/{name}'))
    errors = validate_oris(doc)
    print(name, 'OK' if not errors else errors)
```

## Contributing new examples

See [CONTRIBUTING.md](../CONTRIBUTING.md). Briefly:

1. Generate synthetic findings — clinically plausible combinations chosen by you, not derived from any real patient
2. Use `patient.anonymized_id` of form `P_NNNN_SYNTHETIC` (or `P_NNNN_<your-handle>`)
3. Set the `notes` field to declare the synthetic origin: `"Synthetic example contributed by <handle> on <date>; not derived from any real patient."`
4. Validate against the schema before submitting
5. Add an entry to this README's table

## Roundtrip via parser

```python
import json
from oris.parser import parse_tooth_layers, encode_tooth_layers

doc = json.load(open('examples/synthetic_001.json'))
for tooth_code, tooth_obj in doc['teeth'].items():
    raw = tooth_obj.get('status_layers', '')
    layers = parse_tooth_layers(raw)
    re_encoded = encode_tooth_layers(layers)
    # re_encoded is the canonical form; may differ in surface order from raw input
    # but should be parse-equivalent
    assert parse_tooth_layers(re_encoded) == layers
```
