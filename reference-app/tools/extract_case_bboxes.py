#!/usr/bin/env python3
"""
extract_case_bboxes.py — bake real SemiT-SAM tooth detections into JSON

Run once locally to produce data/cases/case_X_bboxes.json for each of the
three anonymised demo cases. mock_app.py prefers these JSON files over
the math-row fallback in /api/darwin/tooth-bboxes/<file_id>, so the
production Arena draws crops on actual tooth positions instead of
even-spacing them across the arch.

Usage (must be run from inside patient_viewer/venv where SemiT-SAM
weights and ultralytics live — this script intentionally relies on
the production X-RayAnalizer module rather than re-implementing
inference, so the bboxes match what Darwin Lab produces in real
clinical use):

    cd <repo_root>
    source patient_viewer/venv/bin/activate
    python3 oris-repo/reference-app/tools/extract_case_bboxes.py

Outputs (committed alongside the case PNGs):
    oris-repo/reference-app/data/cases/case_A_bboxes.json
    oris-repo/reference-app/data/cases/case_B_bboxes.json
    oris-repo/reference-app/data/cases/case_C_bboxes.json

Each file has the schema:
    {
      "image_size":  {"width": W, "height": H},
      "model":       "SemiT-SAM (32-class FDI)",
      "score_thresh": 0.3,
      "detections":  [
        {"idx": 0, "fdi": "1.6", "tsi": 3, "conf": 0.91,
         "x1": ..., "y1": ..., "x2": ..., "y2": ...,
         "quadrant": "Q1", "area_px": ...},
        ...
      ],
      "fdi_map": { "1.6": [0], "1.7": [3], ... }
    }
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# ---------------------------------------------------------------------
# Path glue: import the production X-RayAnalizer segmentation module
# ---------------------------------------------------------------------

REPO_ROOT = Path(__file__).resolve().parents[3]   # …/X-RayAnalizer/
PATIENT_VIEWER = REPO_ROOT / "patient_viewer"
if not PATIENT_VIEWER.exists():
    sys.exit(f"Could not find patient_viewer at {PATIENT_VIEWER}; "
             f"adjust REPO_ROOT in this script if your layout differs.")
sys.path.insert(0, str(PATIENT_VIEWER))

try:
    import cv2
    from opg_segmentation import segment_teeth
except Exception as e:
    sys.exit(f"Could not import production segment_teeth(): {e}\n"
             f"Make sure you are in patient_viewer/venv and SemiT-SAM weights "
             f"are present at _sam2_temp/.")

# Universal int (1..32) → FDI string ("1.1".."4.8"), shared with
# patient_viewer/batch_gt_populate.py and yolo_routes.py.
TSI_TO_FDI: dict[int, str] = {}
for _i in range(1, 9):   TSI_TO_FDI[_i] = f"1.{9-_i}"      # 1=1.8 … 8=1.1
for _i in range(9, 17):  TSI_TO_FDI[_i] = f"2.{_i-8}"      # 9=2.1 … 16=2.8
for _i in range(17, 25): TSI_TO_FDI[_i] = f"3.{25-_i}"     # 17=3.8 … 24=3.1
for _i in range(25, 33): TSI_TO_FDI[_i] = f"4.{_i-24}"     # 25=4.1 … 32=4.8


CASES_DIR = Path(__file__).resolve().parents[1] / "data" / "cases"
IMAGES_DIR = Path(__file__).resolve().parents[1] / "static" / "images" / "cases"
SCORE_THRESH = 0.30
KEEP_THRESH = 0.50      # drop low-confidence noise after extraction
ALL_FDI_TOP = [f"1.{8-i}" for i in range(8)] + [f"2.{i+1}" for i in range(8)]
ALL_FDI_BOT = [f"4.{8-i}" for i in range(8)] + [f"3.{i+1}" for i in range(8)]
FDI_X_ORDER = {fdi: i for i, fdi in enumerate(ALL_FDI_TOP)}
FDI_X_ORDER.update({fdi: i for i, fdi in enumerate(ALL_FDI_BOT)})


def _dedup(raw_detections: list[dict]) -> list[dict]:
    """Keep highest-confidence detection per FDI, drop noise below KEEP_THRESH."""
    by_fdi: dict[str, dict] = {}
    for d in raw_detections:
        fdi = d["fdi"]
        if d["conf"] < KEEP_THRESH:
            continue
        if fdi not in by_fdi or d["conf"] > by_fdi[fdi]["conf"]:
            by_fdi[fdi] = d
    return sorted(by_fdi.values(), key=lambda d: (d["fdi"][0], FDI_X_ORDER.get(d["fdi"], 99)))


def _project_missing(detections: list[dict], formula: dict[str, str], img_w: int, img_h: int) -> list[dict]:
    """For FDI in `formula` (any non-empty status) that have NO detection,
    interpolate a bbox from the two nearest same-row detections.

    SemiT-SAM is trained on natural teeth and frequently misses implant
    fixtures, so the heavy-implant cases (especially Case A) need this
    completion pass — otherwise the production Arena draws no crop card
    for an FDI cell that is clearly an implant on the OPG."""
    out = list(detections)
    have = {d["fdi"] for d in detections}

    by_quadrant: dict[str, list[dict]] = {}
    for d in detections:
        q = d["fdi"][0]   # '1','2','3','4'
        by_quadrant.setdefault(q, []).append(d)

    for fdi, status in formula.items():
        if not status or fdi in have:
            continue
        # only project if status looks like a real tooth-position (skip "missing")
        primary = status.split("+")[0].split(":")[0]
        if primary in ("", "missing"):
            continue
        # Same row = same arch (top: 1.x/2.x at index 0..15, bot: 4.x/3.x)
        row_top = fdi.startswith("1.") or fdi.startswith("2.")
        row_fdi_order = ALL_FDI_TOP if row_top else ALL_FDI_BOT
        try:
            row_idx = row_fdi_order.index(fdi)
        except ValueError:
            continue
        # Find left neighbour (lower idx) and right neighbour (higher idx) that we DO have
        left = right = None
        for off in range(1, 16):
            li = row_idx - off
            if li >= 0 and not left:
                cand = row_fdi_order[li]
                hit = next((d for d in detections if d["fdi"] == cand), None)
                if hit:
                    left = (li, hit)
            ri = row_idx + off
            if ri < 16 and not right:
                cand = row_fdi_order[ri]
                hit = next((d for d in detections if d["fdi"] == cand), None)
                if hit:
                    right = (ri, hit)
            if left and right:
                break

        if left and right:
            # linear interpolation between two neighbours
            lpos = (left[1]["x1"] + left[1]["x2"]) / 2
            rpos = (right[1]["x1"] + right[1]["x2"]) / 2
            ypos = (left[1]["y1"] + left[1]["y2"] + right[1]["y1"] + right[1]["y2"]) / 4
            t = (row_idx - left[0]) / (right[0] - left[0])
            cx = lpos + (rpos - lpos) * t
            half_w = (left[1]["x2"] - left[1]["x1"] + right[1]["x2"] - right[1]["x1"]) / 4
            half_h = (left[1]["y2"] - left[1]["y1"] + right[1]["y2"] - right[1]["y1"]) / 4
        elif left:
            # extrapolate to the right of the left neighbour using avg tooth width
            ref = left[1]
            half_w = (ref["x2"] - ref["x1"]) / 2
            half_h = (ref["y2"] - ref["y1"]) / 2
            cx = (ref["x1"] + ref["x2"]) / 2 + (row_idx - left[0]) * half_w * 2.0
            ypos = (ref["y1"] + ref["y2"]) / 2
        elif right:
            ref = right[1]
            half_w = (ref["x2"] - ref["x1"]) / 2
            half_h = (ref["y2"] - ref["y1"]) / 2
            cx = (ref["x1"] + ref["x2"]) / 2 - (right[0] - row_idx) * half_w * 2.0
            ypos = (ref["y1"] + ref["y2"]) / 2
        else:
            continue   # no neighbours at all in this row, can't project

        # clamp to image
        cx = max(0, min(img_w, cx))
        ypos = max(0, min(img_h, ypos))
        out.append({
            "idx": len(out),
            "fdi": fdi,
            "tsi": -1,                          # not from SemiT-SAM
            "conf": 0.50,                        # synthetic projection placeholder
            "x1": round(cx - half_w, 1), "y1": round(ypos - half_h, 1),
            "x2": round(cx + half_w, 1), "y2": round(ypos + half_h, 1),
            "quadrant": f"Q{fdi[0]}",
            "area_px": 0,
            "source": "interpolated",
        })
    # re-index to keep idx contiguous
    for i, d in enumerate(out):
        d["idx"] = i
    return out


def extract_one(letter: str) -> dict:
    img_path = IMAGES_DIR / f"case_{letter}.png"
    if not img_path.exists():
        raise FileNotFoundError(f"Missing case PNG: {img_path}")

    img_bgr = cv2.imread(str(img_path), cv2.IMREAD_COLOR)
    if img_bgr is None:
        raise RuntimeError(f"cv2 could not load {img_path}")

    h, w = img_bgr.shape[:2]
    print(f"  ▸ Case {letter}: {img_path.name}  ({w}×{h})")

    teeth_labels, instances, stats = segment_teeth(img_bgr, score_thresh=SCORE_THRESH)
    if instances is None:
        instances = []

    raw = []
    for inst in instances:
        tsi = int(inst.get("fdi") or 0)
        fdi_str = TSI_TO_FDI.get(tsi)
        if not fdi_str:
            continue
        bbox = inst.get("bbox") or [0, 0, 0, 0]
        x1, y1, x2, y2 = [round(float(v), 1) for v in bbox]
        raw.append({
            "fdi": fdi_str,
            "tsi": tsi,
            "conf": round(float(inst.get("confidence", 0.0)), 4),
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "quadrant": inst.get("quadrant") or "?",
            "area_px": int(inst.get("area_px", 0)),
        })

    deduped = _dedup(raw)

    # Read formula from case JSON to know which FDIs to project for
    case_json = CASES_DIR / f"case_{letter}.json"
    formula = {}
    if case_json.exists():
        try:
            formula = json.loads(case_json.read_text(encoding="utf-8")).get("formula", {})
        except Exception:
            pass

    completed = _project_missing(deduped, formula, w, h)
    fdi_map: dict[str, list[int]] = {}
    for d in completed:
        d["idx"] = len(fdi_map.get(d["fdi"], []))   # not used; just keep field
        fdi_map.setdefault(d["fdi"], []).append(0)
    # reset indices and rebuild fdi_map from final list
    for i, d in enumerate(completed):
        d["idx"] = i
    fdi_map = {}
    for i, d in enumerate(completed):
        fdi_map.setdefault(d["fdi"], []).append(i)

    out = {
        "image_size": {"width": w, "height": h},
        "model": "SemiT-SAM (32-class FDI)",
        "score_thresh": SCORE_THRESH,
        "keep_thresh": KEEP_THRESH,
        "stats": stats,
        "raw_count": len(raw),
        "kept_after_dedup": len(deduped),
        "interpolated": len(completed) - len(deduped),
        "detections": completed,
        "fdi_map": fdi_map,
    }
    print(f"     raw={len(raw)} → dedup={len(deduped)} → +interp={len(completed) - len(deduped)} → final={len(completed)} · "
          f"unique FDI={len(fdi_map)} · "
          f"{stats.get('processing_time_s', '?')}s")
    return out


def main() -> int:
    print("Extracting AI tooth bboxes for the 3 anonymised demo cases …")
    print(f"  CASES_DIR  = {CASES_DIR}")
    print(f"  IMAGES_DIR = {IMAGES_DIR}")
    CASES_DIR.mkdir(parents=True, exist_ok=True)

    for letter in ("A", "B", "C"):
        try:
            data = extract_one(letter)
        except Exception as e:
            print(f"  ✗ Case {letter} failed: {e}")
            continue
        out_path = CASES_DIR / f"case_{letter}_bboxes.json"
        out_path.write_text(json.dumps(data, ensure_ascii=False, indent=2))
        print(f"     ✓ wrote {out_path.relative_to(CASES_DIR.parents[2])}")
    print("\nDone. mock_app.py will pick these up on the next request.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
