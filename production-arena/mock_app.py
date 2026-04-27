"""
ORIS Production-Arena Demo — Flask mock backend
================================================

Self-contained demo that runs the FULL production Darwin-Lab Arena UI
(14 JavaScript modules + CSS + HTML) against an in-memory mock backend
populated with synthetic data derived from ../examples/synthetic_*.json.

NO REAL DATA. NO POSTGRESQL. NO PII.

All API endpoints are mocked to return structurally valid responses
that allow the production UI to render and behave normally:
- click cells → cycle through statuses → save GT → see history
- view algorithm comparisons (3 synthetic algorithms per case)
- view anatomy panel, TMJ panel, airway panel
- export ORIS JSON

Storage is in-memory only. State is lost when the server stops.

Run:
    python3 -m pip install -r requirements.txt
    python3 mock_app.py
    open http://localhost:5050/darwin-lab

Privacy:
    All examples are synthetic. PRIVACY.md applies.
    Do not enter real patient data into this demo.
"""

from __future__ import annotations

import json
import os
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from threading import Lock

from flask import Flask, abort, jsonify, render_template, request, send_file


HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parent
EXAMPLES_DIR = REPO_ROOT / "examples"

app = Flask(__name__, template_folder=str(HERE / "templates"), static_folder=str(HERE / "static"))


# ============================================================================
# In-memory data store
# ============================================================================


class MockStore:
    """Thread-safe in-memory store mimicking the production PostgreSQL backend."""

    def __init__(self) -> None:
        self._lock = Lock()
        self.sandboxes: dict[str, dict] = {
            "RUDN": {
                "sandbox_id": "RUDN",
                "label": "Synthetic Demo Sandbox",
                "created_at": "2026-04-27T00:00:00Z",
                "is_demo": True,
            },
        }
        # file_id → {file_id, filename, label, created_at, has_experiments, sandbox_id}
        self.files: dict[int, dict] = {}
        # file_id → ORIS-style legacy formula dict
        self.ground_truth: dict[int, dict] = {}
        # file_id → list of {sequence_num, fdi, old_value, new_value, change_type, source, created_at}
        self.history: dict[int, list[dict]] = {}
        # file_id → list of {codename, formula, score, ...}
        self.algorithms: dict[int, list[dict]] = {}
        # file_id → list of {idx, cls, conf, x1, y1, x2, y2, fdi}
        self.tooth_bboxes: dict[int, list[dict]] = {}

    def lock(self):
        return self._lock


STORE = MockStore()


# ============================================================================
# Bootstrap synthetic data from ../examples/synthetic_*.json
# ============================================================================


def _oris_doc_to_legacy_formula(oris_doc: dict) -> tuple[dict, dict, dict, dict]:
    """Convert an ORIS document → (formula, bridge_links, tooth_notes, root_data) tuple
    matching the legacy production GT format.
    """
    formula: dict[str, str] = {}
    bridge_links = oris_doc.get("bridge_links", {}) or {}
    tooth_notes = oris_doc.get("tooth_notes", {}) or {}
    root_data: dict[str, dict] = {}

    for oris_code, tooth_obj in (oris_doc.get("teeth") or {}).items():
        if not isinstance(tooth_obj, dict):
            continue
        fdi = tooth_obj.get("fdi")
        if not fdi:
            continue
        formula[fdi] = tooth_obj.get("status_layers") or ""
        if "root_data" in tooth_obj:
            root_data[fdi] = tooth_obj["root_data"]

    return formula, bridge_links, tooth_notes, root_data


