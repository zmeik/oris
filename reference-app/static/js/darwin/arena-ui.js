// arena-ui.js — Apply status, rebuild cells, mismatch, OPG controls, YOLO quality, hover
// Extracted from darwin_lab.html lines 13524–14591
// ═══════════════════════════════════════════════════════════════

function _applyToothStatus(value, surfaces) {
    if (!_pickerTarget) return;
    const { fileId, fdi, cellEl, batch } = _pickerTarget;

    if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
    if (!arenaGTSurfaces[fileId]) arenaGTSurfaces[fileId] = {};

    // Apply to all teeth in batch (or single tooth)
    const targets = batch || [{fdi, cellEl}];
    for (const t of targets) {
        arenaGroundTruth[fileId][t.fdi] = surfaces ? `${value}:${surfaces}` : value;
        arenaGTSurfaces[fileId][t.fdi] = surfaces;
        _rebuildCell(t.cellEl, t.fdi, value, surfaces);
    }

    // Auto-bridge if checkbox checked
    if (batch && batch.length > 1) _autoBridgeBatch(fileId, batch);

    // Save to localStorage + DB
    localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
    localStorage.setItem('darwin_gt_surfaces', JSON.stringify(arenaGTSurfaces));
    _debouncedSaveGT(fileId);

    // Update GT filled count with unmarked teeth tooltip (count GT + rootData annotations)
    const _rd = arenaRootData[fileId] || {};
    const ALL32 = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8',
                   '4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
    const filled = ALL32.filter(f => arenaGroundTruth[fileId]?.[f] || (_rd[f] && Object.keys(_rd[f]).length > 0)).length;
    const row = cellEl.closest('.arena-formula-row');
    const sub = row.querySelector('.row-sub');
    if (sub) {
        if (filled >= 32) {
            sub.innerHTML = '✓ Полная разметка';
            sub.title = '';
        } else {
            const umTeeth = _getUnmarkedTeethList(fileId);
            sub.innerHTML = `Разметка ${filled}/32` + (umTeeth ? ` <div style="color:rgba(239,68,68,0.8);font-size:8px;line-height:1.2">нет: ${umTeeth}</div>` : '');
            sub.title = '';
        }
    }
    // Update GT confirm button state
    const gtBtn = document.getElementById(`gt-btn-${fileId}`);
    if (gtBtn) {
        if (filled >= 32) {
            gtBtn.classList.add('ready');
            gtBtn.title = 'Save ground truth and recompute algorithms';
            gtBtn.onclick = () => arenaConfirmGT(fileId);
        } else {
            gtBtn.classList.remove('ready');
            gtBtn.title = `Отмечено ${filled}/32 зубов — отметьте все для сохранения`;
            gtBtn.onclick = null;
        }
    }

    // Close picker
    _pickerEl.classList.remove('open');
    _pickerTarget = null;

    // Re-render if bridges were created (save first to avoid race condition)
    if (batch && batch.length > 1 && document.getElementById('tp-bridge-check')?.checked) {
        _saveGTThenReload(fileId);
    } else {
        recomputeArenaMismatches(fileId);
    }
}

// Apply layered tooth status (multiple layers: endo+post+crown etc.)
function _applyToothLayered(layers) {
    if (!_pickerTarget) return;
    const { fileId, fdi, cellEl, batch } = _pickerTarget;

    if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
    if (!arenaGTSurfaces[fileId]) arenaGTSurfaces[fileId] = {};

    // Validate layer compatibility before saving
    layers = _cleanIncompatibleLayers(layers);
    const encoded = encodeToothLayers(layers);
    const primary = layersPrimaryStatus(layers);
    // Combine all surfaces across layers for visual
    const allSurfs = layers.map(l => l.surfaces).join('');
    const uniqueSurfs = [...new Set(allSurfs.split(''))].join('');

    const targets = batch || [{fdi, cellEl}];
    for (const t of targets) {
        arenaGroundTruth[fileId][t.fdi] = encoded;
        arenaGTSurfaces[fileId][t.fdi] = uniqueSurfs;
        _rebuildCellLayered(t.cellEl, t.fdi, layers);
    }

    // Auto-bridge if checkbox checked
    if (batch && batch.length > 1) _autoBridgeBatch(fileId, batch);

    localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
    localStorage.setItem('darwin_gt_surfaces', JSON.stringify(arenaGTSurfaces));
    _debouncedSaveGT(fileId);

    const _rd2 = arenaRootData[fileId] || {};
    const ALL32b = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8',
                    '4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
    const filled = ALL32b.filter(f => arenaGroundTruth[fileId]?.[f] || (_rd2[f] && Object.keys(_rd2[f]).length > 0)).length;
    const row = cellEl.closest('.arena-formula-row');
    const sub = row.querySelector('.row-sub');
    if (sub) {
        if (filled >= 32) {
            sub.innerHTML = '✓ Полная разметка';
        } else {
            const umTeeth2 = _getUnmarkedTeethList(fileId);
            sub.innerHTML = `Разметка ${filled}/32` + (umTeeth2 ? ` <span style="color:rgba(239,68,68,0.8);font-size:9px">· нет: ${umTeeth2}</span>` : '');
        }
    }
    // Update GT confirm button state
    const gtBtn = document.getElementById(`gt-btn-${fileId}`);
    if (gtBtn) {
        if (filled >= 32) {
            gtBtn.classList.add('ready');
            gtBtn.title = 'Save ground truth and recompute algorithms';
            gtBtn.onclick = () => arenaConfirmGT(fileId);
        } else {
            gtBtn.classList.remove('ready');
            gtBtn.title = `Отмечено ${filled}/32 зубов — отметьте все для сохранения`;
            gtBtn.onclick = null;
        }
    }

    _pickerEl.classList.remove('open');
    _pickerEl.classList.remove('layer-add-mode');
    _layerAddMode = false;
    _pickerTarget = null;

    // Refresh objects panel on affected crop cards
    for (const t of targets) {
        if (typeof _refreshCropObjPanel === 'function') _refreshCropObjPanel(fileId, t.fdi);
    }

    if (batch && batch.length > 1 && document.getElementById('tp-bridge-check')?.checked) {
        _saveGTThenReload(fileId);
    } else {
        recomputeArenaMismatches(fileId);
    }
}

