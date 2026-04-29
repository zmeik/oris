// crop-manager.js — Crop carousel, thumbnails, expanded, resize, annotation, polygon draw
// Extracted from darwin_lab.html lines 14592–18079
// ═══════════════════════════════════════════════════════════════

// ══════════════════════════════════════════════════════════════════════════
// ██  CROP CAROUSEL — веер кропов зубов над/под формулой
// ══════════════════════════════════════════════════════════════════════════

const _carouselState = {}; // { fileId: { cards: [{fdi,cls,conf,bbox,children}], activeFdi: null } }
const _cropFilterState = {}; // { fileId: { fdi: { brightness:1.0, contrast:1.0 } } }
// Restore filter state from crop_overrides (loaded from DB via arenaCropOverrides)
function _restoreCropFilters(fileId) {
    const overrides = (window.arenaCropOverrides || {})[fileId];
    if (!overrides) return;
    for (const [fdi, ov] of Object.entries(overrides)) {
        if (ov && (ov.brightness || ov.contrast)) {
            if (!_cropFilterState[fileId]) _cropFilterState[fileId] = {};
            _cropFilterState[fileId][fdi] = {
                brightness: ov.brightness || 1.0,
                contrast: ov.contrast || 1.0
            };
        }
    }
}
let _cropDisplayMode = 'both'; // 'bbox' | 'contour' | 'both'
let _childResizeState = null; // { child, childIdx, edge, startX, startY, startBbox, card, canvas, fileId, fdi }
let _activeEditChild = null; // { childIdx, fileId, fdi } — child bbox selected for editing (shows resize handles)

const UPPER_FDI = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
const LOWER_FDI = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];

// Parent classes (Level 1 containers — used only for cls inference now)
const PARENT_CLASSES = new Set(['Implant','Missing teeth','Root Piece']);
// Child classes (Level 2 nested inside parent bbox)
const CHILD_CLASSES = new Set(['Crown','Crown framework','Crown veneer','Filling','Caries','Periapical lesion','Root canal obturation','Abutment','Fixation screw','Cover screw']);

// Sub-object categories for rendering (pathology vs artificial)
const SUB_CATEGORY = {
    'Caries': 'pathology', 'Periapical lesion': 'pathology', 'Root Piece': 'pathology',
    'Crown': 'artificial', 'Crown framework': 'artificial', 'Crown veneer': 'artificial',
    'Filling': 'artificial', 'Root canal obturation': 'artificial',
    'Implant': 'artificial', 'Abutment': 'artificial',
    'Fixation screw': 'artificial', 'Cover screw': 'artificial',
    'Missing teeth': 'condition',
};

// Category colors for legend and border accents
const CATEGORY_COLORS = {
    'pathology':  { fill: 'rgba(239,68,68,0.15)', stroke: '#ef4444', dot: '#ef4444', label: 'Пат.' },
    'artificial': { fill: 'rgba(59,130,246,0.15)', stroke: '#3b82f6', dot: '#3b82f6', label: 'Иск.' },
    'condition':  { fill: 'rgba(245,158,11,0.15)', stroke: '#f59e0b', dot: '#f59e0b', label: 'Сост.' },
    'other':      { fill: 'rgba(156,163,175,0.15)', stroke: '#9ca3af', dot: '#9ca3af', label: '?' },
};

/**
 * Build crop card data from YOLO detections for a given file.
 *
 * ARCHITECTURE (2026-04 refactor):
 *   crop bbox = SemiT-SAM tooth bbox (whole tooth, crown-to-apex)
 *   children  = ALL YOLO detections (sub-objects inside the tooth)
 *   cls       = inferred from children: implant > root > missing > tooth
 *
 * SemiT-SAM provides bbox for every FDI position even without YOLO detections.
 * YOLO detections (fillings, crowns, caries etc.) are sub-objects WITHIN the tooth.
 */
function _buildCropData(fileId, opgImg) {
    const data = _yoloCache[fileId];
    if (!data || !data.detections || !data.fdi_map) return [];
    const { detections, fdi_map, interpolated, semit_bboxes } = data;
    const imgW = (opgImg && opgImg.naturalWidth) ? opgImg.naturalWidth : (data.image_size ? data.image_size.width : 2048);
    const imgH = (opgImg && opgImg.naturalHeight) ? opgImg.naturalHeight : (data.image_size ? data.image_size.height : 1024);
    const allFdi = [...UPPER_FDI, ...LOWER_FDI];
    const cards = [];

    for (const fdi of allFdi) {
        const idxList = fdi_map[fdi] || [];
        const dets = idxList.map(idx => detections.find(d => d.idx === idx)).filter(Boolean);
        // Prefer semit_bboxes (ALL teeth) over interpolated (only no-YOLO teeth)
        const interp = (semit_bboxes && semit_bboxes[fdi]) || (interpolated && interpolated[fdi]);

        // ALL YOLO detections become children (sub-objects)
        const allChildren = dets.map(d => ({
            cls: d.cls, conf: d.conf,
            x1: d.x1, y1: d.y1, x2: d.x2, y2: d.y2,
            polygon_pct: d.polygon_pct || null,
            category: SUB_CATEGORY[d.cls] || 'other'
        }));

        // Infer card cls from what YOLO detected inside
        let cls = 'tooth', conf = 0;
        const hasImplant = dets.some(d => d.cls === 'Implant');
        const hasRootPiece = dets.some(d => d.cls === 'Root Piece');
        const hasMissing = dets.some(d => d.cls === 'Missing teeth');
        if (hasImplant) { cls = 'Implant'; conf = dets.find(d => d.cls === 'Implant').conf; }
        else if (hasRootPiece) { cls = 'Root Piece'; conf = dets.find(d => d.cls === 'Root Piece').conf; }
        else if (hasMissing) { cls = 'Missing teeth'; conf = dets.find(d => d.cls === 'Missing teeth').conf; }
        else if (dets.length > 0) { conf = Math.max(...dets.map(d => d.conf)); }

        // Determine crop bbox: prefer SemiT-SAM (whole tooth), fallback to YOLO union
        let cropBbox = null;
        let parentBbox = null;
        let semitBbox = null; // original SemiT-SAM bbox (for focus vignette)

        if (interp) {
            // SemiT-SAM bbox = whole tooth (already has 15%/8% padding from backend)
            cropBbox = { x1: interp.x1, y1: interp.y1, x2: interp.x2, y2: interp.y2 };
            semitBbox = { x1: interp.x1, y1: interp.y1, x2: interp.x2, y2: interp.y2 };

            // Ensure minimum crop dimensions — central incisors are narrow,
            // SemiT-SAM may give only 50% of average tooth width
            const avgToothW = imgW / 16;
            const minCropW = avgToothW * 0.75;
            const minCropH = imgH * 0.18;
            const curW = cropBbox.x2 - cropBbox.x1;
            const curH = cropBbox.y2 - cropBbox.y1;
            if (curW < minCropW) {
                const extra = (minCropW - curW) / 2;
                cropBbox.x1 = Math.max(0, Math.round(cropBbox.x1 - extra));
                cropBbox.x2 = Math.min(imgW, Math.round(cropBbox.x2 + extra));
            }
            if (curH < minCropH) {
                const extra = (minCropH - curH) / 2;
                cropBbox.y1 = Math.max(0, Math.round(cropBbox.y1 - extra));
                cropBbox.y2 = Math.min(imgH, Math.round(cropBbox.y2 + extra));
            }

            // Expand to include any YOLO children that extend beyond SemiT-SAM
            for (const ch of allChildren) {
                const pad = 4;
                cropBbox.x1 = Math.max(0, Math.min(cropBbox.x1, ch.x1 - pad));
                cropBbox.y1 = Math.max(0, Math.min(cropBbox.y1, ch.y1 - pad));
                cropBbox.x2 = Math.min(imgW, Math.max(cropBbox.x2, ch.x2 + pad));
                cropBbox.y2 = Math.min(imgH, Math.max(cropBbox.y2, ch.y2 + pad));
            }
        } else if (dets.length > 0) {
            // No SemiT-SAM — fallback: union of all YOLO detections + generous padding
            let ux1 = Infinity, uy1 = Infinity, ux2 = -Infinity, uy2 = -Infinity;
            for (const d of dets) {
                ux1 = Math.min(ux1, d.x1); uy1 = Math.min(uy1, d.y1);
                ux2 = Math.max(ux2, d.x2); uy2 = Math.max(uy2, d.y2);
            }
            const uw = ux2 - ux1, uh = uy2 - uy1;
            const pw = Math.max(uw * 0.3, uh * 0.15);
            const ph = uh * 0.15;
            cropBbox = {
                x1: Math.max(0, ux1 - pw), y1: Math.max(0, uy1 - ph),
                x2: Math.min(imgW, ux2 + pw), y2: Math.min(imgH, uy2 + ph)
            };
        }

        // Build parentBbox for backward compat (largest YOLO detection or SemiT-SAM)
        if (dets.length > 0) {
            const biggest = dets.reduce((a, b) =>
                ((b.x2-b.x1)*(b.y2-b.y1) > (a.x2-a.x1)*(a.y2-a.y1) ? b : a));
            parentBbox = { x1: biggest.x1, y1: biggest.y1, x2: biggest.x2, y2: biggest.y2,
                           polygon_pct: biggest.polygon_pct || null, cls: biggest.cls };
        }

        if (!cropBbox) {
            // No SemiT-SAM, no YOLO — empty position
            cards.push({ fdi, cls: 'none', conf: 0, bbox: null, children: [], noDet: true, imgW, imgH });
            continue;
        }

        cards.push({
            fdi, cls, conf,
            bbox: cropBbox,
            semitBbox: semitBbox,
            parentBbox: parentBbox,
            children: allChildren,
            noDet: dets.length === 0,
            imgW, imgH
        });
    }

    return cards;
}

/**
 * Return bbox coords for drawImage on the OPG <img>.
 * Detection coords from the API are already in the same coordinate space
 * as the served image (naturalWidth × naturalHeight), because:
 *  - _highlightToothOnOPG uses det.x1 directly with naturalWidth and works
 *  - image_size from API may be wrong for DICOM files (PIL fallback 2048×1024)
 *  - YOLO ran on the served/converted image, not the raw file
 * So we pass coords through unchanged, clamped to natural bounds.
 */
function _yoloToNatural(bbox, card, opgImg) {
    const nW = opgImg.naturalWidth || 2048, nH = opgImg.naturalHeight || 1024;
    return {
        x1: Math.max(0, Math.min(bbox.x1, nW)),
        y1: Math.max(0, Math.min(bbox.y1, nH)),
        x2: Math.max(0, Math.min(bbox.x2, nW)),
        y2: Math.max(0, Math.min(bbox.y2, nH))
    };
}

/**
 * Draw a crop card thumbnail on a small canvas.
 */
function _drawCropThumb(canvas, opgImg, card, uniformScale) {
    if (!card.bbox || !opgImg) return;
    const ctx = canvas.getContext('2d');
    // Scale YOLO coords → image natural coords
    const nb = _yoloToNatural(card.bbox, card, opgImg);
    const sw = nb.x2 - nb.x1, sh = nb.y2 - nb.y1;
    if (sw < 1 || sh < 1) return;

    // Match canvas aspect ratio to crop aspect ratio (prevent distortion)
    // Clamp aspect to prevent extremely tall/thin crops (max 3:1 height:width)
    const rawAspect = sw / sh;
    const aspect = Math.max(rawAspect, 0.33); // floor: crop can be at most 3x taller than wide
    const cw = canvas.width;
    const ch = Math.min(Math.round(cw / aspect), cw * 3); // hard cap: 3x width
    canvas.height = ch;

    // Uniform scale: all thumbs use same px-per-natural-px ratio so sizes match panorama
    if (uniformScale && uniformScale > 0) {
        const dispW = Math.max(20, Math.min(60, Math.round(sw * uniformScale)));
        const dispH = Math.min(Math.round(dispW / aspect), dispW * 3);
        canvas.style.width = dispW + 'px';
        canvas.style.height = dispH + 'px';
    } else {
        canvas.style.width = '36px';
        canvas.style.height = Math.min(Math.round(36 / aspect), 108) + 'px';
    }

    ctx.clearRect(0, 0, cw, ch);
    // Apply saved filter for thumbnail too
    let _tfId = card._fileId;
    if (!_tfId) { for (const f of Object.keys(_carouselState)) { const s = _carouselState[f]; if (s?.cards?.includes(card)) { _tfId = f; card._fileId = f; break; } } }
    const _tfs = ((_cropFilterState[_tfId] || {})[card.fdi]) || {};
    if ((_tfs.brightness && _tfs.brightness !== 1.0) || (_tfs.contrast && _tfs.contrast !== 1.0)) {
        ctx.filter = `brightness(${_tfs.brightness||1}) contrast(${_tfs.contrast||1})`;
    }
    try {
        ctx.drawImage(opgImg, nb.x1, nb.y1, sw, sh, 0, 0, cw, ch);
    } catch(e) { return; }
    ctx.filter = 'none';

    // Draw children bboxes (thin lines)
    const scX = cw / sw, scY = ch / sh;
    for (const child of card.children) {
        const nc = _yoloToNatural(child, card, opgImg);
        const cx1 = (nc.x1 - nb.x1) * scX, cy1 = (nc.y1 - nb.y1) * scY;
        const cw2 = (nc.x2 - nc.x1) * scX, ch2 = (nc.y2 - nc.y1) * scY;
        const color = YOLO_COLORS[child.cls] || 'rgba(255,255,255,0.5)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(cx1, cy1, cw2, ch2);
    }
}

/**
 * Draw an expanded (active) crop card with high resolution and labels.
 */
