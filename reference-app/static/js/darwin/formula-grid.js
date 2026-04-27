// formula-grid.js — Crop drag/drop, FDI constants, formula grid, test cases, evaluate
// Extracted from darwin_lab.html lines 2832–3542
// ═══════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════
// CROP DRAG-TO-REASSIGN — перетаскивание кропа на другой FDI
// ═══════════════════════════════════════════════════════════════

// Global drag state: disable pointer-events on cell children during drag
let _cropDragging = false;
document.addEventListener('dragstart', (e) => {
    if (e.target.closest && e.target.closest('.carousel-card')) {
        _cropDragging = true;
        // Make all arena-cell children transparent to pointer events
        document.querySelectorAll('.arena-cell > *').forEach(el => { el.style.pointerEvents = 'none'; });
    }
});
document.addEventListener('dragend', () => {
    if (_cropDragging) {
        _cropDragging = false;
        document.querySelectorAll('.arena-cell > *').forEach(el => { el.style.pointerEvents = ''; });
        document.querySelectorAll('.arena-cell').forEach(el => { el.style.outline = ''; el.style.background = ''; });
    }
});

function _cropDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    // Find the arena-cell (could be the cell itself or a parent)
    const cell = e.target.closest('.arena-cell') || e.currentTarget;
    cell.style.outline = '2px solid #22c55e';
    cell.style.outlineOffset = '-2px';
    cell.style.background = 'rgba(34,197,94,0.15)';
}

function _cropDragLeave(e) {
    const cell = e.target.closest('.arena-cell') || e.currentTarget;
    cell.style.outline = '';
    cell.style.background = '';
}