def _generate_mock_algorithms(file_id: int, gt_formula: dict) -> list[dict]:
    """Produce 3 synthetic algorithms with slight variations on the GT, to populate
    the Arena's algorithm-comparison view.
    """
    base = dict(gt_formula)

    # Algorithm A — perfect (matches GT)
    a = {
        "codename": "alpha-baseline",
        "config": {"crops": [{"id": "default"}], "filters": []},
        "config_summary": "1 crops × 0 filters",
        "formula": dict(base),
        "confidence": 0.95,
        "score": 0.94,
        "is_champion": False,
        "is_alive": True,
        "generation": 1,
        "branch": "main",
        "images": ["synthetic"],
    }

    # Algorithm B — small mistakes (3-4 cells flipped)
    b_formula = dict(base)
    flipped = 0
    for fdi in list(b_formula.keys())[:4]:
        if b_formula[fdi] == "present":
            b_formula[fdi] = ""
            flipped += 1
    b = {
        "codename": "beta-aggressive",
        "config": {"crops": [{"id": "tight"}], "filters": [{"name": "clahe"}]},
        "config_summary": "1 crops × 1 filters",
        "formula": b_formula,
        "confidence": 0.84,
        "score": 0.82,
        "is_champion": False,
        "is_alive": True,
        "generation": 2,
        "branch": "exp-clahe",
        "images": ["synthetic_clahe"],
    }

    # Algorithm C — champion (also matches GT, different config)
    c = {
        "codename": "gamma-champion",
        "config": {"crops": [{"id": "wide"}, {"id": "tight"}], "filters": [{"name": "sharpen"}]},
        "config_summary": "2 crops × 1 filters",
        "formula": dict(base),
        "confidence": 0.97,
        "score": 0.96,
        "is_champion": True,
        "is_alive": True,
        "generation": 3,
        "branch": "champion",
        "images": ["synthetic_wide", "synthetic_sharp"],
    }

    return [a, b, c]


def _generate_mock_bboxes(formula: dict) -> list[dict]:
    """Synthetic YOLO-style bbox detections: one box per non-empty FDI cell, laid out
    along an arch over the synthetic OPG image.
    """
    detections = []
    OPG_W, OPG_H = 2880, 1450

    # Order FDI top arch L→R then bottom arch R→L
    order_top = [f"1.{8-i}" for i in range(8)] + [f"2.{i+1}" for i in range(8)]
    order_bot = [f"4.{i+1}" for i in range(8)] + [f"3.{8-i}" for i in range(8)]

    for arch_idx, ordering in enumerate([order_top, order_bot]):
        y_center = OPG_H * (0.42 if arch_idx == 0 else 0.58)
        for i, fdi in enumerate(ordering):
            if fdi not in formula or not formula[fdi]:
                continue
            x = int(OPG_W * 0.1 + (OPG_W * 0.8) * (i / 15))
            detections.append({
                "idx": len(detections),
                "cls": "Tooth",
                "conf": 0.92,
                "x1": x - 35,
                "y1": int(y_center) - 60,
                "x2": x + 35,
                "y2": int(y_center) + 60,
                "fdi": fdi,
            })
    return detections


def bootstrap_demo_data() -> None:
    """Load the 3 synthetic ORIS examples into the in-memory store as 3 sandbox files."""
    file_id_base = 10001
    for idx, example_path in enumerate(sorted(EXAMPLES_DIR.glob("synthetic_*.json"))):
        try:
            doc = json.loads(example_path.read_text(encoding="utf-8"))
        except Exception as e:
            print(f"  ⚠ skipping {example_path.name}: {e}")
            continue
        file_id = file_id_base + idx
        formula, bridge_links, tooth_notes, root_data = _oris_doc_to_legacy_formula(doc)

        STORE.files[file_id] = {
            "file_id": file_id,
            "filename": example_path.name,
            "label": doc.get("notes", "Synthetic example"),
            "created_at": doc.get("imaging", {}).get("acquisition_date") or "2026-01-15T00:00:00Z",
            "has_experiments": True,
            "sandbox_id": "RUDN",
        }
        STORE.ground_truth[file_id] = {
            "formula": formula,
            "bridge_links": bridge_links,
            "tooth_notes": tooth_notes,
            "root_data": root_data,
            "crop_overrides": {},
            "diagnostic_sites": {},
        }
        STORE.history[file_id] = [{
            "sequence_num": 1,
            "fdi": None,
            "old_value": None,
            "new_value": None,
            "change_type": "bulk_prefill",
            "source": "manual",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "session_id": str(uuid.uuid4()),
        }]
        STORE.algorithms[file_id] = _generate_mock_algorithms(file_id, formula)
        STORE.tooth_bboxes[file_id] = _generate_mock_bboxes(formula)
        print(f"  ✓ Loaded {example_path.name} → file_id={file_id}, {len(formula)} teeth")


# ============================================================================
# HTML page
# ============================================================================


@app.route("/")
@app.route("/darwin-lab")
def darwin_lab_page():
    return render_template("darwin_lab.html")


# ============================================================================
# Sandbox endpoints
# ============================================================================


@app.route("/api/darwin/sandboxes")
def api_sandboxes():
    return jsonify(list(STORE.sandboxes.values()))