function _drawCropExpanded(canvas, opgImg, card) {
    if (!card.bbox || !opgImg) return;
    const ctx = canvas.getContext('2d');
    // Scale YOLO coords → image natural coords (use viewBbox when in child focus)
    let srcBbox = card.bbox;
    if (_cropFsState && _cropFsState.open && _cropFsState.viewBbox
        && _cropFsState.card === card) {
        srcBbox = _cropFsState.viewBbox;
    }
    const nb = _yoloToNatural(srcBbox, card, opgImg);
    const sw = nb.x2 - nb.x1, sh = nb.y2 - nb.y1;
    if (sw < 1 || sh < 1) return;

    // Match canvas aspect ratio to crop (prevent distortion)
    // Clamp: expanded crop max 3:1 height:width (no kilometer-long crops)
    const rawAspect = sw / sh;
    const aspect = Math.max(rawAspect, 0.33);
    const cw = canvas.width; // e.g. 400
    const ch = Math.min(Math.round(cw / aspect), cw * 3);
    canvas.height = ch;

    ctx.clearRect(0, 0, cw, ch);
    // Apply per-crop brightness/contrast filters
    const _fs = ((_cropFilterState[card._fileId] || {})[card.fdi]) ||
                (card.fdi && _cropFilterState['_last'] ? null : null);
    // Lookup via fileId stored on card, or find from carousel state
    let _fFileId = card._fileId;
    if (!_fFileId) {
        for (const fid of Object.keys(_carouselState)) {
            const st = _carouselState[fid];
            if (st && st.cards && st.cards.includes(card)) { _fFileId = fid; card._fileId = fid; break; }
        }
    }
    const _cropFs = ((_cropFilterState[_fFileId] || {})[card.fdi]) || {};
    const _bri = _cropFs.brightness || 1.0;
    const _con = _cropFs.contrast || 1.0;
    if (_bri !== 1.0 || _con !== 1.0) {
        ctx.filter = `brightness(${_bri}) contrast(${_con})`;
    }
    try {
        ctx.drawImage(opgImg, nb.x1, nb.y1, sw, sh, 0, 0, cw, ch);
    } catch(e) { return; }
    ctx.filter = 'none';

    const scX = cw / sw, scY = ch / sh;

    // ── Focus vignette: dim areas outside SemiT-SAM bbox ──
    // When the crop is wider than the SemiT-SAM bbox (due to minCropW or children),
    // darken the side margins so the central tooth stands out from neighbors.
    if (card.semitBbox && card.bbox) {
        const sb = _yoloToNatural(card.semitBbox, card, opgImg);
        const cropW = nb.x2 - nb.x1;
        const semitW = sb.x2 - sb.x1;
        // Only apply if crop is noticeably wider than SemiT-SAM (>15% extra)
        if (cropW > semitW * 1.15) {
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            const leftEdge = (sb.x1 - nb.x1) * scX;
            const rightEdge = (sb.x2 - nb.x1) * scX;
            // Left dim zone
            if (leftEdge > 2) ctx.fillRect(0, 0, leftEdge, ch);
            // Right dim zone
            if (rightEdge < cw - 2) ctx.fillRect(rightEdge, 0, cw - rightEdge, ch);
        }
    }

    // Draw parent bbox outline (white dashed) — skip if activated as editable child
    const _pbActivated = card.children.some(c => c._isParentBbox);
    const _nW = opgImg.naturalWidth || 2048, _nH = opgImg.naturalHeight || 1024;
    if (card.parentBbox && !_pbActivated && !(canvas.id === 'crop-fs-canvas' && _cropFsHideParent)) {
        const _parentPoly = card.parentBbox.polygon_pct;
        const _hasParentPoly = _parentPoly && _parentPoly.length >= 3;
        // Draw contour for parent if polygon available
        if ((_cropDisplayMode === 'contour' || _cropDisplayMode === 'both') && _hasParentPoly) {
            const color = YOLO_COLORS[card.cls] || 'rgba(255,255,255,0.7)';
            ctx.beginPath();
            for (let pi = 0; pi < _parentPoly.length; pi++) {
                const px = (_parentPoly[pi][0] / 100 * _nW - nb.x1) * scX;
                const py = (_parentPoly[pi][1] / 100 * _nH - nb.y1) * scY;
                pi === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = color.replace(/[\d.]+\)$/, '0.12)');
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.stroke();
        }
        // Bbox fallback / dual mode
        if (_cropDisplayMode === 'bbox' || (_cropDisplayMode === 'both' && !_hasParentPoly)) {
            const pb = _yoloToNatural(card.parentBbox, card, opgImg);
            ctx.setLineDash([4, 3]);
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.lineWidth = 1.5;
            ctx.strokeRect((pb.x1 - nb.x1) * scX, (pb.y1 - nb.y1) * scY,
                           (pb.x2 - pb.x1) * scX, (pb.y2 - pb.y1) * scY);
            ctx.setLineDash([]);
        }
    }

    // Draw children with colored fills + labels (dual mode: bbox / contour / both)
    for (let _ci = 0; _ci < card.children.length; _ci++) {
        // Skip hidden children (fullscreen editor eye toggle)
        if (canvas.id === 'crop-fs-canvas' && _cropFsHidden.has(_ci)) continue;
        const child = card.children[_ci];
        const nc = _yoloToNatural(child, card, opgImg);
        const cx1 = (nc.x1 - nb.x1) * scX, cy1 = (nc.y1 - nb.y1) * scY;
        const cw2 = (nc.x2 - nc.x1) * scX, ch2 = (nc.y2 - nc.y1) * scY;
        const color = YOLO_COLORS[child.cls] || 'rgba(255,255,255,0.5)';
        const isManual = child._manual;
        const hasPolygon = child.polygon_pct && child.polygon_pct.length >= 3;

        // ── Contour mode: draw polygon ──
        if ((_cropDisplayMode === 'contour' || _cropDisplayMode === 'both') && hasPolygon) {
            const pts = child.polygon_pct;
            ctx.beginPath();
            for (let pi = 0; pi < pts.length; pi++) {
                const px = (pts[pi][0] / 100 * _nW - nb.x1) * scX;
                const py = (pts[pi][1] / 100 * _nH - nb.y1) * scY;
                pi === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath();
            ctx.fillStyle = color.replace('0.95', '0.15').replace('0.9', '0.15');
            ctx.fill();
            if (isManual) ctx.setLineDash([4, 3]);
            ctx.strokeStyle = color;
            ctx.lineWidth = 2;
            ctx.stroke();
            if (isManual) ctx.setLineDash([]);
        }

        // ── Bbox mode (or fallback when no polygon) ──
        if (_cropDisplayMode === 'bbox' || _cropDisplayMode === 'both' || !hasPolygon) {
            const isContourFallback = (_cropDisplayMode === 'contour') && !hasPolygon;
            ctx.fillStyle = color.replace('0.95', isContourFallback ? '0.25' : '0.2').replace('0.9', isContourFallback ? '0.25' : '0.2');
            ctx.fillRect(cx1, cy1, cw2, ch2);
            if (isManual || isContourFallback) ctx.setLineDash([4, 3]);
            ctx.strokeStyle = color;
            ctx.lineWidth = isContourFallback ? 2.5 : 2;
            ctx.strokeRect(cx1, cy1, cw2, ch2);
            if (isManual || isContourFallback) ctx.setLineDash([]);
            // Indicate missing contour data
            if (isContourFallback) {
                ctx.font = '8px system-ui';
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.fillText('нет контура', cx1 + 2, cy1 + ch2 - 3);
            }
        }

        // Category accent — thin colored border on left edge
        const _cat = child.category || SUB_CATEGORY[child.cls] || 'other';
        const _catCol = CATEGORY_COLORS[_cat] || CATEGORY_COLORS['other'];
        ctx.fillStyle = _catCol.stroke;
        ctx.fillRect(cx1, cy1, 3, ch2);

        // Label — GT-corrected if reclassified, else "Class %" / "Class ✎"
        const _gtCorr = _getGTCorrectedLabel(_fFileId, card.fdi, child.cls);
        const label = _gtCorr || child.cls.replace('Root canal obturation', 'RCO').replace('Periapical lesion', 'Periap.');
        const suffix = _gtCorr ? ' ✎' : (isManual ? ' ✎' : ` ${Math.round((child.conf || 0) * 100)}%`);
        ctx.font = '10px system-ui';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 3;
        ctx.fillText(`${label}${suffix}`, cx1 + 6, cy1 - 3 > 10 ? cy1 - 3 : cy1 + 12);
        ctx.shadowBlur = 0;
    }

    // ── Category legend bar (compact, bottom of crop) ──
    if (card.children.length > 0) {
        const _catCounts = {};
        for (const ch of card.children) {
            const cat = ch.category || SUB_CATEGORY[ch.cls] || 'other';
            if (!_catCounts[cat]) _catCounts[cat] = [];
            _catCounts[cat].push(ch.cls);
        }
        // Only show legend if there are categorized children
        const cats = Object.keys(_catCounts).filter(c => c !== 'other');
        if (cats.length > 0) {
            const lh = 14; // legend height
            const ly = ch - lh;
            ctx.fillStyle = 'rgba(0,0,0,0.55)';
            ctx.fillRect(0, ly, cw, lh);
            ctx.font = '9px system-ui';
            let lx = 4;
            for (const cat of ['pathology', 'artificial', 'condition']) {
                if (!_catCounts[cat]) continue;
                const cc = CATEGORY_COLORS[cat];
                // Dot
                ctx.fillStyle = cc.dot;
                ctx.beginPath();
                ctx.arc(lx + 4, ly + 7, 3, 0, Math.PI * 2);
                ctx.fill();
                // Label
                ctx.fillStyle = '#ddd';
                const names = [...new Set(_catCounts[cat])].map(n =>
                    n.replace('Root canal obturation', 'RCO').replace('Periapical lesion', 'Periap.').replace('Crown framework', 'Карк.').replace('Crown veneer', 'Обл.')
                ).join(', ');
                const txt = `${cc.label}: ${names}`;
                ctx.fillText(txt, lx + 10, ly + 10);
                lx += ctx.measureText(txt).width + 18;
            }
        }
    }

    // ── Resize handles for active edit child ──
    if (_activeEditChild && _activeEditChild.fileId === _fFileId && _activeEditChild.fdi === card.fdi) {
        const achIdx = _activeEditChild.childIdx;
        // Skip handles if this child is hidden via eye toggle
        if (achIdx >= 0 && achIdx < card.children.length && !(canvas.id === 'crop-fs-canvas' && _cropFsHidden.has(achIdx))) {
            const ach = card.children[achIdx];
            const anc = _yoloToNatural(ach, card, opgImg);
            const ax1 = (anc.x1 - nb.x1) * scX, ay1 = (anc.y1 - nb.y1) * scY;
            const ax2 = (anc.x2 - nb.x1) * scX, ay2 = (anc.y2 - nb.y1) * scY;
            const aw = ax2 - ax1, ah = ay2 - ay1;
            // Highlight border (blue)
            ctx.save();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2.5;
            ctx.strokeRect(ax1, ay1, aw, ah);
            // Corner + midpoint handles (white squares with blue border)
            const hs = 6;
            const handles = [
                [ax1, ay1], [ax1 + aw/2, ay1], [ax2, ay1],
                [ax1, ay1 + ah/2],              [ax2, ay1 + ah/2],
                [ax1, ay2], [ax1 + aw/2, ay2], [ax2, ay2],
            ];
            for (const [hx, hy] of handles) {
                ctx.fillStyle = '#fff';
                ctx.fillRect(hx - hs/2, hy - hs/2, hs, hs);
                ctx.strokeStyle = '#3b82f6';
                ctx.lineWidth = 1.5;
                ctx.strokeRect(hx - hs/2, hy - hs/2, hs, hs);
            }
            ctx.restore();

            // ── Polygon vertex handles (fullscreen editor only) ──
            if (canvas.id === 'crop-fs-canvas' && ach.polygon_pct && ach.polygon_pct.length >= 3) {
                ctx.save();
                const vr = 5; // vertex radius
                for (let vi = 0; vi < ach.polygon_pct.length; vi++) {
                    const vx = (ach.polygon_pct[vi][0] / 100 * _nW - nb.x1) * scX;
                    const vy = (ach.polygon_pct[vi][1] / 100 * _nH - nb.y1) * scY;
                    const isActive = _cropFsVertexState && _cropFsVertexState.dragging && _cropFsVertexState.vertexIdx === vi;
                    ctx.beginPath();
                    ctx.arc(vx, vy, isActive ? vr + 2 : vr, 0, Math.PI * 2);
                    ctx.fillStyle = isActive ? '#f59e0b' : '#fff';
                    ctx.fill();
                    ctx.strokeStyle = '#3b82f6';
                    ctx.lineWidth = 1.5;
                    ctx.stroke();
                }
                ctx.restore();
            }
        }
    }

    // ── GT status badge (top-RIGHT) — descriptive text, e.g. "эндо+штифт+коронка" ──
    const _gtRaw = (arenaGroundTruth[_fFileId] || {})[card.fdi];
    if (_gtRaw) {
        const _gtLayersRaw = parseToothLayers(_gtRaw);
        // Dedupe: if impl_restored present, drop standalone implant
        const _hasCompoundImpl = _gtLayersRaw.some(l => l.status.startsWith('impl_') && l.status !== 'impl_fixture');
        const _gtLayers = _hasCompoundImpl ? _gtLayersRaw.filter(l => l.status !== 'implant' && l.status !== 'impl_fixture') : _gtLayersRaw;
        const _GT_LONG = {
            endo:'эндо', post:'штифт', crowned:'коронка', restored:'пломба',
            caries:'кариес', present:'интакт', missing:'отс.', implant:'имплантат',
            impl_fixture:'имплантат', impl_restored:'имп+кор', impl_cover:'имп+заг',
            impl_healing:'имп+форм', attrition:'стираем.', root:'корень',
            bridge:'мост', bar:'балка', impacted:'ретенц.', cantilever:'консоль',
        };
        const _gtDesc = _gtLayers.map(l => _GT_LONG[l.status] || l.status).join('+');
        if (_gtDesc) {
            ctx.save();
            ctx.font = 'bold 11px system-ui';
            const _gtTm = ctx.measureText(_gtDesc);
            const _gpad = 4;
            // Position: top-RIGHT corner (avoid FDI number at top-left)
            const _gpx = cw - _gtTm.width - _gpad * 2 - 4;
            const _gpy = 4;
            // Blue pill background
            ctx.fillStyle = 'rgba(37,99,235,0.88)';
            _rrect(ctx, _gpx, _gpy, _gtTm.width + _gpad * 2, 18, 4);
            ctx.fill();
            // White text
            ctx.fillStyle = '#fff';
            ctx.textBaseline = 'middle';
            ctx.fillText(_gtDesc, _gpx + _gpad, _gpy + 9);
            ctx.restore();
        }
    }

    // Confidence bar at bottom
    const barH = 4, barW = cw - 8;
    const confVal = card.conf || 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(4, ch - barH - 4, barW, barH);
    ctx.fillStyle = confVal > 0.7 ? 'rgba(16,185,129,0.8)' : confVal > 0.4 ? 'rgba(245,158,11,0.8)' : 'rgba(239,68,68,0.8)';
    ctx.fillRect(4, ch - barH - 4, barW * confVal, barH);

    // FDI label at top-left
    ctx.font = 'bold 13px system-ui';
    // FDI label with dark pill background for readability
    _drawLabelWithBg(ctx, card.fdi, 4, 14, {font:'bold 12px system-ui', color:'#fff', bg:'rgba(0,0,0,0.65)', pad:3});

    // Class + conf at top-right — GT-corrected if reclassified
    const _cardGtCorr = _getGTCorrectedLabel(_fFileId, card.fdi, card.cls);
    const clsLabel = _cardGtCorr || card.cls;
    const clsColor = _cardGtCorr ? '#22d3ee' : (YOLO_COLORS[card.cls] || '#fff');
    const clsText = _cardGtCorr ? `${clsLabel} ✎` : `${clsLabel} ${Math.round(confVal*100)}%`;
    ctx.font = '10px system-ui';
    const tm = ctx.measureText(clsText);
    _drawLabelWithBg(ctx, clsText, cw - tm.width - 10, 14, {font:'10px system-ui', color:clsColor, bg:'rgba(0,0,0,0.65)', pad:3});
}

/**
 * Setup dynamic mousemove tooltip for sub-objects inside expanded crop canvas.
 * Shows class name + confidence when hovering over a child bbox.
 */
function _setupCropCanvasTooltip(canvas, card, fileId) {
    // Store handler reference for cleanup
    if (canvas._tooltipHandler) {
        canvas.removeEventListener('mousemove', canvas._tooltipHandler);
    }
    const CHILD_LABELS_RU = {
        'Crown': 'Коронка', 'Filling': 'Пломба', 'Caries': 'Кариес',
        'Root canal obturation': 'Обтурация каналов', 'Periapical lesion': 'Периапикальное поражение',
        'Implant': 'Имплантат', 'Missing teeth': 'Отсутствующий зуб', 'Root Piece': 'Остаток корня'
    };
    const handler = (e) => {
        const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
        if (!opgImg || !card.bbox) return;
        // Convert mouse pos to image coords (same as _canvasEventToImgCoords)
        const nb = _yoloToNatural(card.bbox, card, opgImg);
        const sw = nb.x2 - nb.x1, sh = nb.y2 - nb.y1;
        if (sw < 1 || sh < 1) return;
        const rect = canvas.getBoundingClientRect();
        const dispScaleX = canvas.width / rect.width, dispScaleY = canvas.height / rect.height;
        const canvasX = (e.clientX - rect.left) * dispScaleX;
        const canvasY = (e.clientY - rect.top) * dispScaleY;
        const imgX = canvasX / (canvas.width / sw) + nb.x1;
        const imgY = canvasY / (canvas.height / (nb.y2-nb.y1)) + nb.y1;

        const hit = _hitTestChildBbox(card, imgX, imgY);
        if (hit) {
            const ruName = _objName(hit.cls);
            const confStr = hit._manual ? (_isEN_crop() ? ' (manual)' : ' (ручная)') : ` ${Math.round((hit.conf || 0) * 100)}%`;
            const parentHint = hit._isParent ? (_isEN_crop() ? '\n(parent object)' : '\n(родительский объект)') : '';
            canvas.title = `${ruName}${confStr}${parentHint}\n${_isEN_crop() ? 'Click: correct / info' : 'Клик: исправить / информация'}`;
            canvas.style.cursor = 'pointer';
        } else {
            const edgeSize = 16;
            const rx = (e.clientX - rect.left) * dispScaleX;
            const isEdge = rx < edgeSize || rx > canvas.width - edgeSize;
            if (!isEdge) {
                canvas.title = `${card.fdi}: Click an object | Edge: resize`;
                canvas.style.cursor = 'default';
            }
        }
    };
    canvas._tooltipHandler = handler;
    canvas.addEventListener('mousemove', handler);
}

/** Compute uniform scale for thumbnail sizing (same jaw). */
function _computeUniformScale(fileId, fdi, opgImg) {
    const state = _carouselState[fileId];
    if (!state || !opgImg) return 0;
    const jaw = fdi.startsWith('1.') || fdi.startsWith('2.') ? UPPER_FDI : LOWER_FDI;
    let maxW = 0;
    for (const f of jaw) {
        const c = state.cards.find(cc => cc.fdi === f);
        if (c && c.bbox) {
            const nb = _yoloToNatural(c.bbox, c, opgImg);
            maxW = Math.max(maxW, nb.x2 - nb.x1);
        }
    }
    return maxW > 0 ? 42 / maxW : 0;
}

// ── Shared dictionaries for objects panel ──
const _OBJ_NAMES = {
    'Crown':'Коронка','Crown framework':'Каркас','Crown veneer':'Облицовка',
    'Filling':'Пломба','Caries':'Кариозная полость',
    'Root canal obturation':'Обтурация каналов','Periapical lesion':'Периапикальный очаг',
    'Implant':'Тело имплантата','Cover screw':'Винт-заглушка',
    'Abutment':'Абатмент','Fixation screw':'Винт абатмента',
    'Missing teeth':'Отсутствует','Root Piece':'Корень','Tooth':'Зуб'};
const _OBJ_NAMES_EN = {
    'Crown':'Crown','Crown framework':'Crown framework','Crown veneer':'Veneer',
    'Filling':'Filling','Caries':'Carious lesion',
    'Root canal obturation':'Canal obturation','Periapical lesion':'Periapical lesion',
    'Implant':'Implant body','Cover screw':'Cover screw',
    'Abutment':'Abutment','Fixation screw':'Abutment screw',
    'Missing teeth':'Missing','Root Piece':'Root remnant','Tooth':'Tooth'};
const _GT_LAYER_NAMES = {endo:'Эндо (каналы)',post:'Штифт',crowned:'Коронка',restored:'Пломба',
    caries:'Кариес',present:'Интактный',missing:'Отсутствует',implant:'Имплантат',
    impl_fixture:'Фикстура',impl_cover:'Заглушка',impl_healing:'Формирователь',
    impl_abutment:'Абатмент',impl_temp_abut:'Вр.абатмент',impl_provisional:'Вр.коронка',
    impl_restored:'Имп.+коронка',attrition:'Стираемость',root:'Корень',bridge:'Мост',
    bar:'Балка',impacted:'Ретенция',cantilever:'Консоль',uncertain:'?'};
const _GT_LAYER_NAMES_EN = {endo:'Endo (canals)',post:'Post',crowned:'Crown',restored:'Filling',
    caries:'Caries',present:'Intact',missing:'Missing',implant:'Implant',
    impl_fixture:'Fixture',impl_cover:'Cover screw',impl_healing:'Healing abut.',
    impl_abutment:'Abutment',impl_temp_abut:'Temp. abut.',impl_provisional:'Temp. crown',
    impl_restored:'Imp. + crown',attrition:'Wear',root:'Root',bridge:'Bridge',
    bar:'Bar',impacted:'Impacted',cantilever:'Cantilever',uncertain:'?'};
// Group / item label translation maps (used by _GT_EXPECTED_CHILDREN
// renderer and crop annotation toolbar). Keys are the canonical
// Russian strings shipped in the data; values are the EN equivalent.
const _GT_GROUP_NAMES_EN = {
    'Имплантат':'Implant', 'Коронка':'Crown', 'Эндодонтия':'Endodontics',
    'Штифт':'Post', 'Реставрация':'Restoration', 'Кариес':'Caries',
};
const _GT_ITEM_LABEL_EN = {
    'Тело имплантата':'Implant body', 'Винт-заглушка':'Cover screw',
    'Формирователь десны':'Healing abutment', 'Абатмент':'Abutment',
    'Винт абатмента':'Abutment screw', 'Временный абатмент':'Temporary abutment',
    'Временная коронка':'Temporary crown', 'Коронка':'Crown',
    'Каркас':'Crown framework', 'Облицовка':'Veneer',
    'Обтурация каналов':'Canal obturation', 'Штифтовая конструкция':'Post & core',
    'Пломба':'Filling', 'Кариозная полость':'Carious lesion',
};
// Helpers — pick RU or EN based on OrisI18n's current language. Falling
// back to the RU string when no EN translation is registered keeps the
// safety net intact for any new label that gets added later.
function _isEN_crop() {
    return (typeof OrisI18n !== 'undefined') && OrisI18n.getLang() === 'en';
}
function _objName(cls) {
    return _isEN_crop() ? (_OBJ_NAMES_EN[cls] || _OBJ_NAMES[cls] || cls)
                        : (_OBJ_NAMES[cls] || cls);
}
function _layerName(status) {
    return _isEN_crop() ? (_GT_LAYER_NAMES_EN[status] || _GT_LAYER_NAMES[status] || status)
                        : (_GT_LAYER_NAMES[status] || status);
}
function _groupNameEN(ru) {
    return _isEN_crop() ? (_GT_GROUP_NAMES_EN[ru] || ru) : ru;
}
function _itemLabelEN(ru) {
    return _isEN_crop() ? (_GT_ITEM_LABEL_EN[ru] || ru) : ru;
}
const _GT_LAYER_COLORS = {endo:'#a855f7',post:'#f59e0b',crowned:'#06b6d4',restored:'#3b82f6',
    caries:'#ef4444',present:'#475569',missing:'#64748b',implant:'#22c55e',
    impl_fixture:'#22c55e',impl_restored:'#06b6d4',impl_cover:'#84cc16',
    impl_healing:'#eab308',bridge:'#22d3ee',root:'#d946ef',impacted:'#78716c',
    attrition:'#fb923c',cantilever:'#67e8f9',bar:'#a78bfa'};
const _GT_TO_YOLO_CLS = {crowned:'Crown',restored:'Filling',caries:'Caries',
    endo:'Root canal obturation',post:'Root canal obturation',
    implant:'Implant',impl_fixture:'Implant',impl_cover:'Implant',
    impl_healing:'Implant',impl_restored:'Implant',impl_abutment:'Implant',
    impl_temp_abut:'Implant',impl_provisional:'Implant',
    root:'Root Piece',missing:'Missing teeth'};

// Contextual sub-objects: GT status → groups of expected YOLO components
// Structure: [{group, color, items:[{cls, req, label?}]}]
// req:true = always shown (✓/✗), req:false = optional (–, shown dimmed)
// label overrides _OBJ_NAMES for context-dependent naming (e.g. Abutment → "Формирователь десны" in impl_healing)
// References: Misch 2008, ISO 16498, Schwarz 2020, Ørstavik 2019, Schwartz & Robbins 2004
const _GT_EXPECTED_CHILDREN = {
    'impl_fixture': [
        {group:'Имплантат', color:'#22c55e', items:[
            {cls:'Implant',req:true,label:'Тело имплантата'}]}],
    'impl_cover': [
        {group:'Имплантат', color:'#22c55e', items:[
            {cls:'Implant',req:true,label:'Тело имплантата'},
            {cls:'Cover screw',req:true,label:'Винт-заглушка'}]}],
    'impl_healing': [
        {group:'Имплантат', color:'#22c55e', items:[
            {cls:'Implant',req:true,label:'Тело имплантата'},
            {cls:'Abutment',req:true,label:'Формирователь десны'}]}],
    'impl_abutment': [
        {group:'Имплантат', color:'#22c55e', items:[
            {cls:'Implant',req:true,label:'Тело имплантата'},
            {cls:'Abutment',req:true,label:'Абатмент'},
            {cls:'Fixation screw',req:true,label:'Винт абатмента'}]}],
    'impl_temp_abut': [
        {group:'Имплантат', color:'#22c55e', items:[
            {cls:'Implant',req:true,label:'Тело имплантата'},
            {cls:'Abutment',req:true,label:'Временный абатмент'}]}],
    'impl_provisional': [
        {group:'Имплантат', color:'#22c55e', items:[
            {cls:'Implant',req:true,label:'Тело имплантата'},
            {cls:'Abutment',req:true,label:'Абатмент'}]},
        {group:'Коронка', color:'#06b6d4', items:[
            {cls:'Crown',req:true,label:'Временная коронка'},
            {cls:'Crown framework',req:true,label:'Каркас'},
            {cls:'Crown veneer',req:false,label:'Облицовка'}]}],
    'impl_restored': [
        {group:'Имплантат', color:'#22c55e', items:[
            {cls:'Implant',req:true,label:'Тело имплантата'},
            {cls:'Abutment',req:true,label:'Абатмент'},
            {cls:'Fixation screw',req:true,label:'Винт абатмента'}]},
        {group:'Коронка', color:'#06b6d4', items:[
            {cls:'Crown',req:true,label:'Коронка'},
            {cls:'Crown framework',req:true,label:'Каркас'},
            {cls:'Crown veneer',req:false,label:'Облицовка'}]}],
    'crowned': [
        {group:'Коронка', color:'#06b6d4', items:[
            {cls:'Crown',req:true,label:'Коронка'},
            {cls:'Crown framework',req:true,label:'Каркас'},
            {cls:'Crown veneer',req:false,label:'Облицовка'}]}],
    'endo': [
        {group:'Эндодонтия', color:'#a855f7', items:[
            {cls:'Root canal obturation',req:true,label:'Обтурация каналов'}]}],
    'post': [
        {group:'Штифт', color:'#f59e0b', items:[
            {cls:'Root canal obturation',req:true,label:'Штифтовая конструкция'}]}],
    'restored': [
        {group:'Реставрация', color:'#3b82f6', items:[
            {cls:'Filling',req:true,label:'Пломба'}]}],
    'caries': [
        {group:'Кариес', color:'#ef4444', items:[
            {cls:'Caries',req:true,label:'Кариозная полость'}]}],
};

/**
 * Build objects panel element for a crop card.
 * Shows expected sub-objects per GT status with ✓/✗ match + YOLO detections.
 * Missing items are clickable → enter draw mode.
 */
function _buildObjPanel(cardEl, card, fileId, fdi) {
    const objPanel = document.createElement('div');
    objPanel.className = 'cc-gt-layers';
    let objHtml = '';

    // Build set of detected YOLO classes for match checking
    // Count YOLO detections: parent (original class, not GT-remapped) + children
    const _detectedYolo = new Set();
    if (card.parentBbox && card.parentBbox.cls) _detectedYolo.add(card.parentBbox.cls);
    for (const ch of card.children) {
        if (!ch._isParentBbox) _detectedYolo.add(ch.cls);
    }

    // Section 1: GT layers with contextual sub-objects
    if (card.gtLayers && card.gtLayers.length > 0) {
        // Deduplicate impl_* layers: keep only the highest stage (same logic as layersAbbreviation)
        const _IR = {implant:0,impl_fixture:1,impl_cover:2,impl_healing:3,impl_abutment:4,impl_temp_abut:5,impl_provisional:6,impl_restored:7};
        let _dedupLayers = card.gtLayers;
        const _implLayers = _dedupLayers.filter(l => _IR[l.status] !== undefined);
        if (_implLayers.length > 1) {
            let _best = _implLayers[0];
            for (const l of _implLayers) { if ((_IR[l.status]||0) > (_IR[_best.status]||0)) _best = l; }
            _dedupLayers = _dedupLayers.filter(l => _IR[l.status] === undefined || l === _best);
        }
        let nFound = 0, nTotal = 0;
        let layerHtml = '';
        const _groupedCls = new Set(); // track classes shown in grouped sections
        for (const l of _dedupLayers) {
            const surf = l.surfaces ? ` <span class="gt-layer-surf">${l.surfaces.toUpperCase()}</span>` : '';
            const groups = _GT_EXPECTED_CHILDREN[l.status];
            if (groups) {
                // Grouped: group headers + child rows
                let grpIdx = 0;
                for (const grp of groups) {
                    const grpSurf = grpIdx === 0 ? surf : '';
                    const sepCls = grpIdx > 0 ? ' gt-group-sep' : '';
                    layerHtml += `<div class="gt-sub-hdr${sepCls}"><span class="gt-layer-dot" style="background:${grp.color}"></span>${_groupNameEN(grp.group)}${grpSurf}</div>`;
                    for (const ch of grp.items) {
                        _groupedCls.add(ch.cls);
                        const hasMatch = _detectedYolo.has(ch.cls);
                        const isOptMissing = !ch.req && !hasMatch;
                        nTotal++;
                        if (hasMatch) nFound++;
                        const statusIcon = hasMatch ? '✓' : (isOptMissing ? '–' : '✗');
                        const statusCss = hasMatch ? 'gt-matched' : (isOptMissing ? 'gt-optional-missing' : 'gt-missing');
                        const optBadge = !ch.req ? ` <span class="gt-opt-badge">${_isEN_crop() ? 'opt.' : 'опц.'}</span>` : '';
                        const chName = (ch.label ? _itemLabelEN(ch.label) : _objName(ch.cls)) || ch.cls;
                        const tipMatch  = _isEN_crop() ? 'YOLO matched — hover to highlight'      : 'YOLO нашёл — наведите для подсветки';
                        const tipNoMatch= _isEN_crop() ? 'Not detected — click to draw manually'  : 'Не найден — клик чтобы нарисовать';
                        layerHtml += `<div class="gt-layer-item gt-child-item gt-has-det ${statusCss}" data-hl-type="gt" data-gt-yolo="${ch.cls}" data-gt-status="${l.status}" data-gt-file="${fileId}" data-gt-fdi="${fdi}" data-draw-cls="${ch.cls}" title="${hasMatch ? tipMatch : tipNoMatch}">` +
                            `<span class="gt-layer-dot" style="background:${YOLO_COLORS[ch.cls]||grp.color||'#888'}"></span>` +
                            `${chName}${optBadge}` +
                            `<span class="gt-match-icon">${statusIcon}</span></div>`;
                    }
                    grpIdx++;
                }
            } else {
                // Flat: single row — skip if YOLO class already covered by a grouped section
                const yoloCls = _GT_TO_YOLO_CLS[l.status] || '';
                if (yoloCls && _groupedCls.has(yoloCls)) continue;
                nTotal++;
                const hasMatch = yoloCls && _detectedYolo.has(yoloCls);
                if (hasMatch) nFound++;
                const statusIcon = hasMatch ? '✓' : '✗';
                const statusCss = hasMatch ? 'gt-matched' : 'gt-missing';
                const tipMatch  = _isEN_crop() ? 'YOLO matched — hover to highlight'     : 'YOLO нашёл — наведите для подсветки';
                const tipNoMatch= _isEN_crop() ? 'Not detected — click to draw manually' : 'Не найден — клик чтобы нарисовать';
                layerHtml += `<div class="gt-layer-item gt-has-det ${statusCss}" data-hl-type="gt" data-gt-yolo="${yoloCls}" data-gt-status="${l.status}" data-gt-file="${fileId}" data-gt-fdi="${fdi}" data-draw-cls="${yoloCls}" title="${hasMatch ? tipMatch : tipNoMatch}">` +
                    `<span class="gt-layer-dot" style="background:${_GT_LAYER_COLORS[l.status]||'#888'}"></span>` +
                    `${_layerName(l.status)}${surf}` +
                    `<span class="gt-match-icon">${statusIcon}</span></div>`;
            }
        }
        const _gtFormulaLabel = _isEN_crop() ? 'GT formula' : 'GT формула';
        objHtml += `<div class="gt-hdr">${_gtFormulaLabel} <span style="float:right;font-size:7px;opacity:0.6">${nFound}/${nTotal}</span></div>`;
        objHtml += layerHtml;

        // "+" button: add objects not in expected children
        const _shownCls = new Set();
        for (const l of card.gtLayers) {
            const grps = _GT_EXPECTED_CHILDREN[l.status];
            if (grps) grps.forEach(g => g.items.forEach(c => _shownCls.add(c.cls)));
            const yc = _GT_TO_YOLO_CLS[l.status];
            if (yc) _shownCls.add(yc);
        }
        const _extras = (typeof ANNOT_CLASSES !== 'undefined' ? ANNOT_CLASSES : []).filter(ac => !_shownCls.has(ac.cls));
        if (_extras.length > 0) {
            objHtml += `<div class="gt-add-row" data-gt-file="${fileId}" data-gt-fdi="${fdi}">` +
                `<span class="gt-add-btn" title="Добавить объект">＋</span>` +
                `<div class="gt-add-dropdown" style="display:none">` +
                _extras.map(ac =>
                    `<div class="gt-add-option" data-cls="${ac.cls}" data-gt-file="${fileId}" data-gt-fdi="${fdi}">` +
                    `<span class="gt-layer-dot" style="background:${ac.color}"></span>` +
                    `${_objName(ac.cls)}</div>`
                ).join('') +
                `</div></div>`;
        }
    }

    // Section 2: YOLO detections (parent + children)
    const yoloItems = [];
    if (card.parentBbox) {
        yoloItems.push({cls: card.parentBbox.cls || card.cls, conf: card.conf, idx: 'parent'});
    }
    for (let i = 0; i < card.children.length; i++) {
        if (!card.children[i]._isParentBbox) {
            yoloItems.push({cls: card.children[i].cls, conf: card.children[i].conf, idx: i});
        }
    }
    if (yoloItems.length > 0) {
        objHtml += `<div class="gt-hdr" style="color:#60a5fa;border-color:rgba(96,165,250,0.15);margin-top:${card.gtLayers?.length ? '4px' : '0'}">YOLO ${yoloItems.length}</div>`;
        for (const yi of yoloItems) {
            const color = YOLO_COLORS[yi.cls] || '#888';
            const name = _objName(yi.cls);
            const conf = yi.conf ? ` ${Math.round(yi.conf*100)}%` : '';
            objHtml += `<div class="gt-layer-item gt-has-det" data-hl-type="yolo" data-hl-idx="${yi.idx}" data-gt-file="${fileId}" data-gt-fdi="${fdi}">` +
                `<span class="gt-layer-dot" style="background:${color}"></span>` +
                `${name}<span class="gt-layer-surf">${conf}</span></div>`;
        }
    }

    if (!objHtml) {
        objHtml = '<div class="gt-hdr">Нет объектов</div><div style="font-size:8px;color:#64748b;padding:2px 0">Назначьте GT статус через пикер</div>';
    }

    objPanel.innerHTML = objHtml;

    // Helper: check if a natural-coord bbox overlaps with the crop bbox (>30% area inside)
    const _cropNb = _yoloToNatural(card.bbox, card, document.getElementById(`arena-opg-img-${fileId}`));
    function _isInsideCrop(nc) {
        const ix1 = Math.max(nc.x1, _cropNb.x1), iy1 = Math.max(nc.y1, _cropNb.y1);
        const ix2 = Math.min(nc.x2, _cropNb.x2), iy2 = Math.min(nc.y2, _cropNb.y2);
        if (ix1 >= ix2 || iy1 >= iy2) return false;
        const iArea = (ix2 - ix1) * (iy2 - iy1);
        const cArea = (nc.x2 - nc.x1) * (nc.y2 - nc.y1);
        return cArea > 0 && (iArea / cArea) > 0.3;
    }

    // Helper: draw a child bbox highlight on the OPG overlay canvas (only if inside crop)
    function _drawChildOnOPG(fId, nc, hlColor, dashed) {
        if (!_isInsideCrop(nc)) return; // skip objects outside crop boundary
        const caseEl = document.getElementById(`arena-case-${fId}`);
        if (!caseEl) return;
        const m = _getOPGMapping(caseEl, true);
        if (!m) return;
        const ox1 = m.tx(nc.x1), oy1 = m.ty(nc.y1);
        const ow = m.tx(nc.x2) - ox1, oh = m.ty(nc.y2) - oy1;
        if (ow < 2 || oh < 2) return;
        m.ctx.save();
        m.ctx.fillStyle = hlColor.replace(')', ',0.25)').replace('rgb', 'rgba');
        m.ctx.fillRect(ox1, oy1, ow, oh);
        if (dashed) m.ctx.setLineDash([5, 3]);
        m.ctx.strokeStyle = hlColor; m.ctx.lineWidth = 2;
        m.ctx.strokeRect(ox1, oy1, ow, oh);
        if (dashed) m.ctx.setLineDash([]);
        m.ctx.restore();
    }

    // Hover highlight handler
    objPanel.querySelectorAll('.gt-layer-item').forEach(item => {
        item.addEventListener('mouseenter', () => {
            const fId = item.dataset.gtFile;
            const cvs = cardEl.querySelector('.cc-canvas');
            const opgImg = document.getElementById(`arena-opg-img-${fId}`);
            if (!cvs || !opgImg || !card.bbox || cvs.width <= 120) return;
            _drawCropExpanded(cvs, opgImg, card);
            // Refresh OPG overlay to clean state before drawing hover highlights
            _refreshOPGChildrenOverlay(fId);
            const ctx = cvs.getContext('2d');
            const nb = _yoloToNatural(card.bbox, card, opgImg);
            const sw = nb.x2 - nb.x1, sh = nb.y2 - nb.y1;
            if (sw < 1 || sh < 1) return;
            const scX = cvs.width / sw, scY = cvs.height / sh;
            const dotEl = item.querySelector('.gt-layer-dot');
            const hlColor = dotEl ? dotEl.style.background || '#4ade80' : '#4ade80';
            const hlType = item.dataset.hlType;
            let highlighted = false;

            if (hlType === 'yolo') {
                const idx = item.dataset.hlIdx;
                let det = null;
                if (idx === 'parent' && card.parentBbox) det = card.parentBbox;
                else { const ci = parseInt(idx); if (ci >= 0 && card.children[ci]) det = card.children[ci]; }
                if (det) {
                    const nc = _yoloToNatural(det, card, opgImg);
                    const insideCrop = (idx === 'parent') || _isInsideCrop(nc);
                    if (insideCrop) {
                        const rx = (nc.x1 - nb.x1) * scX, ry = (nc.y1 - nb.y1) * scY;
                        const rw = (nc.x2 - nc.x1) * scX, rh = (nc.y2 - nc.y1) * scY;
                        ctx.save();
                        ctx.fillStyle = hlColor.replace(')', ',0.25)').replace('rgb', 'rgba');
                        ctx.fillRect(rx, ry, rw, rh);
                        ctx.strokeStyle = hlColor; ctx.lineWidth = 3;
                        ctx.strokeRect(rx, ry, rw, rh);
                        ctx.restore();
                        highlighted = true;
                        _drawChildOnOPG(fId, nc, hlColor, false);
                    }
                }
            } else {
                // GT layer → find matching YOLO child by class (only inside crop)
                const yc = item.dataset.gtYolo;
                if (yc) {
                    for (const ch of card.children) {
                        if (ch.cls === yc && !ch._isParentBbox) {
                            const nc = _yoloToNatural(ch, card, opgImg);
                            if (!_isInsideCrop(nc)) continue; // skip objects outside crop
                            const rx = (nc.x1 - nb.x1) * scX, ry = (nc.y1 - nb.y1) * scY;
                            const rw = (nc.x2 - nc.x1) * scX, rh = (nc.y2 - nc.y1) * scY;
                            if (rw < 2 || rh < 2) continue;
                            ctx.save();
                            ctx.fillStyle = hlColor.replace(')', ',0.25)').replace('rgb', 'rgba');
                            ctx.fillRect(rx, ry, rw, rh);
                            ctx.strokeStyle = hlColor; ctx.lineWidth = 3;
                            ctx.strokeRect(rx, ry, rw, rh);
                            ctx.restore();
                            highlighted = true;
                            _drawChildOnOPG(fId, nc, hlColor, false);
                        }
                    }
                    if (!highlighted && card.parentBbox && card.cls === yc) {
                        const pb = _yoloToNatural(card.parentBbox, card, opgImg);
                        const rx = (pb.x1 - nb.x1) * scX, ry = (pb.y1 - nb.y1) * scY;
                        const rw = (pb.x2 - pb.x1) * scX, rh = (pb.y2 - pb.y1) * scY;
                        ctx.save();
                        ctx.fillStyle = hlColor.replace(')', ',0.25)').replace('rgb', 'rgba');
                        ctx.fillRect(rx, ry, rw, rh);
                        ctx.strokeStyle = hlColor; ctx.lineWidth = 3;
                        ctx.strokeRect(rx, ry, rw, rh);
                        ctx.restore();
                        highlighted = true;
                        _drawChildOnOPG(fId, pb, hlColor, false);
                    }
                }
                // GT fallback: anatomical zone split on parent bbox
                if (!highlighted && card.parentBbox) {
                    const gtStatus = item.dataset.gtStatus || '';
                    const _fdi = item.dataset.gtFdi || card.fdi;
                    const isUpper = _fdi.startsWith('1.') || _fdi.startsWith('2.');
                    const pb = _yoloToNatural(card.parentBbox, card, opgImg);
                    const px = (pb.x1 - nb.x1) * scX, py = (pb.y1 - nb.y1) * scY;
                    const pw = (pb.x2 - pb.x1) * scX, ph = (pb.y2 - pb.y1) * scY;
                    const CROWN_STATS = ['crowned','restored','caries','attrition','bridge','cantilever','bar'];
                    const ROOT_STATS = ['endo','post','root','implant','impl_fixture','impl_cover',
                        'impl_healing','impl_abutment','impl_temp_abut','impl_provisional'];
                    let zx = px, zy = py, zw = pw, zh = ph;
                    if (CROWN_STATS.includes(gtStatus)) {
                        if (isUpper) { zh = ph * 0.40; }
                        else { zy = py + ph * 0.60; zh = ph * 0.40; }
                    } else if (ROOT_STATS.includes(gtStatus)) {
                        if (isUpper) { zy = py + ph * 0.35; zh = ph * 0.65; }
                        else { zh = ph * 0.65; }
                    }
                    ctx.save();
                    ctx.fillStyle = hlColor.replace(')', ',0.22)').replace('rgb', 'rgba');
                    ctx.fillRect(zx, zy, zw, zh);
                    ctx.strokeStyle = hlColor; ctx.lineWidth = 2.5; ctx.setLineDash([5, 3]);
                    ctx.strokeRect(zx, zy, zw, zh);
                    ctx.setLineDash([]); ctx.restore();
                    // OPG highlight: anatomical zone in natural coords
                    const pNat = pb; // already in natural coords
                    const pNH = pNat.y2 - pNat.y1;
                    let zn = {x1:pNat.x1, y1:pNat.y1, x2:pNat.x2, y2:pNat.y2};
                    if (CROWN_STATS.includes(gtStatus)) {
                        if (isUpper) zn.y2 = pNat.y1 + pNH*0.40;
                        else zn.y1 = pNat.y1 + pNH*0.60;
                    } else if (ROOT_STATS.includes(gtStatus)) {
                        if (isUpper) zn.y1 = pNat.y1 + pNH*0.35;
                        else zn.y2 = pNat.y1 + pNH*0.65;
                    }
                    _drawChildOnOPG(fId, zn, hlColor, true);
                }
            }
            // Label
            const label = item.textContent.replace(/\d+%/, '').trim();
            ctx.save();
            ctx.font = 'bold 12px system-ui'; ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0,0,0,0.9)'; ctx.shadowBlur = 4;
            ctx.fillText(label, 6, 16);
            ctx.shadowBlur = 0; ctx.restore();
        });
        item.addEventListener('mouseleave', () => {
            const cvs = cardEl.querySelector('.cc-canvas');
            const fId = item.dataset.gtFile;
            const opgImg = document.getElementById(`arena-opg-img-${fId}`);
            if (cvs && opgImg && card.bbox && cvs.width > 120) {
                _drawCropExpanded(cvs, opgImg, card);
            }
            _refreshOPGChildrenOverlay(fId);
        });
    });
    // Click on matched GT/YOLO item → open sub-object fullscreen focus
    objPanel.querySelectorAll('.gt-layer-item.gt-has-det').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const hlType = item.dataset.hlType;
            const hlIdx = item.dataset.hlIdx;
            const yoloCls = item.dataset.gtYolo || item.dataset.drawCls;
            let chIdx = -1;
            if (hlType === 'yolo' && hlIdx !== 'parent') {
                chIdx = parseInt(hlIdx);
            } else if (yoloCls) {
                chIdx = card.children.findIndex(ch => ch.cls === yoloCls && !ch._isParentBbox);
            }
            if (chIdx >= 0 && card.children[chIdx]) {
                _cropFsOpenChild(fileId, fdi, chIdx);
            }
        });
        item.style.cursor = 'pointer';
    });
    // Click on missing/optional-missing GT item → enter draw mode
    objPanel.querySelectorAll('.gt-layer-item.gt-missing, .gt-layer-item.gt-optional-missing').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const drawCls = item.dataset.drawCls;
            if (!drawCls) return;
            if (!cardEl.classList.contains('active')) _activateCropCard(fileId, fdi);
            _enterCropDrawMode(fileId, fdi, drawCls, cardEl);
            item.style.background = 'rgba(245,158,11,0.3)';
            setTimeout(() => { item.style.background = ''; }, 400);
        });
    });
    // "+" button → toggle dropdown; option → draw mode
    objPanel.querySelectorAll('.gt-add-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dd = btn.parentElement.querySelector('.gt-add-dropdown');
            if (dd) dd.style.display = dd.style.display === 'none' ? '' : 'none';
        });
    });
    objPanel.querySelectorAll('.gt-add-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation();
            const cls = opt.dataset.cls;
            const dd = opt.closest('.gt-add-dropdown');
            if (dd) dd.style.display = 'none';
            if (!cardEl.classList.contains('active')) _activateCropCard(fileId, fdi);
            _enterCropDrawMode(fileId, fdi, cls, cardEl);
        });
    });
    return objPanel;
}