function _rebuildCellLayered(cellEl, fdi, layers) {
    const primary = layersPrimaryStatus(layers);
    const allSurfs = layers.map(l => l.surfaces).join('');
    const uniqueSurfs = [...new Set(allSurfs.split(''))].join('');
    const sc = {
        v: uniqueSurfs.includes('v') ? ' on' : '',
        m: uniqueSurfs.includes('m') ? ' on' : '',
        o: uniqueSurfs.includes('o') ? ' on' : '',
        d: uniqueSurfs.includes('d') ? ' on' : '',
        l: uniqueSurfs.includes('l') ? ' on' : ''
    };
    const svg = toothSvg(34, sc, fdi);
    const abbr = layersAbbreviation(layers);
    const tip = layers.map(l => `${l.status}${l.surfaces ? ':'+l.surfaces : ''}`).join(' + ');
    cellEl.className = `arena-cell ${primary}`;
    if (layers.length > 1) cellEl.classList.add('layered');
    const fileId = cellEl.dataset.file;
    const note = fileId ? ((arenaToothNotes[fileId] || {})[fdi] || '') : '';
    const noteSev = _getNoteSeverity(note);
    const noteDot = note ? `<span class="note-dot${noteSev ? ' severity-'+noteSev : ''}" title="${note.replace(/"/g,'&quot;')}"></span>` : '';
    const noteVis = note ? _getNoteVisuals(note, fdi) : { arrows: '', classes: '' };
    if (noteVis.classes) noteVis.classes.split(' ').forEach(c => cellEl.classList.add(c));
    const rawStatus = fileId ? ((arenaGroundTruth[fileId] || {})[fdi] || '') : '';
    const tipFull = fileId ? richTooltip(fdi, rawStatus, fileId) : `${fdi}: ${tip}`;
    // Root SVG
    const rootHtml = rootSvg(fdi, primary, null, fileId, rawStatus);
    const hasEndo = rawStatus.split('+').some(p => p.split(':')[0] === 'endo');
    const rootClick = hasEndo ? `onclick="event.stopPropagation();_openRootPicker('${fileId}','${fdi}',this)" style="cursor:pointer"` : '';
    // Implant count badge ×N
    const implCount2 = fileId ? ((arenaRootData[fileId] || {})[fdi] || {}).implant_count : 0;
    const implBadge2 = (implCount2 && implCount2 > 1) ? `<span class="impl-count-badge" title="${implCount2} имплантата в этой позиции">×${implCount2}</span>` : '';
    cellEl.innerHTML = `<span class="cell-num">${fdi.replace('.','')}</span><span class="note-arrows-wrap">${svg}${noteVis.arrows}</span><span class="cell-abbr">${abbr}</span>` +
        (rootHtml ? `<span class="cell-root" ${rootClick}>${rootHtml}</span>` : '') + noteDot + implBadge2;
    cellEl.title = tipFull;
}

function _rebuildCell(cellEl, fdi, status, surfaces) {
    const surfs = surfaces || '';
    const sc = {
        v: surfs.includes('v') ? ' on' : '',
        m: surfs.includes('m') ? ' on' : '',
        o: surfs.includes('o') ? ' on' : '',
        d: surfs.includes('d') ? ' on' : '',
        l: surfs.includes('l') ? ' on' : ''
    };
    const svg = toothSvg(34, sc, fdi);
    const abbr = surfaceAbbr(status, surfs);
    const tip = surfaceTooltip(fdi, status, surfs);
    cellEl.className = `arena-cell ${status}`;
    const fileId = cellEl.dataset.file;
    const note = fileId ? ((arenaToothNotes[fileId] || {})[fdi] || '') : '';
    const noteSev = _getNoteSeverity(note);
    const noteDot = note ? `<span class="note-dot${noteSev ? ' severity-'+noteSev : ''}" title="${note.replace(/"/g,'&quot;')}"></span>` : '';
    const noteVis = note ? _getNoteVisuals(note, fdi) : { arrows: '', classes: '' };
    if (noteVis.classes) noteVis.classes.split(' ').forEach(c => cellEl.classList.add(c));
    const rawStatus = fileId ? ((arenaGroundTruth[fileId] || {})[fdi] || '') : '';
    const tipFull = fileId ? richTooltip(fdi, rawStatus, fileId) : tip;
    // Root SVG
    const rootHtml2 = rootSvg(fdi, status, null, fileId, rawStatus);
    const hasEndo2 = status === 'endo' || (rawStatus && rawStatus.split('+').some(p => p.split(':')[0] === 'endo'));
    const rootClick2 = hasEndo2 ? `onclick="event.stopPropagation();_openRootPicker('${fileId}','${fdi}',this)" style="cursor:pointer"` : '';
    // Implant count badge ×N
    const implCount = fileId ? ((arenaRootData[fileId] || {})[fdi] || {}).implant_count : 0;
    const implBadge = (implCount && implCount > 1) ? `<span class="impl-count-badge" title="${implCount} имплантата в этой позиции">×${implCount}</span>` : '';
    cellEl.innerHTML = `<span class="cell-num">${fdi.replace('.','')}</span><span class="note-arrows-wrap">${svg}${noteVis.arrows}</span><span class="cell-abbr">${abbr}</span>` +
        (rootHtml2 ? `<span class="cell-root" ${rootClick2}>${rootHtml2}</span>` : '') + noteDot + implBadge;
    cellEl.title = tipFull;
}

function recomputeArenaMismatches(fileId) {
    const gt = arenaGroundTruth[fileId] || {};
    const container = document.getElementById(`arena-formulas-${fileId}`);
    if (!container) return;

    // Parse "caries:omd" → "caries"
    const parseStatus = s => s.includes(':') ? s.split(':')[0] : s;

    const norm = s => {
        s = parseStatus(s);
        if (['impl_fixture','impl_cover','impl_healing','impl_abutment','impl_temp_abut','impl_provisional','impl_restored','implant'].includes(s)) return 'implant_group';
        if (['present','natural','caries','endo','restored','filling'].includes(s)) return 'tooth_present';
        if (s === 'crown') return 'crowned';
        return s;
    };

    // For each non-ground-truth row
    container.querySelectorAll('.arena-formula-row:not(.ground-truth)').forEach(row => {
        let matches = 0, total = 0;
        row.querySelectorAll('.arena-cell').forEach(cell => {
            const fdi = cell.dataset.fdi;
            const gtStatus = gt[fdi] || '';
            if (!gtStatus) {
                cell.classList.remove('mismatch', 'match');
                return;
            }
            total++;
            // Get algo status from cell classes
            const algoStatus = ARENA_STATUS_CYCLE.find(s => s && cell.classList.contains(s)) || '';
            if (norm(algoStatus) === norm(gtStatus)) {
                cell.classList.add('match');
                cell.classList.remove('mismatch');
                matches++;
            } else {
                cell.classList.add('mismatch');
                cell.classList.remove('match');
            }
        });

        // Update score display
        const scoreEl = row.querySelector('.row-score');
        if (scoreEl && total > 0) {
            const pct = Math.round(matches / total * 100);
            const color = pct >= 70 ? 'var(--green)' : pct >= 40 ? 'var(--yellow)' : 'var(--red)';
            scoreEl.style.color = color;
            scoreEl.textContent = pct + '%';
        }
    });
}

