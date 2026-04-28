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

    detections = []
    fdi_map: dict[str, list[int]] = {}
    for idx, inst in enumerate(instances):
        tsi = int(inst.get("fdi") or 0)
        fdi_str = TSI_TO_FDI.get(tsi)
        if not fdi_str:
            continue
        bbox = inst.get("bbox") or [0, 0, 0, 0]
        x1, y1, x2, y2 = [round(float(v), 1) for v in bbox]
        det = {
            "idx": len(detections),
            "fdi": fdi_str,
            "tsi": tsi,
            "conf": round(float(inst.get("confidence", 0.0)), 4),
            "x1": x1, "y1": y1, "x2": x2, "y2": y2,
            "quadrant": inst.get("quadrant") or "?",
            "area_px": int(inst.get("area_px", 0)),
        }
        detections.append(det)
        fdi_map.setdefault(fdi_str, []).append(det["idx"])

    out = {
        "image_size": {"width": w, "height": h},
        "model": "SemiT-SAM (32-class FDI)",
        "score_thresh": SCORE_THRESH,
        "stats": stats,
        "detections": detections,
        "fdi_map": fdi_map,
    }
    print(f"     {len(detections)} teeth detected · "
          f"{len(fdi_map)} unique FDI · "
          f"processing {stats.get('processing_time_s', '?')}s")
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