async function _cropDrop(e, targetFileId, targetFdi) {
    e.preventDefault();
    e.stopPropagation();
    const cell = e.target.closest('.arena-cell') || e.currentTarget;
    cell.style.outline = '';
    cell.style.background = '';

    const raw = e.dataTransfer.getData('application/x-crop-reassign');
    if (!raw) return;
    const {fileId, fdi: sourceFdi, bbox, cls} = JSON.parse(raw);
    if (fileId !== targetFileId) return; // can only reassign within same file
    if (sourceFdi === targetFdi) return; // dropped on same cell

    // 1. Update GT formula: move crop bbox from sourceFdi to targetFdi in _crop_overrides
    const overrides = window.arenaCropOverrides[fileId] || {};
    const sourceOverride = overrides[sourceFdi] || bbox;
    overrides[targetFdi] = {...sourceOverride, reassigned_from: sourceFdi, source: 'drag_reassign'};
    delete overrides[sourceFdi];
    window.arenaCropOverrides[fileId] = overrides;

    // 2. Update all data structures: yoloCache fdi_map + carousel cards
    // Update fdi_map in YOLO cache (move detection indices from source → target)
    const yolo = _yoloCache[fileId];
    if (yolo && yolo.fdi_map) {
        const sourceIdxs = yolo.fdi_map[sourceFdi] || [];
        yolo.fdi_map[targetFdi] = (yolo.fdi_map[targetFdi] || []).concat(sourceIdxs);
        delete yolo.fdi_map[sourceFdi];
        // Update FDI on detection objects too
        for (const idx of sourceIdxs) {
            const det = yolo.detections.find(d => d.idx === idx);
            if (det) det.fdi = targetFdi;
        }
        // Move interpolated bbox if present
        if (yolo.interpolated && yolo.interpolated[sourceFdi]) {
            yolo.interpolated[targetFdi] = yolo.interpolated[sourceFdi];
            delete yolo.interpolated[sourceFdi];
        }
    }

    // Update carousel card FDI and rebuild carousels
    const state = _carouselState[fileId];
    if (state) {
        const card = state.cards.find(c => c.fdi === sourceFdi);
        if (card) {
            card.fdi = targetFdi;
        }
        // Also swap any target card to avoid collision (swap, not overwrite)
        const targetCard = state.cards.find(c => c.fdi === targetFdi && c !== card);
        if (targetCard && card) {
            targetCard.fdi = sourceFdi; // swap: old target goes to source position
        }
        // Re-detect YOLO objects inside the new bbox, then re-render
        const movedCard = state.cards.find(c => c.fdi === targetFdi);
        if (movedCard && movedCard.bbox) {
            _redetectChildren(fileId, targetFdi, movedCard.bbox);
        } else {
            _renderCropCarousel(fileId, 'upper');
            _renderCropCarousel(fileId, 'lower');
        }
    }

    // 3. Save to server via crop-overrides endpoint (safe: merges into existing GT)
    try {
        const resp = await fetch(`/api/darwin/crop-overrides/${fileId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                crop_overrides: overrides,
                session_id: _gtSessionId,
                reassign: {from: sourceFdi, to: targetFdi, bbox: sourceOverride}
            })
        });
        console.log(`Crop reassign ${sourceFdi}→${targetFdi}: ${resp.ok ? 'saved' : 'failed'}`);
    } catch(err) {
        console.warn('Crop reassign save failed:', err);
    }

    // 4. Visual feedback
    const targetCell = document.querySelector(`.arena-cell[data-fdi="${targetFdi}"][data-file="${fileId}"]`);
    if (targetCell) {
        targetCell.style.outline = '2px solid #22c55e';
        setTimeout(() => { targetCell.style.outline = ''; }, 2000);
    }
}


// ═══════════════════════════════════════════════════════════════
// AUTO-REDETECT: find YOLO objects inside a bbox
// ═══════════════════════════════════════════════════════════════

function _redetectChildren(fileId, fdi, bbox) {
    /**
     * After crop reassign/resize/manual-draw: scan ALL YOLO detections
     * and assign those whose center falls inside the new bbox.
     * Updates fdi_map + card.children + re-renders carousel.
     */
    const yolo = _yoloCache[fileId];
    if (!yolo || !yolo.detections || !bbox) return;

    const matchedIdxs = [];
    const children = [];
    let parent = null;

    for (const det of yolo.detections) {
        const cx = (det.x1 + det.x2) / 2;
        const cy = (det.y1 + det.y2) / 2;
        // Check if detection center is inside bbox (with 10% tolerance)
        const tolX = (bbox.x2 - bbox.x1) * 0.1;
        const tolY = (bbox.y2 - bbox.y1) * 0.1;
        if (cx >= bbox.x1 - tolX && cx <= bbox.x2 + tolX &&
            cy >= bbox.y1 - tolY && cy <= bbox.y2 + tolY) {
            matchedIdxs.push(det.idx);
            const area = (det.x2 - det.x1) * (det.y2 - det.y1);
            if (!parent || area > ((parent.x2 - parent.x1) * (parent.y2 - parent.y1))) {
                if (parent) children.push({cls: parent.cls, conf: parent.conf, x1: parent.x1, y1: parent.y1, x2: parent.x2, y2: parent.y2, polygon_pct: parent.polygon_pct});
                parent = det;
            } else {
                children.push({cls: det.cls, conf: det.conf, x1: det.x1, y1: det.y1, x2: det.x2, y2: det.y2, polygon_pct: det.polygon_pct});
            }
        }
    }

    // Update fdi_map
    if (!yolo.fdi_map) yolo.fdi_map = {};
    yolo.fdi_map[fdi] = matchedIdxs;

    // Update card
    const state = _carouselState[fileId];
    if (state) {
        const card = state.cards.find(c => c.fdi === fdi);
        if (card) {
            card.children = children;
            card.cls = parent ? parent.cls : 'manual';
            card.conf = parent ? parent.conf : 0;
            card.noDet = matchedIdxs.length === 0;
            if (parent) {
                card.parentBbox = { x1: parent.x1, y1: parent.y1, x2: parent.x2, y2: parent.y2, polygon_pct: parent.polygon_pct || null, cls: parent.cls };
                // Expand bbox to include parent + children with padding
                const pw = (bbox.x2 - bbox.x1) * 0.05;
                const ph = (bbox.y2 - bbox.y1) * 0.05;
                card.bbox = {
                    x1: Math.max(0, Math.min(bbox.x1, parent.x1) - pw),
                    y1: Math.max(0, Math.min(bbox.y1, parent.y1) - ph),
                    x2: Math.min(card.imgW || 3034, Math.max(bbox.x2, parent.x2) + pw),
                    y2: Math.min(card.imgH || 1536, Math.max(bbox.y2, parent.y2) + ph),
                };
            }
        }
        _renderCropCarousel(fileId, 'upper');
        _renderCropCarousel(fileId, 'lower');
    }

    console.log(`Redetected ${fdi}: ${matchedIdxs.length} YOLO objects inside bbox (parent: ${parent?.cls || 'none'}, children: ${children.length})`);
}

// ═══════════════════════════════════════════════════════════════
// DELETE / ADD CROPS
// ═══════════════════════════════════════════════════════════════

function _deleteCrop(fileId, fdi) {
    // Remove detection from fdi_map and mark card as noDet
    const yolo = _yoloCache[fileId];
    if (yolo && yolo.fdi_map) {
        delete yolo.fdi_map[fdi];
        // Also remove from interpolated
        if (yolo.interpolated) delete yolo.interpolated[fdi];
    }
    const state = _carouselState[fileId];
    if (state) {
        const card = state.cards.find(c => c.fdi === fdi);
        if (card) {
            card.noDet = true;
            card.bbox = null;
            card.children = [];
            card.cls = 'none';
        }
        _renderCropCarousel(fileId, 'upper');
        _renderCropCarousel(fileId, 'lower');
    }
    // Save deletion as crop_override with deleted flag
    const overrides = window.arenaCropOverrides[fileId] || {};
    overrides[fdi] = { deleted: true, source: 'manual_delete' };
    window.arenaCropOverrides[fileId] = overrides;
    fetch(`/api/darwin/crop-overrides/${fileId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ crop_overrides: overrides, session_id: _gtSessionId })
    }).catch(() => {});
    console.log(`Deleted crop ${fdi} for file ${fileId}`);
}