// ═══ Arena OPG tools: zoom, pan, filter, segmentation toggle ═══

function arenaOPGZoom(e, wrap) {
    e.preventDefault();
    let z = parseFloat(wrap.dataset.zoom) || 1;
    z += e.deltaY < 0 ? 0.15 : -0.15;
    z = Math.max(0.5, Math.min(5, z));
    wrap.dataset.zoom = z;
    _arenaOPGTransform(wrap);
}

function arenaOPGFit(wrap) {
    wrap.dataset.zoom = 1; wrap.dataset.px = 0; wrap.dataset.py = 0;
    _arenaOPGTransform(wrap);
}

function arenaOPGPanStart(e, wrap) {
    if (e.button !== 0) return;
    // Disable pan during correction mode — clicks go to detection targets
    if (_correctionState && _correctionState.active) return;
    e.preventDefault();
    const startX = e.clientX, startY = e.clientY;
    const origPx = parseFloat(wrap.dataset.px)||0, origPy = parseFloat(wrap.dataset.py)||0;
    const onMove = (ev) => {
        wrap.dataset.px = origPx + (ev.clientX - startX);
        wrap.dataset.py = origPy + (ev.clientY - startY);
        _arenaOPGTransform(wrap);
    };
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp); };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

function _arenaOPGTransform(wrap) {
    const z = parseFloat(wrap.dataset.zoom)||1;
    const px = parseFloat(wrap.dataset.px)||0;
    const py = parseFloat(wrap.dataset.py)||0;
    const img = wrap.querySelector('img');
    if (img) img.style.transform = `scale(${z}) translate(${px/z}px, ${py/z}px)`;
    // Redraw EVERY canvas overlay after zoom/pan so all bboxes follow the X-ray.
    // The CSS transform changes img.getBoundingClientRect(), which is the input
    // to _getOPGMapping(); without redrawing, all bboxes/labels stay anchored to
    // the pre-zoom image position and visibly drift away from the teeth.
    const fileId = wrap.dataset.file;
    if (!fileId) return;
    const caseEl = wrap.closest('.arena-case') || wrap.closest('[id^="arena-case-"]');
    if (!caseEl) return;
    requestAnimationFrame(() => {
        const state = _carouselState[fileId];
        const childMode = (state && state.opgChildrenMode) || 'off';
        if (childMode !== 'off') {
            // Objects overlay (crops / all): _refreshOPGChildrenOverlay clears + redraws
            // grouped children + the active crop highlight on top.
            if (typeof _refreshOPGChildrenOverlay === 'function') {
                _refreshOPGChildrenOverlay(fileId);
            }
        } else {
            // No object overlay: redraw active crop highlight + GT status badges.
            if (typeof _refreshOPGForActiveCrop === 'function') {
                _refreshOPGForActiveCrop(fileId);
            } else if (state && state.activeFdi) {
                _highlightToothOnOPG(fileId, state.activeFdi, caseEl);
            }
        }
        // Expert overlay sits on top of everything else — re-paint it last.
        if (typeof _expertOverlayVisible !== 'undefined'
            && _expertOverlayVisible[fileId]
            && typeof _redrawExpertAnnotations === 'function') {
            _redrawExpertAnnotations(fileId, caseEl);
        }
    });
}

// CSS-filter map for client-side OPG enhancement. The reference-app
// doesn't ship the full Pillow/numpy filter pipeline from production
// (/api/implant-assessment/<id>/filtered → CLAHE, etc.), so we apply
// equivalent CSS filters on the IMG element. They are not pixel-exact
// matches for true CLAHE/bone-window operators but give the reviewer
// the same "see more contrast / see bone better / invert" affordance
// that production exposes — instant, no round-trip.
const _OPG_CSS_FILTERS = {
    original:    '',
    clahe:       'contrast(1.55) brightness(1.05) saturate(0)',
    contrast:    'contrast(1.45) brightness(1.05)',
    bone_window: 'contrast(1.85) brightness(0.85) saturate(0)',
    inverted:    'invert(1) hue-rotate(180deg)',
};

function arenaOPGFilter(fileId, filter, btn) {
    const img = document.getElementById(`arena-opg-img-${fileId}`);
    if (!img) return;
    // Update active button (only among Original/CLAHE/Contrast/Bone/Invert —
    // not Objects / FDI / Segments / Expert which are toggles, not filters).
    const toolbar = btn.parentElement;
    toolbar.querySelectorAll('.opg-filter-btn').forEach(b => {
        const oc = b.getAttribute('onclick') || '';
        if (oc.includes('arenaOPGFilter(')) b.classList.remove('active');
    });
    btn.classList.add('active');
    // Apply the CSS filter — preserves the underlying /panorama/<id>/image
    // src so segmentation / objects overlays drawn on the canvas remain
    // aligned with the displayed image (no source-swap needed).
    const css = (filter in _OPG_CSS_FILTERS) ? _OPG_CSS_FILTERS[filter] : '';
    img.style.filter = css;
    img.dataset.filter = filter;
}

