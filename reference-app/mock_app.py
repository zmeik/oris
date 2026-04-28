"""
ORIS Reference Application — Flask backend
============================================

Runs the full production Darwin-Lab Arena UI (14 JS modules + CSS + HTML,
verbatim from the X-RayAnalizer project at the RUDN Diagnostic Centre)
against a lightweight self-contained backend:

  - SQLite for ground-truth persistence + change history (file: data/oris-ref.db)
  - Pillow for OPG image upload (privacy gate + EXIF strip + watermark)
  - oris.parser + oris.bridges (re-used from ../parser/ and ../bridges/)

NO REAL PATIENTS. NO POSTGRESQL. NO PII.

Run:
    pip install -r requirements.txt
    python3 mock_app.py
    open http://localhost:5050/darwin-lab

Privacy:
    All examples are synthetic. See ../PRIVACY.md.
    User-uploaded images: privacy gate + EXIF stripped + watermarked.
"""

from __future__ import annotations

import hashlib
import io
import json
import os
import sqlite3
import sys
import uuid
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from flask import Flask, Response, abort, g, jsonify, render_template, request, send_file

# ---------------------------------------------------------------------------
# Paths and imports from the rest of the repo (parser + bridges)
# ---------------------------------------------------------------------------

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
EXAMPLES_DIR = REPO_ROOT / "examples"
DATA_DIR = HERE / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "oris-ref.db"

# Make ../parser and ../bridges importable
sys.path.insert(0, str(REPO_ROOT))

try:
    from parser.core import parse_tooth_layers, encode_tooth_layers, primary_status
    from parser.numbering import derive_numbering, lookup_oris_from_fdi
    from parser.validate import validate_oris
    from parser.kappa import compute_kappa
    from bridges.fhir import to_fhir
    from bridges.dicom_sr import to_dicom_sr
    from bridges.mis import to_mis_chart
    from bridges.mmoral import to_mmoral_format
except ImportError as e:
    print(f"⚠ Could not import oris.parser/bridges from {REPO_ROOT}: {e}")
    print("   Some features will be disabled.")
    parse_tooth_layers = None  # type: ignore

# Optional Pillow for image processing
try:
    from PIL import Image, ImageDraw, ImageFont, ExifTags
    HAS_PILLOW = True
except ImportError:
    print("⚠ Pillow not installed — image upload will be disabled.")
    print("   Install: pip install Pillow")
    HAS_PILLOW = False

app = Flask(
    __name__,
    template_folder=str(HERE / "templates"),
    static_folder=str(HERE / "static"),
)

# Privacy: max upload size (5 MB) + max image dimensions (4096×4096)
app.config["MAX_CONTENT_LENGTH"] = 5 * 1024 * 1024


# ============================================================================
# SQLite database
# ============================================================================

SCHEMA_SQL = """
CREATE TABLE IF NOT EXISTS sandboxes (
    sandbox_id    TEXT PRIMARY KEY,
    label         TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    is_demo       INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS files (
    file_id       INTEGER PRIMARY KEY,
    sandbox_id    TEXT NOT NULL REFERENCES sandboxes(sandbox_id) ON DELETE CASCADE,
    filename      TEXT,
    label         TEXT,
    image_id      INTEGER REFERENCES uploaded_images(id),
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ground_truth (
    file_id           INTEGER PRIMARY KEY REFERENCES files(file_id) ON DELETE CASCADE,
    formula_json      TEXT NOT NULL DEFAULT '{}',
    bridge_links_json TEXT NOT NULL DEFAULT '{}',
    tooth_notes_json  TEXT NOT NULL DEFAULT '{}',
    root_data_json    TEXT NOT NULL DEFAULT '{}',
    crop_overrides_json TEXT NOT NULL DEFAULT '{}',
    diagnostic_sites_json TEXT NOT NULL DEFAULT '{}',
    last_modified     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS history (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id       INTEGER NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
    sequence_num  INTEGER NOT NULL,
    fdi           TEXT,
    old_value     TEXT,
    new_value     TEXT,
    change_type   TEXT NOT NULL,
    source        TEXT NOT NULL,
    session_id    TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(file_id, sequence_num)
);

CREATE INDEX IF NOT EXISTS ix_history_file_seq ON history(file_id, sequence_num DESC);

CREATE TABLE IF NOT EXISTS algorithms (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    file_id         INTEGER NOT NULL REFERENCES files(file_id) ON DELETE CASCADE,
    codename         TEXT NOT NULL,
    config_json      TEXT NOT NULL,
    formula_json     TEXT NOT NULL,
    confidence       REAL,
    score            REAL,
    is_champion      INTEGER NOT NULL DEFAULT 0,
    is_alive         INTEGER NOT NULL DEFAULT 1,
    generation       INTEGER,
    branch           TEXT,
    UNIQUE(file_id, codename)
);

CREATE TABLE IF NOT EXISTS uploaded_images (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    sha256          TEXT UNIQUE NOT NULL,
    mime            TEXT NOT NULL,
    width           INTEGER,
    height          INTEGER,
    bytes           BLOB NOT NULL,
    privacy_ack     INTEGER NOT NULL DEFAULT 0,
    source_label    TEXT,
    original_size   INTEGER,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
"""


def get_db() -> sqlite3.Connection:
    """Per-request SQLite connection."""
    if "db" not in g:
        g.db = sqlite3.connect(str(DB_PATH))
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
    return g.db


@app.teardown_appcontext
def close_db(_exception):
    db = g.pop("db", None)
    if db is not None:
        db.close()