/**
 * Refresh the objects panel on a crop card after GT change.
 * Updates card.gtLayers/gtAbbr/cls from current GT and rebuilds the panel.
 */
function _refreshCropObjPanel(fileId, fdi) {
    const state = _carouselState[fileId];
    if (!state) return;
    const card = state.cards.find(c => c.fdi === fdi);
    if (!card || !card.bbox) return;
    const cardEl = document.querySelector(`.carousel-card[data-file="${fileId}"][data-fdi="${fdi}"]`);
    if (!cardEl) return;

    // Update card data from current GT
    const gtStatus = (arenaGroundTruth[fileId] || {})[fdi];
    if (gtStatus) {
        const layers = typeof parseToothLayers === 'function' ? parseToothLayers(gtStatus) : [{status: gtStatus}];
        const primary = layers[0]?.status || gtStatus.split('+')[0].split(':')[0];
        const GT_TO_CLS = {
            'impl_restored': 'Implant', 'impl_cover': 'Implant', 'impl_healing': 'Implant',
            'impl_fixture': 'Implant', 'implant': 'Implant',
            'crowned': 'Crown', 'crown': 'Crown',
            'restored': 'Filling', 'filling': 'Filling',
            'caries': 'Caries', 'endo': 'Root canal obturation',
            'missing': 'Missing teeth', 'present': 'Tooth',
            'root': 'Root Piece', 'root_only': 'Root Piece',
            'bridge': 'Crown', 'bar': 'Crown', 'cantilever': 'Crown',
            'post': 'Root canal obturation',
        };
        card.cls = GT_TO_CLS[primary] || card.cls;
        card.noDet = false;
        card.gtLayers = layers;
        card.gtRaw = gtStatus;
        card.gtAbbr = typeof layersAbbreviation === 'function' ? layersAbbreviation(layers) : primary;
    } else {
        card.gtLayers = null;
        card.gtRaw = null;
        card.gtAbbr = null;
    }

    // Update class sub-label
    const clsEl = cardEl.querySelector('.cc-cls');
    if (clsEl) {
        clsEl.textContent = card.gtAbbr || card.cls;
        clsEl.style.color = card.gtAbbr ? '#60a5fa' : (YOLO_COLORS[card.cls] || 'var(--text-dim)');
    }

    // Replace objects panel
    const oldPanel = cardEl.querySelector('.cc-gt-layers');
    if (oldPanel) oldPanel.remove();
    const newPanel = _buildObjPanel(cardEl, card, fileId, fdi);
    // Insert before delete button or at end
    const delBtn = cardEl.querySelector('.cc-delete-btn');
    if (delBtn) cardEl.insertBefore(newPanel, delBtn);
    else cardEl.appendChild(newPanel);

    // Reposition panel if card is active
    if (cardEl.classList.contains('active')) {
        setTimeout(() => {
            const _tb = cardEl.querySelector('.cc-annot-toolbar');
            const _gp = newPanel;
            if (_tb && _gp) _gp.style.left = (146 + _tb.offsetWidth + 8) + 'px';
        }, 30);
    }
}

/**
 * Render carousel for one jaw (upper/lower).
 */