function arenaOPGToggleSeg(fileId, btn) {
    const img = document.getElementById(`arena-opg-img-${fileId}`);
    if (!img) return;
    const toolbar = btn.parentElement;
    if (btn.classList.contains('active')) {
        // Back to original
        btn.classList.remove('active');
        toolbar.querySelector('.opg-filter-btn').classList.add('active');
        img.src = `/panorama/${fileId}/image`;
    } else {
        const prevSrc = img.src;
        toolbar.querySelectorAll('.opg-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        // Set new src with error fallback — don't lose the OPG on failure
        const newImg = new Image();
        newImg.onload = () => { img.src = newImg.src; };
        newImg.onerror = () => {
            // Revert: restore original button state
            btn.classList.remove('active');
            toolbar.querySelector('.opg-filter-btn').classList.add('active');
            img.src = `/panorama/${fileId}/image`;
            console.warn(`Segmentation overlay failed for file ${fileId}`);
        };
        newImg.src = `/api/panorama/${fileId}/segmentation-overlay.jpg`;
    }
}

// ═══ Tooth hover-highlight on OPG (real YOLO bboxes from segmentation) ═══
// Works with BOTH DOM structures:
//   eval-case: .eval-case#eval-case-{fid} > .opg-col > img, .df-cell[data-fdi]
//   arena:     .arena-case#arena-case-{fid} > .arena-opg-wrap > img, .arena-cell[data-fdi]

const _yoloCache = {};

// YOLO class colors
const YOLO_COLORS = {
    'Implant':'rgba(16,185,129,0.95)','Crown':'rgba(6,179,212,0.95)',
    'Crown framework':'rgba(14,116,144,0.95)','Crown veneer':'rgba(125,211,252,0.95)',
    'Filling':'rgba(59,130,246,0.95)','Caries':'rgba(239,68,68,0.95)',
    'Missing teeth':'rgba(248,135,113,0.9)','Periapical lesion':'rgba(245,158,11,0.95)',
    'Root Piece':'rgba(217,70,239,0.9)','Root canal obturation':'rgba(34,211,238,0.95)',
    'Cover screw':'rgba(132,204,22,0.9)',
    'Abutment':'rgba(249,115,22,0.9)',
    'Fixation screw':'rgba(234,179,8,0.9)',
};

// ── FDI mapping is now server-side (same algorithm as implant-assessment) ──
// See panorama_routes.py: darwin_tooth_bboxes() → fdi_map in API response

/** Load YOLO detections (cached). */
async function _loadYoloDetections(fileId, _retryCount) {
    if (_yoloCache[fileId]) return _yoloCache[fileId];
    const _retry = _retryCount || 0;
    try {
        const r = await fetch(`/api/darwin/tooth-bboxes/${fileId}`);
        if (!r.ok) return null;
        const d = await r.json();
        d.detections.forEach(det => {
            det._cx = (det.x1 + det.x2) / 2;
            det._cy = (det.y1 + det.y2) / 2;
        });
        _yoloCache[fileId] = d;
        // Render quality summary badges
        _renderQualitySummary(fileId, d);

        // Auto-init crop carousel if not yet initialized (SemiT-SAM cache was warming)
        if (!_carouselState[fileId] && d.fdi_map && Object.keys(d.fdi_map).length > 0) {
            const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
            if (opgImg && opgImg.complete && opgImg.naturalWidth > 0) {
                _initCropCarousel(fileId);
            }
        }
        return d;
    } catch(e) {
        // Retry up to 3 times with 3s delay (SemiT-SAM may still be computing)
        if (_retry < 3) {
            await new Promise(r => setTimeout(r, 3000));
            return _loadYoloDetections(fileId, _retry + 1);
        }
        return null;
    }
}

/** Show quality validation badges under OPG image */
function _renderQualitySummary(fileId, data) {
    const q = data.quality;
    if (!q) return;
    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;
    // Don't duplicate
    if (caseEl.querySelector('.quality-bar')) return;

    // Count all issues
    const nUnmatched = (q.unmatched_detections || []).length;
    const nMissingDet = (q.missing_with_detection || []).length;
    const nMismatch = (q.type_mismatches || []).length;
    const nNoDetect = (q.teeth_without_detection || []).length;
    const implMismatch = q.implant_count_mismatch;
    const nJawCross = (q.jaw_crossing || []).length;
    const nQuadMismatch = (q.quadrant_count_mismatch || []).length;
    const nLowConf = (q.low_confidence || []).length;
    const nGapAnomaly = (q.adjacent_gap_anomaly || []).length;
    const nInterp = data.interpolated ? Object.keys(data.interpolated).length : 0;

    const total = nUnmatched + nMissingDet + nMismatch + nNoDetect
                + (implMismatch ? 1 : 0) + nJawCross + nQuadMismatch + nLowConf + nGapAnomaly;

    // ── Rich tooltip system ──
    // User-friendly descriptions for non-experts (shown on hover)
    const _R_HELP = {
        R1: {
            title: 'Лишние объекты на снимке',
            desc: 'Модель YOLO обнаружила на снимке объекты (зубы/импланты), которым нет соответствия в зубной формуле. Возможные причины: ложное срабатывание модели, неполная формула, или артефакт на снимке.',
        },
        R2: {
            title: 'Конфликт: отсутствует, но виден',
            desc: 'В формуле зуб отмечен как отсутствующий, но модель обнаружила объект в этой позиции на снимке. Возможно, формула устарела или это корень зуба / артефакт.',
        },
        R3: {
            title: 'Тип не совпадает',
            desc: 'Тип объекта в формуле (имплант, коронка) не совпадает с тем, что увидела модель на снимке. Например: в формуле имплант, а модель видит обычный зуб.',
        },
        R4: {
            title: 'Не найден моделью',
            desc: 'Зуб или имплант есть в формуле, но модель не обнаружила его на снимке. Причины: наложение корней, низкое качество области снимка, зуб частично вне кадра, или ограничение модели.',
        },
        R5: {
            title: 'Число имплантов не совпало',
            desc: 'Общее количество имплантов в формуле отличается от количества имплантов, найденных на снимке. Требуется ручная проверка.',
        },
        R6: {
            title: 'Не та челюсть',
            desc: 'Обнаруженный объект расположен на противоположной челюсти от той, что указана в формуле (верхняя вместо нижней или наоборот). Возможна ошибка сопоставления.',
        },
        R7: {
            title: 'Квадрант: количество не сходится',
            desc: 'Количество найденных зубов в квадранте (1/4 челюсти) не совпадает с формулой. Некоторые зубы могли быть пропущены моделью или слились с соседними.',
        },
        R8: {
            title: 'Низкая уверенность модели',
            desc: 'Модель определила объект, но с очень низкой уверенностью (менее 30%). Такие результаты ненадёжны и требуют визуальной проверки врачом.',
        },
        R9: {
            title: 'Необычный зазор',
            desc: 'Расстояние между двумя соседними зубами на снимке выглядит аномально большим или маленьким. Возможна ошибка сопоставления зубов или особенность прикуса.',
        },
        INT: {
            title: 'Расчётные позиции',
            desc: 'Зубы, которые есть в формуле, но не были найдены моделью. Их позиция на снимке вычислена как промежуток между обнаруженными соседями. При наведении показывается область штриховым контуром.',
        },
    };

    // Ensure global tooltip element exists
    if (!document.getElementById('qc-tooltip')) {
        const tt = document.createElement('div');
        tt.id = 'qc-tooltip';
        tt.style.cssText = `
            display:none; position:fixed; z-index:9999;
            max-width:320px; padding:10px 14px; border-radius:8px;
            background:rgba(15,23,42,0.96); border:1px solid rgba(100,116,139,0.4);
            color:#e2e8f0; font-size:12px; line-height:1.5;
            box-shadow:0 8px 24px rgba(0,0,0,0.5); pointer-events:none;
            backdrop-filter:blur(8px);
        `;
        document.body.appendChild(tt);
    }

    // Build quality bar
    const bar = document.createElement('div');
    bar.className = 'quality-bar';
    bar.style.cssText = 'display:flex;gap:5px;flex-wrap:wrap;padding:4px 8px;margin:4px 0;align-items:center;';

    const _badge = (ruleId, text, color, detailLines) => {
        const b = document.createElement('span');
        b.className = 'qc-badge';
        b.dataset.rule = ruleId;
        b.style.cssText = `font-size:10px;padding:2px 6px;border-radius:3px;background:${color};color:#fff;cursor:help;white-space:nowrap;transition:filter 0.15s;`;
        b.textContent = text;

        // Rich tooltip on hover
        b.addEventListener('mouseenter', function(ev) {
            const tt = document.getElementById('qc-tooltip');
            if (!tt) return;
            const help = _R_HELP[ruleId] || {};
            let html = `<div style="font-weight:700;font-size:13px;margin-bottom:6px;color:#f59e0b;">${ruleId}: ${help.title || ''}</div>`;
            html += `<div style="color:#cbd5e1;margin-bottom:8px;">${help.desc || ''}</div>`;
            if (detailLines && detailLines.length) {
                html += `<div style="font-size:11px;color:#94a3b8;border-top:1px solid rgba(100,116,139,0.3);padding-top:6px;margin-top:4px;">`;
                html += detailLines.slice(0, 8).map(l => `<div style="margin:2px 0;">${l}</div>`).join('');
                if (detailLines.length > 8) html += `<div style="color:#64748b;">... +${detailLines.length - 8}</div>`;
                html += `</div>`;
            }
            tt.innerHTML = html;
            tt.style.display = 'block';
            const r = ev.target.getBoundingClientRect();
            tt.style.left = Math.min(r.left, window.innerWidth - 340) + 'px';
            tt.style.top = (r.bottom + 8) + 'px';
            // Flip up if below viewport
            if (r.bottom + 8 + tt.offsetHeight > window.innerHeight) {
                tt.style.top = (r.top - tt.offsetHeight - 8) + 'px';
            }
        });
        b.addEventListener('mouseleave', function() {
            const tt = document.getElementById('qc-tooltip');
            if (tt) tt.style.display = 'none';
        });
        return b;
    };

    if (total === 0) {
        const okBadge = _badge('OK', 'QC: OK', '#16a34a', []);
        bar.appendChild(okBadge);
    } else {
        if (nUnmatched > 0) {
            const lines = q.unmatched_detections.map(u => `${u.label} (conf ${u.conf}) @ (${u.cx}, ${u.cy})`);
            const r1badge = _badge('R1', `R1: ${nUnmatched} лишних`, '#9333ea', lines);
            // Click to toggle YOLO bbox highlights on OPG
            r1badge.style.cursor = 'pointer';
            r1badge.title = 'Click to show/hide detections on the image';
            r1badge.addEventListener('click', () => _toggleR1Highlights(fileId, q.unmatched_detections, data.detections || []));
            bar.appendChild(r1badge);
        }
        if (nMissingDet > 0) {
            const lines = q.missing_with_detection.map(m => `${m.fdi} (${m.status}) \u2190 ${m.detection_label}`);
            bar.appendChild(_badge('R2', `R2: ${nMissingDet} O\u2260YOLO`, '#dc2626', lines));
        }
        if (nMismatch > 0) {
            const lines = q.type_mismatches.map(m => `${m.fdi}: GT=${m.gt_status}, YOLO=${m.detected.join('+')}`);
            bar.appendChild(_badge('R3', `R3: ${nMismatch} тип\u2260`, '#ea580c', lines));
        }
        if (nNoDetect > 0) {
            const lines = q.teeth_without_detection.map(m => `${m.fdi} (${m.status})`);
            bar.appendChild(_badge('R4', `R4: ${nNoDetect} не найд.`, '#6b7280', lines));
        }
        if (implMismatch) {
            const d = implMismatch.diff;
            const sign = d > 0 ? '+' : '';
            bar.appendChild(_badge('R5', `R5: имп ${implMismatch.gt_implants}\u2192${implMismatch.yolo_implants}`,
                '#b91c1c', [`Формула: ${implMismatch.gt_implants} импл., Снимок: ${implMismatch.yolo_implants} импл. (${sign}${d})`]));
        }
        if (nJawCross > 0) {
            const lines = q.jaw_crossing.map(j => `${j.fdi}: ожид. ${j.expected}, факт ${j.actual}`);
            bar.appendChild(_badge('R6', `R6: ${nJawCross} jaw\u2717`, '#991b1b', lines));
        }
        if (nQuadMismatch > 0) {
            const lines = q.quadrant_count_mismatch.map(
                qm => `Q${qm.quadrant}: ожид. ${qm.expected}, найд. ${qm.mapped} (\u0394${qm.missing})`);
            bar.appendChild(_badge('R7', `R7: ${nQuadMismatch}Q \u0394`, '#c2410c', lines));
        }
        if (nLowConf > 0) {
            const lines = q.low_confidence.map(l => `${l.fdi}: ${l.label} conf=${l.conf}`);
            bar.appendChild(_badge('R8', `R8: ${nLowConf} low`, '#d97706', lines));
        }
        if (nGapAnomaly > 0) {
            const lines = q.adjacent_gap_anomaly.map(
                g => `${g.fdi_pair.join('\u2194')}: ${g.gap_px}px vs ${g.expected_px}px (\u00d7${g.ratio})`);
            bar.appendChild(_badge('R9', `R9: ${nGapAnomaly} gap`, '#7c3aed', lines));
        }
    }

    // Interpolation indicator (informational, not an error)
    if (nInterp > 0) {
        const interpFdis = Object.keys(data.interpolated);
        bar.appendChild(_badge('INT', `\u2248${nInterp} расч.`, 'rgba(245,158,11,0.8)',
            interpFdis.map(f => {
                const nb = data.interpolated[f].neighbors || [];
                return `${f} \u2248 между ${nb.filter(Boolean).join(' и ')}`;
            })
        ));
    }

    // Insert after toolbar (or correction banner if present) — below filter buttons
    const toolbar = caseEl.querySelector('.arena-opg-toolbar');
    const corrBanner = caseEl.querySelector('.correction-banner');
    const insertAfter = corrBanner || toolbar || caseEl.querySelector('.arena-opg-wrap');
    if (insertAfter) insertAfter.after(bar);
    else caseEl.prepend(bar);
}

/** Toggle R1 (unmatched YOLO detections) highlights on OPG canvas */
let _r1Active = {};
function _toggleR1Highlights(fileId, unmatched, allDetections) {
    const canvas = document.getElementById(`arena-opg-canvas-${fileId}`);
    const img = document.getElementById(`arena-opg-img-${fileId}`);
    if (!canvas || !img) return;

    // Toggle off
    if (_r1Active[fileId]) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        _r1Active[fileId] = false;
        return;
    }

    // Size canvas to match displayed image
    const rect = img.getBoundingClientRect();
    canvas.width = img.naturalWidth || rect.width;
    canvas.height = img.naturalHeight || rect.height;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.pointerEvents = 'none';
    canvas.style.zIndex = '5';

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Build set of unmatched detection centers for matching
    const unmatchedSet = new Set(unmatched.map(u => `${u.cx},${u.cy}`));

    // Draw ALL detections but highlight unmatched ones
    for (const det of allDetections) {
        const cx = det._cx || (det.x1 + det.x2) / 2;
        const cy = det._cy || (det.y1 + det.y2) / 2;
        const isUnmatched = unmatchedSet.has(`${Math.round(cx)},${Math.round(cy)}`);

        if (isUnmatched) {
            // R1: unmatched — bright purple with label
            ctx.strokeStyle = 'rgba(168, 85, 247, 0.9)';
            ctx.lineWidth = 3;
            ctx.setLineDash([]);
            ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
        } else {
            // Matched — dim green outline
            ctx.strokeStyle = 'rgba(74, 222, 128, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.fillStyle = 'transparent';
        }

        const x = det.x1, y = det.y1, w = det.x2 - det.x1, h = det.y2 - det.y1;
        ctx.beginPath();
        ctx.rect(x, y, w, h);
        ctx.fill();
        ctx.stroke();

        if (isUnmatched) {
            // Draw label
            ctx.setLineDash([]);
            ctx.font = 'bold 18px system-ui';
            ctx.fillStyle = 'rgba(168, 85, 247, 0.95)';
            const label = `${det.class || det.label || '?'} ${(det.conf || 0).toFixed(2)}`;
            ctx.fillText(label, x + 2, y - 5 > 0 ? y - 5 : y + 18);

            // Crosshair at center
            ctx.strokeStyle = 'rgba(255, 100, 100, 0.8)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(cx - 15, cy); ctx.lineTo(cx + 15, cy);
            ctx.moveTo(cx, cy - 15); ctx.lineTo(cx, cy + 15);
            ctx.stroke();
        }
    }

    ctx.setLineDash([]);
    _r1Active[fileId] = true;
}

