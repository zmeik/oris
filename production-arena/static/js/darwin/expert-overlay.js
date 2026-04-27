// expert-overlay.js — Expert annotations overlay, correction mode, algo detail
// Extracted from darwin_lab.html lines 18080–18726
// ═══════════════════════════════════════════════════════════════


/** Toggle expert annotations overlay on OPG. */
const _expertAnnotCache = {};
let _expertOverlayVisible = {};

async function _toggleExpertOverlay(fileId, btn) {
    _expertOverlayVisible[fileId] = !_expertOverlayVisible[fileId];
    if (btn) btn.classList.toggle('active', _expertOverlayVisible[fileId]);

    if (_expertOverlayVisible[fileId] && !_expertAnnotCache[fileId]) {
        try {
            const r = await fetch(`/api/panorama/${fileId}/reference-annotations`);
            if (r.ok) _expertAnnotCache[fileId] = await r.json();
            else _expertAnnotCache[fileId] = [];
        } catch(e) { _expertAnnotCache[fileId] = []; }
    }

    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;
    const m = _getOPGMapping(caseEl);
    if (!m) return;

    if (_expertOverlayVisible[fileId]) {
        // Clear overlay first, then redraw GT + expert bboxes
        _refreshOPGForActiveCrop(fileId);
        // Re-get mapping after refresh (canvas was cleared and redrawn)
        const m2 = _getOPGMapping(caseEl, true);
        if (!m2) return;
        const anns = _expertAnnotCache[fileId] || [];
        for (const ea of anns) {
            if (!ea.bbox_pct || ea.type !== 'child_bbox') continue;
            const bp = ea.bbox_pct;
            const x1 = m2.tx(bp.x1 * m2.img.naturalWidth), y1 = m2.ty(bp.y1 * m2.img.naturalHeight);
            const x2 = m2.tx(bp.x2 * m2.img.naturalWidth), y2 = m2.ty(bp.y2 * m2.img.naturalHeight);
            const color = YOLO_COLORS[ea.label] || 'rgba(245,158,11,0.9)';
            // Source badge: green for manual, orange for override
            const srcColor = (ea.source === 'manual_crop' || ea.source === 'manual_contour')
                ? 'rgba(34,197,94,0.95)' : 'rgba(245,158,11,0.95)';
            const srcTag = ea.source === 'bbox_override' ? '✎ resize'
                : ea.source === 'manual_contour' ? '✎ контур'
                : '✎ добавлен';
            // Dashed bbox
            m2.ctx.setLineDash([6, 4]);
            m2.ctx.strokeStyle = color;
            m2.ctx.lineWidth = 2.5;
            m2.ctx.shadowColor = color;
            m2.ctx.shadowBlur = 6;
            m2.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            m2.ctx.setLineDash([]);
            m2.ctx.shadowBlur = 0;
            // Label (drawn BELOW bbox to avoid overlapping with Objects layer labels above)
            const eLabelY = y2 + 12;
            _drawLabelWithBg(m2.ctx, `${ea.label} ${srcTag}`, x1 + 2, eLabelY,
                {font:'bold 9px system-ui', color:'#fff', bg: srcColor.replace('0.95','0.85')});
        }
        if (anns.filter(a => a.type === 'child_bbox').length === 0) {
            // No expert annotations — show message
            m2.ctx.font = '12px system-ui';
            m2.ctx.fillStyle = 'rgba(148,163,184,0.7)';
            m2.ctx.fillText('Нет экспертных правок bbox', 10, 20);
        }
    } else {
        _refreshOPGForActiveCrop(fileId);
    }
}