function _renderCropCarousel(fileId, jaw) {
    const containerId = `crop-carousel-${jaw}-${fileId}`;
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = '';

    const state = _carouselState[fileId];
    if (!state) return;

    const fdiList = jaw === 'upper' ? UPPER_FDI : LOWER_FDI;
    const opgImg = document.getElementById(`arena-opg-img-${fileId}`);

    // Compute uniform scale: all thumbs same px-per-natural-pixel so sizes match panorama
    let _maxBboxW = 0;
    for (const fdi of fdiList) {
        const c = state.cards.find(cc => cc.fdi === fdi);
        if (c && c.bbox && opgImg) {
            const nb = _yoloToNatural(c.bbox, c, opgImg);
            _maxBboxW = Math.max(_maxBboxW, nb.x2 - nb.x1);
        }
    }
    const _uniformScale = _maxBboxW > 0 ? 42 / _maxBboxW : 0; // 42px = target width for largest bbox

    for (const fdi of fdiList) {
        const card = state.cards.find(c => c.fdi === fdi);
        if (!card) continue;

        const isImplant = card.cls === 'Implant';
        const noDet = card.noDet;

        const cardEl = document.createElement('div');
        cardEl.className = `carousel-card${isImplant ? ' is-implant' : ''}${noDet ? ' no-det' : ''}`;
        cardEl.dataset.fdi = fdi;
        cardEl.dataset.file = fileId;
        // Drag-to-reassign: drag crop to a different FDI cell
        // BUT disable drag when interacting with sliders (brightness/contrast)
        cardEl.draggable = true;
        cardEl.addEventListener('dragstart', (e) => {
            // Don't start drag if user is using a slider or button inside the card
            if (e.target.closest('input[type=range], button, .cc-filter-bar, .cc-annot-toolbar')) {
                e.preventDefault();
                return;
            }
            e.dataTransfer.setData('application/x-crop-reassign', JSON.stringify({
                fileId, fdi, bbox: card.bbox, cls: card.cls
            }));
            e.dataTransfer.effectAllowed = 'move';
            cardEl.style.opacity = '0.4';
        });
        cardEl.addEventListener('dragend', () => { cardEl.style.opacity = '1'; });
        // Tooltip on card
        const confStr = card.conf ? ` ${Math.round(card.conf*100)}%` : '';
        const gtTip = card.gtAbbr ? `\nGT: ${card.gtAbbr} (${card.gtRaw})` : '';
        cardEl.title = noDet
            ? `${fdi} — no detection\nClick: draw crop manually`
            : `${fdi} — ${card.gtAbbr || card.cls}${confStr}${gtTip}\nClick: open fullscreen editor   ·   Drag: reassign FDI`;
        // Click on empty card → draw manual crop on OPG
        if (noDet) {
            cardEl.addEventListener('click', (e) => {
                e.stopPropagation();
                _startAddCrop(fileId, fdi);
            });
            cardEl.style.cursor = 'cell';
        }

        // Canvas for thumbnail (height set by _drawCropThumb based on aspect ratio)
        const cvs = document.createElement('canvas');
        cvs.className = 'cc-canvas';
        cvs.width = 120; cvs.height = 120; // will be adjusted by draw
        cvs.title = noDet ? fdi : `${fdi}: ${card.cls}${confStr}\nClick: expand | Edge: resize`;
        cardEl.appendChild(cvs);

        // Label
        const lbl = document.createElement('div');
        lbl.className = 'cc-label';
        lbl.textContent = fdi;
        cardEl.appendChild(lbl);

        // Class sub-label
        const clsEl = document.createElement('div');
        clsEl.className = 'cc-cls';
        if (!noDet) {
            // GT abbreviation synced with SVG cell (ИК, Э+Ш+К, etc.)
            clsEl.textContent = card.gtAbbr || card.cls;
            clsEl.style.color = YOLO_COLORS[card.cls] || 'var(--text-dim)';
        }
        cardEl.appendChild(clsEl);

        // ── Objects panel — built via _buildObjPanel (shared with _refreshCropObjPanel) ──
        if (!noDet && card.bbox) {
            cardEl.appendChild(_buildObjPanel(cardEl, card, fileId, fdi));
        }

        // ── Delete crop button (✕) — removes false positive detection ──
        if (!noDet) {
            const delBtn = document.createElement('button');
            delBtn.className = 'cc-delete-btn';
            delBtn.textContent = '✕';
            delBtn.title = `Удалить кроп ${fdi} (ложное срабатывание)`;
            delBtn.style.cssText = 'position:absolute;top:1px;right:1px;width:14px;height:14px;border:none;background:rgba(239,68,68,0.7);color:#fff;font-size:9px;line-height:14px;text-align:center;border-radius:3px;cursor:pointer;z-index:20;display:none;padding:0';
            delBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                _deleteCrop(fileId, fdi);
            });
            cardEl.appendChild(delBtn);
            // Show on hover
            cardEl.addEventListener('mouseenter', () => { delBtn.style.display = 'block'; });
            cardEl.addEventListener('mouseleave', () => { delBtn.style.display = 'none'; });
        }

        // ── Annotation toolbar (hidden until card is active) ──
        const annotBar = document.createElement('div');
        annotBar.className = 'cc-annot-toolbar';
        for (const ac of ANNOT_CLASSES) {
            const btn = document.createElement('button');
            btn.className = 'cc-annot-btn';
            btn.textContent = (_isEN_crop() && ac.abbrEN) ? ac.abbrEN : ac.abbr;
            const CLS_RU = {'Crown':'коронку','Filling':'пломбу','Caries':'кариес',
                'Root canal obturation':'обтурацию каналов','Periapical lesion':'периапикальное поражение',
                'Implant':'имплантат','Cover screw':'заглушку','Abutment':'абатмент','Fixation screw':'фикс. винт'};
            btn.title = `Нарисовать ${CLS_RU[ac.cls] || ac.cls}`;
            btn.dataset.cls = ac.cls;
            btn.style.setProperty('--dot-color', ac.color);
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (_cropAnnotState.mode === 'draw' && _cropAnnotState.activeClass === ac.cls) {
                    _exitCropDrawMode();
                } else {
                    _enterCropDrawMode(fileId, fdi, ac.cls, cardEl);
                }
            });
            annotBar.appendChild(btn);
        }
        // ── Separator + quick tooth-status buttons ──
        const sep = document.createElement('span');
        sep.style.cssText = 'width:1px;height:12px;background:rgba(255,255,255,0.1);flex:0 0 1px;';
        annotBar.appendChild(sep);
        // Quick status buttons: Endo, Post
        const QUICK_STATUSES = [
            {abbr:'Эн', status:'endo', color:'#a855f7', title:'Установить статус: эндо (пролеченные каналы)'},
            {abbr:'Ш', status:'post', color:'#f59e0b', title:'Установить статус: штифт (post)'},
        ];
        for (const qs of QUICK_STATUSES) {
            const qb = document.createElement('button');
            qb.className = 'cc-annot-btn';
            qb.textContent = (_isEN_crop() && qs.abbrEN) ? qs.abbrEN : qs.abbr;
            qb.title = qs.title;
            qb.style.setProperty('--dot-color', qs.color);
            qb.addEventListener('click', (e) => {
                e.stopPropagation();
                _quickSetToothStatus(fileId, fdi, qs.status, qb);
            });
            annotBar.appendChild(qb);
        }
        // Implant analysis button (only for implant-type cards)
        if (isImplant) {
            const implBtn = document.createElement('button');
            implBtn.className = 'cc-implant-btn';
            implBtn.textContent = '🦴';
            implBtn.title = `Имплант-анализ для ${fdi}`;
            implBtn.addEventListener('click', (e) => { e.stopPropagation(); _openImplantFromCrop(fileId, fdi, card); });
            annotBar.appendChild(implBtn);
        }
        // Display mode toggle: bbox / contour / both
        const sep2 = document.createElement('span');
        sep2.style.cssText = 'width:1px;height:12px;background:rgba(255,255,255,0.1);flex:0 0 1px;';
        annotBar.appendChild(sep2);
        const DISP_MODES = [
            {mode:'bbox', icon:'▭', title:'Bbox (прямоугольники)'},
            {mode:'contour', icon:'◎', title:'Контур (маска)'},
            {mode:'both', icon:'▭◎', title:'Оба режима'},
        ];
        for (const dm of DISP_MODES) {
            const db = document.createElement('button');
            db.className = 'cc-annot-btn cc-disp-btn' + (_cropDisplayMode === dm.mode ? ' active' : '');
            db.textContent = dm.icon;
            db.title = dm.title;
            db.dataset.dispMode = dm.mode;
            db.addEventListener('click', (e) => {
                e.stopPropagation();
                _cropDisplayMode = dm.mode;
                // Update active state on all display mode buttons in this card
                cardEl.querySelectorAll('.cc-disp-btn').forEach(b => b.classList.toggle('active', b.dataset.dispMode === dm.mode));
                // Redraw
                const cvs = cardEl.querySelector('.cc-canvas');
                const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
                if (cvs && opgImg && card.bbox) {
                    cvs.width = 400;
                    _drawCropExpanded(cvs, opgImg, card);
                    cvs.style.width = '220px';
                    cvs.style.height = Math.round(220 * cvs.height / cvs.width) + 'px';
                }
            });
            annotBar.appendChild(db);
        }
        // Contour draw button
        const contourBtn = document.createElement('button');
        contourBtn.className = 'cc-annot-btn';
        contourBtn.textContent = '✎◎';
        contourBtn.title = 'Нарисовать контур вручную (клики → двойной клик замыкает)';
        contourBtn.style.setProperty('--dot-color', '#d946ef');
        contourBtn.addEventListener('click', (ev) => {
            ev.stopPropagation();
            if (_cropAnnotState.mode === 'draw_polygon') {
                _exitCropDrawMode();
            } else {
                _enterContourDrawMode(fileId, fdi, card.children.length > 0 ? card.children[0].cls : 'Crown', cardEl);
            }
        });
        annotBar.appendChild(contourBtn);
        cardEl.appendChild(annotBar);

        // ── Filter bar (brightness / contrast) ──
        const filterBar = document.createElement('div');
        filterBar.className = 'cc-filter-bar';
        const savedFs = ((_cropFilterState[fileId] || {})[fdi]) || {};
        filterBar.innerHTML =
            `<label title="Яркость">☀</label>` +
            `<input type="range" min="0.4" max="2.5" step="0.05" value="${savedFs.brightness||1.0}" data-param="brightness" title="Яркость">` +
            `<span class="cc-filter-val" data-vfor="brightness">${Math.round((savedFs.brightness||1)*100)}%</span>` +
            `<label title="Контраст">◐</label>` +
            `<input type="range" min="0.3" max="3.0" step="0.05" value="${savedFs.contrast||1.0}" data-param="contrast" title="Контраст">` +
            `<span class="cc-filter-val" data-vfor="contrast">${Math.round((savedFs.contrast||1)*100)}%</span>` +
            `<button class="cc-filter-reset" title="Сброс фильтров">↺</button>`;
        // Wire up slider events
        filterBar.querySelectorAll('input[type=range]').forEach(slider => {
            slider.addEventListener('input', (e) => {
                e.stopPropagation();
                const param = slider.dataset.param;
                const val = parseFloat(slider.value);
                if (!_cropFilterState[fileId]) _cropFilterState[fileId] = {};
                if (!_cropFilterState[fileId][fdi]) _cropFilterState[fileId][fdi] = { brightness: 1.0, contrast: 1.0 };
                _cropFilterState[fileId][fdi][param] = val;
                // Update value display
                const vSpan = filterBar.querySelector(`[data-vfor="${param}"]`);
                if (vSpan) vSpan.textContent = Math.round(val * 100) + '%';
                // Redraw with filter
                const cvs2 = cardEl.querySelector('.cc-canvas');
                const opgImg2 = document.getElementById(`arena-opg-img-${fileId}`);
                if (cvs2 && opgImg2) {
                    cvs2.width = 400;
                    _drawCropExpanded(cvs2, opgImg2, card);
                    cvs2.style.width = '220px'; cvs2.style.height = Math.round(220 * cvs2.height / cvs2.width) + 'px';
                }
                // Save
                _saveCropFilter(fileId, fdi);
            });
        });
        filterBar.querySelector('.cc-filter-reset').addEventListener('click', (e) => {
            e.stopPropagation();
            if (_cropFilterState[fileId]) delete _cropFilterState[fileId][fdi];
            filterBar.querySelectorAll('input[type=range]').forEach(s => {
                s.value = 1.0;
                const vSpan = filterBar.querySelector(`[data-vfor="${s.dataset.param}"]`);
                if (vSpan) vSpan.textContent = '100%';
            });
            const cvs2 = cardEl.querySelector('.cc-canvas');
            const opgImg2 = document.getElementById(`arena-opg-img-${fileId}`);
            if (cvs2 && opgImg2) {
                cvs2.width = 400;
                _drawCropExpanded(cvs2, opgImg2, card);
                cvs2.style.width = '220px'; cvs2.style.height = Math.round(220 * cvs2.height / cvs2.width) + 'px';
            }
            _saveCropFilter(fileId, fdi);
        });
        cardEl.appendChild(filterBar);

        // ── Status bar ──
        const statusBar = document.createElement('div');
        statusBar.className = 'cc-status-bar';
        statusBar.textContent = '';
        cardEl.appendChild(statusBar);

        // Draw thumbnail with uniform scale (proportional to panorama)
        if (opgImg && opgImg.complete && card.bbox) {
            _drawCropThumb(cvs, opgImg, card, _uniformScale);
        }

        // Click handler — restored production UX:
        //   • Single click on a crop with a bbox → open the full-screen
        //     editor (the "comfortable work mode" the reviewer remembers).
        //     The card is also marked active so closing fullscreen via Esc
        //     lands the reviewer back on a highlighted carousel slot.
        //   • Single click on a crop with NO detection → just activate
        //     (so the reviewer can draw a manual crop in carousel mode).
        //   • Click on the annotation canvas of an already-active card
        //     while a fullscreen editor is OPEN — the canvas mousedown
        //     handler runs the annotation tool. The fullscreen flow
        //     handles its own clicks separately, so we don't conflict.
        //   • Ctrl/Cmd+click — kept as a synonym for power users.
        //   • Double-click — kept as a redundant trigger for users who
        //     learnt the dblclick gesture.
        cardEl.addEventListener('click', (e) => {
            e.stopPropagation();
            // Active-card canvas hits go to annotation mousedown — the
            // mousedown handler already ran in carousel mode before we
            // reach this click. Only block if we'd otherwise re-open FS.
            if (cardEl.classList.contains('active') && e.target.closest('.cc-canvas')
                && _cropFsState && _cropFsState.open) return;
            if (!cardEl.classList.contains('active')) _activateCropCard(fileId, fdi);
            if (card.bbox) _cropFsOpen(fileId, fdi);
        });
        cardEl.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            e.preventDefault();
            if (!card.bbox) return;
            if (!cardEl.classList.contains('active')) _activateCropCard(fileId, fdi);
            _cropFsOpen(fileId, fdi);
        });

        container.appendChild(cardEl);
    }
}

/**
 * Activate (expand) one crop card, deactivate others.
 */
/** Navigate from row-level nav arrows. */
function _navCropFromRow(fileId, dir) {
    const state = _carouselState[fileId];
    if (!state || !state.activeFdi) return;
    _navigateCrop(fileId, state.activeFdi, dir);
}

/** Navigate to prev/next crop in the same jaw. dir: -1 (left) or +1 (right). */
function _navigateCrop(fileId, currentFdi, dir) {
    const state = _carouselState[fileId];
    if (!state) return;
    const fdiList = currentFdi.startsWith('1.') || currentFdi.startsWith('2.') ? UPPER_FDI : LOWER_FDI;
    // Filter to only FDIs that have crop cards
    const available = fdiList.filter(f => state.cards.some(c => c.fdi === f && (c.bbox || !c.noDet)));
    const idx = available.indexOf(currentFdi);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx >= 0 && nextIdx < available.length) {
        _activateCropCard(fileId, available[nextIdx]);
    }
}

function _activateCropCard(fileId, fdi) {
    const state = _carouselState[fileId];
    if (!state) return;

    // If same card clicked again — deactivate
    if (state.activeFdi === fdi) {
        _deactivateAllCards(fileId);
        return;
    }

    state.activeFdi = fdi;
    _activeEditChild = null; // Clear edit selection when switching crops
    const card = state.cards.find(c => c.fdi === fdi);
    const allCards = document.querySelectorAll(`.carousel-card[data-file="${fileId}"]`);
    const fdiList = fdi.startsWith('1.') || fdi.startsWith('2.') ? UPPER_FDI : LOWER_FDI;
    const fdiIdx = fdiList.indexOf(fdi);

    allCards.forEach(el => {
        const elFdi = el.dataset.fdi;
        const elIdx = fdiList.indexOf(elFdi);
        el.classList.remove('active', 'nb-left', 'nb-right', 'distant');

        if (elFdi === fdi) {
            el.classList.add('active');
            // Ensure toolbar/status visible (clear any stale inline display)
            const atb = el.querySelector('.cc-annot-toolbar');
            if (atb) atb.style.display = '';
            const asb = el.querySelector('.cc-status-bar');
            if (asb) asb.style.display = '';
            // Update canvas tooltip for expanded mode
            const activeCvs = el.querySelector('.cc-canvas');
            if (activeCvs) activeCvs.title = `${fdi}: Click an object | Edge: resize`;
            // Redraw at high resolution (aspect-correct)
            const cvs = el.querySelector('.cc-canvas');
            if (cvs && card && card.bbox) {
                cvs.width = 400;
                const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
                _drawCropExpanded(cvs, opgImg, card);
                cvs.style.width = '220px';
                cvs.style.height = Math.round(220 * cvs.height / cvs.width) + 'px';
            }
            // Setup drag-to-resize on this card
            _setupCropResize(el, fileId, fdi);
            // Setup dynamic tooltip for sub-objects on hover
            if (cvs && card) _setupCropCanvasTooltip(cvs, card, fileId);
            // Setup annotation interaction (hit-test, draw)
            _setupCropAnnotation(el, fileId, fdi);
            // Load manual annotations from DB
            if (card) _loadManualChildAnnotations(fileId, fdi, card).then(() => {
                if (cvs && card.bbox) {
                    const opgImg2 = document.getElementById(`arena-opg-img-${fileId}`);
                    _drawCropExpanded(cvs, opgImg2, card);
                    cvs.style.width = '220px';
                    cvs.style.height = Math.round(220 * cvs.height / cvs.width) + 'px';
                }
                // Rebuild obj panel now that manual annotations are loaded
                _refreshCropObjPanel(fileId, fdi);
            });
            // Update row-level nav arrows (on formula row edges)
            const _navAvail = fdiList.filter(f => state.cards.some(c => c.fdi === f && (c.bbox || !c.noDet)));
            const _navIdx = _navAvail.indexOf(fdi);
            const _rowNavL = document.getElementById(`crop-nav-left-${fileId}`);
            const _rowNavR = document.getElementById(`crop-nav-right-${fileId}`);
            if (_rowNavL) { _rowNavL.classList.add('visible'); _rowNavL.disabled = _navIdx <= 0; _rowNavL.title = _navIdx > 0 ? `← ${_navAvail[_navIdx-1]}` : ''; }
            if (_rowNavR) { _rowNavR.classList.add('visible'); _rowNavR.disabled = _navIdx >= _navAvail.length-1; _rowNavR.title = _navIdx < _navAvail.length-1 ? `→ ${_navAvail[_navIdx+1]}` : ''; }
            // Position filter bar below toolbar, GT panel to the right of toolbar
            setTimeout(() => {
                const _tb = el.querySelector('.cc-annot-toolbar');
                const _fb = el.querySelector('.cc-filter-bar');
                const _gp = el.querySelector('.cc-gt-layers');
                if (_tb && _fb) _fb.style.top = (_tb.offsetHeight + 4) + 'px';
                if (_tb && _gp) _gp.style.left = (146 + _tb.offsetWidth + 8) + 'px';
            }, 50);
            // Update status bar
            const sb = el.querySelector('.cc-status-bar');
            if (sb) sb.textContent = card.children.length > 0
                ? 'Объект | Кнопки справа для аннотации'
                : 'Кнопки справа для аннотации';
            // Show GT description instead of YOLO class when active
            const _clsEl = el.querySelector('.cc-cls');
            if (_clsEl) {
                const _gtVal = (arenaGroundTruth[fileId] || {})[fdi];
                if (_gtVal) {
                    const _gtL = parseToothLayers(_gtVal);
                    const _CLS_LONG = {endo:'эндо',post:'штифт',crowned:'коронка',restored:'пломба',caries:'кариес',present:'интакт',missing:'отс.',implant:'имплантат',impl_fixture:'имплантат',impl_restored:'имп+кор',impl_cover:'имп+заг',impl_healing:'имп+форм',attrition:'стираем.',root:'корень',bridge:'мост'};
                    _clsEl.textContent = _gtL.map(l => _CLS_LONG[l.status] || l.status).join('+');
                    _clsEl.style.color = '#60a5fa';
                }
            }
        } else {
            // ── Bug fix: reset inline canvas styles so CSS class controls size ──
            const prevCvs = el.querySelector('.cc-canvas');
            if (prevCvs && prevCvs.width > 120) {
                prevCvs.width = 120;
                prevCvs.style.width = '36px';
                prevCvs.style.height = 'auto';
                prevCvs.style.cursor = 'default';
                prevCvs.classList.remove('draw-mode');
                const prevCard = state.cards.find(c => c.fdi === elFdi);
                const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
                if (prevCard && prevCard.bbox && opgImg) {
                    const _us = _computeUniformScale(fileId, elFdi, opgImg);
                    _drawCropThumb(prevCvs, opgImg, prevCard, _us);
                }
            }
            // Clear inline display on toolbar/status (let CSS .active rule handle visibility)
            const tb = el.querySelector('.cc-annot-toolbar');
            if (tb) tb.style.display = '';
            const sb = el.querySelector('.cc-status-bar');
            if (sb) sb.style.display = '';

            if (elIdx >= 0 && Math.abs(elIdx - fdiIdx) === 1) {
                el.classList.add(elIdx < fdiIdx ? 'nb-left' : 'nb-right');
            } else if (elIdx >= 0) {
                el.classList.add('distant');
            }
        }
    });

    // Exit any active draw mode when switching cards
    _exitCropDrawMode();

    // Highlight tooth on OPG + crop bbox outline (respects children mode)
    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (caseEl) {
        const childMode = state.opgChildrenMode || 'off';
        if (childMode !== 'off') {
            // Re-render full children overlay + active card highlight
            _refreshOPGChildrenOverlay(fileId);
        } else if (card && card.bbox) {
            _drawCropBboxOnOPG(fileId, fdi, card, caseEl);
        } else {
            _highlightToothOnOPG(fileId, fdi, caseEl);
        }
    }

    // Highlight corresponding formula cell
    _highlightFormulaCell(fileId, fdi);
}

/**
 * Deactivate all carousel cards for a file.
 */