/* Dead code removed: _fdiCenter, _findJawSeparatorY, _buildFdiMap
   FDI mapping now uses server-side smart matching via data.fdi_map */

/** Ensure canvas overlay exists in the given case container. */
function _ensureCanvas(caseEl) {
    const isArena = caseEl.id.startsWith('arena-');
    const fileId = caseEl.id.replace('eval-case-', '').replace('arena-case-', '');
    if (isArena) {
        // Arena: canvas already exists in template
        return document.getElementById(`arena-opg-canvas-${fileId}`);
    }
    // Eval: create if needed
    let canvas = caseEl.querySelector('.opg-hover-canvas');
    if (canvas) return canvas;
    const col = caseEl.querySelector('.opg-col');
    if (!col) return null;
    canvas = document.createElement('canvas');
    canvas.className = 'opg-hover-canvas';
    col.appendChild(canvas);
    return canvas;
}

/** Get image→canvas coordinate transform for OPG in a case container. */
function _getOPGMapping(caseEl, noResize) {
    const canvas = _ensureCanvas(caseEl);
    if (!canvas) return null;
    const col = canvas.parentElement;
    const img = col.querySelector('img');
    if (!img || !img.naturalWidth) return null;
    const colRect = col.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();
    if (!noResize) {
        canvas.width = colRect.width;
        canvas.height = colRect.height;
    }
    // Scale: how OPG image pixels map to display pixels
    const sc = imgRect.width / (img.naturalWidth || 2048);
    // Offset: image position within the column
    const ox = imgRect.left - colRect.left;
    const oy = imgRect.top - colRect.top;
    return {
        canvas, ctx: canvas.getContext('2d'),
        w: colRect.width, h: colRect.height, img,
        tx: nx => nx * sc + ox,
        ty: ny => ny * sc + oy,
    };
}