@app.route("/api/darwin/sandbox/<sbx_id>/files")
def api_sandbox_files(sbx_id: str):
    files = [f for f in STORE.files.values() if f["sandbox_id"] == sbx_id]
    return jsonify(files)


@app.route("/api/darwin/sandbox/<sbx_id>/add-to-arena", methods=["POST"])
def api_sandbox_add_to_arena(sbx_id: str):
    return jsonify({"ok": True, "added_to_arena": True})


@app.route("/api/darwin/sandbox/<sbx_id>/import-folder", methods=["POST"])
@app.route("/api/darwin/sandbox/<sbx_id>/import-image", methods=["POST"])
def api_sandbox_import(sbx_id: str):
    return jsonify({"ok": False, "error": "Disabled in demo mode (use synthetic data only)."}), 403


@app.route("/api/darwin/sandboxes", methods=["POST"])
def api_sandbox_create():
    return jsonify({"ok": False, "error": "Disabled in demo mode."}), 403


@app.route("/api/darwin/sandboxes/<sbx_id>", methods=["DELETE"])
def api_sandbox_delete(sbx_id: str):
    return jsonify({"ok": False, "error": "Disabled in demo mode."}), 403


# ============================================================================
# Test-cases / Arena endpoints
# ============================================================================


@app.route("/api/darwin/test-cases")
def api_test_cases():
    cases = [
        {
            "file_id": f["file_id"],
            "filename": f["filename"],
            "label": f["label"],
            "created_at": f["created_at"],
        }
        for f in STORE.files.values()
    ]
    return jsonify(cases)


@app.route("/api/darwin/arena/<int:file_id>")
def api_arena_data(file_id: int):
    if file_id not in STORE.algorithms:
        return jsonify({"file_id": file_id, "algorithms": []})
    return jsonify({
        "file_id": file_id,
        "algorithms": STORE.algorithms[file_id],
    })


@app.route("/api/darwin/arena/candidates")
def api_arena_candidates():
    cases = [
        {
            "file_id": f["file_id"],
            "filename": f["filename"],
            "label": f["label"],
            "created_at": f["created_at"],
            "patient_id": None,
        }
        for f in STORE.files.values()
    ]
    return jsonify(cases)


@app.route("/api/darwin/arena/add", methods=["POST"])
def api_arena_add():
    return jsonify({"ok": True})


# ============================================================================
# Ground-truth endpoints
# ============================================================================


@app.route("/api/darwin/ground-truth/<int:file_id>", methods=["GET"])
def api_gt_get(file_id: int):
    gt = STORE.ground_truth.get(file_id)
    if gt is None:
        return jsonify({"file_id": file_id, "formula": {}, "saved": False, "current_seq": 0})

    history = STORE.history.get(file_id, [])
    current_seq = max((h["sequence_num"] for h in history), default=0)

    return jsonify({
        "file_id": file_id,
        "formula": gt.get("formula", {}),
        "bridge_links": gt.get("bridge_links", {}),
        "tooth_notes": gt.get("tooth_notes", {}),
        "root_data": gt.get("root_data", {}),
        "crop_overrides": gt.get("crop_overrides", {}),
        "diagnostic_sites": gt.get("diagnostic_sites", {}),
        "saved": True,
        "current_seq": current_seq,
    })


@app.route("/api/darwin/ground-truth/<int:file_id>", methods=["POST"])
def api_gt_save(file_id: int):
    if file_id not in STORE.ground_truth:
        # Create a new GT entry if file_id is new
        STORE.ground_truth[file_id] = {
            "formula": {}, "bridge_links": {}, "tooth_notes": {},
            "root_data": {}, "crop_overrides": {}, "diagnostic_sites": {},
        }
        STORE.history.setdefault(file_id, [])

    data = request.json or {}
    formula = data.get("formula", {})
    bridge_links = data.get("bridge_links", {})
    tooth_notes = data.get("tooth_notes", {})
    root_data = data.get("root_data", {})
    crop_overrides = data.get("crop_overrides", {})
    source = data.get("source", "manual")
    session_id = data.get("session_id", str(uuid.uuid4()))

    with STORE.lock():
        old_formula = dict(STORE.ground_truth[file_id].get("formula", {}))
        STORE.ground_truth[file_id]["formula"] = dict(formula)
        STORE.ground_truth[file_id]["bridge_links"] = dict(bridge_links)
        STORE.ground_truth[file_id]["tooth_notes"] = dict(tooth_notes)
        STORE.ground_truth[file_id]["root_data"] = dict(root_data)
        STORE.ground_truth[file_id]["crop_overrides"] = dict(crop_overrides)

        history = STORE.history.setdefault(file_id, [])
        seq = max((h["sequence_num"] for h in history), default=0) + 1

        # Diff against old formula → produce per-fdi history entries
        all_fdis = set(old_formula.keys()) | set(formula.keys())
        added_entries = []
        for fdi in sorted(all_fdis):
            old_val = old_formula.get(fdi, "")
            new_val = formula.get(fdi, "")
            if old_val != new_val:
                added_entries.append({
                    "sequence_num": seq,
                    "fdi": fdi,
                    "old_value": old_val,
                    "new_value": new_val,
                    "change_type": "single_update",
                    "source": source,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "session_id": session_id,
                })

        if not added_entries:
            # No diff — record a no-op event
            added_entries.append({
                "sequence_num": seq,
                "fdi": None,
                "old_value": None,
                "new_value": None,
                "change_type": "save_no_diff",
                "source": source,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "session_id": session_id,
            })
        history.extend(added_entries)

    return jsonify({"ok": True, "file_id": file_id, "saved": True, "current_seq": seq})