/** Draw all children grouped by FDI on the OPG overlay canvas. */
function _drawGroupedChildrenOnOPG(fileId, caseEl, mode) {
    const state = _carouselState[fileId];
    if (!state || !state.cards) return;
    const m = _getOPGMapping(caseEl);
    if (!m) return;
    const { ctx, w, h } = m;

    // Don't clear — caller manages clearing

    for (const card of state.cards) {
        if (!card.bbox || card.noDet) continue;

        if (mode === 'crops' || mode === 'all') {
            // Draw parent crop bbox (thin, subtle)
            const b = card.bbox;
            const x1 = m.tx(b.x1), y1 = m.ty(b.y1);
            const x2 = m.tx(b.x2), y2 = m.ty(b.y2);

            ctx.save();
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(148,163,184,0.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
            ctx.setLineDash([]);

            // FDI label with background
            const fLabelY = y1 - 2 > 10 ? y1 - 2 : y1 + 10;
            _drawLabelWithBg(ctx, card.fdi, x1 + 2, fLabelY,
                {font:'7px system-ui', color:'rgba(148,163,184,0.95)', bg:'rgba(15,23,42,0.75)'});
            ctx.restore();
        }

        if (mode === 'all' && card.children.length > 0) {
            // Compute union bbox of all children
            let ux1 = Infinity, uy1 = Infinity, ux2 = -Infinity, uy2 = -Infinity;
            for (const ch of card.children) {
                ux1 = Math.min(ux1, ch.x1); uy1 = Math.min(uy1, ch.y1);
                ux2 = Math.max(ux2, ch.x2); uy2 = Math.max(uy2, ch.y2);
            }

            // Group container (gray dashed)
            const gx1 = m.tx(ux1) - 2, gy1 = m.ty(uy1) - 2;
            const gx2 = m.tx(ux2) + 2, gy2 = m.ty(uy2) + 2;
            ctx.save();
            ctx.setLineDash([2, 2]);
            ctx.strokeStyle = 'rgba(156,163,175,0.4)';
            ctx.lineWidth = 1;
            ctx.strokeRect(gx1, gy1, gx2 - gx1, gy2 - gy1);
            ctx.setLineDash([]);

            // Group label with background
            const gLabelY = gy1 - 2 > 10 ? gy1 - 2 : gy1 + 10;
            _drawLabelWithBg(ctx, `${card.fdi} (${card.children.length})`, gx1 + 2, gLabelY,
                {font:'bold 8px system-ui', color:'rgba(200,210,220,0.95)', bg:'rgba(15,23,42,0.8)'});
            ctx.restore();

            // Individual children
            for (const ch of card.children) {
                const cx1 = m.tx(ch.x1), cy1 = m.ty(ch.y1);
                const cw = m.tx(ch.x2) - cx1, chh = m.ty(ch.y2) - cy1;
                const color = YOLO_COLORS[ch.cls] || 'rgba(255,255,255,0.5)';

                ctx.save();
                ctx.fillStyle = color.replace('0.95', '0.15').replace('0.9', '0.15');
                ctx.fillRect(cx1, cy1, cw, chh);
                if (ch._manual) {
                    ctx.setLineDash([3, 2]);
                }
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(cx1, cy1, cw, chh);
                ctx.setLineDash([]);
                ctx.restore();
            }
        }
    }
}

// ── FDI grid overlay — 32-slot arch-fit template from panorama_annotations ──

const _fdiGridCache = {};
const _fdiGridMode = {}; // fileId -> 'off' | 'occupied' | 'all'

async function _toggleFDIGridOverlay(fileId, btn) {
    const cur = _fdiGridMode[fileId] || 'off';
    const next = cur === 'off' ? 'occupied' : cur === 'occupied' ? 'all' : 'off';
    _fdiGridMode[fileId] = next;
    if (btn) {
        btn.classList.toggle('active', next !== 'off');
        btn.textContent = next === 'off' ? '🔲 FDI'
                       : next === 'occupied' ? '🔲 FDI: занятые'
                       : '🔲 FDI: все 32';
    }
    if (next !== 'off' && !_fdiGridCache[fileId]) {
        try {
            const r = await fetch(`/api/darwin/fdi-slots/${fileId}`);
            if (r.ok) _fdiGridCache[fileId] = await r.json();
            else _fdiGridCache[fileId] = {slots: []};
        } catch(e) { _fdiGridCache[fileId] = {slots: []}; }
    }
    _drawFDIGridOnOPG(fileId);
}
window._toggleFDIGridOverlay = _toggleFDIGridOverlay;

function _drawFDIGridOnOPG(fileId) {
    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;
    const m = _getOPGMapping(caseEl);
    if (!m) return;
    const mode = _fdiGridMode[fileId] || 'off';
    const data = _fdiGridCache[fileId];
    if (mode === 'off' || !data || !data.slots) {
        // Redraw whatever else was showing (respects active crop + children view)
        if (typeof _refreshOPGChildrenOverlay === 'function') _refreshOPGChildrenOverlay(fileId);
        return;
    }
    // Redraw base first, then grid on top
    if (typeof _refreshOPGChildrenOverlay === 'function') _refreshOPGChildrenOverlay(fileId);
    const m2 = _getOPGMapping(caseEl, true);
    if (!m2) return;
    const ctx = m2.ctx;
    const W = m2.img.naturalWidth;
    const H = m2.img.naturalHeight;

    for (const s of data.slots) {
        if (mode === 'occupied' && !s.occupied) continue;
        const bp = s.bbox_pct;
        // bbox_pct stored in percent of native image dimensions
        const x1 = m2.tx(bp.x / 100 * W);
        const y1 = m2.ty(bp.y / 100 * H);
        const x2 = m2.tx((bp.x + bp.w) / 100 * W);
        const y2 = m2.ty((bp.y + bp.h) / 100 * H);
        const w = x2 - x1, h = y2 - y1;

        ctx.save();
        if (s.occupied) {
            ctx.strokeStyle = 'rgba(16,185,129,0.95)';  // emerald — green for occupied
            ctx.fillStyle = 'rgba(16,185,129,0.08)';
            ctx.lineWidth = 1.8;
        } else {
            ctx.strokeStyle = 'rgba(148,163,184,0.75)';  // slate — grey for empty
            ctx.fillStyle = 'rgba(148,163,184,0.04)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
        }
        ctx.fillRect(x1, y1, w, h);
        ctx.strokeRect(x1, y1, w, h);
        ctx.setLineDash([]);
        // Label
        const labelColor = s.occupied ? '#6ee7b7' : '#cbd5e1';
        const labelBg = s.occupied ? 'rgba(16,185,129,0.88)' : 'rgba(71,85,105,0.9)';
        const lY = y1 + 11;
        _drawLabelWithBg(ctx, s.fdi, x1 + 3, lY,
            {font: 'bold 9px system-ui', color: '#fff', bg: labelBg});
        ctx.restore();
    }
}

/** Toggle OPG children view: OFF → crops → all → OFF */
function _toggleOPGChildrenView(fileId, btn) {
    const state = _carouselState[fileId];
    if (!state) return;

    // Cycle mode
    const current = state.opgChildrenMode || 'off';
    const next = current === 'off' ? 'crops' : current === 'crops' ? 'all' : 'off';
    state.opgChildrenMode = next;

    // Update button text — keep '🦷 Объекты' prefix across all states
    if (next === 'off') {
        btn.textContent = '🦷 Объекты';
        btn.classList.remove('active');
    } else if (next === 'crops') {
        btn.textContent = '🦷 Объекты: кропы';
        btn.classList.add('active');
    } else {
        btn.textContent = '🦷 Объекты: все';
        btn.classList.add('active');
    }

    // Redraw OPG overlay
    _refreshOPGChildrenOverlay(fileId);
}

/** Refresh OPG children overlay (called after toggle or annotation change). */
function _refreshOPGChildrenOverlay(fileId) {
    const state = _carouselState[fileId];
    if (!state) return;
    const mode = state.opgChildrenMode || 'off';
    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;

    if (mode === 'off') {
        // If there's an active card, redraw its highlight; otherwise clear
        if (state.activeFdi) {
            const card = state.cards.find(c => c.fdi === state.activeFdi);
            if (card && card.bbox) {
                _drawCropBboxOnOPG(fileId, state.activeFdi, card, caseEl);
            } else {
                _highlightToothOnOPG(fileId, state.activeFdi, caseEl);
            }
        } else {
            const m = _getOPGMapping(caseEl);
            if (m) m.ctx.clearRect(0, 0, m.w, m.h);
        }
    } else {
        // Clear and redraw children overlay
        const m = _getOPGMapping(caseEl);
        if (m) m.ctx.clearRect(0, 0, m.w, m.h);

        _drawGroupedChildrenOnOPG(fileId, caseEl, mode);

        // If there's an active card, also draw its specific highlight on top
        if (state.activeFdi) {
            const card = state.cards.find(c => c.fdi === state.activeFdi);
            if (card && card.bbox) {
                // Draw active crop bbox (orange, on top of the grouped overlay)
                const b = card.bbox;
                const x1 = m.tx(b.x1), y1 = m.ty(b.y1);
                const x2 = m.tx(b.x2), y2 = m.ty(b.y2);
                m.ctx.save();
                m.ctx.setLineDash([6, 3]);
                m.ctx.strokeStyle = 'rgba(245,158,11,0.9)';
                m.ctx.lineWidth = 2;
                m.ctx.shadowColor = 'rgba(245,158,11,0.4)';
                m.ctx.shadowBlur = 8;
                m.ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
                m.ctx.setLineDash([]);
                const aLabelY = y1 - 4 > 12 ? y1 - 4 : y1 + 13;
                _drawLabelWithBg(m.ctx, card.fdi, x1 + 4, aLabelY,
                    {font:'bold 9px system-ui', color:'#fff', bg:'rgba(245,158,11,0.85)'});
                m.ctx.restore();
            }
        }

        // Draw GT status badges on top of children overlay
        _drawGTStatusOnOPG(fileId, caseEl);
    }
}


// ══════════════════════════════════════════════════════════════════════════
// ██  CORRECTION MODE — click-to-assign FDI↔detection
// ══════════════════════════════════════════════════════════════════════════
// Flow: click GT cell → correction mode → click detection on OPG → save
// Corrections persist to DB and improve future matching.

const _correctionState = { active: false, fileId: null, fdi: null, caseEl: null };

function _enterCorrectionMode(fileId, fdi, caseEl) {
    // Exit previous if any
    if (_correctionState.active) _exitCorrectionMode();

    // Close any open status picker — correction mode takes priority
    if (typeof _pickerEl !== 'undefined' && _pickerEl && _pickerEl.classList.contains('open')) {
        _pickerEl.classList.remove('open');
    }

    _correctionState.active = true;
    _correctionState.fileId = fileId;
    _correctionState.fdi = fdi;
    _correctionState.caseEl = caseEl;

    // Visual: pulse the selected cell, dim others
    caseEl.querySelectorAll('.arena-cell').forEach(c => c.classList.remove('correction-selected'));
    caseEl.querySelectorAll(`.arena-cell[data-fdi="${fdi}"]`).forEach(c => {
        c.classList.add('correction-selected');
    });

    // Enable pointer-events on canvas so clicks register
    const canvas = document.getElementById(`arena-opg-canvas-${fileId}`);
    if (canvas) canvas.style.pointerEvents = 'auto';

    // Show correction banner
    _showCorrectionBanner(fileId, fdi, caseEl);

    // Draw all detections as clickable targets on OPG
    _loadYoloDetections(fileId).then(() => _drawCorrectionTargets(fileId, fdi, caseEl));
}

function _exitCorrectionMode() {
    if (!_correctionState.active) return;
    const { caseEl, fileId } = _correctionState;
    if (caseEl) {
        caseEl.querySelectorAll('.correction-selected').forEach(c => c.classList.remove('correction-selected'));
        _clearToothHighlight(caseEl);
        // Remove banner
        const banner = caseEl.querySelector('.correction-banner');
        if (banner) banner.remove();
        // Restore pointer-events:none on canvas
        const canvas = document.getElementById(`arena-opg-canvas-${fileId}`);
        if (canvas) canvas.style.pointerEvents = 'none';
    }
    _correctionState.active = false;
    _correctionState.fileId = null;
    _correctionState.fdi = null;
    _correctionState.caseEl = null;
}

function _showCorrectionBanner(fileId, fdi, caseEl) {
    // Remove old banner
    const old = caseEl.querySelector('.correction-banner');
    if (old) old.remove();

    const data = _yoloCache[fileId];
    const fdiMap = data ? (data.fdi_map || {}) : {};
    const currentMatch = fdiMap[fdi];
    const isManual = data && data.manual_corrections && data.manual_corrections[fdi] !== undefined;

    const banner = document.createElement('div');
    banner.className = 'correction-banner';
    banner.style.cssText = `
        background:rgba(15,23,42,0.95); border:2px solid rgba(245,158,11,0.8);
        border-radius:6px; padding:6px 10px; display:flex; align-items:center; gap:8px;
        flex-wrap:wrap; font-size:11px; color:#e2e8f0; margin-top:6px;
    `;

    const statusText = currentMatch
        ? `${fdi} → det #${currentMatch.join(',')}${isManual ? ' (ручная)' : ' (авто)'}`
        : `${fdi} → нет совпадения`;

    banner.innerHTML = `
        <span style="font-weight:700;color:#f59e0b;">✎ Коррекция</span>
        <span>${statusText}</span>
        <span style="color:#94a3b8;">| Кликните объект на снимке</span>
        <button onclick="_exitCorrectionMode()" style="
            background:rgba(239,68,68,0.8); border:none; color:#fff; padding:2px 8px;
            border-radius:3px; cursor:pointer; font-size:10px; margin-left:auto;
        ">Esc ✕</button>
        ${currentMatch ? `<button onclick="_saveFdiCorrection('unassign')" style="
            background:rgba(100,116,139,0.6); border:none; color:#fff; padding:2px 8px;
            border-radius:3px; cursor:pointer; font-size:10px;
        ">Отвязать</button>` : ''}
    `;

    // Insert BELOW toolbar (between filter buttons and quality badges), NOT on top of OPG
    const toolbar = caseEl.querySelector(`#arena-opg-toolbar-${fileId}`) || caseEl.querySelector('.arena-opg-toolbar');
    if (toolbar) {
        toolbar.after(banner);
    } else {
        // Fallback: after OPG wrap
        const opg = caseEl.querySelector('.arena-opg-col');
        if (opg) opg.appendChild(banner);
    }
}

function _drawCorrectionTargets(fileId, fdi, caseEl) {
    const data = _yoloCache[fileId];
    if (!data) return;
    const m = _getOPGMapping(caseEl);
    if (!m) return;
    const { ctx, w, h } = m;
    ctx.clearRect(0, 0, w, h);

    const fdiMap = data.fdi_map || {};
    const currentIdxs = new Set(fdiMap[fdi] || []);

    // Light overlay
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, 0, w, h);

    // Draw ALL detections as clickable targets
    data.detections.forEach(det => {
        const dx1 = m.tx(det.x1), dy1 = m.ty(det.y1);
        const dx2 = m.tx(det.x2), dy2 = m.ty(det.y2);
        const pad = 4;
        const isCurrent = currentIdxs.has(det.idx);

        // Cutout for each detection
        ctx.save();
        _rrect(ctx, dx1 - pad, dy1 - pad, dx2 - dx1 + pad*2, dy2 - dy1 + pad*2, 4);
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fill();
        ctx.restore();

        // Border: green for current match, cyan for others
        ctx.save();
        if (isCurrent) {
            ctx.strokeStyle = 'rgba(16,185,129,0.95)';
            ctx.lineWidth = 3;
            ctx.shadowColor = 'rgba(16,185,129,0.6)';
        } else {
            ctx.strokeStyle = 'rgba(56,189,248,0.8)';
            ctx.lineWidth = 2;
            ctx.shadowColor = 'rgba(56,189,248,0.4)';
        }
        ctx.shadowBlur = 10;
        _rrect(ctx, dx1 - pad, dy1 - pad, dx2 - dx1 + pad*2, dy2 - dy1 + pad*2, 4);
        ctx.stroke();
        ctx.restore();

        // Check if this detection is assigned to another FDI
        let assignedTo = null;
        for (const [f, idxs] of Object.entries(fdiMap)) {
            if (idxs.includes(det.idx)) { assignedTo = f; break; }
        }

        // Label with detection info
        ctx.save();
        ctx.font = 'bold 10px system-ui,sans-serif';
        const lbl = isCurrent
            ? `#${det.idx} ${det.cls} ${(det.conf*100).toFixed(0)}% — ТЕКУЩИЙ`
            : assignedTo
                ? `#${det.idx} ${det.cls} ${(det.conf*100).toFixed(0)}% → ${assignedTo}`
                : `#${det.idx} ${det.cls} ${(det.conf*100).toFixed(0)}%`;
        const tm = ctx.measureText(lbl);
        const lx = Math.max(1, Math.min(dx1, w - tm.width - 6));
        const ly = Math.max(14, dy1 - pad - 4);
        ctx.fillStyle = isCurrent ? 'rgba(16,185,129,0.9)' : 'rgba(0,0,0,0.85)';
        _rrect(ctx, lx - 3, ly - 11, tm.width + 6, 14, 3); ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillText(lbl, lx, ly);
        ctx.restore();
    });

    // FDI badge
    ctx.save(); ctx.font = 'bold 14px system-ui,sans-serif';
    const badge = `${fdi} — выберите объект`;
    const btm = ctx.measureText(badge);
    ctx.fillStyle = 'rgba(245,158,11,0.9)';
    _rrect(ctx, 6, 6, btm.width + 12, 22, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(badge, 12, 22); ctx.restore();
}

async function _saveFdiCorrection(action, detIdx) {
    const { fileId, fdi, caseEl } = _correctionState;
    if (!fileId || !fdi) return;

    const body = { file_id: parseInt(fileId), fdi, action };
    if (action === 'assign' && detIdx !== undefined) {
        body.detection_idx = detIdx;
        // Get label from YOLO data
        const data = _yoloCache[fileId];
        if (data) {
            const det = data.detections.find(d => d.idx === detIdx);
            if (det) body.label = det.cls;
        }
    }

    try {
        const resp = await fetch('/api/darwin/arena/fdi-correction', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(body),
        });
        const result = await resp.json();
        if (result.ok) {
            // Invalidate cache and reload
            delete _yoloCache[fileId];
            _exitCorrectionMode();
            // Reload YOLO data and re-render quality
            await _loadYoloDetections(fileId);
            // Remove and rebuild quality bar
            if (caseEl) {
                const oldBar = caseEl.querySelector('.quality-bar');
                if (oldBar) oldBar.remove();
                _renderQualitySummary(fileId, _yoloCache[fileId]);
            }
            // Flash confirmation
            _flashConfirmation(caseEl, action === 'unassign'
                ? `${fdi} отвязан`
                : `${fdi} → #${detIdx} сохранено`);
        } else {
            alert('Ошибка: ' + (result.error || 'unknown'));
        }
    } catch (e) {
        alert('Ошибка сети: ' + e.message);
    }
}