/** Draw rounded rect path. */
function _rrect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.quadraticCurveTo(x+w,y,x+w,y+r);
    ctx.lineTo(x+w,y+h-r); ctx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    ctx.lineTo(x+r,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-r);
    ctx.lineTo(x,y+r); ctx.quadraticCurveTo(x,y,x+r,y); ctx.closePath();
}

/** Highlight exactly ONE tooth on OPG using server-side FDI mapping.
 *  Same algorithm as implant-assessment: dental formula → X-coord match.
 *  One FDI = one detection group. No ambiguity. */
function _highlightToothOnOPG(fileId, fdi, caseEl) {
    const data = _yoloCache[fileId];
    if (!data || !data.detections.length) return;
    if (!caseEl) caseEl = document.getElementById(`eval-case-${fileId}`) || document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;
    const m = _getOPGMapping(caseEl);
    if (!m) return;
    const { ctx, w, h } = m;
    ctx.clearRect(0, 0, w, h);

    // Prefer crop card bbox over fdi_map (crop has verified, manually overridable detections)
    const _cs = _carouselState[fileId];
    const _cropCard = _cs ? _cs.cards.find(c => c.fdi === fdi && c.bbox) : null;
    let targetGroup = null;
    let targetSet = new Set();

    if (_cropCard && _cropCard.parentBbox) {
        // Build target group from crop card's parent + children (absolute OPG coords)
        targetGroup = [];
        // Parent detection as main bbox
        const pb = _cropCard.parentBbox;
        targetGroup.push({ x1: pb.x1, y1: pb.y1, x2: pb.x2, y2: pb.y2,
            cls: pb.cls || _cropCard.cls, conf: _cropCard.conf, idx: -1 });
        // Children (non-parent)
        for (const ch of _cropCard.children) {
            if (ch._isParentBbox) continue;
            targetGroup.push({ x1: ch.x1, y1: ch.y1, x2: ch.x2, y2: ch.y2,
                cls: ch.cls, conf: ch.conf || 1.0, idx: -2 });
        }
        targetSet.add(-1); targetSet.add(-2);
    } else {
        // Fallback: Use server-provided fdi_map (from dental formula smart matching)
        const fdiMap = data.fdi_map || {};
        const targetIdxList = fdiMap[fdi]; // array of detection indices (or undefined)
        targetGroup = targetIdxList
            ? targetIdxList.map(idx => data.detections.find(d => d.idx === idx)).filter(Boolean)
            : null;
        if (targetIdxList) targetIdxList.forEach(idx => targetSet.add(idx));
    }

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, w, h);

    // Phase 1: Draw dim borders for NON-target detections
    data.detections.forEach(det => {
        if (targetSet.has(det.idx)) return;
        const dx1 = m.tx(det.x1), dy1 = m.ty(det.y1);
        const dx2 = m.tx(det.x2), dy2 = m.ty(det.y2);
        const pad = 3;
        const rx = dx1-pad, ry = dy1-pad, rw = dx2-dx1+pad*2, rh = dy2-dy1+pad*2;
        const color = YOLO_COLORS[det.cls] || 'rgba(200,200,200,0.9)';
        ctx.save();
        ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.25)');
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        _rrect(ctx, rx, ry, rw, rh, 4); ctx.stroke();
        ctx.restore();
    });

    // Phase 2: Draw target detections (cutout + border + stacked labels)
    if (targetGroup && targetGroup.length) {
        // Find bounding box of entire group for cutout
        let gx1=Infinity, gy1=Infinity, gx2=-Infinity, gy2=-Infinity;
        targetGroup.forEach(det => {
            gx1 = Math.min(gx1, m.tx(det.x1));
            gy1 = Math.min(gy1, m.ty(det.y1));
            gx2 = Math.max(gx2, m.tx(det.x2));
            gy2 = Math.max(gy2, m.ty(det.y2));
        });
        const pad = 5;
        // Cut out group area from overlay
        ctx.save(); _rrect(ctx, gx1-pad, gy1-pad, gx2-gx1+pad*2, gy2-gy1+pad*2, 4);
        ctx.globalCompositeOperation = 'destination-out'; ctx.fill(); ctx.restore();

        // Draw border for each detection in group
        targetGroup.forEach(det => {
            const dx1 = m.tx(det.x1), dy1 = m.ty(det.y1);
            const dx2 = m.tx(det.x2), dy2 = m.ty(det.y2);
            const color = YOLO_COLORS[det.cls] || 'rgba(200,200,200,0.9)';
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.5;
            ctx.shadowColor = color.replace(/[\d.]+\)$/, '0.6)');
            ctx.shadowBlur = 14;
            _rrect(ctx, dx1-3, dy1-3, dx2-dx1+6, dy2-dy1+6, 4); ctx.stroke();
            ctx.restore();
        });

        // Stacked labels above the group — GT-corrected if reclassified
        const labels = targetGroup.map(d => {
            const corr = _getGTCorrectedLabel(fileId, fdi, d.cls);
            return {
                text: corr ? `${corr} ✎` : `${d.cls} ${(d.conf*100).toFixed(0)}%`,
                color: corr ? '#22d3ee' : (YOLO_COLORS[d.cls] || 'rgba(200,200,200,0.9)')
            };
        });
        // Add GT-only layers that YOLO missed (e.g. endo not detected but in GT)
        const _gtVal = (arenaGroundTruth[fileId] || {})[fdi];
        if (_gtVal) {
            const _gtLayers = parseToothLayers(_gtVal);
            const _CORR_TO_STATUS = {'Штифт':'post','Обтурация':'endo','Пломба':'restored','Кариес':'caries','Отсутствует':'missing'};
            const _GT_LABEL = {endo:{t:'Эндо',c:'#a855f7'},post:{t:'Штифт',c:'#d97706'},crowned:{t:'Коронка',c:'#f59e0b'},
                restored:{t:'Пломба',c:'#3b82f6'},caries:{t:'Кариес',c:'#ef4444'},implant:{t:'Имплантат',c:'#22c55e'}};
            const coveredStatuses = new Set();
            targetGroup.forEach(d => {
                const corr = _getGTCorrectedLabel(fileId, fdi, d.cls);
                if (corr) { const s = _CORR_TO_STATUS[corr]; if (s) coveredStatuses.add(s); }
                else { const s = CHILD_TO_FORMULA[d.cls]; if (s) coveredStatuses.add(s); }
            });
            _gtLayers.forEach(l => {
                if (!coveredStatuses.has(l.status) && _GT_LABEL[l.status]) {
                    labels.push({ text: `${_GT_LABEL[l.status].t} ✎`, color: _GT_LABEL[l.status].c });
                }
            });
        }
        ctx.font = 'bold 11px system-ui,sans-serif';
        let labelY = Math.max(16, gy1 - pad - 4);
        // Draw bottom-to-top so first label is on top
        for (let i = labels.length - 1; i >= 0; i--) {
            const { text, color } = labels[i];
            const tm = ctx.measureText(text);
            const lx = Math.max(2, Math.min(gx1, w - tm.width - 8));
            const ly = labelY - i * 18;
            ctx.save();
            ctx.fillStyle = 'rgba(0,0,0,0.85)';
            _rrect(ctx, lx - 4, ly - 12, tm.width + 8, 16, 3); ctx.fill();
            ctx.fillStyle = color;
            ctx.fillText(text, lx, ly);
            ctx.restore();
        }
    }

    // Phase 2b: Interpolated position (tooth exists in GT but YOLO missed it)
    // Show estimated area between detected neighbors with dashed amber border
    let isInterpolated = false;
    if ((!targetGroup || !targetGroup.length) && data.interpolated && data.interpolated[fdi]) {
        isInterpolated = true;
        const interp = data.interpolated[fdi];
        const ix1 = m.tx(interp.x1), iy1 = m.ty(interp.y1);
        const ix2 = m.tx(interp.x2), iy2 = m.ty(interp.y2);
        const pad = 4;

        // Cut out interpolated area from dark overlay
        ctx.save();
        _rrect(ctx, ix1 - pad, iy1 - pad, ix2 - ix1 + pad * 2, iy2 - iy1 + pad * 2, 4);
        ctx.globalCompositeOperation = 'destination-out'; ctx.fill();
        ctx.restore();

        // Dashed amber border — "estimated" look
        ctx.save();
        ctx.strokeStyle = 'rgba(245,158,11,0.85)';
        ctx.lineWidth = 2;
        ctx.setLineDash([6, 4]);
        ctx.shadowColor = 'rgba(245,158,11,0.4)';
        ctx.shadowBlur = 10;
        _rrect(ctx, ix1 - pad, iy1 - pad, ix2 - ix1 + pad * 2, iy2 - iy1 + pad * 2, 4);
        ctx.stroke();
        ctx.restore();

        // Semi-transparent amber fill
        ctx.save();
        ctx.fillStyle = 'rgba(245,158,11,0.08)';
        _rrect(ctx, ix1 - pad, iy1 - pad, ix2 - ix1 + pad * 2, iy2 - iy1 + pad * 2, 4);
        ctx.fill();
        ctx.restore();

        // Label: "estimated" + neighbors info
        ctx.save(); ctx.font = 'bold 11px system-ui,sans-serif';
        const nbrs = interp.neighbors || [];
        const nbLabel = nbrs.filter(Boolean).join(' ↔ ');
        const estText = `≈ расч. между ${nbLabel}`;
        const etm = ctx.measureText(estText);
        const elx = Math.max(2, Math.min(ix1, w - etm.width - 8));
        const ely = Math.max(16, iy1 - pad - 4);
        ctx.fillStyle = 'rgba(0,0,0,0.85)';
        _rrect(ctx, elx - 4, ely - 12, etm.width + 8, 16, 3); ctx.fill();
        ctx.fillStyle = 'rgba(245,158,11,0.95)';
        ctx.fillText(estText, elx, ely);
        ctx.restore();
    }

    // FDI badge top-left
    ctx.save(); ctx.font = 'bold 14px system-ui,sans-serif';
    const badge = targetGroup && targetGroup.length ? fdi
                : isInterpolated ? fdi + ' ≈'
                : fdi + ' ?';
    const badgeColor = targetGroup && targetGroup.length ? 'rgba(16,185,129,0.9)'
                     : isInterpolated ? 'rgba(245,158,11,0.9)'
                     : 'rgba(100,100,100,0.8)';
    const tm = ctx.measureText(badge);
    ctx.fillStyle = badgeColor;
    _rrect(ctx, 6, 6, tm.width + 12, 22, 4); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.fillText(badge, 12, 22); ctx.restore();

    // Quality: show type mismatch warning if applicable
    const q = data.quality;
    if (q && (targetGroup && targetGroup.length || isInterpolated)) {
        const mismatches = (q.type_mismatches || []).filter(mm => mm.fdi === fdi);
        if (mismatches.length) {
            ctx.save(); ctx.font = 'bold 11px system-ui,sans-serif';
            const warnText = '⚠ ' + mismatches.map(mm => mm.issue.replace(/_/g,' ')).join(', ');
            const wm = ctx.measureText(warnText);
            ctx.fillStyle = 'rgba(220,120,20,0.9)';
            _rrect(ctx, 6, 32, wm.width + 12, 18, 3); ctx.fill();
            ctx.fillStyle = '#fff'; ctx.fillText(warnText, 12, 46); ctx.restore();
        }
    }

    // Draw GT status badges on all teeth (shows expert annotations on panorama)
    _drawGTStatusOnOPG(fileId, caseEl);
}