// ── Add manual crop: draw bbox on OPG ──
let _addCropState = null; // {fileId, fdi, startX, startY, wrap, canvas}

function _startAddCrop(fileId, fdi) {
    const wrap = document.querySelector(`.arena-opg-wrap[data-file="${fileId}"]`);
    if (!wrap) return;
    const img = wrap.querySelector('img');
    if (!img) return;

    // Create overlay canvas for drawing
    let drawCanvas = wrap.querySelector('.crop-draw-canvas');
    if (!drawCanvas) {
        drawCanvas = document.createElement('canvas');
        drawCanvas.className = 'crop-draw-canvas';
        drawCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:50;cursor:crosshair;';
        wrap.appendChild(drawCanvas);
    }
    drawCanvas.width = wrap.offsetWidth;
    drawCanvas.height = wrap.offsetHeight;
    drawCanvas.style.display = 'block';
    drawCanvas.style.pointerEvents = 'auto';

    _addCropState = { fileId, fdi, wrap, canvas: drawCanvas, img, startX: 0, startY: 0, drawing: false };

    // Show banner
    let banner = document.getElementById('add-crop-banner');
    if (!banner) {
        banner = document.createElement('div');
        banner.id = 'add-crop-banner';
        banner.style.cssText = 'position:fixed;top:60px;left:50%;transform:translateX(-50%);z-index:9999;background:#6366f1;color:#fff;padding:8px 20px;border-radius:8px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.4)';
        document.body.appendChild(banner);
    }
    banner.textContent = `Нарисуйте bbox для зуба ${fdi} на снимке (зажмите мышку и проведите)`;
    banner.style.display = 'block';

    drawCanvas.onmousedown = (e) => {
        const rect = drawCanvas.getBoundingClientRect();
        _addCropState.startX = e.clientX - rect.left;
        _addCropState.startY = e.clientY - rect.top;
        _addCropState.drawing = true;
    };

    drawCanvas.onmousemove = (e) => {
        if (!_addCropState || !_addCropState.drawing) return;
        const rect = drawCanvas.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const ctx = drawCanvas.getContext('2d');
        ctx.clearRect(0, 0, drawCanvas.width, drawCanvas.height);
        ctx.strokeStyle = '#22c55e';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(_addCropState.startX, _addCropState.startY,
            cx - _addCropState.startX, cy - _addCropState.startY);
        ctx.setLineDash([]);
    };

    drawCanvas.onmouseup = (e) => {
        if (!_addCropState || !_addCropState.drawing) return;
        _addCropState.drawing = false;
        const rect = drawCanvas.getBoundingClientRect();
        const endX = e.clientX - rect.left;
        const endY = e.clientY - rect.top;

        // Convert display coords → natural image coords
        const imgRect = _addCropState.img.getBoundingClientRect();
        const wrapRect = _addCropState.wrap.getBoundingClientRect();
        const sc = _addCropState.img.naturalWidth / imgRect.width;
        const ox = imgRect.left - wrapRect.left;
        const oy = imgRect.top - wrapRect.top;

        const x1 = Math.round(Math.min(_addCropState.startX, endX) - ox) * sc;
        const y1 = Math.round(Math.min(_addCropState.startY, endY) - oy) * sc;
        const x2 = Math.round(Math.max(_addCropState.startX, endX) - ox) * sc;
        const y2 = Math.round(Math.max(_addCropState.startY, endY) - oy) * sc;

        if (Math.abs(x2 - x1) < 10 || Math.abs(y2 - y1) < 10) {
            // Too small — cancel
            _cancelAddCrop();
            return;
        }

        // Create the crop
        _finishAddCrop(_addCropState.fileId, _addCropState.fdi, {
            x1: Math.max(0, Math.round(x1)),
            y1: Math.max(0, Math.round(y1)),
            x2: Math.min(_addCropState.img.naturalWidth, Math.round(x2)),
            y2: Math.min(_addCropState.img.naturalHeight, Math.round(y2))
        });
    };

    // Escape to cancel
    const escHandler = (e) => {
        if (e.key === 'Escape') { _cancelAddCrop(); document.removeEventListener('keydown', escHandler); }
    };
    document.addEventListener('keydown', escHandler);
}