function _flashConfirmation(caseEl, text) {
    const flash = document.createElement('div');
    flash.style.cssText = `
        position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:10000;
        background:rgba(16,185,129,0.95); color:#fff; padding:12px 24px; border-radius:8px;
        font-size:14px; font-weight:700; box-shadow:0 8px 32px rgba(0,0,0,0.4);
        animation: fadeOut 1.5s ease-in-out forwards;
    `;
    flash.textContent = text;
    document.body.appendChild(flash);
    setTimeout(() => flash.remove(), 1600);
}

// Add CSS for correction mode + flash animation
(function _addCorrectionCSS() {
    if (document.getElementById('correction-css')) return;
    const style = document.createElement('style');
    style.id = 'correction-css';
    style.textContent = `
        .correction-selected {
            outline: 2px solid #f59e0b !important;
            outline-offset: -1px;
            animation: correctionPulse 1s infinite;
        }
        @keyframes correctionPulse {
            0%, 100% { outline-color: rgba(245,158,11,0.9); }
            50% { outline-color: rgba(245,158,11,0.3); }
        }
        @keyframes fadeOut {
            0% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
            70% { opacity: 1; transform: translate(-50%,-50%) scale(1); }
            100% { opacity: 0; transform: translate(-50%,-50%) scale(0.9); }
        }
    `;
    document.head.appendChild(style);
})();