/** Clear highlight on the canvas inside a case container. */
function _clearToothHighlight(caseEl) {
    if (!caseEl) return;
    const canvas = _ensureCanvas(caseEl);
    if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
}

/** Init hover via event delegation on a stable parent container.
 *  Works for both eval-cases and arena-cases without per-cell binding. */
function _initToothHoverHighlight(fileId) {
    _loadYoloDetections(fileId);
}

/** Delegated hover handler — called once on arena-cases and eval-cases containers. */
function _setupHoverDelegation() {
    if (window._hoverDelegationReady) return;
    window._hoverDelegationReady = true;

    // Find the closest case container and fileId from a cell
    function _caseInfo(cell) {
        const ec = cell.closest('.eval-case[id^="eval-case-"]')
                || cell.closest('.arena-case[id^="arena-case-"]');
        if (!ec) return null;
        const fid = ec.id.replace('eval-case-', '').replace('arena-case-', '');
        return { ec, fid };
    }

    let _lastHoverFdi = null, _lastHoverCase = null;

    document.addEventListener('mouseover', function(e) {
        const cell = e.target.closest('[data-fdi]');
        if (!cell) {
            // Mouse left all cells — clear
            if (_lastHoverCase) {
                _lastHoverCase.querySelectorAll('.hover-active')
                    .forEach(c => c.classList.remove('hover-active'));
                _clearToothHighlight(_lastHoverCase);
                _lastHoverFdi = null; _lastHoverCase = null;
            }
            return;
        }

        const info = _caseInfo(cell);
        if (!info) return;

        const fdi = cell.dataset.fdi;
        if (fdi === _lastHoverFdi && info.ec === _lastHoverCase) return; // same cell

        // Clear previous
        if (_lastHoverCase) {
            _lastHoverCase.querySelectorAll('.hover-active')
                .forEach(c => c.classList.remove('hover-active'));
            _clearToothHighlight(_lastHoverCase);
        }

        // Highlight new
        _lastHoverFdi = fdi;
        _lastHoverCase = info.ec;
        info.ec.querySelectorAll(`[data-fdi="${fdi}"]`)
            .forEach(c => c.classList.add('hover-active'));

        // Quality rule 1: don't show OPG highlight for missing/intact teeth
        // The hovered cell knows its own status via CSS class
        const _SKIP_HOVER = ['missing', 'intact'];
        const cellStatus = cell.className.split(/\s+/);
        const isMissingOrIntact = _SKIP_HOVER.some(s => cellStatus.includes(s));
        if (isMissingOrIntact) return; // yellow border via CSS only, no OPG overlay

        _loadYoloDetections(info.fid).then(() => _highlightToothOnOPG(info.fid, fdi, info.ec));
    });

    document.addEventListener('mouseout', function(e) {
        const cell = e.target.closest('[data-fdi]');
        if (!cell) return;
        // Only clear if leaving to an element that is NOT another [data-fdi] in same case
        const related = e.relatedTarget ? e.relatedTarget.closest('[data-fdi]') : null;
        if (related) {
            const info1 = _caseInfo(cell), info2 = _caseInfo(related);
            if (info1 && info2 && info1.ec === info2.ec && cell.dataset.fdi === related.dataset.fdi) return;
        }
        // Clear this cell's highlight if leaving
        if (!related || !related.dataset.fdi) {
            if (_lastHoverCase) {
                _lastHoverCase.querySelectorAll('.hover-active')
                    .forEach(c => c.classList.remove('hover-active'));
                _clearToothHighlight(_lastHoverCase);
                _lastHoverFdi = null; _lastHoverCase = null;
            }
        }
    });
}

// Setup delegation immediately
_setupHoverDelegation();

// Right-click on formula cell → layer removal context menu
document.addEventListener('contextmenu', function(e) {
    const cell = e.target.closest('.arena-cell[data-fdi][data-file]');
    if (!cell) return;
    const fdi = cell.dataset.fdi;
    const fileId = cell.dataset.file;
    const raw = (arenaGroundTruth[fileId] || {})[fdi];
    if (raw && raw.includes('+')) {
        _showLayerContextMenu(e, fileId, fdi);
    }
});

