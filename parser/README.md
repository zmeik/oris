# `parser/` — Python reference implementation

Pure-Python implementation of the ORIS v0.1 specification.

## Modules

| Module | Public API |
|--------|-----------|
| [`core.py`](core.py) | `Layer`, `parse_tooth_layers`, `encode_tooth_layers`, `primary_status`, `aggregated_surfaces`, `STATUSES`, `SURFACES`, `ParseError` |
| [`numbering.py`](numbering.py) | `derive_numbering`, `lookup_oris_from_fdi`, `all_oris_codes`, `OCCUPANT_NAMES`, `NumberingError` |
| [`validate.py`](validate.py) | `validate_oris`, `is_valid`, `ValidationError` |
| [`kappa.py`](kappa.py) | `compute_kappa`, `KappaError` |

All public functions are also re-exported from the top-level package as `oris.parser.<name>`.

## Quick start

```python
from oris.parser import (
    parse_tooth_layers, encode_tooth_layers,
    derive_numbering, validate_oris, compute_kappa,
)

# 1. Parse and re-encode
layers = parse_tooth_layers("endo:mo+post+crowned")
assert encode_tooth_layers(layers) == "endo:mo+post+crowned"

# 2. Resolve numbering
nums = derive_numbering("LLCPIN")
assert nums["fdi"] == "3.1"
assert nums["occupant"] == "N"

# 3. Validate a document
import json
doc = json.load(open("examples/synthetic_001.json"))
errors = validate_oris(doc)
assert errors == []

# 4. Compute inter-rater κ
doc_a = json.load(open("examples/synthetic_001.json"))
doc_b = json.load(open("examples/synthetic_002.json"))  # different patient — kappa not meaningful
# In practice, two raters annotate the SAME imaging study:
# kappa = compute_kappa(rater_a_doc, rater_b_doc)
```

## Design notes

- **No I/O in `core.py`.** Parsing and encoding are pure functions over strings.
- **CSV-backed numbering.** `numbering.py` loads the 52-entry mapping from `../numbering/*.csv` once (LRU-cached).
- **Schema-backed validation.** `validate.py` uses the canonical JSON Schema in `../schema/oris-v0.1.json`, plus business-rule checks (grammar reparse, bridge_link references, contradictory layered statuses).
- **Stateless kappa.** `kappa.py` computes Cohen's κ on the fly — no global state.

## Testing

See [`tests/`](../tests/). Run with:

```bash
pip install -e ".[dev]"
pytest tests/ -v
```