// Canvas click handler for correction mode
document.addEventListener('click', function(e) {
    if (!_correctionState.active) return;

    // Check if click is on the OPG canvas
    const canvas = e.target.closest('canvas');
    if (!canvas || !_correctionState.caseEl) return;
    if (!_correctionState.caseEl.contains(canvas)) return;

    const data = _yoloCache[_correctionState.fileId];
    if (!data) return;

    const m = _getOPGMapping(_correctionState.caseEl);
    if (!m) return;

    // Get click coords in image space
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) / rect.width * canvas.width;
    const cy = (e.clientY - rect.top) / rect.height * canvas.height;

    // Find closest detection to click
    let bestDet = null, bestDist = Infinity;
    data.detections.forEach(det => {
        const dx1 = m.tx(det.x1), dy1 = m.ty(det.y1);
        const dx2 = m.tx(det.x2), dy2 = m.ty(det.y2);
        // Check if click is inside bbox (with padding)
        const pad = 8;
        if (cx >= dx1 - pad && cx <= dx2 + pad && cy >= dy1 - pad && cy <= dy2 + pad) {
            const dist = Math.abs(cx - (dx1+dx2)/2) + Math.abs(cy - (dy1+dy2)/2);
            if (dist < bestDist) {
                bestDist = dist;
                bestDet = det;
            }
        }
    });

    if (bestDet) {
        _saveFdiCorrection('assign', bestDet.idx);
    }
});

