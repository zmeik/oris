"""Schema-only validation: every shipped example file must validate cleanly
against the JSON Schema, with no errors.

This test does NOT depend on the parser — only on jsonschema. It is the
canonical validation test that the GitHub Actions workflow also runs.
"""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator

REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_PATH = REPO_ROOT / "schema" / "oris-v0.1.json"
EXAMPLES_DIR = REPO_ROOT / "examples"


@pytest.fixture(scope="module")
def schema():
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


@pytest.mark.parametrize(
    "example_file",
    sorted(p.name for p in EXAMPLES_DIR.glob("*.json")),
)
def test_example_validates_against_schema(schema, example_file):
    doc = json.loads((EXAMPLES_DIR / example_file).read_text(encoding="utf-8"))
    validator = Draft202012Validator(schema)
    errors = list(validator.iter_errors(doc))
    assert not errors, "\n".join(e.message for e in errors)