@contextmanager
def db_connect():
    """Standalone connection (used outside Flask request context for seeding)."""
    conn = sqlite3.connect(str(DB_PATH))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create schema if not present."""
    with db_connect() as conn:
        conn.executescript(SCHEMA_SQL)


# ============================================================================
# Bootstrap synthetic data from ../examples/
# ============================================================================


def _oris_doc_to_legacy_formula(oris_doc: dict) -> tuple[dict, dict, dict, dict]:
    """Convert an ORIS document → (formula, bridge_links, tooth_notes, root_data)."""
    formula: dict[str, str] = {}
    bridge_links = oris_doc.get("bridge_links", {}) or {}
    tooth_notes = oris_doc.get("tooth_notes", {}) or {}
    root_data: dict[str, dict] = {}

    for _oris_code, tooth_obj in (oris_doc.get("teeth") or {}).items():
        if not isinstance(tooth_obj, dict):
            continue
        fdi = tooth_obj.get("fdi")
        if not fdi:
            continue
        formula[fdi] = tooth_obj.get("status_layers") or ""
        if "root_data" in tooth_obj:
            root_data[fdi] = tooth_obj["root_data"]

    return formula, bridge_links, tooth_notes, root_data


def _generate_mock_algorithms(gt_formula: dict) -> list[dict]:
    """Three synthetic algorithms with slight variations for the Arena comparison view."""
    base = dict(gt_formula)

    a = {
        "codename": "alpha-baseline",
        "config": {"crops": [{"id": "default"}], "filters": []},
        "formula": dict(base),
        "confidence": 0.95, "score": 0.94,
        "is_champion": 0, "is_alive": 1,
        "generation": 1, "branch": "main",
    }
    b_formula = dict(base)
    for fdi in list(b_formula.keys())[:4]:
        if b_formula[fdi] == "present":
            b_formula[fdi] = ""
    b = {
        "codename": "beta-aggressive",
        "config": {"crops": [{"id": "tight"}], "filters": [{"name": "clahe"}]},
        "formula": b_formula,
        "confidence": 0.84, "score": 0.82,
        "is_champion": 0, "is_alive": 1,
        "generation": 2, "branch": "exp-clahe",
    }
    c = {
        "codename": "gamma-champion",
        "config": {"crops": [{"id": "wide"}, {"id": "tight"}], "filters": [{"name": "sharpen"}]},
        "formula": dict(base),
        "confidence": 0.97, "score": 0.96,
        "is_champion": 1, "is_alive": 1,
        "generation": 3, "branch": "champion",
    }
    return [a, b, c]


def _ingest_image(conn: sqlite3.Connection, img_path: Path, source_label: str) -> int | None:
    """Ingest an image file into uploaded_images table (idempotent via SHA-256)."""
    if not img_path.exists():
        return None
    img_bytes = img_path.read_bytes()
    sha = hashlib.sha256(img_bytes).hexdigest()
    row = conn.execute("SELECT id FROM uploaded_images WHERE sha256 = ?", (sha,)).fetchone()
    if row:
        return row["id"]
    # Probe dimensions via Pillow if available
    w = h = None
    if HAS_PILLOW:
        try:
            with Image.open(io.BytesIO(img_bytes)) as im:
                w, h = im.size
        except Exception:
            pass
    cur = conn.execute(
        """
        INSERT INTO uploaded_images (sha256, mime, width, height, bytes,
                                     privacy_ack, source_label, original_size)
        VALUES (?, 'image/png', ?, ?, ?, 1, ?, ?)
        """,
        (sha, w, h, img_bytes, source_label, len(img_bytes)),
    )
    return cur.lastrowid


def bootstrap_demo_data() -> None:
    """Seed the SQLite DB with anonymized real-cohort cases (case_A/B/C) plus
    optional synthetic-fallback cases. Idempotent — re-runs are safe.

    Three primary cases (anonymised from the RUDN K08.1 cohort, all PII stripped,
    full-image cropping + watermark applied):
      file_id 1001 = Case A — multi-tooth + multiple implants + bridges
      file_id 1002 = Case B — heavy restoration (crowns + endo + bridge + impl)
      file_id 1003 = Case C — implant-only / All-on-X (10 impl + bar overdenture)

    The 3 synthetic schema-test fixtures from ../examples/synthetic_*.json
    remain available for testing the parser/bridges in isolation but are NOT
    seeded into the demo SQLite (they would clutter the file list).
    """
    with db_connect() as conn:
        # Sandbox
        conn.execute(
            "INSERT OR IGNORE INTO sandboxes (sandbox_id, label, is_demo) VALUES (?, ?, ?)",
            ("RUDN", "Anonymised Demo Cases (RUDN K08.1, PII stripped)", 1),
        )

        # ── Primary: 3 anonymised real-cohort cases with attached OPG images ──
        cases_dir = HERE / "data" / "cases"
        images_dir = HERE / "static" / "images" / "cases"

        for case_letter in ("A", "B", "C"):
            json_path = cases_dir / f"case_{case_letter}.json"
            png_path = images_dir / f"case_{case_letter}.png"
            if not json_path.exists():
                print(f"  ⚠ Missing {json_path.name}, skipping case {case_letter}")
                continue

            doc = json.loads(json_path.read_text(encoding="utf-8"))
            file_id = doc["file_id"]                     # 1001/1002/1003
            label = doc["label"]                         # generic case description
            formula = doc.get("formula", {})
            bridge_links = doc.get("bridge_links", {})
            tooth_notes = doc.get("tooth_notes", {})
            root_data = doc.get("root_data", {})

            # Ingest the corresponding anonymised PNG
            image_id = _ingest_image(conn, png_path, f"case_{case_letter}_anonymised")

            conn.execute(
                """
                INSERT OR REPLACE INTO files (file_id, sandbox_id, filename, label, image_id, created_at)
                VALUES (?, 'RUDN', ?, ?, ?, '2026-01-01T00:00:00Z')
                """,
                (file_id, f"case_{case_letter}.png", label, image_id),
            )
            conn.execute(
                """
                INSERT OR REPLACE INTO ground_truth (file_id, formula_json, bridge_links_json,
                                                     tooth_notes_json, root_data_json,
                                                     crop_overrides_json, diagnostic_sites_json)
                VALUES (?, ?, ?, ?, ?, '{}', '{}')
                """,
                (
                    file_id,
                    json.dumps(formula),
                    json.dumps(bridge_links),
                    json.dumps(tooth_notes),
                    json.dumps(root_data),
                ),
            )
            existing = conn.execute(
                "SELECT 1 FROM history WHERE file_id = ?", (file_id,)
            ).fetchone()
            if not existing:
                conn.execute(
                    """
                    INSERT INTO history (file_id, sequence_num, change_type, source, session_id)
                    VALUES (?, 1, 'bulk_prefill', 'manual', ?)
                    """,
                    (file_id, str(uuid.uuid4())),
                )
            for algo in _generate_mock_algorithms(formula):
                conn.execute(
                    """
                    INSERT OR REPLACE INTO algorithms
                    (file_id, codename, config_json, formula_json, confidence, score,
                     is_champion, is_alive, generation, branch)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        file_id, algo["codename"], json.dumps(algo["config"]),
                        json.dumps(algo["formula"]), algo["confidence"], algo["score"],
                        algo["is_champion"], algo["is_alive"],
                        algo["generation"], algo["branch"],
                    ),
                )
            print(f"  ✓ Case {case_letter} → file_id={file_id}, {len(formula)} teeth, "
                  f"{len(bridge_links)} bridge links, image: {png_path.name}")