// GT cell click handler → enter correction mode
// ONLY via dedicated correction button or Ctrl+Click — normal click opens tooth picker
// (uses event delegation, only on GT row = first .arena-formula-row)
document.addEventListener('click', function(e) {
    // Don't interfere with correction canvas clicks
    if (e.target.closest('canvas')) return;
    // Don't interfere with buttons
    if (e.target.closest('button, a, select, input, .qc-badge')) return;

    const cell = e.target.closest('.arena-cell[data-fdi]');
    if (!cell) return;

    // Only trigger on GT row (first formula row in the case)
    const formulaRow = cell.closest('.arena-formula-row');
    if (!formulaRow) return;
    const caseEl = cell.closest('.arena-case');
    if (!caseEl) return;

    // Check if this is the GT row (first .arena-formula-row child)
    const allRows = caseEl.querySelectorAll('.arena-formula-row');
    if (allRows.length === 0 || allRows[0] !== formulaRow) return;

    // ── Normal click opens tooth picker (handled by _toothCellMouseDown) ──
    // ── Only Ctrl+Click enters YOLO correction mode ──
    if (!e.ctrlKey && !e.metaKey) return;

    const fileId = caseEl.id.replace('arena-case-', '');
    const fdi = cell.dataset.fdi;

    // Toggle: if already in correction mode for same cell, exit
    if (_correctionState.active && _correctionState.fdi === fdi && _correctionState.fileId === fileId) {
        _exitCorrectionMode();
        return;
    }

    _loadYoloDetections(fileId).then(() => _enterCorrectionMode(fileId, fdi, caseEl));
});