@app.route("/api/darwin/ground-truth/<int:file_id>/history")
def api_gt_history(file_id: int):
    limit = int(request.args.get("limit", 50))
    history = STORE.history.get(file_id, [])
    return jsonify({"file_id": file_id, "history": list(reversed(history[-limit:]))})


@app.route("/api/darwin/ground-truth/<int:file_id>/snapshot/<int:seq>")
def api_gt_snapshot(file_id: int, seq: int):
    """Return the GT formula as it was at sequence_num=seq (best-effort reconstruction).

    For the demo, snapshots simply return the current formula and mark which
    sequence it belongs to. Production reconstructs by replaying history.
    """
    gt = STORE.ground_truth.get(file_id)
    if not gt:
        abort(404)
    return jsonify({"file_id": file_id, "sequence_num": seq, "formula": gt.get("formula", {})})


@app.route("/api/darwin/ground-truth/<int:file_id>/rollback/<int:seq>", methods=["POST"])
def api_gt_rollback(file_id: int, seq: int):
    """Rollback marker only — for demo purposes the operation is recorded but the
    formula is not actually reverted.
    """
    history = STORE.history.setdefault(file_id, [])
    new_seq = max((h["sequence_num"] for h in history), default=0) + 1
    history.append({
        "sequence_num": new_seq,
        "fdi": None,
        "old_value": None,
        "new_value": None,
        "change_type": "rollback",
        "source": "manual",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "session_id": str(uuid.uuid4()),
        "rollback_to": seq,
    })
    return jsonify({"ok": True, "rolled_back_to": seq, "new_seq": new_seq})


# ============================================================================
# Image / panorama endpoints
# ============================================================================


@app.route("/panorama/sandbox/<int:file_id>/image")
def panorama_image(file_id: int):
    """Serve the synthetic OPG image for any file_id (all share one placeholder)."""
    img_path = HERE / "static" / "images" / "synthetic_opg_001.png"
    if not img_path.exists():
        abort(404)
    return send_file(str(img_path), mimetype="image/png")


@app.route("/api/panorama/<int:file_id>/overlay-state", methods=["GET", "POST"])
def panorama_overlay_state(file_id: int):
    if request.method == "POST":
        return jsonify({"ok": True})
    return jsonify({"file_id": file_id, "filters": [], "zoom": 1.0, "pan_x": 0, "pan_y": 0})


# ============================================================================
# YOLO / bbox endpoints
# ============================================================================


@app.route("/api/darwin/tooth-bboxes/<int:file_id>")
def api_tooth_bboxes(file_id: int):
    detections = STORE.tooth_bboxes.get(file_id, [])
    fdi_map: dict[str, list[int]] = {}
    for d in detections:
        if d.get("fdi"):
            fdi_map.setdefault(d["fdi"], []).append(d["idx"])
    return jsonify({
        "detections": detections,
        "image_size": {"width": 2880, "height": 1450},
        "fdi_map": fdi_map,
        "formula_source": "demo_synthetic",
    })


@app.route("/api/darwin/arena/fdi-correction", methods=["POST"])
def api_fdi_correction_post():
    return jsonify({"ok": True})


@app.route("/api/darwin/arena/fdi-corrections/<int:file_id>")
def api_fdi_corrections_get(file_id: int):
    return jsonify({"file_id": file_id, "corrections": []})