function _deactivateAllCards(fileId) {
    const state = _carouselState[fileId];
    if (state) state.activeFdi = null;
    // Hide row-level nav arrows
    const _rnL = document.getElementById(`crop-nav-left-${fileId}`);
    const _rnR = document.getElementById(`crop-nav-right-${fileId}`);
    if (_rnL) _rnL.classList.remove('visible');
    if (_rnR) _rnR.classList.remove('visible');

    const allCards = document.querySelectorAll(`.carousel-card[data-file="${fileId}"]`);
    allCards.forEach(el => {
        el.classList.remove('active', 'nb-left', 'nb-right', 'distant');
        // Restore thumbnail resolution
        const cvs = el.querySelector('.cc-canvas');
        if (cvs && cvs.width > 120) {
            cvs.width = 120;
            cvs.style.width = '36px';
            cvs.style.height = 'auto';
            cvs.style.cursor = 'default';
            const fdi = el.dataset.fdi;
            const card = state ? state.cards.find(c => c.fdi === fdi) : null;
            const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
            if (card && card.bbox && opgImg) {
                const _us2 = _computeUniformScale(fileId, fdi, opgImg);
                _drawCropThumb(cvs, opgImg, card, _us2);
            }
        }
    });

    // Clear OPG highlight
    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (caseEl) {
        const m = _getOPGMapping(caseEl);
        if (m) m.ctx.clearRect(0, 0, m.w, m.h);
    }
    // Clear formula cell highlight
    document.querySelectorAll(`.arena-formula-row.ground-truth[data-file="${fileId}"] .arena-cell.crop-active`).forEach(el => {
        el.classList.remove('crop-active');
        el.style.boxShadow = '';
    });
    // Exit draw mode if active
    if (_cropAnnotState.mode === 'draw' && String(_cropAnnotState.fileId) === String(fileId)) {
        _exitCropDrawMode();
    }
}

// ── Click outside crop → collapse active card ──
document.addEventListener('click', (e) => {
    // Close any open "+" dropdowns unless clicking inside one
    if (!e.target.closest('.gt-add-row')) {
        document.querySelectorAll('.gt-add-dropdown').forEach(dd => dd.style.display = 'none');
    }
    // If click is inside a carousel card or its children — skip (card's own handler manages it)
    if (e.target.closest('.carousel-card, .cc-annot-toolbar, .cc-annot-btn, .cc-child-popup, .cc-status-bar, .cc-filter-bar')) return;
    // If click is inside a popup or modal — skip
    if (e.target.closest('.gt-history-panel, .gt-timemachine, .tooth-picker-overlay')) return;
    // Deactivate any active crop card in any file
    for (const fileId of Object.keys(_carouselState)) {
        if (_carouselState[fileId].activeFdi) {
            _deactivateAllCards(fileId);
        }
    }
});

// ── Escape key → collapse active crop card ──
document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // If draw mode is active, exit draw mode first (don't collapse)
    if (_cropAnnotState.mode === 'draw') {
        _exitCropDrawMode();
        e.stopPropagation();
        return;
    }
    // Collapse any active crop
    for (const fileId of Object.keys(_carouselState)) {
        if (_carouselState[fileId].activeFdi) {
            _deactivateAllCards(fileId);
            e.stopPropagation();
            return;
        }
    }
});

/**
 * Highlight the formula cell corresponding to active crop card.
 */
function _highlightFormulaCell(fileId, fdi) {
    // Remove previous highlight
    document.querySelectorAll(`.arena-formula-row.ground-truth[data-file="${fileId}"] .arena-cell.crop-active`).forEach(el => {
        el.classList.remove('crop-active');
        el.style.boxShadow = '';
    });
    // Add highlight to current
    const cell = document.querySelector(`.arena-formula-row.ground-truth[data-file="${fileId}"] .arena-cell[data-fdi="${fdi}"]`);
    if (cell) {
        cell.classList.add('crop-active');
        cell.style.boxShadow = '0 0 12px rgba(59,130,246,0.6), inset 0 0 8px rgba(59,130,246,0.2)';
    }
}

/**
 * Toggle carousel visibility.
 */
function _toggleCropCarousel(fileId) {
    const upper = document.getElementById(`crop-carousel-upper-${fileId}`);
    const lower = document.getElementById(`crop-carousel-lower-${fileId}`);
    const btn = document.getElementById(`crop-toggle-${fileId}`);
    if (!upper || !lower) return;

    const isCollapsed = upper.classList.contains('collapsed');
    if (isCollapsed) {
        upper.classList.remove('collapsed');
        lower.classList.remove('collapsed');
        if (btn) btn.classList.add('active');
    } else {
        upper.classList.add('collapsed');
        lower.classList.add('collapsed');
        if (btn) btn.classList.remove('active');
        _deactivateAllCards(fileId);
    }
}

/**
 * Navigate to Implant Assessment tab from expanded implant crop card.
 */
function _openImplantFromCrop(fileId, fdi, card) {
    // Try to switch to implant assessment tab
    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;

    // Look for the implant assessment tab button
    const tabBtns = document.querySelectorAll('.darwin-tab-btn, [data-tab]');
    for (const btn of tabBtns) {
        const tabName = btn.dataset.tab || btn.textContent;
        if (tabName && (tabName.includes('implant') || tabName.includes('Имплант'))) {
            btn.click();
            // After tab switch, try to highlight this implant
            setTimeout(() => {
                const implList = document.querySelectorAll('.implant-item, .impl-card');
                for (const item of implList) {
                    if (item.textContent.includes(fdi) || item.dataset.fdi === fdi) {
                        item.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        item.style.outline = '2px solid var(--green)';
                        setTimeout(() => item.style.outline = '', 3000);
                        break;
                    }
                }
            }, 300);
            return;
        }
    }
    // Fallback: alert
    console.log(`Implant analysis for FDI ${fdi}, file ${fileId}`);
}

/**
 * Initialize crop carousels for a given case.
 * Called automatically after OPG image loads.
 */
async function _initCropCarousel(fileId) {
    // Ensure YOLO data is loaded
    let data = _yoloCache[fileId];
    if (!data) {
        data = await _loadYoloDetections(fileId);
    }
    if (!data || !data.detections || data.detections.length === 0) return;

    // Build card data — pass opgImg so we use naturalWidth/Height for bounds
    const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
    const cards = _buildCropData(fileId, opgImg);
    // Apply saved crop_overrides to card bboxes + filters (expert resized crops)
    const savedOverrides = (window.arenaCropOverrides || {})[fileId];
    if (savedOverrides) {
        for (const card of cards) {
            const ov = savedOverrides[card.fdi];
            if (ov && ov.deleted) {
                // Crop was explicitly deleted by expert
                card.bbox = null; card.noDet = true; card.cls = 'none'; card.children = [];
            } else if (ov && ov.x1 !== undefined) {
                if (card.bbox) {
                    // Update existing bbox
                    card.bbox.x1 = ov.x1; card.bbox.y1 = ov.y1;
                    card.bbox.x2 = ov.x2; card.bbox.y2 = ov.y2;
                } else {
                    // Manual crop on tooth with no YOLO detection — create bbox from override
                    card.bbox = { x1: ov.x1, y1: ov.y1, x2: ov.x2, y2: ov.y2 };
                    card.noDet = false;
                    if (card.cls === 'none') card.cls = 'manual';
                }
            }
            if (ov && (ov.brightness || ov.contrast)) {
                if (!_cropFilterState[fileId]) _cropFilterState[fileId] = {};
                _cropFilterState[fileId][card.fdi] = {
                    brightness: ov.brightness || 1.0,
                    contrast: ov.contrast || 1.0
                };
            }
        }
    }
    // Apply GT status to cards: GT formula is the source of truth, not YOLO
    const gt = arenaGroundTruth[fileId] || {};
    for (const card of cards) {
        const gtStatus = gt[card.fdi];
        if (gtStatus && card.bbox) {
            // Expert has defined this tooth's status — use it as primary class
            const layers = parseToothLayers ? parseToothLayers(gtStatus) : [{status: gtStatus}];
            const primary = layers[0]?.status || gtStatus.split('+')[0].split(':')[0];
            // Map GT status to display class
            const GT_TO_CLS = {
                'impl_restored': 'Implant', 'impl_cover': 'Implant', 'impl_healing': 'Implant',
                'impl_fixture': 'Implant', 'implant': 'Implant',
                'crowned': 'Crown', 'crown': 'Crown',
                'restored': 'Filling', 'filling': 'Filling',
                'caries': 'Caries', 'endo': 'Root canal obturation',
                'missing': 'Missing teeth', 'present': 'Tooth',
                'root': 'Root Piece', 'root_only': 'Root Piece',
                'bridge': 'Crown', 'bar': 'Crown', 'cantilever': 'Crown',
                'post': 'Root canal obturation',
            };
            card.cls = GT_TO_CLS[primary] || card.cls;
            card.noDet = false; // Expert confirmed — not "no detection"
            // Store GT layers for display — crop must show same info as SVG cell
            card.gtLayers = layers;
            card.gtRaw = gtStatus;
            card.gtAbbr = typeof layersAbbreviation === 'function' ? layersAbbreviation(layers) : primary;
        }
    }

    _carouselState[fileId] = { cards, activeFdi: null, opgChildrenMode: 'all' };

    // Auto-redetect YOLO children for interpolated cards (gap-filling bbox, no YOLO)
    // and manual crops restored from crop_overrides on reload
    for (const card of cards) {
        if (card.bbox && card.children.length === 0 && card.noDet) {
            if (card.cls === 'interpolated') {
                _redetectChildren(fileId, card.fdi, card.bbox);
            }
        }
    }

    // Render carousels
    _renderCropCarousel(fileId, 'upper');
    _renderCropCarousel(fileId, 'lower');

    // Render text formula under OPG
    _renderTextFormula(fileId);

    // Auto-populate GT from YOLO if GT formula is empty
    if (typeof autoPopulateGTFromYOLO === 'function') {
        autoPopulateGTFromYOLO(fileId);
    }

    // Draw objects + GT pills on OPG by default (expert mode always on)
    const _initCaseEl = document.getElementById(`arena-case-${fileId}`);
    if (_initCaseEl) {
        const _initOPG = document.getElementById(`arena-opg-img-${fileId}`);
        const _drawAll = () => {
            _getOPGMapping(_initCaseEl);
            _refreshOPGChildrenOverlay(fileId);
            // Set "Объекты" button to active state
            const _objBtn = _initCaseEl.querySelector('.opg-filter-btn[onclick*="toggleOPGChildrenView"]');
            if (_objBtn) { _objBtn.textContent = '🦷 Objects: all'; _objBtn.classList.add('active'); }
        };
        if (_initOPG && _initOPG.complete) setTimeout(_drawAll, 100);
        else if (_initOPG) _initOPG.addEventListener('load', _drawAll);
    }
}

/**
 * Hook: called from arena cell click to sync carousel.
 */
function _syncCarouselFromFormula(fileId, fdi) {
    if (!_carouselState[fileId]) return;
    const upper = document.getElementById(`crop-carousel-upper-${fileId}`);
    if (upper && upper.classList.contains('collapsed')) return; // carousel hidden
    _activateCropCard(fileId, fdi);
}

// ══════════════════════════════════════════════════════════════════════════
// ██  CROP CARD RESIZE — drag edges to adjust bbox on crop + OPG
// ══════════════════════════════════════════════════════════════════════════

let _cropResizeState = null; // { fileId, fdi, edge, startX, startY, startBbox, canvas, card }

/** Detect which edge the cursor is near (returns 'n','s','e','w','ne','nw','se','sw' or null). */
function _getCropEdge(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const w = rect.width, h = rect.height;
    const T = 16; // edge threshold in display pixels
    let edge = '';
    if (y < T) edge += 'n';
    else if (y > h - T) edge += 's';
    if (x < T) edge += 'w';
    else if (x > w - T) edge += 'e';
    return edge || null;
}

/** Map edge string to CSS cursor. */
function _edgeCursor(edge) {
    return { n:'n-resize', s:'s-resize', e:'e-resize', w:'w-resize',
             ne:'ne-resize', nw:'nw-resize', se:'se-resize', sw:'sw-resize' }[edge] || 'default';
}

/** Setup resize handlers on an activated crop card canvas. */
function _setupCropResize(cardEl, fileId, fdi) {
    const canvas = cardEl.querySelector('.cc-canvas');
    if (!canvas || canvas._resizeSetup) return;
    canvas._resizeSetup = true;

    canvas.addEventListener('mousemove', (e) => {
        if (_cropResizeState) return; // already dragging
        if (!cardEl.classList.contains('active')) return;
        // Don't override cursor here — annotation mousemove handles child+crop edges
        // Only set cursor if annotation handler hasn't been set up yet
        if (!canvas._annotSetup) {
            const edge = _getCropEdge(canvas, e);
            canvas.style.cursor = edge ? _edgeCursor(edge) : 'default';
        }
    });

    canvas.addEventListener('mousedown', (e) => {
        if (!cardEl.classList.contains('active')) return;
        // If child edge is closer, let annotation handler deal with it
        const state = _carouselState[fileId];
        if (!state) return;
        const card = state.cards.find(c => c.fdi === fdi);
        if (!card || !card.bbox) return;
        const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
        if (opgImg && card.children?.length > 0) {
            const chEdge = _getChildBboxEdge(canvas, card, opgImg, e);
            if (chEdge) return; // child edge takes priority — handled by annotation mousedown
        }
        const edge = _getCropEdge(canvas, e);
        if (!edge) return; // clicked center

        _cropResizeState = {
            fileId, fdi, edge,
            startX: e.clientX, startY: e.clientY,
            startBbox: { x1: card.bbox.x1, y1: card.bbox.y1, x2: card.bbox.x2, y2: card.bbox.y2 },
            canvas, card, cardEl
        };
        canvas.classList.add('resizing');
        e.preventDefault();
        // Note: removed e.stopPropagation() — not needed, early return on !edge handles center clicks
    });
}

/** Detect if cursor is near a child bbox edge. Returns {child, childIdx, edge} or null. */
function _getChildBboxEdge(canvas, card, opgImg, e) {
    if (!card || !card.children || card.children.length === 0) return null;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let srcBbox = card.bbox;
    if (_cropFsState && _cropFsState.open && _cropFsState.viewBbox
        && _cropFsState.card === card) {
        srcBbox = _cropFsState.viewBbox;
    }
    const nb = _yoloToNatural(srcBbox, card, opgImg);
    const sw = nb.x2 - nb.x1, sh = nb.y2 - nb.y1;
    const cw = canvas.width, ch = canvas.height;
    const scX = rect.width / cw * (cw / sw), scY = rect.height / ch * (ch / sh);
    const T = 14; // threshold px — generous for easy grabbing

    for (let i = 0; i < card.children.length; i++) {
        const child = card.children[i];
        const nc = _yoloToNatural(child, card, opgImg);
        // Convert to display coordinates
        const dx1 = (nc.x1 - nb.x1) * rect.width / sw;
        const dy1 = (nc.y1 - nb.y1) * rect.height / sh;
        const dx2 = (nc.x2 - nb.x1) * rect.width / sw;
        const dy2 = (nc.y2 - nb.y1) * rect.height / sh;

        // Check if near edges
        const inX = mx >= dx1 - T && mx <= dx2 + T;
        const inY = my >= dy1 - T && my <= dy2 + T;
        if (!inX || !inY) continue;

        let edge = '';
        if (Math.abs(my - dy1) < T) edge += 'n';
        else if (Math.abs(my - dy2) < T) edge += 's';
        if (Math.abs(mx - dx1) < T) edge += 'w';
        else if (Math.abs(mx - dx2) < T) edge += 'e';
        if (edge) return { child, childIdx: i, edge };
    }
    // Also detect parentBbox edges (the YOLO parent detection shown as white dashed)
    if (card.parentBbox) {
        const pc = _yoloToNatural(card.parentBbox, card, opgImg);
        const px1 = (pc.x1 - nb.x1) * rect.width / sw;
        const py1 = (pc.y1 - nb.y1) * rect.height / sh;
        const px2 = (pc.x2 - nb.x1) * rect.width / sw;
        const py2 = (pc.y2 - nb.y1) * rect.height / sh;
        const inPX = mx >= px1 - T && mx <= px2 + T;
        const inPY = my >= py1 - T && my <= py2 + T;
        if (inPX && inPY) {
            let edge = '';
            if (Math.abs(my - py1) < T) edge += 'n';
            else if (Math.abs(my - py2) < T) edge += 's';
            if (Math.abs(mx - px1) < T) edge += 'w';
            else if (Math.abs(mx - px2) < T) edge += 'e';
            if (edge) {
                // Return parentBbox as a pseudo-child for resize
                return { child: { cls: card.cls, conf: card.conf,
                    x1: card.parentBbox.x1, y1: card.parentBbox.y1,
                    x2: card.parentBbox.x2, y2: card.parentBbox.y2,
                    _isParentBbox: true }, childIdx: -1, edge, _isParentBbox: true };
            }
        }
    }
    return null;
}

/** Draw crop bbox outline on the OPG overlay (orange dashed = crop area). */
function _drawCropBboxOnOPG(fileId, fdi, card, caseEl) {
    // First draw normal highlight
    _highlightToothOnOPG(fileId, fdi, caseEl);

    // Then overlay crop bbox
    const m = _getOPGMapping(caseEl);
    if (!m || !card.bbox) return;
    const { ctx, w, h } = m;
    const b = card.bbox;
    const x1 = m.tx(b.x1), y1 = m.ty(b.y1);
    const x2 = m.tx(b.x2), y2 = m.ty(b.y2);

    ctx.save();
    ctx.setLineDash([6, 3]);
    ctx.strokeStyle = 'rgba(245,158,11,0.9)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(245,158,11,0.4)';
    ctx.shadowBlur = 8;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
    ctx.setLineDash([]);

    // Small label "crop"
    ctx.font = 'bold 9px system-ui';
    ctx.fillStyle = 'rgba(245,158,11,0.9)';
    ctx.fillText('crop', x1 + 4, y1 - 4 > 10 ? y1 - 4 : y1 + 12);
    // GT abbreviation near the crop bbox
    const _cropGtVal = (arenaGroundTruth[fileId] || {})[fdi];
    if (_cropGtVal) {
        const _cropGtL = parseToothLayers(_cropGtVal);
        const _cropGtA = layersAbbreviation(_cropGtL);
        if (_cropGtA) {
            ctx.font = 'bold 11px system-ui';
            ctx.fillStyle = 'rgba(96,165,250,0.95)';
            ctx.fillText(_cropGtA, x1 + 4, y1 - 16 > 10 ? y1 - 16 : y2 + 14);
        }
    }
    ctx.restore();

    // Also draw GT status badges
    _drawGTStatusOnOPG(fileId, caseEl);
}

/**
 * Draw GT status badges on the OPG overlay for all teeth with GT values.
 * Shows colored pills at each tooth's bbox position on the panorama.
 * Called after any GT change so the user sees immediate feedback.
 */
function _drawGTStatusOnOPG(fileId, caseElArg) {
    const caseEl = caseElArg || document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;
    const state = _carouselState[fileId];
    const gt = arenaGroundTruth[fileId];
    if (!state || !state.cards || !gt) return;

    // noResize=true to avoid clearing existing overlay (we draw ON TOP)
    const m = _getOPGMapping(caseEl, true);
    if (!m) return;
    const { ctx, w, h } = m;

    // Color map for GT statuses
    const GT_STATUS_COLORS = {
        'endo': '#a855f7', 'post': '#f59e0b', 'crowned': '#06b6d4',
        'restored': '#3b82f6', 'caries': '#ef4444', 'implant': '#22c55e',
        'impl_fixture': '#22c55e', 'impl_cover': '#22c55e', 'impl_healing': '#22c55e',
        'impl_abutment': '#22c55e', 'impl_restored': '#22c55e',
        'impl_temp_abut': '#22c55e', 'impl_provisional': '#22c55e',
        'missing': '#64748b', 'root': '#78716c',
    };
    const GT_STATUS_ABBR = {
        'endo': 'Э', 'post': 'Ш', 'crowned': 'К', 'restored': 'П',
        'caries': 'Кр', 'implant': 'И', 'impl_fixture': 'И',
        'impl_cover': 'ИЗ', 'impl_healing': 'ИФ', 'impl_restored': 'ИК',
        'impl_abutment': 'И', 'impl_temp_abut': 'И', 'impl_provisional': 'И',
        'missing': '✕', 'root': 'Кн',
    };

    const _activeFdi = (state || {}).activeFdi;

    ctx.save();
    for (const card of state.cards) {
        const val = gt[card.fdi];
        if (!val || !card.bbox) continue;

        const _rawL = parseToothLayers(val);
        // Collapse implant stages to highest only
        const _IR2 = {implant:0,impl_fixture:1,impl_cover:2,impl_healing:3,impl_abutment:4,impl_temp_abut:5,impl_provisional:6,impl_restored:7};
        const _implL = _rawL.filter(l => _IR2[l.status] !== undefined);
        let layers = _rawL;
        if (_implL.length > 1) {
            let _best = _implL[0]; for (const l of _implL) { if ((_IR2[l.status]||0) > (_IR2[_best.status]||0)) _best = l; }
            layers = _rawL.filter(l => _IR2[l.status] === undefined || l === _best);
        }
        if (layers.length === 0) continue;

        const isActive = card.fdi === _activeFdi;

        // Position: bottom-center of the tooth bbox on OPG
        const bx = (card.bbox.x1 + card.bbox.x2) / 2;
        const by = card.bbox.y2;
        const dx = m.tx(bx);
        const dy = m.ty(by) + 4;

        // Active tooth: larger pills + glow
        const pillW = isActive ? 14 : 11;
        const pillH = isActive ? 13 : 10;
        const pillGap = 1;
        const totalW = layers.length * (pillW + pillGap) - pillGap;
        let startX = dx - totalW / 2;

        if (isActive) {
            ctx.shadowColor = '#3b82f6';
            ctx.shadowBlur = 14;
        }

        for (const layer of layers) {
            const color = GT_STATUS_COLORS[layer.status] || '#94a3b8';
            const abbr = GT_STATUS_ABBR[layer.status] || layer.status[0].toUpperCase();

            ctx.fillStyle = isActive ? color : color + 'cc';
            _rrect(ctx, startX, dy, pillW, pillH, isActive ? 3 : 2);
            ctx.fill();

            ctx.font = `bold ${isActive ? 9 : 7}px system-ui`;
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(abbr, startX + pillW / 2, dy + pillH / 2);

            startX += pillW + pillGap;
        }

        if (isActive) {
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }
    }
    ctx.restore();
}

/**
 * Refresh the OPG overlay for the currently active crop card.
 * Re-draws the full highlight (highlight + crop bbox + GT status badges).
 * Called after GT formula changes so the panorama reflects the new state.
 */