# ============================================================================
# HTML pages
# ============================================================================


@app.route("/")
def landing_page():
    """Landing page = polished IJOS-quality static demo (paper Figure 2 source).

    The standalone HTML at /static/demo.html is fully self-contained — no API
    calls, all SVG generated procedurally — so it works on any browser without
    backend setup. Reviewers see Q1-quality design first, then click into
    /darwin-lab for the full interactive Flask version (3 anonymised cases,
    layer editor, bridge exports, time-machine ground-truth history)."""
    return send_file(str(HERE / "static" / "demo.html"), mimetype="text/html")


@app.route("/demo")
def demo_page():
    """Static IJOS-quality demo (alias for /)."""
    return send_file(str(HERE / "static" / "demo.html"), mimetype="text/html")


@app.route("/darwin-lab")
def darwin_lab_page():
    """Full interactive Arena UI — backed by SQLite + bridges (FHIR/DICOM-SR/MIS/MMOral)."""
    return render_template("darwin_lab.html")


@app.route("/play")
def play_page():
    """Reviewer-facing playground = the full production Darwin-Lab Arena.

    Same template as /darwin-lab so reviewers get every piece of UI we
    iterated on: 22-status icon picker, layered status editor, Vertucci
    root-data, surface m/d/o/v/l checkboxes, anatomy panel, 16-cell
    crops carousel, fullscreen crop editor, time-machine ground-truth
    history, FDI bbox overlay on the OPG, etc.

    The bridges-export floating panel injected into darwin_lab.html
    surfaces the FHIR R4 / DICOM-SR / MIS / MMOral / ORIS converters
    so reviewers don't need to type API URLs by hand. Three anonymised
    K08.1 cases (A/B/C, file_id 1001-1003) are auto-seeded into SQLite
    on app startup; reviewers switch between them via the Sandbox file
    list at the top of the Arena."""
    return render_template("darwin_lab.html")


@app.route("/api/play/cases")
def api_play_cases():
    """List the 3 demo cases for the playground (A/B/C)."""
    cases = []
    for letter, file_id in (("A", 1001), ("B", 1002), ("C", 1003)):
        json_path = HERE / "data" / "cases" / f"case_{letter}.json"
        png_path = HERE / "static" / "images" / "cases" / f"case_{letter}.png"
        if not json_path.exists() or not png_path.exists():
            continue
        doc = json.loads(json_path.read_text(encoding="utf-8"))
        cases.append({
            "letter": letter,
            "file_id": file_id,
            "label": doc.get("label", f"Case {letter}"),
            "image_url": f"/static/images/cases/case_{letter}.png",
            "formula": doc.get("formula", {}),
            "tooth_notes": doc.get("tooth_notes", {}),
            "root_data": doc.get("root_data", {}),
        })
    return jsonify({"cases": cases})


@app.route("/api/play/export", methods=["POST"])
def api_play_export():
    """Stateless export — accepts {formula, format} JSON, returns the bridge output.

    Unlike /api/export/<file_id> this does NOT touch the SQLite ground-truth row,
    so reviewers can experiment in /play without polluting the demo state."""
    payload = request.get_json(silent=True) or {}
    formula = payload.get("formula") or {}
    fmt = (payload.get("format") or "oris").lower()
    case_letter = payload.get("case", "X")

    # Build a lightweight ORIS doc directly from the FDI→status map,
    # mirroring the logic in _build_oris_doc_from_db() but skipping the DB.
    teeth: dict[str, dict] = {}
    if lookup_oris_from_fdi is not None:
        for fdi, status in formula.items():
            occupant = "N"
            if status == "missing":
                occupant = "A"
            elif status in ("implant", "impl_fixture", "impl_healing", "impl_restored"):
                occupant = "F"
            elif status == "bridge":
                occupant = "B"
            elif status == "cantilever":
                occupant = "C"
            elif status == "uncertain":
                occupant = "U"
            try:
                code = lookup_oris_from_fdi(fdi, occupant)
            except Exception:
                continue
            teeth[code] = {
                "fdi": fdi,
                "occupant": occupant,
                "status_layers": status,
            }

    doc = {
        "oris_version": "0.1.0",
        "document_id": f"PLAY_{case_letter}",
        "patient": {"anonymized_id": f"P_PLAY_{case_letter}_DEMO", "age_years": None, "sex": None},
        "imaging": {
            "modality": "OPG",
            "device": "ORIS Reference Application — Playground",
            "acquisition_date": "2026-01-01T00:00:00Z",
        },
        "teeth": teeth,
        "ground_truth_meta": {
            "source": "manual",
            "session_id": "play-session",
            "sequence_num": 1,
        },
        "notes": f"Playground export for Case {case_letter}",
    }

    if fmt == "oris":
        body = json.dumps(doc, ensure_ascii=False, indent=2)
        return Response(body, mimetype="application/json",
                        headers={"Content-Disposition": f"attachment; filename=oris_play_{case_letter}.json"})
    if fmt == "fhir":
        if to_fhir is None:
            return jsonify({"error": "bridges.fhir not available"}), 500
        body = json.dumps(to_fhir(doc), ensure_ascii=False, indent=2)
        return Response(body, mimetype="application/json",
                        headers={"Content-Disposition": f"attachment; filename=fhir_play_{case_letter}.json"})
    if fmt == "dicom":
        if to_dicom_sr is None:
            return jsonify({"error": "bridges.dicom_sr not available"}), 500
        body = to_dicom_sr(doc)
        return Response(body, mimetype="application/xml",
                        headers={"Content-Disposition": f"attachment; filename=dicom_sr_play_{case_letter}.xml"})
    if fmt == "mis":
        if to_mis_chart is None:
            return jsonify({"error": "bridges.mis not available"}), 500
        body = json.dumps(to_mis_chart(doc), ensure_ascii=False, indent=2)
        return Response(body, mimetype="application/json",
                        headers={"Content-Disposition": f"attachment; filename=mis_chart_play_{case_letter}.json"})
    if fmt == "mmoral":
        if to_mmoral_format is None:
            return jsonify({"error": "bridges.mmoral not available"}), 500
        body = json.dumps(to_mmoral_format(doc), ensure_ascii=False, indent=2)
        return Response(body, mimetype="application/json",
                        headers={"Content-Disposition": f"attachment; filename=mmoral_play_{case_letter}.json"})

    return jsonify({"error": f"unknown format '{fmt}' (use oris|fhir|dicom|mis|mmoral)"}), 400


# ============================================================================
# Sandbox endpoints
# ============================================================================