# ============================================================================
# Card / context / hint endpoints
# ============================================================================


@app.route("/api/darwin/card-hints/<int:file_id>")
def api_card_hints(file_id: int):
    return jsonify({"file_id": file_id, "implant_hints": [], "missing_hints": []})


@app.route("/api/darwin/card-context/<int:file_id>")
def api_card_context(file_id: int):
    f = STORE.files.get(file_id, {})
    return jsonify({
        "file_id": file_id,
        "patient_card": f.get("label", "Synthetic example"),
        "patient_name": "Anonymized Synthetic",
        "extracted_fields": {},
    })


@app.route("/api/darwin/ai-hint/<int:file_id>", methods=["GET"])
def api_ai_hint(file_id: int):
    return jsonify({"file_id": file_id, "hints": [], "leader_codename": "alpha-baseline"})


@app.route("/api/darwin/prefill-from-card/<int:file_id>")
def api_prefill_from_card(file_id: int):
    return jsonify({"file_id": file_id, "formula": {}, "available": False, "source": "demo_no_card"})


@app.route("/api/darwin/fdi-slots/<int:file_id>")
def api_fdi_slots(file_id: int):
    formula = STORE.ground_truth.get(file_id, {}).get("formula", {})
    slots = [
        {"fdi": fdi, "status": status, "occupied": bool(status)}
        for fdi, status in formula.items()
    ]
    return jsonify({"file_id": file_id, "slots": slots})


# ============================================================================
# Tree / experiment / metric endpoints
# ============================================================================