// Escape key exits correction mode
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _correctionState.active) {
        _exitCorrectionMode();
    }
});

// ═══ Arena algorithm detail panel ═══

function showArenaAlgoDetail(fileId, codename, labelEl) {
    const panel = document.getElementById(`arena-detail-${fileId}`);
    if (!panel) return;

    // Highlight selected row
    const formulas = document.getElementById(`arena-formulas-${fileId}`);
    if (formulas) {
        formulas.querySelectorAll('.arena-formula-row').forEach(r => r.style.outline = '');
        const row = labelEl.closest('.arena-formula-row');
        if (row) row.style.outline = '1.5px solid var(--blue)';
    }

    // Get algorithm data from the row
    const row = labelEl.closest('.arena-formula-row');
    const sub = row?.querySelector('.row-sub')?.textContent || '';
    const scoreEl = row?.querySelector('.row-score');
    const score = scoreEl?.textContent || '—';

    // Compare with GT to show differences
    const gt = arenaGroundTruth[fileId] || {};
    const upper = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
    const lower = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
    const all = [...upper, ...lower];

    // Extract algo formula from cell classes
    let diffs = [];
    row?.querySelectorAll('.arena-cell').forEach(cell => {
        const fdi = cell.dataset.fdi;
        if (!fdi) return;
        const gtRaw = gt[fdi] || '';
        const gtStatus = gtRaw.includes(':') ? gtRaw.split(':')[0] : gtRaw;
        if (!gtStatus) return;
        // Get algo status from cell classes
        const algoStatus = ['present','missing','implant','impl_fixture','impl_healing','impl_restored',
            'crowned','crown','restored','filling','caries','endo','root','impacted','bridge','bridge_pontic','uncertain']
            .find(s => cell.classList.contains(s)) || '';
        const norm = s => {
            if (['impl_fixture','impl_cover','impl_healing','impl_abutment','impl_temp_abut','impl_provisional','impl_restored','implant'].includes(s)) return 'implant_group';
            if (['present','natural','caries','endo','restored','filling'].includes(s)) return 'tooth_present';
            if (s === 'crown') return 'crowned';
            return s;
        };
        if (norm(algoStatus) !== norm(gtStatus)) {
            diffs.push({fdi, got: arenaStatusIcon(algoStatus) || '—', exp: arenaStatusIcon(gtStatus)});
        }
    });

    let diffHtml = '';
    if (diffs.length === 0) {
        diffHtml = '<div style="color:var(--green);margin-top:8px">Полное совпадение с эталоном</div>';
    } else {
        diffHtml = `<div class="adp-diff"><div style="font-size:10px;color:var(--text-dim);margin-bottom:4px">Расхождения (${diffs.length}):</div>`;
        for (const d of diffs) {
            diffHtml += `<div class="adp-diff-item"><span class="fdi">${d.fdi}</span><span class="got">${d.got}</span>→<span class="exp">${d.exp}</span></div>`;
        }
        diffHtml += '</div>';
    }

    panel.innerHTML = `
        <h4>${codename}</h4>
        <div class="adp-meta">${sub}</div>
        <div style="font-size:18px;font-weight:700;color:${scoreEl?.style.color || 'var(--text)'}">${score}</div>
        ${diffHtml}
    `;
}