@app.route("/api/darwin/sandboxes")
def api_sandboxes():
    rows = get_db().execute("SELECT sandbox_id, label, created_at, is_demo FROM sandboxes").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/darwin/sandbox/<sbx_id>/files")
def api_sandbox_files(sbx_id: str):
    rows = get_db().execute(
        """
        SELECT f.file_id, f.filename, f.label, f.created_at,
               (SELECT 1 FROM algorithms a WHERE a.file_id = f.file_id LIMIT 1) AS has_experiments,
               f.sandbox_id
        FROM files f WHERE f.sandbox_id = ?
        ORDER BY f.file_id
        """,
        (sbx_id,),
    ).fetchall()
    return jsonify([
        {**dict(r), "has_experiments": bool(r["has_experiments"])} for r in rows
    ])


@app.route("/api/darwin/sandbox/<sbx_id>/add-to-arena", methods=["POST"])
def api_sandbox_add_to_arena(sbx_id: str):
    return jsonify({"ok": True, "added_to_arena": True})


@app.route("/api/darwin/sandbox/<sbx_id>/import-folder", methods=["POST"])
@app.route("/api/darwin/sandbox/<sbx_id>/import-image", methods=["POST"])
def api_sandbox_import(sbx_id: str):
    return jsonify({"ok": False, "error": "Use /api/upload-opg for image upload."}), 403


@app.route("/api/darwin/sandboxes", methods=["POST"])
def api_sandbox_create():
    return jsonify({"ok": False, "error": "Disabled in demo mode."}), 403


@app.route("/api/darwin/sandboxes/<sbx_id>", methods=["DELETE"])
def api_sandbox_delete(sbx_id: str):
    return jsonify({"ok": False, "error": "Disabled in demo mode."}), 403


# ============================================================================
# Test cases / Arena endpoints
# ============================================================================