@app.route("/api/darwin/tree")
def api_darwin_tree():
    nodes = []
    for file_id, algos in STORE.algorithms.items():
        for a in algos:
            nodes.append({
                "id": f"{file_id}-{a['codename']}",
                "experiment_id": None,
                "name": a["codename"],
                "version": "v1",
                "codename": a["codename"],
                "generation": a.get("generation", 1),
                "branch": a.get("branch", "main"),
                "mutation_type": "synthetic",
                "parent_id": None,
                "is_alive": a.get("is_alive", True),
                "is_champion": a.get("is_champion", False),
                "verdict": "synthetic_demo",
                "confidence": a.get("confidence", 0.9),
                "teeth": 32,
                "implants": 0,
                "restorations": 0,
                "pathologies": 0,
                "tokens": 0,
                "duration_ms": 0,
                "images": ["synthetic"],
                "tldr": "Synthetic demo algorithm",
                "tags": ["demo"],
                "created_at": datetime.now(timezone.utc).isoformat(),
                "score_human": a.get("score", 0.9),
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
    return jsonify({"results": [], "demo": True, "note": "MMOral results disabled in demo"})


@app.route("/api/darwin/mcnemar/<a>/<b>/<cat>")
@app.route("/api/darwin/confusion/<algo>/<category>")
def api_stats_passthrough(*args, **kwargs):
    return jsonify({"matrix": [[0, 0], [0, 0]], "p_value": None, "demo": True})


@app.route("/api/darwin/learning/stats")
def api_learning_stats():
    return jsonify({"corrections_total": 0, "uncertainty_avg": 0.0, "demo": True})


# ============================================================================
# Vote / batch / analysis endpoints
# ============================================================================


@app.route("/api/darwin/vote", methods=["POST"])
def api_darwin_vote():
    return jsonify({"ok": True, "demo": True})


@app.route("/api/darwin/crop-overrides/<int:file_id>", methods=["POST"])
def api_crop_overrides(file_id: int):
    data = request.json or {}
    if file_id in STORE.ground_truth:
        STORE.ground_truth[file_id]["crop_overrides"] = data.get("crop_overrides", {})
    return jsonify({"ok": True, "file_id": file_id})


@app.route("/api/darwin/batch-prepopulate-gt", methods=["POST"])
@app.route("/api/darwin/batch-w0-to-gt", methods=["POST"])
def api_batch_endpoints():
    return jsonify({"ok": False, "error": "Batch operations disabled in demo mode."}), 403


@app.route("/api/darwin/save-analysis/<int:file_id>", methods=["POST"])
def api_save_analysis(file_id: int):
    return jsonify({"ok": True, "file_id": file_id})


@app.route("/api/darwin/analysis-status/<int:file_id>")
def api_analysis_status(file_id: int):
    return jsonify({"file_id": file_id, "status": "ready", "demo": True})


@app.route("/api/darwin/analysis-queue")
def api_analysis_queue():
    return jsonify({"queue": [], "demo": True})


# ============================================================================
# Implant assessment / library endpoints
# ============================================================================


@app.route("/api/implant-assessment/<int:file_id>")
def api_implant_assessment(file_id: int):
    return jsonify({
        "file_id": file_id,
        "assessments": [],
        "summary": {"total_implants": 0, "with_complications": 0},
        "demo": True,
    })


@app.route("/api/implant-assessment/batch-status")
def api_implant_assessment_batch():
    return jsonify({"queue": [], "demo": True})


@app.route("/api/implant-assessment/references")
def api_implant_references():
    return jsonify({
        "references": [
            {"id": "Schwarz_2020", "label": "Schwarz et al., J Clin Periodontol 2018 (with 2020 updates)"},
            {"id": "Pjetursson_2012", "label": "Pjetursson et al., Clin Oral Implants Res 2012"},
            {"id": "Misch_2008", "label": "Misch CE, Dental Implant Prosthetics 2nd ed., 2008"},
            {"id": "Froum_2012", "label": "Froum & Rosen, Int J Periodontics Restorative Dent 2012"},
            {"id": "AAP_2017", "label": "AAP World Workshop 2017"},
        ]
    })


@app.route("/api/implant-library")
def api_implant_library_list():
    return jsonify({"systems": [
        {"key": "synthetic_a", "label": "Synthetic Implant A", "manufacturer": "Demo"},
        {"key": "synthetic_b", "label": "Synthetic Implant B", "manufacturer": "Demo"},
    ]})


@app.route("/api/implant-library/<system>/svg")
@app.route("/api/implant-library/<system>/match")
@app.route("/api/implant-library/<system>/silhouette")
def api_implant_library_detail(system: str):
    # Empty SVG placeholder
    return ('<svg xmlns="http://www.w3.org/2000/svg" width="60" height="130">'
            '<rect width="60" height="130" fill="#222" stroke="#666"/>'
            '<text x="30" y="70" text-anchor="middle" fill="#ccc" font-size="10">SYNTHETIC</text>'
            '</svg>'), 200, {"Content-Type": "image/svg+xml"}


# ============================================================================
# Expert / panorama analysis endpoints
# ============================================================================


@app.route("/api/expert/timeline")
def api_expert_timeline():
    return jsonify({"events": [], "demo": True})


@app.route("/api/panorama-analysis/<int:analysis_id>/review")
def api_panorama_analysis_review(analysis_id: int):
    return jsonify({"analysis_id": analysis_id, "demo": True})


@app.route("/api/patient/<int:patient_id>/panoramas")
def api_patient_panoramas(patient_id: int):
    return jsonify([])


# ============================================================================
# Fallback for any other endpoint the UI might call — return empty 200
# ============================================================================


@app.errorhandler(404)
def not_found(e):
    if request.path.startswith("/api/"):
        # Many UI features call exotic endpoints; return empty rather than 404 to keep UI responsive
        return jsonify({"demo": True, "endpoint": request.path, "note": "Not implemented in mock"}), 200
    return jsonify({"error": "Not Found", "path": request.path}), 404


# ============================================================================
# Main
# ============================================================================


def main() -> None:
    print("=" * 70)
    print("ORIS Production-Arena Demo (mock backend)")
    print("=" * 70)
    print(f"  Repo root:    {REPO_ROOT}")
    print(f"  Examples:     {EXAMPLES_DIR}")
    print()
    print("Loading synthetic data:")
    if not EXAMPLES_DIR.exists():
        print(f"  ⚠ Examples directory not found at {EXAMPLES_DIR}")
        sys.exit(1)
    bootstrap_demo_data()
    print()
    if not STORE.files:
        print("  ⚠ No synthetic examples loaded. Did you forget to clone with examples/?")
    else:
        print(f"  → {len(STORE.files)} synthetic test cases loaded.")
    print()

    port = int(os.environ.get("PORT", 5050))
    print(f"⚡ Open in browser: http://localhost:{port}/darwin-lab")
    print()
    print("Privacy: this demo runs entirely on localhost with synthetic data only.")
    print("         No PII, no telemetry. See ../PRIVACY.md.")
    print("=" * 70)
    print()

    app.run(debug=True, port=port, host="127.0.0.1", use_reloader=False)


if __name__ == "__main__":
    main()