function _refreshOPGForActiveCrop(fileId) {
    const state = _carouselState[fileId];
    if (!state) return;
    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;

    // Also refresh the text formula under OPG
    _renderTextFormula(fileId);

    const activeFdi = state.activeFdi;
    if (!activeFdi) {
        // No active crop — just draw GT badges on a clean canvas
        const m = _getOPGMapping(caseEl);
        if (m) _drawGTStatusOnOPG(fileId, caseEl);
        return;
    }

    const card = state.cards.find(c => c.fdi === activeFdi);
    const childMode = state.opgChildrenMode || 'off';
    if (childMode !== 'off') {
        _refreshOPGChildrenOverlay(fileId);
    } else if (card && card.bbox) {
        _drawCropBboxOnOPG(fileId, activeFdi, card, caseEl);
    } else {
        _highlightToothOnOPG(fileId, activeFdi, caseEl);
    }
    // Always draw GT status pills on OPG so expert corrections are immediately visible
    _drawGTStatusOnOPG(fileId, caseEl);
}

/**
 * Render text dental formula under OPG — Russian convention + human-readable legend.
 * Called after GT load, GT change, rollback.
 */
// Helper — pull a localised long-form status name ("эндо" / "endo",
// "имп+кор" / "imp+crown") from OrisI18n. Falls back to the legacy
// Russian table so callers without OrisI18n loaded still get strings.
const _LEGACY_LONG_NAMES = {
    endo:'эндо', post:'штифт', crowned:'коронка', restored:'пломба',
    caries:'кариес', present:'интакт', missing:'отс.', implant:'имплантат',
    impl_fixture:'имплантат', impl_restored:'имп+кор', impl_cover:'имп+заг',
    impl_healing:'имп+форм', impl_abutment:'имп+абат', impl_provisional:'имп+врем',
    impl_temp_abut:'имп+вр.абат', attrition:'стираем.', root:'корень',
    bridge:'мост', bar:'балка', impacted:'ретенц.', cantilever:'консоль',
};
function _statusLongName(s) {
    if (typeof OrisI18n !== 'undefined') {
        const v = OrisI18n.t('longName_' + s);
        if (v && v !== 'longName_' + s) return v;
    }
    return _LEGACY_LONG_NAMES[s] || s;
}

function _renderTextFormula(fileId) {
    const el = document.getElementById(`gt-text-formula-${fileId}`);
    if (!el) return;
    const gt = arenaGroundTruth[fileId] || {};

    const UPPER_R = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1'];
    const UPPER_L = ['2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
    const LOWER_R = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1'];
    const LOWER_L = ['3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];

    const _SC = {endo:'#a855f7', post:'#f59e0b', crowned:'#06b6d4', restored:'#3b82f6',
        caries:'#ef4444', present:'#475569', missing:'#64748b', implant:'#22c55e',
        impl_fixture:'#22c55e', impl_restored:'#06b6d4', impl_cover:'#84cc16',
        impl_healing:'#eab308', bridge:'#22d3ee', root:'#d946ef'};

    // Filter redundant layers: if impl_restored/impl_cover/etc present, drop standalone implant/impl_fixture
    function _dedupeImplLayers(layers) {
        // Implant stages are progressive — keep only the highest stage
        const IMPL_RANK = {implant:0, impl_fixture:1, impl_cover:2, impl_healing:3,
            impl_abutment:4, impl_temp_abut:5, impl_provisional:6, impl_restored:7};
        const implLayers = layers.filter(l => IMPL_RANK[l.status] !== undefined);
        if (implLayers.length <= 1) return layers;
        // Keep the highest-ranked implant layer, discard the rest
        let best = implLayers[0];
        for (const l of implLayers) { if ((IMPL_RANK[l.status]||0) > (IMPL_RANK[best.status]||0)) best = l; }
        return layers.filter(l => IMPL_RANK[l.status] === undefined || l === best);
    }

    function cellHtml(fdi) {
        const raw = gt[fdi];
        if (!raw) return '<td style="min-width:34px;text-align:center;color:#475569;padding:1px 2px">·</td>';
        const layers = _dedupeImplLayers(parseToothLayers(raw));
        // Per-layer 1-3 char code via the bilingual arenaStatusIcon
        // (RU: К/П/С/Э/Ш/И/ИК…  EN: C/F/Ca/E/P/I/IC…) — concat into a
        // composite (ИК / IC, ЭПК / EFC, ПШЭ / FPE, etc.).
        const abbr = layers.map(l => arenaStatusIcon(l.status) || l.status[0]?.toUpperCase() || '?').join('') || '·';
        const primary = layers.length > 0 ? layers[layers.length - 1].status : '';
        const color = _SC[primary] || '#94a3b8';
        const title = layers.map(l => _statusLongName(l.status)).join('+');
        return `<td style="min-width:34px;text-align:center;color:${color};font-weight:600;padding:1px 2px" title="${fdi}: ${title}">${abbr}</td>`;
    }

    function numHtml(fdi) {
        return `<td style="min-width:34px;text-align:center;color:#64748b;padding:1px 2px;font-size:10px">${fdi.split('.')[1]}</td>`;
    }

    const sepTd = '<td style="padding:0 3px;color:#475569;font-weight:bold">│</td>';
    const sepLine = `<tr><td colspan="8" style="border-bottom:1.5px solid #334155"></td>${sepTd}<td colspan="8" style="border-bottom:1.5px solid #334155"></td></tr>`;

    const html = `<table style="border-collapse:collapse;font-family:'SF Mono',Monaco,Consolas,monospace;font-size:11px;line-height:1.4">
        <tr>${UPPER_R.map(cellHtml).join('')}${sepTd}${UPPER_L.map(cellHtml).join('')}</tr>
        <tr>${UPPER_R.map(numHtml).join('')}${sepTd}${UPPER_L.map(numHtml).join('')}</tr>
        ${sepLine}
        <tr>${LOWER_R.map(numHtml).join('')}${sepTd}${LOWER_L.map(numHtml).join('')}</tr>
        <tr>${LOWER_R.map(cellHtml).join('')}${sepTd}${LOWER_L.map(cellHtml).join('')}</tr>
    </table>`;

    el.innerHTML = html;

    // Legend: non-empty teeth
    const allFdi = [...UPPER_R, ...UPPER_L, ...LOWER_R, ...LOWER_L];
    const legendParts = allFdi.filter(fdi => gt[fdi]).map(fdi => {
        const layers = _dedupeImplLayers(parseToothLayers(gt[fdi]));
        const long = layers.map(l => _statusLongName(l.status)).join('+');
        return `<span style="white-space:nowrap">${fdi}: ${long}</span>`;
    });
    let legendEl = el.nextElementSibling;
    if (!legendEl || !legendEl.classList.contains('gt-text-legend')) {
        legendEl = document.createElement('div');
        legendEl.className = 'gt-text-legend';
        legendEl.style.cssText = 'font-size:10px;color:#64748b;padding:4px 10px 0;line-height:1.6;';
        el.after(legendEl);
    }
    legendEl.innerHTML = legendParts.length > 0 ? legendParts.join(' <span style="color:#334155">│</span> ') : '';
}

// Re-render every visible text-formula (and its bottom legend strip)
// when the language flips so abbreviations + long-form names follow.
if (typeof OrisI18n !== 'undefined' && typeof OrisI18n.onLangChange === 'function') {
    OrisI18n.onLangChange(() => {
        document.querySelectorAll('[id^="gt-text-formula-"]').forEach(el => {
            const m = el.id.match(/^gt-text-formula-(\d+)$/);
            if (m) _renderTextFormula(parseInt(m[1], 10));
        });
    });
}

/** Redraw the expanded crop card after resize. */
function _redrawExpandedCard(rs) {
    const { canvas, card, fileId } = rs;
    const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
    if (!opgImg) return;
    const isFs = (canvas.id === 'crop-fs-canvas');
    canvas.width = isFs ? 900 : 400;
    _drawCropExpanded(canvas, opgImg, card);
    if (isFs) {
        const z = _cropFsState.zoom || 1;
        canvas.style.width = Math.round(canvas.width * z) + 'px';
        canvas.style.height = Math.round(canvas.height * z) + 'px';
    } else {
        canvas.style.width = '220px';
        canvas.style.height = Math.round(220 * canvas.height / canvas.width) + 'px';
    }
    if (isFs) _cropFsUpdateSidebar();
}

// Global drag handlers for crop resize
document.addEventListener('mousemove', (e) => {
    if (!_cropResizeState) return;
    const rs = _cropResizeState;

    const dx = e.clientX - rs.startX;
    const dy = e.clientY - rs.startY;

    // Convert display pixel delta → image coordinate delta
    const rect = rs.canvas.getBoundingClientRect();
    const bboxW = rs.startBbox.x2 - rs.startBbox.x1;
    const bboxH = rs.startBbox.y2 - rs.startBbox.y1;
    const scaleX = bboxW / rect.width;
    const scaleY = bboxH / rect.height;

    const opgImg = document.getElementById(`arena-opg-img-${rs.fileId}`);
    const maxW = opgImg ? opgImg.naturalWidth : 3000;
    const maxH = opgImg ? opgImg.naturalHeight : 1500;

    // Update bbox edges
    const b = rs.card.bbox;
    if (rs.edge.includes('n')) b.y1 = Math.max(0, rs.startBbox.y1 + dy * scaleY);
    if (rs.edge.includes('s')) b.y2 = Math.min(maxH, rs.startBbox.y2 + dy * scaleY);
    if (rs.edge.includes('w')) b.x1 = Math.max(0, rs.startBbox.x1 + dx * scaleX);
    if (rs.edge.includes('e')) b.x2 = Math.min(maxW, rs.startBbox.x2 + dx * scaleX);

    // Enforce minimum crop size (40px in image space)
    if (b.x2 - b.x1 < 40) { if (rs.edge.includes('w')) b.x1 = b.x2 - 40; else b.x2 = b.x1 + 40; }
    if (b.y2 - b.y1 < 40) { if (rs.edge.includes('n')) b.y1 = b.y2 - 40; else b.y2 = b.y1 + 40; }

    // Redraw crop canvas
    _redrawExpandedCard(rs);

    // Redraw OPG overlay with crop bbox
    const caseEl = document.getElementById(`arena-case-${rs.fileId}`);
    if (caseEl) _drawCropBboxOnOPG(rs.fileId, rs.fdi, rs.card, caseEl);

    e.preventDefault();
});

document.addEventListener('mouseup', (e) => {
    if (!_cropResizeState) return;
    const rs = _cropResizeState;

    rs.canvas.classList.remove('resizing');
    rs.card._modified = true;

    // Add "modified" badge
    let badge = rs.cardEl.querySelector('.cc-modified-badge');
    if (!badge) {
        badge = document.createElement('div');
        badge.className = 'cc-modified-badge';
        badge.textContent = '✎';
        badge.title = 'Кроп изменён — bbox скорректирован';
        rs.cardEl.appendChild(badge);
    }

    // ── Persist crop resize to GT as _crop_overrides ──
    const b = rs.card.bbox;
    if (!arenaCropOverrides) window.arenaCropOverrides = {};
    if (!arenaCropOverrides[rs.fileId]) arenaCropOverrides[rs.fileId] = {};
    const prevOv = arenaCropOverrides[rs.fileId][rs.fdi] || {};
    arenaCropOverrides[rs.fileId][rs.fdi] = {
        ...prevOv,  // keep existing filter settings
        x1: Math.round(b.x1), y1: Math.round(b.y1),
        x2: Math.round(b.x2), y2: Math.round(b.y2)
    };
    // Save via GT save mechanism (includes crop overrides)
    _debouncedSaveGT(rs.fileId, rs.fdi,
        JSON.stringify(rs.startBbox), JSON.stringify(arenaCropOverrides[rs.fileId][rs.fdi]),
        'crop_resize');
    // Also auto-save crop overrides directly (independent safety net)
    _autosaveCropOverrides(rs.fileId);

    _cropResizeState = null;
});

// ── Global drag handlers for CHILD BBOX resize ──
document.addEventListener('mousemove', (e) => {
    if (!_childResizeState) return;
    const rs = _childResizeState;
    const dx = e.clientX - rs.startX;
    const dy = e.clientY - rs.startY;

    const rect = rs.canvas.getBoundingClientRect();
    const nb = _yoloToNatural(rs.card.bbox, rs.card, document.getElementById(`arena-opg-img-${rs.fileId}`));
    const sw = nb.x2 - nb.x1, sh = nb.y2 - nb.y1;
    const scaleX = sw / rect.width;
    const scaleY = sh / rect.height;

    const ch = rs.child;
    if (rs.edge.includes('n')) ch.y1 = rs.startBbox.y1 + dy * scaleY;
    if (rs.edge.includes('s')) ch.y2 = rs.startBbox.y2 + dy * scaleY;
    if (rs.edge.includes('w')) ch.x1 = rs.startBbox.x1 + dx * scaleX;
    if (rs.edge.includes('e')) ch.x2 = rs.startBbox.x2 + dx * scaleX;
    // Enforce minimum 10px
    if (ch.x2 - ch.x1 < 10) { if (rs.edge.includes('w')) ch.x1 = ch.x2 - 10; else ch.x2 = ch.x1 + 10; }
    if (ch.y2 - ch.y1 < 10) { if (rs.edge.includes('n')) ch.y1 = ch.y2 - 10; else ch.y2 = ch.y1 + 10; }

    // Scale polygon proportionally with bbox change
    if (ch.polygon_pct && rs._origPoly) {
        const ob = rs.startBbox;
        const opgImg = document.getElementById(`arena-opg-img-${rs.fileId}`);
        const pnW = opgImg?.naturalWidth || 2048, pnH = opgImg?.naturalHeight || 1024;
        const obW = ob.x2 - ob.x1, obH = ob.y2 - ob.y1;
        if (obW > 0 && obH > 0) {
            ch.polygon_pct = rs._origPoly.map(pt => {
                const px = pt[0] / 100 * pnW, py = pt[1] / 100 * pnH;
                const rx = (px - ob.x1) / obW, ry = (py - ob.y1) / obH;
                return [
                    Math.round((ch.x1 + rx * (ch.x2 - ch.x1)) / pnW * 10000) / 100,
                    Math.round((ch.y1 + ry * (ch.y2 - ch.y1)) / pnH * 10000) / 100
                ];
            });
        }
    }

    _redrawExpandedCard(rs);
    e.preventDefault();
});

document.addEventListener('mouseup', (e) => {
    if (!_childResizeState) return;
    const rs = _childResizeState;
    const ch = rs.child;
    const opgImg = document.getElementById(`arena-opg-img-${rs.fileId}`);
    const nW = opgImg ? opgImg.naturalWidth : 2048, nH = opgImg ? opgImg.naturalHeight : 1024;
    const bbox_pct = { x1: ch.x1 / nW, y1: ch.y1 / nH, x2: ch.x2 / nW, y2: ch.y2 / nH };
    const polygon_pct_save = ch.polygon_pct || null;

    if (ch._manual && ch._annot_id) {
        // Update existing manual annotation
        fetch(`/api/panorama/${rs.fileId}/reference-annotations/${ch._annot_id}`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ bbox_pct, polygon_pct: polygon_pct_save })
        }).catch(err => console.warn('Child bbox update failed:', err));
    } else {
        // YOLO detection — create override annotation
        fetch(`/api/panorama/${rs.fileId}/reference-annotations`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                fdi: rs.fdi, annotation_type: 'child_bbox', label: ch.cls,
                bbox_pct, polygon_pct: polygon_pct_save,
                details: { source: 'bbox_override', original_conf: ch.conf },
                source: 'bbox_override'
            })
        }).then(r => r.json()).then(d => {
            ch._manual = true;
            ch._annot_id = d.id || null;
        }).catch(err => console.warn('Child bbox override save failed:', err));
    }

    // Log to expert_actions
    const oldStr = `${ch.cls}: ${JSON.stringify(rs.startBbox)}`;
    const newStr = `${ch.cls}: ${JSON.stringify({x1:Math.round(ch.x1),y1:Math.round(ch.y1),x2:Math.round(ch.x2),y2:Math.round(ch.y2)})}`;
    _debouncedSaveGT(rs.fileId, rs.fdi, oldStr, newStr, 'bbox_resize');

    // Keep the child selected (handles visible) after resize
    _activeEditChild = { childIdx: rs.childIdx, fileId: rs.fileId, fdi: rs.fdi };
    // Redraw to show handles at new position
    _redrawExpandedCard(rs);
    // Invalidate expert cache
    delete _expertAnnotCache[rs.fileId];

    _childResizeState = null;
});

/** Map quick-status → ANNOT_CLASS for auto-draw after status set. */
const QUICK_TO_ANNOT = {
    'endo': 'Root canal obturation',
    'crowned': 'Crown',
    'restored': 'Filling',
    'implant': 'Implant',
    'caries': 'Caries',
};

/**
 * Quick-set tooth status from crop toolbar (Endo, Post, etc.)
 * Adds as a layer to existing GT formula.
 * If adding (not removing), auto-enters draw mode for corresponding bbox class.
 */
function _quickSetToothStatus(fileId, fdi, status, btn) {
    if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
    const current = arenaGroundTruth[fileId][fdi] || '';
    const layers = current ? parseToothLayers(current) : [];

    // Toggle: if already has this status, remove it
    const idx = layers.findIndex(l => l.status === status);
    let newVal;
    let wasAdded = false;
    if (idx >= 0) {
        layers.splice(idx, 1);
        newVal = layers.length > 0 ? encodeToothLayers(layers) : '';
        btn.classList.remove('active');
    } else {
        layers.push({ status: status, surfaces: '' });
        newVal = encodeToothLayers(layers);
        btn.classList.add('active');
        wasAdded = true;
    }

    arenaGroundTruth[fileId][fdi] = newVal;
    _debouncedSaveGT(fileId, fdi, current, newVal, 'crop_quick_status');

    // Update the formula cell visually
    const cell = document.querySelector(`.arena-formula-row.ground-truth[data-file="${fileId}"] .arena-cell[data-fdi="${fdi}"]`);
    if (cell) _updateArenaCellVisual(cell, fdi, newVal, fileId);

    // Update OPG overlay to reflect GT change
    _refreshOPGForActiveCrop(fileId);

    // Refresh objects panel to reflect new GT layers
    if (typeof _refreshCropObjPanel === 'function') _refreshCropObjPanel(fileId, fdi);

    // Redraw active crop canvas to reflect GT badge change
    const _qState = _carouselState[fileId];
    if (_qState && _qState.activeFdi === fdi) {
        const _qCardEl = document.querySelector(`.carousel-card.active[data-file="${fileId}"][data-fdi="${fdi}"]`);
        if (_qCardEl) {
            const _qCvs = _qCardEl.querySelector('.cc-canvas');
            const _qCard = _qState.cards.find(c => c.fdi === fdi);
            const _qOpg = document.getElementById(`arena-opg-img-${fileId}`);
            if (_qCvs && _qCard && _qOpg) {
                _qCvs.width = 400;
                _drawCropExpanded(_qCvs, _qOpg, _qCard);
                _qCvs.style.width = '220px';
                _qCvs.style.height = Math.round(220 * _qCvs.height / _qCvs.width) + 'px';
            }
            // Update cls label
            const _qCls = _qCardEl.querySelector('.cc-cls');
            if (_qCls) {
                const _QGL = {endo:'эндо',post:'штифт',crowned:'коронка',restored:'пломба',caries:'кариес',present:'интакт',missing:'отс.',implant:'имплантат',impl_fixture:'имплантат',impl_restored:'имп+кор',impl_cover:'имп+заг',impl_healing:'имп+форм',attrition:'стираем.',root:'корень',bridge:'мост'};
                const _qLayers = parseToothLayers(newVal);
                _qCls.textContent = _qLayers.map(l => _QGL[l.status] || l.status).join('+');
                _qCls.style.color = '#60a5fa';
            }
        }
    }

    // Update status bar
    const cardEl = btn.closest('.carousel-card');
    const sb = cardEl?.querySelector('.cc-status-bar');

    // If status was ADDED and there's a corresponding draw class → auto-enter draw mode
    const drawCls = wasAdded ? QUICK_TO_ANNOT[status] : null;
    if (drawCls && cardEl) {
        if (sb) {
            sb.textContent = `✓ ${status} добавлен — нарисуйте ${(function(_a){return _a ? ((_isEN_crop()&&_a.abbrEN)?_a.abbrEN:_a.abbr) : drawCls;})(ANNOT_CLASSES.find(a=>a.cls===drawCls))} | Esc — пропустить`;
            sb.classList.add('success');
            setTimeout(() => sb.classList.remove('success'), 1500);
        }
        _enterCropDrawMode(fileId, fdi, drawCls, cardEl);
    } else if (sb) {
        sb.textContent = `✓ ${status} ${idx >= 0 ? 'убран' : 'добавлен'}`;
        sb.classList.add('success');
        setTimeout(() => { sb.classList.remove('success'); sb.textContent = ''; }, 2000);
    }
}

/** Save crop filter (brightness/contrast) into crop_overrides and trigger GT save. */
function _saveCropFilter(fileId, fdi) {
    if (!window.arenaCropOverrides) window.arenaCropOverrides = {};
    if (!arenaCropOverrides[fileId]) arenaCropOverrides[fileId] = {};
    if (!arenaCropOverrides[fileId][fdi]) arenaCropOverrides[fileId][fdi] = {};
    const fs = ((_cropFilterState[fileId] || {})[fdi]) || {};
    // Merge filter into existing override (keeps bbox if already resized)
    if (fs.brightness && fs.brightness !== 1.0) arenaCropOverrides[fileId][fdi].brightness = fs.brightness;
    else delete arenaCropOverrides[fileId][fdi].brightness;
    if (fs.contrast && fs.contrast !== 1.0) arenaCropOverrides[fileId][fdi].contrast = fs.contrast;
    else delete arenaCropOverrides[fileId][fdi].contrast;
    // Clean up empty entries
    if (Object.keys(arenaCropOverrides[fileId][fdi]).length === 0) {
        delete arenaCropOverrides[fileId][fdi];
    }
    _debouncedSaveGT(fileId, fdi, null, JSON.stringify(fs), 'crop_filter');
    // Also auto-save crop overrides directly (independent of GT debounce)
    _autosaveCropOverrides(fileId);
}

