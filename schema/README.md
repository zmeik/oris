# `schema/` — JSON Schema specifications

This directory contains the formal JSON Schema definition for ORIS documents.

## Files

| File | Purpose |
|------|---------|
| [`oris-v0.1.json`](oris-v0.1.json) | Master schema for ORIS v0.1 documents (Draft 2020-12) |

## Validating a document

```python
import json
from jsonschema import Draft202012Validator

schema = json.load(open("schema/oris-v0.1.json"))
validator = Draft202012Validator(schema)

doc = json.load(open("examples/synthetic_001.json"))
errors = list(validator.iter_errors(doc))
assert errors == [], errors
```

Or via the convenience function:

```python
from oris.parser import validate_oris
errors = validate_oris(doc)
```

## Schema design principles

1. **`additionalProperties: false`** at every level — strict mode prevents typos and unstable forks.
2. **Required fields are minimal** — only `oris_version`, `document_id`, `imaging`, `teeth`. All other blocks are optional, allowing partial documents during AI prefill or staged radiologist reading.
3. **Patient block is optional and PII-free** — only opaque IDs and minimal demographics. See [PRIVACY.md](../PRIVACY.md).
4. **Pattern-validated keys** — tooth keys must match the 6-character ORIS pattern; FDI keys must match `[1-8].[1-8]`; UUID format for `session_id`.
5. **Enum-bounded values** — every categorical field is bounded to an explicit enum to prevent free-text drift.

## Versioning

The schema follows semantic versioning. Backwards-incompatible changes will only happen at major version bumps (v0.x → v1.0; never within a 0.x release line). Within v0.x, additions are allowed; renames or removals are not.

## Anatomy / TMJ / airway as part of the master schema

In v0.1 the three extension blocks (`anatomical_landmarks`, `tmj_findings`, `airway_assessment`) are defined inside the master schema via `$defs`, not as separate files. This keeps validation single-pass. Future versions may split them into separate referenced schemas if their complexity grows.