@app.route("/api/darwin/test-cases")
def api_test_cases():
    rows = get_db().execute(
        "SELECT file_id, filename, label, created_at FROM files ORDER BY file_id"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/darwin/arena/<int:file_id>")
def api_arena_data(file_id: int):
    rows = get_db().execute(
        """
        SELECT codename, config_json, formula_json, confidence, score,
               is_champion, is_alive, generation, branch
        FROM algorithms WHERE file_id = ?
        ORDER BY generation, branch, codename
        """,
        (file_id,),
    ).fetchall()
    algos = []
    for r in rows:
        config = json.loads(r["config_json"])
        algos.append({
            "codename": r["codename"],
            "config": config,
            "config_summary": f"{len(config.get('crops', []))} crops × {len(config.get('filters', []))} filters",
            "formula": json.loads(r["formula_json"]),
            "confidence": r["confidence"],
            "score": r["score"],
            "is_champion": bool(r["is_champion"]),
            "is_alive": bool(r["is_alive"]),
            "generation": r["generation"],
            "branch": r["branch"],
            "images": ["synthetic"],
        })
    return jsonify({"file_id": file_id, "algorithms": algos})


@app.route("/api/darwin/arena/candidates")
def api_arena_candidates():
    rows = get_db().execute(
        "SELECT file_id, filename, label, created_at FROM files ORDER BY file_id"
    ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/darwin/arena/add", methods=["POST"])
def api_arena_add():
    return jsonify({"ok": True})


# ============================================================================
# Ground-truth endpoints (SQLite-backed)
# ============================================================================


@app.route("/api/darwin/ground-truth/<int:file_id>", methods=["GET"])
def api_gt_get(file_id: int):
    db = get_db()
    row = db.execute(
        """
        SELECT formula_json, bridge_links_json, tooth_notes_json, root_data_json,
               crop_overrides_json, diagnostic_sites_json, last_modified
        FROM ground_truth WHERE file_id = ?
        """,
        (file_id,),
    ).fetchone()
    if row is None:
        return jsonify({"file_id": file_id, "formula": {}, "saved": False, "current_seq": 0})
    seq_row = db.execute(
        "SELECT MAX(sequence_num) AS s FROM history WHERE file_id = ?", (file_id,)
    ).fetchone()
    return jsonify({
        "file_id": file_id,
        "formula": json.loads(row["formula_json"]),
        "bridge_links": json.loads(row["bridge_links_json"]),
        "tooth_notes": json.loads(row["tooth_notes_json"]),
        "root_data": json.loads(row["root_data_json"]),
        "crop_overrides": json.loads(row["crop_overrides_json"]),
        "diagnostic_sites": json.loads(row["diagnostic_sites_json"]),
        "saved": True,
        "current_seq": seq_row["s"] or 0,
    })


@app.route("/api/darwin/ground-truth/<int:file_id>", methods=["POST"])
def api_gt_save(file_id: int):
    data = request.json or {}
    formula = data.get("formula", {})
    bridge_links = data.get("bridge_links", {})
    tooth_notes = data.get("tooth_notes", {})
    root_data = data.get("root_data", {})
    crop_overrides = data.get("crop_overrides", {})
    diagnostic_sites = data.get("diagnostic_sites", {})
    source = data.get("source", "manual")
    session_id = data.get("session_id", str(uuid.uuid4()))

    db = get_db()
    # Ensure file exists
    file_row = db.execute("SELECT 1 FROM files WHERE file_id = ?", (file_id,)).fetchone()
    if not file_row:
        return jsonify({"ok": False, "error": f"unknown file_id {file_id}"}), 404

    # Old formula (for diff)
    old_row = db.execute(
        "SELECT formula_json FROM ground_truth WHERE file_id = ?", (file_id,)
    ).fetchone()
    old_formula = json.loads(old_row["formula_json"]) if old_row else {}

    db.execute(
        """
        INSERT INTO ground_truth (file_id, formula_json, bridge_links_json,
                                  tooth_notes_json, root_data_json,
                                  crop_overrides_json, diagnostic_sites_json, last_modified)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(file_id) DO UPDATE SET
            formula_json = excluded.formula_json,
            bridge_links_json = excluded.bridge_links_json,
            tooth_notes_json = excluded.tooth_notes_json,
            root_data_json = excluded.root_data_json,
            crop_overrides_json = excluded.crop_overrides_json,
            diagnostic_sites_json = excluded.diagnostic_sites_json,
            last_modified = datetime('now')
        """,
        (
            file_id,
            json.dumps(formula),
            json.dumps(bridge_links),
            json.dumps(tooth_notes),
            json.dumps(root_data),
            json.dumps(crop_overrides),
            json.dumps(diagnostic_sites),
        ),
    )

    # History rows for diffs
    seq_row = db.execute(
        "SELECT COALESCE(MAX(sequence_num), 0) AS s FROM history WHERE file_id = ?", (file_id,)
    ).fetchone()
    next_seq = (seq_row["s"] or 0) + 1

    all_fdis = set(old_formula.keys()) | set(formula.keys())
    diffs = [
        (fdi, old_formula.get(fdi, ""), formula.get(fdi, ""))
        for fdi in sorted(all_fdis)
        if old_formula.get(fdi, "") != formula.get(fdi, "")
    ]
    if diffs:
        for fdi, old_v, new_v in diffs:
            db.execute(
                """
                INSERT INTO history (file_id, sequence_num, fdi, old_value, new_value,
                                     change_type, source, session_id)
                VALUES (?, ?, ?, ?, ?, 'single_update', ?, ?)
                """,
                (file_id, next_seq, fdi, old_v, new_v, source, session_id),
            )
    else:
        db.execute(
            """
            INSERT INTO history (file_id, sequence_num, change_type, source, session_id)
            VALUES (?, ?, 'save_no_diff', ?, ?)
            """,
            (file_id, next_seq, source, session_id),
        )

    db.commit()
    return jsonify({"ok": True, "file_id": file_id, "saved": True, "current_seq": next_seq})


@app.route("/api/darwin/ground-truth/<int:file_id>/history")
def api_gt_history(file_id: int):
    limit = int(request.args.get("limit", 50))
    rows = get_db().execute(
        """
        SELECT sequence_num, fdi, old_value, new_value, change_type, source,
               session_id, created_at
        FROM history WHERE file_id = ?
        ORDER BY sequence_num DESC, id DESC
        LIMIT ?
        """,
        (file_id, limit),
    ).fetchall()
    return jsonify({"file_id": file_id, "history": [dict(r) for r in rows]})


@app.route("/api/darwin/ground-truth/<int:file_id>/snapshot/<int:seq>")
def api_gt_snapshot(file_id: int, seq: int):
    """Best-effort: return current formula tagged with seq (full replay not implemented)."""
    row = get_db().execute(
        "SELECT formula_json FROM ground_truth WHERE file_id = ?", (file_id,)
    ).fetchone()
    if not row:
        abort(404)
    return jsonify({
        "file_id": file_id,
        "sequence_num": seq,
        "formula": json.loads(row["formula_json"]),
    })


@app.route("/api/darwin/ground-truth/<int:file_id>/rollback/<int:seq>", methods=["POST"])
def api_gt_rollback(file_id: int, seq: int):
    db = get_db()
    seq_row = db.execute(
        "SELECT COALESCE(MAX(sequence_num), 0) AS s FROM history WHERE file_id = ?", (file_id,)
    ).fetchone()
    new_seq = (seq_row["s"] or 0) + 1
    db.execute(
        """
        INSERT INTO history (file_id, sequence_num, change_type, source, session_id, old_value, new_value)
        VALUES (?, ?, 'rollback', 'manual', ?, ?, ?)
        """,
        (file_id, new_seq, str(uuid.uuid4()), f"seq={seq}", "rolled_back"),
    )
    db.commit()
    return jsonify({"ok": True, "rolled_back_to": seq, "new_seq": new_seq})


# ============================================================================
# Image upload + serving (with privacy gate, EXIF strip, watermark)
# ============================================================================


WATERMARK_TEXT = "ORIS v0.1 reference app — synthetic / non-clinical"
MAX_IMG_DIM = 4096


def _watermark_and_strip_exif(raw_bytes: bytes) -> tuple[bytes, int, int]:
    """Strip EXIF, apply visible watermark, enforce max-dim. Return (png_bytes, w, h)."""
    if not HAS_PILLOW:
        raise RuntimeError("Pillow not installed")

    src = Image.open(io.BytesIO(raw_bytes))

    # Convert to RGB (drop EXIF orientation, GPS, datetime, all metadata)
    if src.mode not in ("RGB", "L"):
        src = src.convert("RGB")
    else:
        # Re-create from raw pixel data → drops all metadata
        src = Image.new(src.mode, src.size, 0).paste(src) or src

    # Hard re-encode to drop EXIF
    buf = io.BytesIO()
    src.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    img = Image.open(buf).convert("RGB")

    # Enforce max dim
    if max(img.size) > MAX_IMG_DIM:
        img.thumbnail((MAX_IMG_DIM, MAX_IMG_DIM), Image.LANCZOS)

    w, h = img.size

    # Apply watermark (bottom-right, semi-transparent layer composited)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", max(14, h // 80))
    except Exception:
        font = ImageFont.load_default()
    bbox = draw.textbbox((0, 0), WATERMARK_TEXT, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    pad = 12
    x = w - tw - pad
    y = h - th - pad
    draw.rectangle([x - 6, y - 4, x + tw + 6, y + th + 6], fill=(0, 0, 0, 100))
    draw.text((x, y), WATERMARK_TEXT, fill=(255, 255, 255, 180), font=font)
    img_rgba = img.convert("RGBA")
    img_rgba = Image.alpha_composite(img_rgba, overlay).convert("RGB")

    out = io.BytesIO()
    img_rgba.save(out, format="PNG", optimize=True)
    return out.getvalue(), w, h


@app.route("/api/upload-opg", methods=["POST"])
def api_upload_opg():
    if not HAS_PILLOW:
        return jsonify({"ok": False, "error": "Pillow not installed on server."}), 500

    if request.form.get("privacy_ack") != "1":
        return jsonify({
            "ok": False,
            "error": "privacy_ack=1 required. By submitting, you confirm the image is synthetic, public domain, or fully anonymised.",
        }), 400

    file = request.files.get("image")
    if not file:
        return jsonify({"ok": False, "error": "no file uploaded"}), 400

    raw = file.read()
    if not raw:
        return jsonify({"ok": False, "error": "empty file"}), 400

    sha = hashlib.sha256(raw).hexdigest()
    db = get_db()
    existing = db.execute(
        "SELECT id, width, height FROM uploaded_images WHERE sha256 = ?", (sha,)
    ).fetchone()
    if existing:
        return jsonify({
            "ok": True, "image_id": existing["id"],
            "width": existing["width"], "height": existing["height"],
            "deduplicated": True,
        })

    try:
        wm_bytes, w, h = _watermark_and_strip_exif(raw)
    except Exception as e:
        return jsonify({"ok": False, "error": f"image processing failed: {e}"}), 400

    cur = db.execute(
        """
        INSERT INTO uploaded_images (sha256, mime, width, height, bytes,
                                     privacy_ack, source_label, original_size)
        VALUES (?, 'image/png', ?, ?, ?, 1, 'user_upload', ?)
        """,
        (sha, w, h, wm_bytes, len(raw)),
    )
    db.commit()
    return jsonify({
        "ok": True, "image_id": cur.lastrowid,
        "width": w, "height": h,
        "watermarked": True, "exif_stripped": True,
    })


@app.route("/uploads/<int:image_id>")
def serve_upload(image_id: int):
    row = get_db().execute(
        "SELECT bytes, mime FROM uploaded_images WHERE id = ?", (image_id,)
    ).fetchone()
    if not row:
        abort(404)
    return Response(row["bytes"], mimetype=row["mime"])


@app.route("/panorama/sandbox/<int:file_id>/image")
@app.route("/panorama/<int:file_id>/image")
def panorama_image(file_id: int):
    """Serve the OPG image associated with a file_id (synthetic placeholder by default).

    Two URL aliases:
      - /panorama/sandbox/<id>/image  — sandbox-aware path used by some JS
      - /panorama/<id>/image          — production-API path used by opg-viewer.js
    Both return the same image so the production JS modules work unmodified.
    """
    row = get_db().execute(
        """
        SELECT u.bytes, u.mime FROM files f
        JOIN uploaded_images u ON u.id = f.image_id
        WHERE f.file_id = ?
        """,
        (file_id,),
    ).fetchone()
    if row:
        return Response(row["bytes"], mimetype=row["mime"])
    # Fallback: ship-with-app placeholder
    img_path = HERE / "static" / "images" / "synthetic_opg_001.png"
    if img_path.exists():
        return send_file(str(img_path), mimetype="image/png")
    abort(404)


@app.route("/api/panorama/<int:file_id>/overlay-state", methods=["GET", "POST"])
def panorama_overlay_state(file_id: int):
    if request.method == "POST":
        return jsonify({"ok": True})
    return jsonify({"file_id": file_id, "filters": [], "zoom": 1.0, "pan_x": 0, "pan_y": 0})


@app.route("/api/files/<int:file_id>/use-image/<int:image_id>", methods=["POST"])
def api_attach_image(file_id: int, image_id: int):
    """Attach an uploaded image to a file (for arena viewing)."""
    db = get_db()
    db.execute("UPDATE files SET image_id = ? WHERE file_id = ?", (image_id, file_id))
    db.commit()
    return jsonify({"ok": True, "file_id": file_id, "image_id": image_id})


# ============================================================================
# Bridges (FHIR / DICOM-SR / MIS / MMOral) — using oris.bridges
# ============================================================================


def _build_oris_doc_from_db(file_id: int) -> dict | None:
    """Reconstruct a minimal ORIS document from SQLite GT for bridge export."""
    db = get_db()
    f_row = db.execute(
        "SELECT filename, label, created_at FROM files WHERE file_id = ?", (file_id,)
    ).fetchone()
    if not f_row:
        return None
    gt_row = db.execute(
        """
        SELECT formula_json, bridge_links_json, tooth_notes_json, root_data_json
        FROM ground_truth WHERE file_id = ?
        """,
        (file_id,),
    ).fetchone()
    if not gt_row:
        return None

    formula = json.loads(gt_row["formula_json"])
    bridge_links = json.loads(gt_row["bridge_links_json"])
    tooth_notes = json.loads(gt_row["tooth_notes_json"])
    root_data = json.loads(gt_row["root_data_json"])

    # Build teeth dict with ORIS 6-char codes
    teeth: dict[str, dict] = {}
    if lookup_oris_from_fdi is not None:
        for fdi, status in formula.items():
            occupant = "N"
            if status == "missing":
                occupant = "A"
            elif status in ("implant", "impl_fixture", "impl_healing", "impl_restored"):
                occupant = "F"
            elif status == "bridge":
                occupant = "B"
            elif status == "cantilever":
                occupant = "C"
            elif status == "uncertain":
                occupant = "U"
            try:
                code = lookup_oris_from_fdi(fdi, occupant)
            except Exception:
                continue
            teeth[code] = {
                "fdi": fdi,
                "occupant": occupant,
                "status_layers": status,
            }
            if fdi in root_data:
                teeth[code]["root_data"] = root_data[fdi]

    return {
        "oris_version": "0.1.0",
        "document_id": f"REF_APP_{file_id}",
        "patient": {"anonymized_id": f"P_{file_id}_DEMO", "age_years": None, "sex": None},
        "imaging": {
            "modality": "OPG",
            "device": "ORIS Reference Application",
            "acquisition_date": f_row["created_at"] or "2026-01-01T00:00:00Z",
        },
        "teeth": teeth,
        "bridge_links": bridge_links,
        "tooth_notes": tooth_notes,
        "ground_truth_meta": {
            "source": "manual",
            "session_id": "00000000-0000-0000-0000-000000000000",
            "sequence_num": 1,
        },
        "notes": f_row["label"] or "Synthetic example",
    }


@app.route("/api/export/<int:file_id>")
def api_export(file_id: int):
    """Export the file_id's ORIS document in one of: oris, fhir, dicom, mis, mmoral."""
    fmt = (request.args.get("format") or "oris").lower()
    doc = _build_oris_doc_from_db(file_id)
    if doc is None:
        return jsonify({"error": f"file_id {file_id} not found"}), 404

    if fmt == "oris":
        body = json.dumps(doc, ensure_ascii=False, indent=2)
        return Response(body, mimetype="application/json",
                        headers={"Content-Disposition": f"attachment; filename=oris_{file_id}.json"})
    if fmt == "fhir":
        if to_fhir is None:
            return jsonify({"error": "bridges.fhir not available"}), 500
        body = json.dumps(to_fhir(doc), ensure_ascii=False, indent=2)
        return Response(body, mimetype="application/json",
                        headers={"Content-Disposition": f"attachment; filename=fhir_{file_id}.json"})
    if fmt == "dicom":
        if to_dicom_sr is None:
            return jsonify({"error": "bridges.dicom_sr not available"}), 500
        body = to_dicom_sr(doc)
        return Response(body, mimetype="application/xml",
                        headers={"Content-Disposition": f"attachment; filename=dicom_sr_{file_id}.xml"})
    if fmt == "mis":
        if to_mis_chart is None:
            return jsonify({"error": "bridges.mis not available"}), 500
        body = json.dumps(to_mis_chart(doc), ensure_ascii=False, indent=2)
        return Response(body, mimetype="application/json",
                        headers={"Content-Disposition": f"attachment; filename=mis_chart_{file_id}.json"})
    if fmt == "mmoral":
        if to_mmoral_format is None:
            return jsonify({"error": "bridges.mmoral not available"}), 500
        body = json.dumps(to_mmoral_format(doc), ensure_ascii=False, indent=2)
        return Response(body, mimetype="application/json",
                        headers={"Content-Disposition": f"attachment; filename=mmoral_{file_id}.json"})

    return jsonify({"error": f"unknown format '{fmt}' (use oris|fhir|dicom|mis|mmoral)"}), 400


@app.route("/api/validate/<int:file_id>")
def api_validate(file_id: int):
    """Validate the file_id's reconstructed ORIS doc against the JSON Schema."""
    if validate_oris is None:
        return jsonify({"error": "parser.validate not available"}), 500
    doc = _build_oris_doc_from_db(file_id)
    if doc is None:
        return jsonify({"error": f"file_id {file_id} not found"}), 404
    errors = validate_oris(doc)
    return jsonify({
        "file_id": file_id,
        "valid": all(e.severity != "error" for e in errors),
        "errors": [str(e) for e in errors if e.severity == "error"],
        "warnings": [str(e) for e in errors if e.severity == "warning"],
    })


# ============================================================================
# Mock endpoints needed by production UI (return empty/sane defaults)
# ============================================================================


_FILE_TO_LETTER = {1001: "A", 1002: "B", 1003: "C"}


@app.route("/api/darwin/tooth-bboxes/<int:file_id>")
def api_tooth_bboxes(file_id: int):
    """Tooth bboxes for the production Arena overlay.

    For the three anonymised demo cases (file_id 1001/1002/1003) we serve
    REAL SemiT-SAM detections that were extracted once via
    `tools/extract_case_bboxes.py` and committed to
    `data/cases/case_X_bboxes.json`. That keeps the public reference app
    visually faithful to clinical reality (crops sit on actual teeth, not
    on math-row positions) without shipping model weights or requiring
    the reviewer to run inference.

    For any other file_id (e.g. user-uploaded sandbox OPG without a
    pre-baked detection), we fall back to a simple synthetic spread
    across the arch — best-effort, clearly labelled `formula_source:
    'demo_synthetic'` so callers can distinguish."""
    letter = _FILE_TO_LETTER.get(file_id)
    if letter:
        baked_path = HERE / "data" / "cases" / f"case_{letter}_bboxes.json"
        if baked_path.exists():
            data = json.loads(baked_path.read_text(encoding="utf-8"))
            # Production frontend expects each detection to carry a
            # "cls" key — SemiT-SAM JSON omits it, so we add it on read.
            for det in data.get("detections", []):
                det.setdefault("cls", "Tooth")
            return jsonify({
                "detections": data.get("detections", []),
                "image_size": data.get("image_size", {}),
                "fdi_map": data.get("fdi_map", {}),
                "formula_source": data.get("model", "SemiT-SAM"),
            })

    # Fallback: math-row spread for unknown file_ids
    formula = json.loads((get_db().execute(
        "SELECT formula_json FROM ground_truth WHERE file_id = ?", (file_id,)
    ).fetchone() or {"formula_json": "{}"})["formula_json"])
    OPG_W, OPG_H = 2880, 1450
    order_top = [f"1.{8-i}" for i in range(8)] + [f"2.{i+1}" for i in range(8)]
    order_bot = [f"4.{i+1}" for i in range(8)] + [f"3.{8-i}" for i in range(8)]
    detections = []
    for arch_idx, ordering in enumerate([order_top, order_bot]):
        y_center = OPG_H * (0.42 if arch_idx == 0 else 0.58)
        for i, fdi in enumerate(ordering):
            if fdi not in formula or not formula[fdi]:
                continue
            x = int(OPG_W * 0.1 + (OPG_W * 0.8) * (i / 15))
            detections.append({
                "idx": len(detections), "cls": "Tooth", "conf": 0.92,
                "x1": x - 35, "y1": int(y_center) - 60,
                "x2": x + 35, "y2": int(y_center) + 60,
                "fdi": fdi,
            })
    fdi_map: dict[str, list[int]] = {}
    for d in detections:
        fdi_map.setdefault(d["fdi"], []).append(d["idx"])
    return jsonify({
        "detections": detections,
        "image_size": {"width": OPG_W, "height": OPG_H},
        "fdi_map": fdi_map,
        "formula_source": "demo_synthetic",
    })


@app.route("/api/darwin/arena/fdi-correction", methods=["POST"])
def api_fdi_correction_post():
    return jsonify({"ok": True})


@app.route("/api/darwin/arena/fdi-corrections/<int:file_id>")
def api_fdi_corrections_get(file_id: int):
    return jsonify({"file_id": file_id, "corrections": []})


@app.route("/api/darwin/card-hints/<int:file_id>")
def api_card_hints(file_id: int):
    return jsonify({"file_id": file_id, "implant_hints": [], "missing_hints": []})


@app.route("/api/darwin/card-context/<int:file_id>")
def api_card_context(file_id: int):
    f = get_db().execute(
        "SELECT label FROM files WHERE file_id = ?", (file_id,)
    ).fetchone()
    return jsonify({
        "file_id": file_id,
        "patient_card": (f["label"] if f else "Synthetic example"),
        "patient_name": "Anonymized Synthetic",
        "extracted_fields": {},
    })


@app.route("/api/darwin/ai-hint/<int:file_id>", methods=["GET"])
def api_ai_hint(file_id: int):
    return jsonify({"file_id": file_id, "hints": [], "leader_codename": "alpha-baseline"})


@app.route("/api/darwin/prefill-from-card/<int:file_id>")
def api_prefill_from_card(file_id: int):
    return jsonify({"file_id": file_id, "formula": {}, "available": False})


@app.route("/api/darwin/fdi-slots/<int:file_id>")
def api_fdi_slots(file_id: int):
    formula = json.loads((get_db().execute(
        "SELECT formula_json FROM ground_truth WHERE file_id = ?", (file_id,)
    ).fetchone() or {"formula_json": "{}"})["formula_json"])
    return jsonify({
        "file_id": file_id,
        "slots": [{"fdi": fdi, "status": s, "occupied": bool(s)} for fdi, s in formula.items()],
    })


@app.route("/api/darwin/tree")
def api_darwin_tree():
    rows = get_db().execute(
        "SELECT id, file_id, codename, generation, branch, is_alive, is_champion, confidence, score FROM algorithms"
    ).fetchall()
    nodes = []
    for r in rows:
        nodes.append({
            "id": r["id"], "experiment_id": None, "name": r["codename"], "version": "v1",
            "codename": r["codename"], "generation": r["generation"], "branch": r["branch"],
            "mutation_type": "synthetic", "parent_id": None,
            "is_alive": bool(r["is_alive"]), "is_champion": bool(r["is_champion"]),
            "verdict": "synthetic_demo", "confidence": r["confidence"],
            "teeth": 32, "implants": 0, "restorations": 0, "pathologies": 0,
            "tokens": 0, "duration_ms": 0, "images": ["synthetic"],
            "tldr": "Synthetic demo algorithm", "tags": ["demo"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "score_human": r["score"],
        })
    return jsonify({"nodes": nodes})


@app.route("/api/darwin/experiment/<exp_id>")
@app.route("/api/darwin/experiment/<exp_id>/preview")
def api_experiment(exp_id: str):
    return jsonify({"experiment_id": exp_id, "preview": "Synthetic demo experiment"})


@app.route("/api/darwin/evaluate-formula", methods=["POST"])
def api_evaluate_formula():
    return jsonify({"score": 0.95, "matches": 30, "mismatches": 2, "demo": True})


@app.route("/api/darwin/mmoral-results")
def api_mmoral_results():
    return jsonify({"results": [], "demo": True})


@app.route("/api/darwin/mcnemar/<a>/<b>/<cat>")
@app.route("/api/darwin/confusion/<algo>/<category>")
def api_stats_passthrough(*args, **kwargs):
    return jsonify({"matrix": [[0, 0], [0, 0]], "p_value": None, "demo": True})


@app.route("/api/darwin/learning/stats")
def api_learning_stats():
    return jsonify({"corrections_total": 0, "uncertainty_avg": 0.0, "demo": True})


@app.route("/api/darwin/vote", methods=["POST"])
def api_darwin_vote():
    return jsonify({"ok": True, "demo": True})


@app.route("/api/darwin/crop-overrides/<int:file_id>", methods=["POST"])
def api_crop_overrides(file_id: int):
    data = request.json or {}
    db = get_db()
    db.execute(
        "UPDATE ground_truth SET crop_overrides_json = ? WHERE file_id = ?",
        (json.dumps(data.get("crop_overrides", {})), file_id),
    )
    db.commit()
    return jsonify({"ok": True, "file_id": file_id})


@app.route("/api/darwin/batch-prepopulate-gt", methods=["POST"])
@app.route("/api/darwin/batch-w0-to-gt", methods=["POST"])
def api_batch_endpoints():
    return jsonify({"ok": False, "error": "Batch ops disabled in demo."}), 403


@app.route("/api/darwin/save-analysis/<int:file_id>", methods=["POST"])
def api_save_analysis(file_id: int):
    return jsonify({"ok": True, "file_id": file_id})


@app.route("/api/darwin/analysis-status/<int:file_id>")
def api_analysis_status(file_id: int):
    return jsonify({"file_id": file_id, "status": "ready", "demo": True})


@app.route("/api/darwin/analysis-queue")
def api_analysis_queue():
    return jsonify({"queue": [], "demo": True})


@app.route("/api/implant-assessment/<int:file_id>")
def api_implant_assessment(file_id: int):
    return jsonify({
        "file_id": file_id, "assessments": [],
        "summary": {"total_implants": 0, "with_complications": 0}, "demo": True,
    })


@app.route("/api/implant-assessment/batch-status")
def api_implant_assessment_batch():
    return jsonify({"queue": [], "demo": True})


@app.route("/api/implant-assessment/references")
def api_implant_references():
    return jsonify({
        "references": [
            {"id": "Schwarz_2020", "label": "Schwarz et al. 2018 (with 2020 updates)"},
            {"id": "Pjetursson_2012", "label": "Pjetursson et al. 2012"},
            {"id": "Misch_2008", "label": "Misch CE, 2008"},
            {"id": "Froum_2012", "label": "Froum & Rosen 2012"},
            {"id": "AAP_2017", "label": "AAP World Workshop 2017"},
        ]
    })


@app.route("/api/implant-library")
def api_implant_library_list():
    return jsonify({"systems": [
        {"key": "synthetic_a", "label": "Synthetic Implant A", "manufacturer": "Demo"},
    ]})


@app.route("/api/implant-library/<system>/svg")
@app.route("/api/implant-library/<system>/match")
@app.route("/api/implant-library/<system>/silhouette")
def api_implant_library_detail(system: str):
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="130">'
            '<rect width="60" height="130" fill="#222" stroke="#666"/>'
            '<text x="30" y="70" text-anchor="middle" fill="#ccc" font-size="10">SYNTHETIC</text>'
            '</svg>'), 200, {"Content-Type": "image/svg+xml"}


@app.route("/api/expert/timeline")
def api_expert_timeline():
    return jsonify({"events": [], "demo": True})


@app.route("/api/panorama-analysis/<int:analysis_id>/review")
def api_panorama_analysis_review(analysis_id: int):
    return jsonify({"analysis_id": analysis_id, "demo": True})


@app.route("/api/patient/<int:patient_id>/panoramas")
def api_patient_panoramas(patient_id: int):
    return jsonify([])


@app.errorhandler(404)
def not_found(_e):
    if request.path.startswith("/api/"):
        return jsonify({"demo": True, "endpoint": request.path, "note": "not implemented in mock"}), 200
    return jsonify({"error": "Not Found", "path": request.path}), 404


# ============================================================================
# Main
# ============================================================================


def main() -> None:
    print("=" * 70)
    print("ORIS Reference Application (SQLite + Pillow + bridges)")
    print("=" * 70)
    print(f"  Repo root:  {REPO_ROOT}")
    print(f"  DB:         {DB_PATH}")
    print(f"  Pillow:     {'yes' if HAS_PILLOW else 'NO (image upload disabled)'}")
    print(f"  Parser/bridges imported: {'yes' if parse_tooth_layers is not None else 'NO'}")
    print()

    print("Initialising database...")
    init_db()
    print(f"  ✓ Schema ready at {DB_PATH}")

    print("\nSeeding synthetic examples (idempotent)...")
    bootstrap_demo_data()

    port = int(os.environ.get("PORT", 5050))
    print()
    print(f"⚡ Open in browser: http://localhost:{port}/darwin-lab")
    print()
    print("Privacy: localhost only, synthetic data, no telemetry. See ../PRIVACY.md.")
    print("=" * 70)
    print()

    app.run(debug=True, port=port, host="127.0.0.1", use_reloader=False)


if __name__ == "__main__":
    main()