/**
 * Auto-save crop overrides directly to DB via dedicated endpoint.
 * Independent of GT formula save — ensures crop edits (resize, brightness, contrast) never lost.
 */
let _cropAutoSaveTimers = {};
function _autosaveCropOverrides(fileId) {
    // Debounce: 500ms after last crop change
    if (_cropAutoSaveTimers[fileId]) clearTimeout(_cropAutoSaveTimers[fileId]);
    _cropAutoSaveTimers[fileId] = setTimeout(() => {
        const co = (window.arenaCropOverrides || {})[fileId];
        if (!co || Object.keys(co).length === 0) return;
        fetch(`/api/darwin/crop-overrides/${fileId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ crop_overrides: co, session_id: _gtSessionId })
        }).then(r => {
            if (!r.ok) console.warn(`Crop override auto-save failed for file ${fileId}`);
        }).catch(e => console.warn('Crop override auto-save error:', e));
    }, 500);
}


// ══════════════════════════════════════════════════════════════════════════
// ██  CROP ANNOTATION — interactive nested object editing in crop cards
// ══════════════════════════════════════════════════════════════════════════

/** Annotation class definitions (toolbar buttons). */
const ANNOT_CLASSES = [
    {cls:'Crown', abbr:'Кор', abbrEN:'Cr', color:'#06b6d4'},
    {cls:'Crown framework', abbr:'Крк', abbrEN:'CrFr', color:'#0e7490'},
    {cls:'Crown veneer', abbr:'Обл', abbrEN:'Vnr', color:'#7dd3fc'},
    {cls:'Filling', abbr:'Пл', abbrEN:'Fi', color:'#3b82f6'},
    {cls:'Caries', abbr:'Кар', abbrEN:'Ca', color:'#ef4444'},
    {cls:'Root canal obturation', abbr:'Обт', abbrEN:'Obt', color:'#a855f7'},
    {cls:'Periapical lesion', abbr:'Пер', abbrEN:'PA', color:'#f59e0b'},
    {cls:'Implant', abbr:'Имп', abbrEN:'Im', color:'#22c55e'},
    {cls:'Cover screw', abbr:'Заг', abbrEN:'CS', color:'#84cc16'},
    {cls:'Abutment', abbr:'Аб', abbrEN:'Ab', color:'#f97316'},
    {cls:'Fixation screw', abbr:'ФВ', abbrEN:'AS', color:'#eab308'}
];

/** Map child class → formula layer status. */
const CHILD_TO_FORMULA = {
    'Crown':'crowned', 'Crown framework':'crowned', 'Crown veneer':'crowned',
    'Filling':'restored', 'Caries':'caries',
    'Root canal obturation':'endo', 'Implant':'implant',
    'Periapical lesion': null, 'Cover screw':'impl_cover',
    'Abutment':'impl_healing', 'Fixation screw':'impl_cover'
};

/**
 * Check if expert GT reclassified a YOLO detection.
 * Returns corrected Russian label if GT overrides the YOLO class, or null if unchanged.
 * E.g., YOLO says "Implant" but GT has "post" → returns "Штифт".
 */
function _getGTCorrectedLabel(fileId, fdi, yoloCls) {
    const gt = (arenaGroundTruth[fileId] || {})[fdi];
    if (!gt) return null;
    const layers = parseToothLayers(gt);
    const statuses = new Set(layers.map(l => l.status));
    const expected = CHILD_TO_FORMULA[yoloCls];
    if (!expected) return null;
    // If GT contains the expected status, YOLO agrees with expert — no correction
    if (statuses.has(expected)) return null;
    // GT doesn't have expected — check for reclassification
    const RECLASS = {
        'Implant': {'post':'Штифт','endo':'Обтурация'},
        'Crown': {'restored':'Пломба'},
        'Filling': {'caries':'Кариес'},
        'Root Piece': {'missing':'Отсутствует'},
    };
    const reclass = RECLASS[yoloCls];
    if (!reclass) return null;
    for (const [status, label] of Object.entries(reclass)) {
        if (statuses.has(status)) return label;
    }
    return null;
};

/** Global annotation state. */
let _cropAnnotState = {
    mode: 'view',        // 'view' | 'draw' | 'draw_polygon'
    activeClass: null,    // 'Crown', 'Filling', etc.
    fileId: null, fdi: null,
    card: null, canvas: null, cardEl: null,
    drawStart: null, drawCurrent: null,
    polygonPoints: []     // for draw_polygon mode: [{imgX, imgY, cx, cy}, ...]
};

/** Convert mouse event on canvas → OPG natural coords + canvas internal coords. */
function _canvasEventToImgCoords(canvas, card, opgImg, e) {
    if (!card || !card.bbox || !opgImg) return null;
    const rect = canvas.getBoundingClientRect();
    const displayX = e.clientX - rect.left;
    const displayY = e.clientY - rect.top;
    // canvas internal coords
    const cx = displayX * (canvas.width / rect.width);
    const cy = displayY * (canvas.height / rect.height);
    // → OPG natural coords (use viewBbox when in child focus)
    let srcBbox = card.bbox;
    if (_cropFsState && _cropFsState.open && _cropFsState.viewBbox
        && _cropFsState.card === card) {
        srcBbox = _cropFsState.viewBbox;
    }
    const nb = _yoloToNatural(srcBbox, card, opgImg);
    const sw = nb.x2 - nb.x1, sh = nb.y2 - nb.y1;
    const scX = canvas.width / sw, scY = canvas.height / sh;
    const imgX = nb.x1 + cx / scX;
    const imgY = nb.y1 + cy / scY;
    return { cx, cy, displayX, displayY, imgX, imgY };
}

/** Setup annotation interaction on an active crop card canvas. */
function _setupCropAnnotation(cardEl, fileId, fdi) {
    const canvas = cardEl.querySelector('.cc-canvas');
    if (!canvas || canvas._annotSetup) return;
    canvas._annotSetup = true;
    const state = _carouselState[fileId];
    if (!state) return;
    const card = state.cards.find(c => c.fdi === fdi);

    // ── Click handler (respects priority: resize edge > draw > hit-test) ──
    canvas.addEventListener('mousedown', (e) => {
        if (!cardEl.classList.contains('active')) return;
        if (_cropResizeState) return; // resize in progress

        const opgImg = document.getElementById(`arena-opg-img-${fileId}`);

        // ── Priority: child bbox edge FIRST, then crop edge ──
        // Child edges take priority because they're inside the crop and often
        // overlap with crop edges (e.g., Crown bbox near canvas boundary).
        if (!_childResizeState && _cropAnnotState.mode !== 'draw' && _cropAnnotState.mode !== 'draw_polygon') {
            const chEdge = _getChildBboxEdge(canvas, card, opgImg, e);
            if (chEdge) {
                if (chEdge._isParentBbox) {
                    // ParentBbox edge grabbed — reuse or create child copy, then start resize
                    let pbChild, pbIdx;
                    const existingPb = card.children.findIndex(c => c._isParentBbox);
                    if (existingPb >= 0) {
                        pbChild = card.children[existingPb]; pbIdx = existingPb;
                    } else {
                        pbChild = {
                            cls: card.cls, conf: card.conf,
                            x1: card.parentBbox.x1, y1: card.parentBbox.y1,
                            x2: card.parentBbox.x2, y2: card.parentBbox.y2,
                            polygon_pct: null, _isParentBbox: true
                        };
                        card.children.push(pbChild);
                        pbIdx = card.children.length - 1;
                        // Save override to DB in background
                        const nW = opgImg ? opgImg.naturalWidth : 2048, nH = opgImg ? opgImg.naturalHeight : 1024;
                        const bbox_pct = { x1: pbChild.x1/nW, y1: pbChild.y1/nH, x2: pbChild.x2/nW, y2: pbChild.y2/nH };
                        fetch(`/api/panorama/${fileId}/reference-annotations`, {
                            method: 'POST', headers: {'Content-Type':'application/json'},
                            body: JSON.stringify({ fdi, annotation_type:'child_bbox', label:pbChild.cls,
                                bbox_pct, details:{source:'bbox_override',original_conf:pbChild.conf}, source:'bbox_override' })
                        }).then(r=>r.json()).then(d=>{
                            pbChild._manual = true; pbChild._annot_id = d.id||null;
                            _debouncedSaveGT(fileId, fdi, '', `${pbChild.cls} bbox_override`, 'bbox_override');
                            delete _expertAnnotCache[fileId];
                        }).catch(err=>console.warn('ParentBbox override save failed:', err));
                    }
                    _activeEditChild = { childIdx: pbIdx, fileId, fdi };
                    _childResizeState = {
                        child: pbChild, childIdx: pbIdx, edge: chEdge.edge,
                        startX: e.clientX, startY: e.clientY,
                        startBbox: { x1: pbChild.x1, y1: pbChild.y1, x2: pbChild.x2, y2: pbChild.y2 },
                        _origPoly: pbChild.polygon_pct ? pbChild.polygon_pct.map(p => [...p]) : null,
                        card, canvas, cardEl, fileId, fdi
                    };
                } else {
                    _childResizeState = {
                        child: chEdge.child, childIdx: chEdge.childIdx, edge: chEdge.edge,
                        startX: e.clientX, startY: e.clientY,
                        startBbox: { x1: chEdge.child.x1, y1: chEdge.child.y1, x2: chEdge.child.x2, y2: chEdge.child.y2 },
                        _origPoly: chEdge.child.polygon_pct ? chEdge.child.polygon_pct.map(p => [...p]) : null,
                        card, canvas, cardEl, fileId, fdi
                    };
                }
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }

        // If near crop edge (and no child edge matched) — parent resize
        const edge = _getCropEdge(canvas, e);
        if (edge) return;

        const coords = _canvasEventToImgCoords(canvas, card, opgImg, e);
        if (!coords) return;

        if (_cropAnnotState.mode === 'draw') {
            // In draw mode: ALWAYS start drawing (even inside existing bboxes)
            // This allows drawing sub-objects like cover screws inside implant bboxes
            _cropAnnotState.drawStart = coords;
            _cropAnnotState.drawCurrent = coords;
            _cropAnnotState.canvas = canvas;
            _cropAnnotState.card = card;
            _cropAnnotState.cardEl = cardEl;
            e.preventDefault();
            e.stopPropagation();
        } else if (_cropAnnotState.mode === 'draw_polygon') {
            // Polygon draw mode: add point on click
            _cropAnnotState.polygonPoints.push(coords);
            // Preview: redraw crop + polygon so far
            const _pgOpg = document.getElementById(`arena-opg-img-${fileId}`);
            if (canvas && _pgOpg) {
                canvas.width = 400;
                _drawCropExpanded(canvas, _pgOpg, card);
                // Draw polygon preview
                const _pgCtx = canvas.getContext('2d');
                const _pgNb = _yoloToNatural(card.bbox, card, _pgOpg);
                const _pgSw = _pgNb.x2 - _pgNb.x1, _pgSh = _pgNb.y2 - _pgNb.y1;
                const _pgScX = canvas.width / _pgSw, _pgScY = canvas.height / _pgSh;
                _pgCtx.beginPath();
                _cropAnnotState.polygonPoints.forEach((p, i) => {
                    const px = (p.imgX - _pgNb.x1) * _pgScX, py = (p.imgY - _pgNb.y1) * _pgScY;
                    i === 0 ? _pgCtx.moveTo(px, py) : _pgCtx.lineTo(px, py);
                });
                _pgCtx.strokeStyle = '#d946ef';
                _pgCtx.lineWidth = 2;
                _pgCtx.stroke();
                // Draw points
                _cropAnnotState.polygonPoints.forEach(p => {
                    const px = (p.imgX - _pgNb.x1) * _pgScX, py = (p.imgY - _pgNb.y1) * _pgScY;
                    _pgCtx.beginPath();
                    _pgCtx.arc(px, py, 3, 0, Math.PI * 2);
                    _pgCtx.fillStyle = '#d946ef';
                    _pgCtx.fill();
                });
                canvas.style.width = '220px';
                canvas.style.height = Math.round(220 * canvas.height / canvas.width) + 'px';
            }
            const sb = cardEl.querySelector('.cc-status-bar');
            if (sb) sb.textContent = `Контур: ${_cropAnnotState.polygonPoints.length} точек | Двойной клик — замкнуть | Esc — отмена`;
            e.stopPropagation();
        } else {
            // Hit-test children — click activates for editing (resize handles) + reclassify popup
            const hit = _hitTestChildBbox(card, coords.imgX, coords.imgY);
            if (hit) {
                _activateChildForEdit(hit, card, canvas, cardEl, fileId, fdi);
                _showChildInfoPopup(hit, coords.displayX, coords.displayY, cardEl, fileId, fdi);
                e.stopPropagation();
            } else if (_activeEditChild) {
                // Clicked outside any bbox — deselect active edit child
                _activeEditChild = null;
                const _deOPG = document.getElementById(`arena-opg-img-${fileId}`);
                if (canvas && _deOPG) {
                    canvas.width = 400;
                    _drawCropExpanded(canvas, _deOPG, card);
                    canvas.style.width = '220px';
                    canvas.style.height = Math.round(220 * canvas.height / canvas.width) + 'px';
                }
                const sb = cardEl.querySelector('.cc-status-bar');
                if (sb) sb.textContent = '';
            }
        }
    });

    // ── Mousemove for draw preview + hover cursor ──
    canvas.addEventListener('mousemove', (e) => {
        if (!cardEl.classList.contains('active')) return;
        if (_cropResizeState) return;

        if (_cropAnnotState.mode === 'draw' && _cropAnnotState.drawStart) {
            const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
            const coords = _canvasEventToImgCoords(canvas, card, opgImg, e);
            if (coords) {
                _cropAnnotState.drawCurrent = coords;
                _drawAnnotPreview(canvas, card, opgImg);
            }
            e.preventDefault();
        } else if (_cropAnnotState.mode === 'view') {
            const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
            // Child edge cursor takes priority over crop edge
            const chEdge = _getChildBboxEdge(canvas, card, opgImg, e);
            if (chEdge) {
                canvas.style.cursor = _edgeCursor(chEdge.edge);
            } else if (_getCropEdge(canvas, e)) {
                canvas.style.cursor = _edgeCursor(_getCropEdge(canvas, e));
            } else {
                // Check if hovering over a child bbox → pointer cursor
                const coords = _canvasEventToImgCoords(canvas, card, opgImg, e);
                if (coords && _hitTestChildBbox(card, coords.imgX, coords.imgY)) {
                    canvas.style.cursor = 'pointer';
                } else {
                    canvas.style.cursor = 'default';
                }
            }
        }
    });

    // ── Mouseup for draw finish ──
    canvas.addEventListener('mouseup', (e) => {
        if (_cropAnnotState.mode !== 'draw' || !_cropAnnotState.drawStart) return;

        const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
        const endCoords = _canvasEventToImgCoords(canvas, card, opgImg, e);
        if (!endCoords) { _cropAnnotState.drawStart = null; return; }

        const start = _cropAnnotState.drawStart;
        const minSize = 8; // minimum bbox size in natural image pixels
        const bboxW = Math.abs(endCoords.imgX - start.imgX);
        const bboxH = Math.abs(endCoords.imgY - start.imgY);

        if (bboxW < minSize || bboxH < minSize) {
            // Too small — cancel
            _cropAnnotState.drawStart = null;
            _cropAnnotState.drawCurrent = null;
            _drawCropExpanded(canvas, opgImg, card);
            canvas.style.width = '220px'; canvas.style.height = Math.round(220 * canvas.height / canvas.width) + 'px';
            return;
        }

        // Compute bbox in natural OPG coords
        const x1 = Math.min(start.imgX, endCoords.imgX);
        const y1 = Math.min(start.imgY, endCoords.imgY);
        const x2 = Math.max(start.imgX, endCoords.imgX);
        const y2 = Math.max(start.imgY, endCoords.imgY);

        // Convert to percentage coords for API
        const nW = opgImg.naturalWidth || 2048, nH = opgImg.naturalHeight || 1024;
        const bbox_pct = {
            x1: x1 / nW, y1: y1 / nH,
            x2: x2 / nW, y2: y2 / nH
        };

        _saveChildAnnotation(fileId, fdi, _cropAnnotState.activeClass, bbox_pct, {x1, y1, x2, y2}, card, canvas, cardEl);

        _cropAnnotState.drawStart = null;
        _cropAnnotState.drawCurrent = null;

        // Auto-exit draw mode after successful bbox save
        _exitCropDrawMode();
    });

    // ── Double-click to finish polygon contour ──
    canvas.addEventListener('dblclick', (e) => {
        if (_cropAnnotState.mode === 'draw_polygon' && _cropAnnotState.polygonPoints.length >= 3) {
            e.preventDefault();
            e.stopPropagation();
            _finishPolygonDraw();
        }
    });
}

/** Enter draw mode for a specific class. */
function _enterCropDrawMode(fileId, fdi, cls, cardEl) {
    _exitCropDrawMode(); // exit previous if any

    const state = _carouselState[fileId];
    if (!state) return;
    const card = state.cards.find(c => c.fdi === fdi);
    const canvas = cardEl.querySelector('.cc-canvas');

    _cropAnnotState.mode = 'draw';
    _cropAnnotState.activeClass = cls;
    _cropAnnotState.fileId = fileId;
    _cropAnnotState.fdi = fdi;
    _cropAnnotState.card = card;
    _cropAnnotState.canvas = canvas;
    _cropAnnotState.cardEl = cardEl;
    _cropAnnotState.drawStart = null;
    _cropAnnotState.drawCurrent = null;

    // Visual: crosshair + highlight button
    if (canvas) canvas.classList.add('draw-mode');
    cardEl.querySelectorAll('.cc-annot-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.cls === cls);
    });

    // Update status bar
    const sb = cardEl.querySelector('.cc-status-bar');
    const _aClass = ANNOT_CLASSES.find(a => a.cls === cls); const abbr = _aClass ? ((_isEN_crop()&&_aClass.abbrEN)?_aClass.abbrEN:_aClass.abbr) : cls;
    if (sb) sb.textContent = `Рисование ${abbr} — нарисуйте прямоугольник | Esc — отмена`;
}

/** Exit draw mode. */
function _exitCropDrawMode() {
    if (_cropAnnotState.mode === 'view') return;

    const { canvas, cardEl } = _cropAnnotState;
    if (canvas) canvas.classList.remove('draw-mode');
    if (cardEl) {
        cardEl.querySelectorAll('.cc-annot-btn').forEach(b => b.classList.remove('active'));
        const sb = cardEl.querySelector('.cc-status-bar');
        if (sb) sb.textContent = 'Кликните на объект | Кнопки ниже для аннотации';
    }

    // Redraw to remove preview
    if (canvas && _cropAnnotState.card) {
        const opgImg = document.getElementById(`arena-opg-img-${_cropAnnotState.fileId}`);
        if (opgImg) {
            canvas.width = 400;
            _drawCropExpanded(canvas, opgImg, _cropAnnotState.card);
            canvas.style.width = '220px'; canvas.style.height = Math.round(220 * canvas.height / canvas.width) + 'px';
        }
    }

    _cropAnnotState.mode = 'view';
    _cropAnnotState.activeClass = null;
    _cropAnnotState.drawStart = null;
    _cropAnnotState.drawCurrent = null;
    _cropAnnotState.polygonPoints = [];
}

/** Enter contour draw mode — user clicks points to form a polygon. */
function _enterContourDrawMode(fileId, fdi, cls, cardEl) {
    _exitCropDrawMode();
    const state = _carouselState[fileId];
    if (!state) return;
    const card = state.cards.find(c => c.fdi === fdi);
    const canvas = cardEl.querySelector('.cc-canvas');

    _cropAnnotState.mode = 'draw_polygon';
    _cropAnnotState.activeClass = cls;
    _cropAnnotState.fileId = fileId;
    _cropAnnotState.fdi = fdi;
    _cropAnnotState.card = card;
    _cropAnnotState.canvas = canvas;
    _cropAnnotState.cardEl = cardEl;
    _cropAnnotState.polygonPoints = [];

    if (canvas) canvas.classList.add('draw-mode');
    const sb = cardEl.querySelector('.cc-status-bar');
    if (sb) sb.textContent = `Контур ${cls} — кликайте точки | Двойной клик — замкнуть | Esc — отмена`;
}

/** Finalize polygon contour and save as annotation. */
async function _finishPolygonDraw() {
    const pts = _cropAnnotState.polygonPoints;
    if (pts.length < 3) { _exitCropDrawMode(); return; }

    const { fileId, fdi, activeClass, card, canvas, cardEl } = _cropAnnotState;
    const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
    const nW = opgImg ? opgImg.naturalWidth : 2048, nH = opgImg ? opgImg.naturalHeight : 1024;

    // Convert points to percentage coordinates
    const polygon_pct = pts.map(p => [p.imgX / nW * 100, p.imgY / nH * 100]);

    // Compute bounding box
    const xs = pts.map(p => p.imgX), ys = pts.map(p => p.imgY);
    const bbox_pct = {
        x1: Math.min(...xs) / nW, y1: Math.min(...ys) / nH,
        x2: Math.max(...xs) / nW, y2: Math.max(...ys) / nH
    };

    try {
        const resp = await fetch(`/api/panorama/${fileId}/reference-annotations`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                fdi, annotation_type: 'child_bbox', label: activeClass,
                bbox_pct, polygon_pct, source: 'manual_contour',
                details: { polygon_points: pts.length }
            })
        });
        const data = await resp.json();

        // Add to card.children
        card.children.push({
            cls: activeClass, conf: 1.0,
            x1: Math.min(...xs), y1: Math.min(...ys),
            x2: Math.max(...xs), y2: Math.max(...ys),
            polygon_pct, _manual: true, _annot_id: data.id || null
        });

        // Log
        _debouncedSaveGT(fileId, fdi, null, `${activeClass}: ${pts.length} points`, 'contour_draw');
    } catch(e) { console.error('Save contour failed:', e); }

    _exitCropDrawMode();
    // Redraw (skip if fullscreen — caller handles redraw via _cropFsDraw)
    const _isFs = canvas && canvas.id === 'crop-fs-canvas';
    if (canvas && opgImg && !_isFs) {
        canvas.width = 400;
        _drawCropExpanded(canvas, opgImg, card);
        canvas.style.width = '220px';
        canvas.style.height = Math.round(220 * canvas.height / canvas.width) + 'px';
    }
}

// Escape key exits draw mode globally
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (_cropAnnotState.mode === 'draw' || _cropAnnotState.mode === 'draw_polygon')) {
        _exitCropDrawMode();
    }
});

/** Draw annotation preview (expanded crop + semi-transparent rect for current drag). */
function _drawAnnotPreview(canvas, card, opgImg) {
    if (!canvas || !card || !opgImg) return;
    const _isFs = (canvas.id === 'crop-fs-canvas');
    canvas.width = _isFs ? (_cropFsState.viewBbox ? 1200 : 900) : 400;
    _drawCropExpanded(canvas, opgImg, card);

    const start = _cropAnnotState.drawStart;
    const curr = _cropAnnotState.drawCurrent;
    if (!start || !curr) return;

    const ctx = canvas.getContext('2d');
    const x = Math.min(start.cx, curr.cx);
    const y = Math.min(start.cy, curr.cy);
    const w = Math.abs(curr.cx - start.cx);
    const h = Math.abs(curr.cy - start.cy);

    const acInfo = ANNOT_CLASSES.find(a => a.cls === _cropAnnotState.activeClass);
    const color = acInfo ? acInfo.color : '#fff';

    ctx.save();
    ctx.fillStyle = color + '30';
    ctx.fillRect(x, y, w, h);
    ctx.setLineDash([4, 3]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);

    ctx.font = (_isFs ? '14' : '10') + 'px system-ui';
    ctx.fillStyle = '#fff';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 3;
    ctx.fillText(_cropAnnotState.activeClass, x + 2, y > 12 ? y - 3 : y + 12);
    ctx.shadowBlur = 0;
    ctx.restore();

    if (_isFs) {
        canvas.style.width = canvas.width + 'px';
        canvas.style.height = canvas.height + 'px';
    } else {
        canvas.style.width = '220px';
        canvas.style.height = Math.round(220 * canvas.height / canvas.width) + 'px';
    }
}

/** Draw polygon preview in fullscreen: existing points + line to cursor. */
function _drawPolygonPreview(canvas, card, opgImg, mouseEvent) {
    const pts = _cropAnnotState.polygonPoints;
    if (!pts || pts.length === 0) return;
    const ctx = canvas.getContext('2d');
    let srcBbox = card.bbox;
    if (_cropFsState && _cropFsState.open && _cropFsState.viewBbox
        && _cropFsState.card === card) {
        srcBbox = _cropFsState.viewBbox;
    }
    const nb = _yoloToNatural(srcBbox, card, opgImg);
    const sw = nb.x2 - nb.x1, sh = nb.y2 - nb.y1;
    if (sw < 1 || sh < 1) return;
    const scX = canvas.width / sw, scY = canvas.height / sh;
    const toCx = p => (p.imgX - nb.x1) * scX;
    const toCy = p => (p.imgY - nb.y1) * scY;

    const color = '#f0abfc';
    ctx.save();
    // Fill polygon area
    ctx.beginPath();
    ctx.moveTo(toCx(pts[0]), toCy(pts[0]));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(toCx(pts[i]), toCy(pts[i]));
    ctx.closePath();
    ctx.fillStyle = 'rgba(240,171,252,0.15)';
    ctx.fill();
    // Stroke
    ctx.beginPath();
    ctx.moveTo(toCx(pts[0]), toCy(pts[0]));
    for (let i = 1; i < pts.length; i++) ctx.lineTo(toCx(pts[i]), toCy(pts[i]));
    // Line to cursor if mouse event provided
    if (mouseEvent) {
        const coords = _canvasEventToImgCoords(canvas, card, opgImg, mouseEvent);
        if (coords) ctx.lineTo(toCx(coords), toCy(coords));
    }
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
    // Vertices
    for (const p of pts) {
        ctx.beginPath();
        ctx.arc(toCx(p), toCy(p), 4, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = '#1e1b4b';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }
    // First vertex larger (close hint)
    if (pts.length >= 3) {
        ctx.beginPath();
        ctx.arc(toCx(pts[0]), toCy(pts[0]), 7, 0, Math.PI * 2);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.stroke();
    }
    ctx.restore();
}

/** Hit-test: find child bbox containing the point (in OPG natural coords). */
function _hitTestChildBbox(card, imgX, imgY) {
    if (!card) return null;
    // Check children first (topmost)
    if (card.children) {
        for (let i = card.children.length - 1; i >= 0; i--) {
            const ch = card.children[i];
            if (imgX >= ch.x1 && imgX <= ch.x2 && imgY >= ch.y1 && imgY <= ch.y2) {
                return ch;
            }
        }
    }
    // Then check parent bbox (Implant, Missing teeth, Root Piece)
    if (card.parentBbox) {
        const pb = card.parentBbox;
        if (imgX >= pb.x1 && imgX <= pb.x2 && imgY >= pb.y1 && imgY <= pb.y2) {
            return { cls: card.cls, conf: card.conf, x1: pb.x1, y1: pb.y1, x2: pb.x2, y2: pb.y2, _isParent: true };
        }
    }
    return null;
}

/**
 * Activate a YOLO detection for editing: create expert-layer override, show resize handles.
 * Works for both child bboxes and parentBbox (the white dashed rectangle).
 * After activation, user can drag edges to resize and changes save to expert layer + time machine.
 */
async function _activateChildForEdit(hit, card, canvas, cardEl, fileId, fdi) {
    const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
    let childIdx;
    let child;

    if (hit._isParent || hit._isParentBbox) {
        // Parent bbox clicked — check if we already created a child from it
        const existingPbChild = card.children.findIndex(c => c._isParentBbox);
        if (existingPbChild >= 0) {
            // Reuse existing child copy
            childIdx = existingPbChild;
            child = card.children[existingPbChild];
        } else {
            // Create new editable child copy from parentBbox (preserve polygon)
            child = {
                cls: card.cls, conf: card.conf,
                x1: hit.x1, y1: hit.y1, x2: hit.x2, y2: hit.y2,
                polygon_pct: card.parentBbox.polygon_pct || null,
                _isParentBbox: true
            };
            card.children.push(child);
            childIdx = card.children.length - 1;
        }
    } else {
        // Find matching child in children array
        childIdx = card.children.findIndex(c => c === hit);
        if (childIdx < 0) {
            childIdx = card.children.findIndex(c =>
                Math.abs(c.x1 - hit.x1) < 1 && Math.abs(c.y1 - hit.y1) < 1 &&
                Math.abs(c.x2 - hit.x2) < 1 && Math.abs(c.y2 - hit.y2) < 1);
        }
        if (childIdx < 0) return;
        child = card.children[childIdx];
    }

    // If not already manual, save as bbox_override to expert layer
    if (!child._manual) {
        const nW = opgImg ? opgImg.naturalWidth : 2048;
        const nH = opgImg ? opgImg.naturalHeight : 1024;
        const bbox_pct = { x1: child.x1/nW, y1: child.y1/nH, x2: child.x2/nW, y2: child.y2/nH };
        try {
            const resp = await fetch(`/api/panorama/${fileId}/reference-annotations`, {
                method: 'POST',
                headers: {'Content-Type':'application/json'},
                body: JSON.stringify({
                    fdi, annotation_type: 'child_bbox', label: child.cls,
                    bbox_pct, details: { source: 'bbox_override', original_conf: child.conf },
                    source: 'bbox_override'
                })
            });
            const data = await resp.json();
            if (resp.ok) {
                child._manual = true;
                child._annot_id = data.id || null;
                // Log to time machine
                _debouncedSaveGT(fileId, fdi, '', `${child.cls} bbox_override`, 'bbox_override');
                delete _expertAnnotCache[fileId];
            }
        } catch(e) { console.error('Activate edit failed:', e); }
    }

    // Set active edit child — shows resize handles
    _activeEditChild = { childIdx, fileId, fdi };

    // Redraw with handles
    if (canvas && opgImg) {
        const _isFs = (canvas.id === 'crop-fs-canvas');
        canvas.width = _isFs ? 900 : 400;
        _drawCropExpanded(canvas, opgImg, card);
        if (_isFs) {
            const _z = _cropFsState.zoom || 1;
            canvas.style.width = Math.round(canvas.width * _z) + 'px';
            canvas.style.height = Math.round(canvas.height * _z) + 'px';
        } else {
            canvas.style.width = '220px';
            canvas.style.height = Math.round(220 * canvas.height / canvas.width) + 'px';
        }
        if (_isFs) _cropFsUpdateSidebar();
    }

    // Status bar feedback
    const sb = cardEl.querySelector('.cc-status-bar');
    const CLS_RU = {'Crown':'Коронка','Filling':'Пломба','Caries':'Кариес',
        'Root canal obturation':'Обтурация','Periapical lesion':'Периапикал.',
        'Implant':'Имплантат','Missing teeth':'Отсутств.','Root Piece':'Корень',
        'Cover screw':'Заглушка','Abutment':'Абатмент','Fixation screw':'Фикс. винт'};
    const label = CLS_RU[child.cls] || child.cls;
    if (sb) {
        sb.textContent = `✎ ${label} — перетащите края для изменения размера`;
        sb.classList.add('success');
        setTimeout(() => sb.classList.remove('success'), 2000);
    }
}

/** Show info popup for a child bbox. */
function _showChildInfoPopup(child, displayX, displayY, cardEl, fileId, fdi) {
    // Remove existing popup
    document.querySelectorAll('.cc-child-popup').forEach(p => p.remove());

    const popup = document.createElement('div');
    popup.className = 'cc-child-popup';

    const CLS_RU_SHORT = {'Crown':'Коронка','Filling':'Пломба','Caries':'Кариес',
        'Root canal obturation':'Обтурация','Periapical lesion':'Периапикал.',
        'Implant':'Имплантат','Missing teeth':'Отсутств.','Root Piece':'Корень',
        'Cover screw':'Заглушка','Abutment':'Абатмент','Fixation screw':'Фикс. винт'};
    const label = CLS_RU_SHORT[child.cls] || child.cls;
    const isManual = child._manual;
    const confText = isManual ? '' : ` ${Math.round((child.conf || 0) * 100)}%`;

    let html = `<span class="popup-label" style="color:${YOLO_COLORS[child.cls] || '#fff'}">${label}</span>`;
    if (!isManual && child.conf) html += `<span class="popup-conf">${confText}</span>`;
    if (isManual) html += `<span class="popup-manual">✎ ручная</span>`;

    // Reclassify dropdown — suggest related corrections
    const RECLASS_OPTIONS = {
        'Implant': [{to:'post', label:'Штифт'}, {to:'endo', label:'Эндо'}],
        'Crown': [{to:'restored', label:'Пломба'}, {to:'crowned', label:'Коронка (GT)'}],
        'Filling': [{to:'caries', label:'Кариес'}, {to:'restored', label:'Реставрация (GT)'}],
        'Root Piece': [{to:'missing', label:'Отсутствует'}],
    };
    const options = RECLASS_OPTIONS[child.cls];
    if (options) {
        html += `<div style="margin-top:4px;border-top:1px solid rgba(255,255,255,0.08);padding-top:3px;">`;
        html += `<div style="font-size:7px;color:#64748b;margin-bottom:2px;">Исправить на:</div>`;
        for (const opt of options) {
            html += `<button class="reclass-btn" data-status="${opt.to}" style="
                font-size:8px;padding:1px 5px;margin:1px;border:1px solid rgba(255,255,255,0.15);
                border-radius:4px;background:rgba(255,255,255,0.05);color:#cbd5e1;cursor:pointer;
            ">${opt.label}</button>`;
        }
        html += `</div>`;
    }

    if (isManual && child._annot_id) {
        html += `<button class="del-btn" title="Удалить аннотацию" data-annot-id="${child._annot_id}">✕</button>`;
    }
    popup.innerHTML = html;

    // Position
    popup.style.left = Math.min(displayX + 4, 160) + 'px';
    popup.style.top = (displayY + 4) + 'px';
    cardEl.style.position = 'relative';
    cardEl.appendChild(popup);

    // Delete handler
    const delBtn = popup.querySelector('.del-btn');
    if (delBtn) {
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const annotId = parseInt(delBtn.dataset.annotId);
            _deleteChildAnnotation(fileId, annotId, fdi, child, cardEl);
            popup.remove();
        });
    }

    // Reclassify handlers — set GT tooth status
    popup.querySelectorAll('.reclass-btn').forEach(rb => {
        rb.addEventListener('click', (e) => {
            e.stopPropagation();
            const newStatus = rb.dataset.status;
            if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
            const current = arenaGroundTruth[fileId][fdi] || '';
            const layers = current ? parseToothLayers(current) : [];
            // Add layer if not present
            if (!layers.find(l => l.status === newStatus)) {
                layers.push({ status: newStatus, surfaces: '' });
            }
            const newVal = encodeToothLayers(layers);
            arenaGroundTruth[fileId][fdi] = newVal;
            _debouncedSaveGT(fileId, fdi, current, newVal, 'reclass_from_crop');
            // Update formula cell
            const cell = document.querySelector(`.arena-formula-row.ground-truth[data-file="${fileId}"] .arena-cell[data-fdi="${fdi}"]`);
            if (cell) _updateArenaCellVisual(cell, fdi, newVal, fileId);
            // Update OPG overlay to reflect GT change
            _refreshOPGForActiveCrop(fileId);
            // Feedback
            rb.style.background = 'rgba(34,197,94,0.3)';
            rb.style.borderColor = 'rgba(34,197,94,0.5)';
            rb.textContent += ' ✓';
            const sb = cardEl.querySelector('.cc-status-bar');
            if (sb) { sb.textContent = `✓ ${newStatus} добавлен в ${fdi}`; sb.classList.add('success');
                setTimeout(() => { sb.classList.remove('success'); sb.textContent = ''; }, 2000);
            }
            setTimeout(() => popup.remove(), 600);
        });
        rb.addEventListener('mouseenter', () => { rb.style.background = 'rgba(255,255,255,0.12)'; });
        rb.addEventListener('mouseleave', () => { rb.style.background = 'rgba(255,255,255,0.05)'; });
    });

    // Auto-dismiss on click elsewhere
    setTimeout(() => {
        const dismiss = (ev) => {
            if (!popup.contains(ev.target)) {
                popup.remove();
                document.removeEventListener('mousedown', dismiss);
            }
        };
        document.addEventListener('mousedown', dismiss);
    }, 100);
}