function _cancelAddCrop() {
    if (_addCropState) {
        _addCropState.canvas.style.display = 'none';
        _addCropState.canvas.style.pointerEvents = 'none';
        _addCropState = null;
    }
    const banner = document.getElementById('add-crop-banner');
    if (banner) banner.style.display = 'none';
}

function _finishAddCrop(fileId, fdi, bbox) {
    _cancelAddCrop(); // hide overlay

    // Add to yoloCache as interpolated
    const yolo = _yoloCache[fileId];
    if (yolo) {
        if (!yolo.interpolated) yolo.interpolated = {};
        yolo.interpolated[fdi] = bbox;
        if (!yolo.fdi_map) yolo.fdi_map = {};
        yolo.fdi_map[fdi] = []; // no YOLO detections, just interpolated bbox
    }

    // Update carousel card and auto-detect YOLO objects inside new bbox
    const state = _carouselState[fileId];
    if (state) {
        const card = state.cards.find(c => c.fdi === fdi);
        if (card) {
            card.noDet = false;
            card.bbox = bbox;
            card.cls = 'manual';
            card.children = [];
            const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
            card.imgW = opgImg?.naturalWidth || 2048;
            card.imgH = opgImg?.naturalHeight || 1024;
        }
        // Redetect: find YOLO objects inside the drawn bbox
        _redetectChildren(fileId, fdi, bbox);
    }

    // Save as crop_override
    const overrides = window.arenaCropOverrides[fileId] || {};
    overrides[fdi] = { ...bbox, source: 'manual_draw' };
    window.arenaCropOverrides[fileId] = overrides;
    fetch(`/api/darwin/crop-overrides/${fileId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ crop_overrides: overrides, session_id: _gtSessionId })
    }).catch(() => {});

    console.log(`Added manual crop for ${fdi}: ${JSON.stringify(bbox)}`);
}


// ═══════════════════════════════════════════════════════════════
// DENTAL FORMULA CONSTANTS
// ═══════════════════════════════════════════════════════════════
const FDI_UPPER_RIGHT = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1'];
const FDI_UPPER_LEFT  = ['2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
const FDI_LOWER_RIGHT = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1'];
const FDI_LOWER_LEFT  = ['3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
const ALL_FDI = [...FDI_UPPER_RIGHT, ...FDI_UPPER_LEFT, ...FDI_LOWER_RIGHT, ...FDI_LOWER_LEFT];

const STATUS_LIST = [
    {key:'present',        icon:'✓',  label:'Зуб',           color:'var(--green)'},
    {key:'missing',        icon:'✕',  label:'Нет',           color:'var(--red)'},
    {key:'impl_fixture',   icon:'⬡',  label:'Fixture',       color:'#16a34a'},
    {key:'impl_healing',   icon:'⬡↑', label:'Формиров.',     color:'#ca8a04'},
    {key:'impl_restored',  icon:'⬡♛', label:'Имп+коронка',   color:'#06b6d4'},
    {key:'crown',          icon:'♛',  label:'Коронка',        color:'#06b6d4'},
    {key:'filling',        icon:'●',  label:'Пломба',         color:'#0ea5e9'},
    {key:'root',           icon:'↓',  label:'Корень',         color:'#d946ef'},
    {key:'bridge_pontic',  icon:'⌒',  label:'Мост',           color:'var(--purple)'},
];

// Ground truth formulas per file_id
const gtFormulas = {};

// ═══════════════════════════════════════════════════════════════
// RENDER DENTAL FORMULA GRID
// ═══════════════════════════════════════════════════════════════
function renderFormulaGrid(formula, options = {}) {
    const {editable = false, id = '', compareWith = null, compact = false} = options;
    const cellSize = compact ? 'width:28px;height:30px;font-size:9px' : '';

    function cell(fdi) {
        const st = (formula && formula[fdi]) || '';
        const stClass = st ? `st-${st}` : 'st-empty';
        const cmpClass = compareWith ? (compareWith[fdi] === st ? 'match' : 'mismatch') : '';
        const editAttr = editable ? `onclick="cycleToothStatus('${id}','${fdi}')"` : '';
        const fdiLabel = compact ? fdi.split('.')[1] : fdi;
        return `<div class="df-cell ${stClass} ${cmpClass}" data-fdi="${fdi}" ${editAttr} style="${cellSize}" title="${fdi}">
            <span class="st-icon"></span><span class="fdi">${fdiLabel}</span>
        </div>`;
    }

    function row(right, left) {
        return `<div class="df-row">${right.map(cell).join('')}<div class="df-mid">│</div>${left.map(cell).join('')}</div>`;
    }

    const cls = editable ? 'df-grid-wrap gt-editable' : 'df-grid-wrap';
    return `<div class="${cls}" id="${id}">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);padding:0 20px">
            <span>Q1 (пр.верх)</span><span>Q2 (лев.верх)</span>
        </div>
        ${row(FDI_UPPER_RIGHT, FDI_UPPER_LEFT)}
        <div class="df-sep"></div>
        ${row(FDI_LOWER_RIGHT, FDI_LOWER_LEFT)}
        <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-dim);padding:0 20px">
            <span>Q4 (пр.низ)</span><span>Q3 (лев.низ)</span>
        </div>
    </div>`;
}

// Cycle through statuses on click
function cycleToothStatus(gridId, fdi) {
    const fileId = gridId.replace('gt-formula-', '');
    if (!gtFormulas[fileId]) gtFormulas[fileId] = {};

    const current = gtFormulas[fileId][fdi] || '';
    const keys = STATUS_LIST.map(s => s.key);
    const idx = keys.indexOf(current);
    const next = keys[(idx + 1) % keys.length];
    gtFormulas[fileId][fdi] = next;

    // Update cell visuals
    const grid = document.getElementById(gridId);
    const cell = grid.querySelector(`[data-fdi="${fdi}"]`);
    cell.className = `df-cell st-${next}`;

    // Update counters
    updateGTCounters(fileId);
}

function updateGTCounters(fileId) {
    const f = gtFormulas[fileId] || {};
    const counts = {};
    STATUS_LIST.forEach(s => counts[s.key] = 0);
    // Also count legacy 'implant' as impl_fixture
    counts['implant'] = 0;
    for (const st of Object.values(f)) if (counts[st] !== undefined) counts[st]++;
    const implTotal = (counts.impl_fixture||0) + (counts.impl_healing||0) + (counts.impl_restored||0) + (counts.implant||0);
    const el = document.getElementById(`gt-counts-${fileId}`);
    if (el) {
        el.innerHTML = `<span style="color:var(--green)">✓${counts.present} зуб</span> · ` +
            `<span style="color:#16a34a">⬡${implTotal} имп</span>` +
            (counts.impl_fixture ? ` <span style="color:#16a34a;font-size:10px">(${counts.impl_fixture}fix</span>` : '') +
            (counts.impl_healing ? ` <span style="color:#ca8a04;font-size:10px">${counts.impl_healing}heal</span>` : '') +
            (counts.impl_restored ? ` <span style="color:#06b6d4;font-size:10px">${counts.impl_restored}rest)</span>` : '') +
            ` · <span style="color:var(--red)">✕${counts.missing} нет</span> · ` +
            `<span style="color:#06b6d4">♛${counts.crown}</span> · ` +
            `<span style="color:#0ea5e9">●${counts.filling}</span>`;
    }
}

// ═══════════════════════════════════════════════════════════════
// LOAD TEST CASES
// ═══════════════════════════════════════════════════════════════
async function loadTestCases() {
    const container = document.getElementById('eval-cases');

    try {
        const resp = await fetch('/api/darwin/test-cases');
        const cases = await resp.json();

        // Load card context + GT from Arena for all cases in parallel
        const ctxPromises = cases.map(c =>
            fetch(`/api/darwin/card-context/${c.file_id}`).then(r => r.json()).catch(() => null)
        );
        const gtPromises = cases.map(c =>
            fetch(`/api/darwin/ground-truth/${c.file_id}`).then(r => r.json()).catch(() => ({formula:{}}))
        );
        const [contexts, gtResults] = await Promise.all([Promise.all(ctxPromises), Promise.all(gtPromises)]);

        // Pre-fill gtFormulas with Arena GT data
        cases.forEach((c, idx) => {
            const arenaGt = gtResults[idx]?.formula || {};
            if (Object.keys(arenaGt).length > 0) {
                gtFormulas[c.file_id] = arenaGt;
            }
        });

        container.innerHTML = cases.map((c, idx) => {
            const origUrl = `/api/files/${c.file_id}/preview`;
            const segUrl = `/api/panorama/${c.file_id}/segmentation-overlay.jpg`;

            // Card context
            const ctx = contexts[idx];
            const cardContextHtml = renderCardContext(ctx);

            // Algorithm dental formulas
            const algoFormulas = c.algorithms.map(a => {
                const df = a.dental_formula || {};
                const implCount = Object.values(df).filter(s => s === 'implant').length;
                const teethCount = Object.values(df).filter(s => s === 'present').length;
                const crownCount = Object.values(df).filter(s => s === 'crown').length;
                const bridgeCount = Object.values(df).filter(s => s === 'bridge_pontic').length;
                const hasDf = Object.keys(df).length > 0;
                const scoreStr = a.human_score !== null ? `${(a.human_score * 100).toFixed(0)}%` : '—';
                const scoreClass = a.human_score !== null
                    ? (a.human_score >= 0.9 ? 'exact' : a.human_score >= 0.7 ? 'close' : 'miss')
                    : '';

                return `<div class="algo-formula-card">
                    <h4>
                        <span>${a.name} <span style="color:var(--text-dim);font-weight:400">${a.codename}</span> · ${a.images}img</span>
                        <span class="accuracy ${scoreClass}">${scoreStr}</span>
                    </h4>
                    <div style="font-size:11px;color:var(--text-dim);margin-bottom:4px">
                        ⬡${implCount} имп · ✓${teethCount} зуб · ♛${crownCount} кор · ⌒${bridgeCount} мост · conf ${a.confidence}
                    </div>
                    ${hasDf ? renderFormulaGrid(df, {compact: true}) : '<div style="color:var(--text-dim);font-size:12px;padding:10px">⏳ Формула не загружена</div>'}
                </div>`;
            }).join('');

            // Build legend
            const legend = STATUS_LIST.map(s =>
                `<span><span style="color:${s.color}">${s.icon}</span> ${s.label}</span>`
            ).join('');

            return `<div class="eval-case" id="eval-case-${c.file_id}">
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
                    <h2 style="margin:0">${c.surname} ${c.first_name}</h2>
                    <span style="color:var(--text-dim);font-size:13px">P${c.patient_id} · fid=${c.file_id}</span>
                    <a href="${c.segmentation_url}" target="_blank" style="background:var(--green);color:#000;padding:4px 12px;border-radius:6px;font-size:13px;font-weight:600;text-decoration:none">
                        🔍 Интерактивная сегментация
                    </a>
                </div>
                <div class="subtitle">${c.label}</div>

                <!-- Twin OPG: Original + YOLO overlay -->
                <div class="opg-twin">
                    <div class="opg-col">
                        <div class="opg-col-title">📷 Оригинал</div>
                        <img src="${origUrl}" alt="Original OPG" onclick="toggleZoom(this)" title="Оригинальный снимок (клик = зум)">
                    </div>
                    <div class="opg-col">
                        <div class="opg-col-title" style="display:flex;align-items:center;gap:6px">
                            🔬 Сегментация
                            <button style="font-size:10px;padding:1px 6px;border:1px solid rgba(255,255,255,0.15);background:var(--blue);color:#fff;border-radius:3px;cursor:pointer" onclick="this.parentElement.parentElement.querySelector('img').src='${segUrl}';this.style.background='var(--blue)';this.nextSibling.style.background='';this.nextSibling.nextSibling.style.background=''">YOLO</button><button style="font-size:10px;padding:1px 6px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#94a3b8;border-radius:3px;cursor:pointer" onclick="this.parentElement.parentElement.querySelector('img').src='${segUrl.replace('.jpg','.jpg?source=expert')}';this.style.background='var(--blue)';this.style.color='#fff';this.previousSibling.style.background='';this.nextSibling.style.background=''">Эксперт</button><button style="font-size:10px;padding:1px 6px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#94a3b8;border-radius:3px;cursor:pointer" onclick="this.parentElement.parentElement.querySelector('img').src='${segUrl.replace('.jpg','.jpg?source=both')}';this.style.background='var(--blue)';this.style.color='#fff';this.previousSibling.previousSibling.style.background='';this.previousSibling.style.background=''">Оба</button>
                        </div>
                        <img src="${segUrl}" alt="YOLO Overlay" onclick="toggleZoom(this)" title="YOLO bbox overlay (клик = зум)">
                    </div>
                </div>

                <!-- Card context from medical records -->
                ${cardContextHtml}

                <div class="df-section">
                    <div class="df-section-title">
                        🦷 GROUND TRUTH — ваша оценка
                        <span class="df-label">(кликайте по зубам для переключения статуса)</span>
                        <a href="/darwin-lab#arena-${c.file_id}" style="font-size:10px;margin-left:8px;color:#60a5fa">Открыть в Арене (полная формула с кропами)</a>
                    </div>
                    ${renderFormulaGrid(gtFormulas[c.file_id] || {}, {editable: true, id: 'gt-formula-' + c.file_id})}
                    <div class="eval-toolbar">
                        <button onclick="setAllGT(${c.file_id}, 'missing')" title="Всё отсутствует">Всё ✕</button>
                        <button onclick="setAllGT(${c.file_id}, 'present')" title="Все зубы">Все ✓</button>
                        <button class="primary" onclick="saveFormulaEval(${c.file_id})">💾 Сохранить GT и оценить</button>
                        <span id="eval-status-${c.file_id}"></span>
                        <div id="gt-counts-${c.file_id}" style="font-size:12px;margin-left:auto"></div>
                        <div class="legend">${legend}</div>
                    </div>
                </div>

                <div class="df-section">
                    <div class="df-section-title">🧬 Результаты алгоритмов</div>
                    <div class="algo-formulas">${algoFormulas}</div>
                </div>
            </div>`;
        }).join('');

        // Initialize tooth hover-highlight on OPG for all eval cases
        requestAnimationFrame(() => {
            container.querySelectorAll('.eval-case[id^="eval-case-"]').forEach(ec => {
                const fid = ec.id.replace('eval-case-', '');
                if (fid) _initToothHoverHighlight(fid);
            });
        });

    } catch (e) {
        container.innerHTML = `<div style="color:var(--red)">Ошибка загрузки: ${e.message}</div>`;
    }
}

function renderCardContext(ctx) {
    if (!ctx || ctx.error) return '';
    const s = ctx.summary;
    const p = ctx.patient;

    // Implants — grouped by system+size
    let implHtml = '';
    if (ctx.implants.length > 0) {
        const groups = {};
        ctx.implants.forEach(i => {
            const key = `${i.system || '?'} Ø${i.diameter || '?'}×${i.length || '?'}`;
            if (!groups[key]) groups[key] = {count: 0, teeth: [], date: i.installation_date};
            groups[key].count++;
            if (i.tooth_number) groups[key].teeth.push(i.tooth_number);
        });
        const implChips = Object.entries(groups).map(([key, g]) => {
            const parts = [`${g.count}× ${key}`];
            if (g.teeth.length) parts.push(`зубы: ${g.teeth.join(', ')}`);
            if (g.date) parts.push(g.date);
            return `<span class="ctx-chip impl">⬡ ${parts.join(' · ')}</span>`;
        }).join('');
        implHtml = `<div><div class="ctx-label">⬡ Имплантаты (${ctx.implants.length})</div>${implChips}</div>`;
    }

    // Diagnoses
    let diagHtml = '';
    if (ctx.diagnoses.length > 0) {
        const diagChips = ctx.diagnoses.map(d => {
            const parts = [d.icd10_code];
            if (d.qualifier) parts.push(d.qualifier);
            if (d.description) parts.push(d.description.substring(0, 60));
            if (d.tooth_number) parts.push(`зуб ${d.tooth_number}`);
            return `<span class="ctx-chip diag">📋 ${parts.join(' · ')}</span>`;
        }).join('');
        diagHtml = `<div><div class="ctx-label">📋 Диагнозы (${ctx.diagnoses.length})</div>${diagChips}</div>`;
    }

    // Diary summary
    let diaryHtml = '';
    if (ctx.diary_entries.length > 0) {
        const first = ctx.diary_entries[0];
        const last = ctx.diary_entries[ctx.diary_entries.length - 1];
        const implRelated = ctx.diary_entries.filter(d =>
            (d.treatment || '').toLowerCase().includes('имплант') ||
            (d.treatment || '').toLowerCase().includes('implant')
        );
        diaryHtml = `<div><div class="ctx-label">📝 Дневник (${ctx.diary_entries.length} визитов)</div>
            <span class="ctx-chip diary">📅 ${first.visit_date || '?'} → ${last.visit_date || '?'}</span>
            ${implRelated.length > 0 ? `<span class="ctx-chip diary">⬡ ${implRelated.length} визитов с имплантацией</span>` : ''}
        </div>`;
    }

    // YOLO summary
    let yoloHtml = '';
    if (s.yolo_detections_count > 0) {
        const yoloChips = Object.entries(s.yolo_classes).map(([cls, cnt]) =>
            `<span class="ctx-chip yolo">${cls}: ${cnt}</span>`
        ).join('');
        yoloHtml = `<div><div class="ctx-label">🔬 YOLO-детекции (${s.yolo_detections_count})</div>${yoloChips}</div>`;
    }

    const hasData = s.implant_count > 0 || s.diagnosis_count > 0 || s.diary_entries_count > 0 || s.yolo_detections_count > 0;
    if (!hasData) return `<div class="card-context"><em style="color:var(--text-dim);font-size:12px">📁 Нет данных в карте для этого пациента</em></div>`;

    return `<details class="card-context">
        <summary>📁 Данные медицинской карты — ${p.surname} ${p.first_name}
            <span style="color:var(--text-dim);font-size:11px;margin-left:8px">
                ${s.implant_count} имп · ${s.diagnosis_count} диаг · ${s.diary_entries_count} визитов · ${s.yolo_detections_count} YOLO
            </span>
        </summary>
        <div class="ctx-grid">
            ${yoloHtml}
            ${implHtml}
            ${diagHtml}
            ${diaryHtml}
        </div>
    </details>`;
}

function setAllGT(fileId, status) {
    gtFormulas[fileId] = {};
    ALL_FDI.forEach(fdi => gtFormulas[fileId][fdi] = status);
    const grid = document.getElementById(`gt-formula-${fileId}`);
    grid.querySelectorAll('.df-cell').forEach(cell => {
        cell.className = `df-cell st-${status}`;
    });
    updateGTCounters(fileId);
}

function toggleZoom(img) {
    img.classList.toggle('zoomed');
}

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.zoomed').forEach(img => img.classList.remove('zoomed'));
        closeOPGViewer();
    }
});