/** Save a new manual child annotation to DB. */
async function _saveChildAnnotation(fileId, fdi, cls, bbox_pct, bboxNatural, card, canvas, cardEl) {
    try {
        const resp = await fetch(`/api/panorama/${fileId}/reference-annotations`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                fdi: fdi,
                annotation_type: 'child_bbox',
                label: cls,
                bbox_pct: bbox_pct,
                details: { parent_fdi: fdi, source: 'crop_annotation' },
                source: 'manual_crop'
            })
        });
        const data = await resp.json();
        if (!resp.ok) { console.error('Save annotation failed:', data); return; }

        // Add to card.children as manual
        card.children.push({
            cls, conf: 1.0,
            x1: bboxNatural.x1, y1: bboxNatural.y1,
            x2: bboxNatural.x2, y2: bboxNatural.y2,
            polygon_pct: null,
            _manual: true, _annot_id: data.id || null
        });

        // Redraw expanded
        const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
        if (canvas && opgImg) {
            canvas.width = 400;
            _drawCropExpanded(canvas, opgImg, card);
            canvas.style.width = '220px'; canvas.style.height = Math.round(220 * canvas.height / canvas.width) + 'px';
        }

        // Status feedback
        const sb = cardEl.querySelector('.cc-status-bar');
        const _aClass = ANNOT_CLASSES.find(a => a.cls === cls); const abbr = _aClass ? ((_isEN_crop()&&_aClass.abbrEN)?_aClass.abbrEN:_aClass.abbr) : cls;
        if (sb) {
            sb.textContent = `✓ ${abbr} сохранён`;
            sb.classList.add('success');
            setTimeout(() => {
                sb.classList.remove('success');
                if (_cropAnnotState.mode === 'draw') {
                    sb.textContent = `Рисование ${abbr} — нарисуйте прямоугольник | Esc — отмена`;
                } else {
                    sb.textContent = 'Кликните на объект | Кнопки ниже для аннотации';
                }
            }, 2000);
        }

        // Auto-update formula
        _suggestFormulaUpdate(fileId, fdi, cls, 'add');

        // Refresh OPG overlay if in "all children" mode
        _refreshOPGChildrenOverlay(fileId);

        // Invalidate expert annotation cache so toggle refreshes
        delete _expertAnnotCache[fileId];

        // Refresh objects panel so ✗ → ✓
        _refreshCropObjPanel(fileId, fdi);

    } catch(e) {
        console.error('Save annotation error:', e);
    }
}

/** Delete a manual child annotation from DB. */
async function _deleteChildAnnotation(fileId, annotId, fdi, child, cardEl) {
    try {
        const resp = await fetch(`/api/panorama/${fileId}/reference-annotations/${annotId}`, { method: 'DELETE' });
        if (!resp.ok) { console.error('Delete annotation failed'); return; }

        // Remove from card.children
        const state = _carouselState[fileId];
        if (!state) return;
        const card = state.cards.find(c => c.fdi === fdi);
        if (card) {
            card.children = card.children.filter(ch => ch._annot_id !== annotId);
        }

        // Redraw
        const canvas = cardEl.querySelector('.cc-canvas');
        const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
        if (canvas && card && opgImg) {
            canvas.width = 400;
            _drawCropExpanded(canvas, opgImg, card);
            canvas.style.width = '220px'; canvas.style.height = Math.round(220 * canvas.height / canvas.width) + 'px';
        }

        // Status
        const sb = cardEl.querySelector('.cc-status-bar');
        if (sb) {
            sb.textContent = '✓ Аннотация удалена';
            sb.classList.add('success');
            setTimeout(() => {
                sb.classList.remove('success');
                sb.textContent = 'Кликните на объект | Кнопки ниже для аннотации';
            }, 2000);
        }

        // Auto-update formula (remove)
        _suggestFormulaUpdate(fileId, fdi, child.cls, 'remove');

        // Refresh OPG overlay
        _refreshOPGChildrenOverlay(fileId);

        // Invalidate expert annotation cache
        delete _expertAnnotCache[fileId];

        // Refresh objects panel so ✓ → ✗
        _refreshCropObjPanel(fileId, fdi);

    } catch(e) {
        console.error('Delete annotation error:', e);
    }
}

/** Load manual child annotations from DB for a specific FDI card. */
async function _loadManualChildAnnotations(fileId, fdi, card) {
    try {
        const resp = await fetch(`/api/panorama/${fileId}/reference-annotations`);
        if (!resp.ok) return;
        const annotations = await resp.json();

        // Filter for child_bbox annotations matching this FDI
        const matching = annotations.filter(a =>
            a.type === 'child_bbox' && a.fdi === fdi && a.bbox_pct
        );

        if (matching.length === 0) return;

        const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
        const nW = opgImg ? (opgImg.naturalWidth || 2048) : 2048;
        const nH = opgImg ? (opgImg.naturalHeight || 1024) : 1024;

        for (const ann of matching) {
            const bp = ann.bbox_pct;
            // Check if already loaded (avoid duplicates)
            const existing = card.children.find(ch =>
                ch._annot_id === ann.id || (ch._manual && ch.cls === ann.label &&
                Math.abs(ch.x1 - bp.x1 * nW) < 5 && Math.abs(ch.y1 - bp.y1 * nH) < 5)
            );
            if (existing) continue;

            card.children.push({
                cls: ann.label,
                conf: 1.0,
                x1: bp.x1 * nW, y1: bp.y1 * nH,
                x2: bp.x2 * nW, y2: bp.y2 * nH,
                polygon_pct: ann.polygon_pct || null,
                _manual: true,
                _annot_id: ann.id
            });
        }
    } catch(e) {
        console.warn('Load manual annotations failed:', e);
    }
}

/** Auto-update formula layers when adding/removing child annotations. */
function _suggestFormulaUpdate(fileId, fdi, cls, action) {
    const formulaStatus = CHILD_TO_FORMULA[cls];
    if (!formulaStatus) return; // e.g. Periapical lesion has no formula status

    const gt = arenaGroundTruth[fileId] || {};
    const currentRaw = gt[fdi] || '';
    const layers = parseToothLayers(currentRaw);

    if (action === 'add') {
        // Check if layer already exists
        if (layers.some(l => l.status === formulaStatus)) return;
        layers.push({ status: formulaStatus, surfaces: '' });
    } else if (action === 'remove') {
        const idx = layers.findIndex(l => l.status === formulaStatus);
        if (idx < 0) return;
        layers.splice(idx, 1);
    }

    const newRaw = encodeToothLayers(layers);
    if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
    arenaGroundTruth[fileId][fdi] = newRaw;

    // Update localStorage + debounced save to DB
    localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
    _debouncedSaveGT(fileId);

    // Update formula cell visually
    const cell = document.querySelector(`.arena-formula-row.ground-truth[data-file="${fileId}"] .arena-cell[data-fdi="${fdi}"]`);
    if (cell) _updateArenaCellVisual(cell, fdi, newRaw, fileId);

    // Update OPG overlay to reflect GT change
    _refreshOPGForActiveCrop(fileId);
}

// ══════════════════════════════════════════════════════════════════════════
// ██  OPG CHILDREN OVERLAY — grouped sub-objects + toggle
// ══════════════════════════════════════════════════════════════════════════

/** Draw a text label with semi-transparent background on a canvas context. */
function _drawLabelWithBg(ctx, text, x, y, opts = {}) {
    const font = opts.font || '8px system-ui';
    const color = opts.color || '#fff';
    const bg = opts.bg || 'rgba(0,0,0,0.7)';
    const pad = opts.pad ?? 2;
    ctx.save();
    ctx.font = font;
    const tw = ctx.measureText(text).width;
    const fh = parseInt(font) || 8;
    const bh = fh + pad * 2;
    ctx.fillStyle = bg;
    ctx.fillRect(x - 1, y - fh - pad + 1, tw + pad * 2 + 1, bh);
    ctx.fillStyle = color;
    ctx.fillText(text, x + pad, y);
    ctx.restore();
}
