// fullscreen.js — OPG fullscreen viewer + crop fullscreen editor
// Extracted from darwin_lab.html lines 18807–19962
// ═══════════════════════════════════════════════════════════════

// ═══ Fullscreen OPG Viewer — zoom, pan, filters ═══
const _opgFs = { open:false, fileId:null, img:null, scale:1, offsetX:0, offsetY:0, filter:'', overlayMode:'off', overlayImg:null };

function _opgFsOpen(fileId) {
    const overlay = document.getElementById('opg-fs-overlay');
    const imgSrc = `/panorama/${fileId}/image`;
    _opgFs.fileId = fileId;
    _opgFs.filter = '';
    _opgFs.overlayMode = 'off';
    _opgFs.overlayImg = null;
    _opgFs.open = true;
    overlay.classList.add('open');

    // Reset active filter + overlay buttons
    overlay.querySelectorAll('[data-fs-filter]').forEach(b => b.classList.toggle('active', b.dataset.fsFilter === ''));
    overlay.querySelectorAll('[data-fs-overlay]').forEach(b => b.classList.toggle('active', b.dataset.fsOverlay === 'off'));

    const img = new Image();
    img.onload = () => {
        _opgFs.img = img;
        _opgFsFit();
        document.getElementById('opg-fs-info').textContent = `${img.naturalWidth}×${img.naturalHeight} | file_id=${fileId}`;
    };
    img.src = imgSrc;
}

function _opgFsClose() {
    _opgFs.open = false;
    document.getElementById('opg-fs-overlay').classList.remove('open');
    // Restore carousel visibility after fullscreen exit
    document.querySelectorAll('.crop-carousel').forEach(el => { el.style.display = ''; el.style.visibility = 'visible'; });
}

function _opgFsDraw() {
    const cvs = document.getElementById('opg-fs-canvas');
    if (!cvs || !_opgFs.img) return;
    const ctx = cvs.getContext('2d');
    const img = _opgFs.img;
    cvs.width = img.naturalWidth;
    cvs.height = img.naturalHeight;

    // Apply filter: preset + slider values
    const _fsBri = parseFloat(document.getElementById('opg-fs-brightness')?.value || 1);
    const _fsCon = parseFloat(document.getElementById('opg-fs-contrast')?.value || 1);
    const presetFilter = _opgFsFilterCSS(_opgFs.filter);
    const sliderFilter = `brightness(${_fsBri}) contrast(${_fsCon})`;
    ctx.filter = presetFilter !== 'none' ? `${presetFilter} ${sliderFilter}` : sliderFilter;
    ctx.drawImage(img, 0, 0);
    ctx.filter = 'none';

    // If invert — pixel inversion
    if (_opgFs.filter === 'invert') {
        const id = ctx.getImageData(0, 0, cvs.width, cvs.height);
        const d = id.data;
        for (let i = 0; i < d.length; i += 4) { d[i] = 255-d[i]; d[i+1] = 255-d[i+1]; d[i+2] = 255-d[i+2]; }
        ctx.putImageData(id, 0, 0);
    }

    // Draw overlay if active
    if (_opgFs.overlayMode !== 'off' && _opgFs.overlayImg && _opgFs.overlayImg.complete) {
        ctx.globalAlpha = 0.6;
        ctx.drawImage(_opgFs.overlayImg, 0, 0, cvs.width, cvs.height);
        ctx.globalAlpha = 1.0;
    }

    // Position
    cvs.style.transform = `translate(${_opgFs.offsetX}px, ${_opgFs.offsetY}px) scale(${_opgFs.scale})`;
}

function _opgFsFilterCSS(f) {
    switch(f) {
        case 'clahe': return 'contrast(1.4) brightness(1.1)';
        case 'contrast': return 'contrast(2.0)';
        case 'bone': return 'contrast(1.8) brightness(0.7)';
        case 'sharp': return 'contrast(1.2) brightness(1.05)';
        default: return 'none';
    }
}

function _opgFsFilter(f, btn) {
    _opgFs.filter = f;
    document.getElementById('opg-fs-overlay').querySelectorAll('[data-fs-filter]')
        .forEach(b => b.classList.toggle('active', b.dataset.fsFilter === f));
    _opgFsDraw();
}

function _opgFsSliderChange() {
    const bri = parseFloat(document.getElementById('opg-fs-brightness').value);
    const con = parseFloat(document.getElementById('opg-fs-contrast').value);
    document.getElementById('opg-fs-bri-val').textContent = Math.round(bri * 100) + '%';
    document.getElementById('opg-fs-con-val').textContent = Math.round(con * 100) + '%';
    _opgFsDraw();
}

function _opgFsOverlay(mode, btn) {
    _opgFs.overlayMode = mode;
    document.getElementById('opg-fs-overlay').querySelectorAll('[data-fs-overlay]')
        .forEach(b => b.classList.toggle('active', b.dataset.fsOverlay === mode));
    if (mode === 'off') {
        _opgFs.overlayImg = null;
        _opgFsDraw();
        return;
    }
    // Load segmentation overlay image
    const url = `/api/panorama/${_opgFs.fileId}/segmentation-overlay.jpg?source=${mode}&w=${_opgFs.img?.naturalWidth || 2000}`;
    const img = new Image();
    img.onload = () => { _opgFs.overlayImg = img; _opgFsDraw(); };
    img.onerror = () => { _opgFs.overlayImg = null; _opgFsDraw(); console.warn('Overlay load failed:', url); };
    img.src = url;
}

function _opgFsFit() {
    const vp = document.getElementById('opg-fs-viewport');
    if (!_opgFs.img || !vp) return;
    const vpW = vp.clientWidth, vpH = vp.clientHeight;
    const imgW = _opgFs.img.naturalWidth, imgH = _opgFs.img.naturalHeight;
    _opgFs.scale = Math.min(vpW / imgW, vpH / imgH) * 0.95;
    _opgFs.offsetX = (vpW - imgW * _opgFs.scale) / 2;
    _opgFs.offsetY = (vpH - imgH * _opgFs.scale) / 2;
    _opgFsDraw();
}

function _opgFsZoom(factor) {
    const vp = document.getElementById('opg-fs-viewport');
    const vpW = vp.clientWidth / 2, vpH = vp.clientHeight / 2;
    // Zoom towards center
    _opgFs.offsetX = vpW - (_opgFs.scale * factor) * (vpW - _opgFs.offsetX) / _opgFs.scale;
    _opgFs.offsetY = vpH - (_opgFs.scale * factor) * (vpH - _opgFs.offsetY) / _opgFs.scale;
    _opgFs.scale *= factor;
    _opgFsDraw();
}

// Pan with mouse drag
(function() {
    const vp = document.getElementById('opg-fs-viewport');
    let dragging = false, startX, startY, startOx, startOy;

    vp.addEventListener('mousedown', e => {
        if (!_opgFs.open) return;
        dragging = true;
        startX = e.clientX; startY = e.clientY;
        startOx = _opgFs.offsetX; startOy = _opgFs.offsetY;
        vp.classList.add('dragging');
        e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
        if (!dragging) return;
        _opgFs.offsetX = startOx + (e.clientX - startX);
        _opgFs.offsetY = startOy + (e.clientY - startY);
        _opgFsDraw();
    });
    document.addEventListener('mouseup', () => {
        if (dragging) { dragging = false; vp.classList.remove('dragging'); }
    });

    // Wheel zoom
    vp.addEventListener('wheel', e => {
        if (!_opgFs.open) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        // Zoom towards cursor
        const rect = vp.getBoundingClientRect();
        const mx = e.clientX - rect.left, my = e.clientY - rect.top;
        _opgFs.offsetX = mx - factor * (mx - _opgFs.offsetX);
        _opgFs.offsetY = my - factor * (my - _opgFs.offsetY);
        _opgFs.scale *= factor;
        _opgFsDraw();
    }, {passive: false});

    // Esc closes fullscreen; Arrow keys navigate crops
    document.addEventListener('keydown', e => {
        // Fullscreen crop editor takes priority
        if (_cropFsState.open) {
            if (e.key === 'Escape') {
                if (_cropAnnotState.mode && _cropAnnotState.mode !== 'view') { _cropFsExitDraw(); e.preventDefault(); return; }
                if (_cropFsState.viewBbox) { _cropFsExitChildFocus(); e.preventDefault(); return; }
                _cropFsClose(); e.preventDefault(); return;
            }
            if (e.key === 'ArrowLeft') { _cropFsNav(-1); e.preventDefault(); return; }
            if (e.key === 'ArrowRight') { _cropFsNav(1); e.preventDefault(); return; }
            if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { _cropFsUndo(); e.preventDefault(); return; }
            if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === 'y' && (e.ctrlKey || e.metaKey))) { _cropFsRedo(); e.preventDefault(); return; }
            return;
        }
        if (e.key === 'Escape' && _opgFs.open) _opgFsClose();
        // ← → navigate between crops when arena is visible and no input focused
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !_opgFs.open
            && !e.target.closest('input, select, textarea')) {
            const arenaArea = document.getElementById('arena-area');
            if (!arenaArea || !arenaArea.classList.contains('active')) return;
            // Find active crop's fileId and fdi
            const activeCard = document.querySelector('.carousel-card.active');
            if (!activeCard) return;
            const fid = activeCard.dataset.file;
            const fdi = activeCard.dataset.fdi;
            if (fid && fdi) {
                e.preventDefault();
                _navigateCrop(fid, fdi, e.key === 'ArrowLeft' ? -1 : 1);
            }
        }
    });

    // Double-click on OPG column (or its canvas overlay) opens fullscreen
    document.addEventListener('dblclick', e => {
        // Find closest OPG column container
        const col = e.target.closest('.arena-opg-col');
        if (col) {
            const img = col.querySelector('.arena-opg');
            if (img) {
                const m = img.id?.match(/arena-opg-img-(\d+)/);
                if (m) { _opgFsOpen(parseInt(m[1])); e.stopPropagation(); }
            }
        }
    });
})();

// ═══════════════════════════════════════════════════════════════════════════
// ██  FULLSCREEN CROP EDITOR — Ctrl+click on crop card to open
// ═══════════════════════════════════════════════════════════════════════════

const _cropFsState = { open: false, fileId: null, fdi: null, card: null, opgImg: null, zoom: 1.0,
    viewBbox: null, focusedChildIdx: null, focusedChildCls: null };

function _cropFsGetViewBbox() {
    return (_cropFsState && _cropFsState.viewBbox) ||
           (_cropFsState && _cropFsState.card && _cropFsState.card.bbox);
}

function _cropFsOpen(fileId, fdi) {
    const state = _carouselState[fileId];
    if (!state) return;
    const card = state.cards.find(c => c.fdi === fdi);
    if (!card || !card.bbox) return;
    const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
    if (!opgImg) return;

    _cropFsState.open = true;
    _cropFsState.fileId = fileId;
    _cropFsState.fdi = fdi;
    _cropFsState.card = card;
    _cropFsState.opgImg = opgImg;
    _cropFsState.viewBbox = null;
    _cropFsState.focusedChildIdx = null;
    _cropFsState.focusedChildCls = null;
    _cropFsHidden.clear();
    _cropFsHideParent = false;

    document.getElementById('crop-fs-overlay').classList.add('open');

    // Sync brightness/contrast sliders from per-crop filter state
    const fs = ((_cropFilterState[fileId] || {})[fdi]) || {};
    document.getElementById('crop-fs-brightness').value = fs.brightness || 1.0;
    document.getElementById('crop-fs-contrast').value = fs.contrast || 1.0;

    _cropFsBuildToolbar();
    // Fit to viewport on first open, then draw + sidebar
    requestAnimationFrame(() => { _cropFsFit(); _cropFsUpdateSidebar(); });

    // Info
    const gtRaw = (arenaGroundTruth[fileId] || {})[fdi];
    const gtDesc = gtRaw ? ` | GT: ${gtRaw}` : '';
    document.getElementById('crop-fs-info').textContent =
        `FDI ${fdi} | ${card.cls} ${Math.round((card.conf||0)*100)}% | file_id=${fileId}${gtDesc}`;
}

function _cropFsClose() {
    _cropFsState.open = false;
    _cropFsState.viewBbox = null;
    _cropFsState.focusedChildIdx = null;
    _cropFsState.focusedChildCls = null;
    document.getElementById('crop-fs-overlay').classList.remove('open');
    // Sync small card redraw
    if (_cropFsState.fileId && _cropFsState.fdi) {
        const cardEl = document.querySelector(
            `.carousel-card[data-file="${_cropFsState.fileId}"][data-fdi="${_cropFsState.fdi}"]`);
        if (cardEl) {
            const cvs = cardEl.querySelector('.cc-canvas');
            if (cvs && _cropFsState.opgImg && _cropFsState.card) {
                cvs.width = 400;
                _drawCropExpanded(cvs, _cropFsState.opgImg, _cropFsState.card);
                cvs.style.width = '220px';
                cvs.style.height = Math.round(220 * cvs.height / cvs.width) + 'px';
            }
        }
    }
}

/** Open fullscreen editor focused on a specific child sub-object. */
function _cropFsOpenChild(fileId, fdi, childIdx) {
    const state = _carouselState[fileId];
    if (!state) return;
    const card = state.cards.find(c => c.fdi === fdi);
    if (!card) return;
    const child = card.children[childIdx];
    if (!child) return;

    // Compute padded bbox around child (30% padding, min 80px each side)
    const opgImg = document.getElementById(`arena-opg-img-${fileId}`);
    const nW = opgImg?.naturalWidth || 2048, nH = opgImg?.naturalHeight || 1024;
    const cw = child.x2 - child.x1, ch = child.y2 - child.y1;
    const padX = Math.max(cw * 0.3, 80), padY = Math.max(ch * 0.3, 80);
    const viewBbox = {
        x1: Math.max(0, child.x1 - padX),
        y1: Math.max(0, child.y1 - padY),
        x2: Math.min(nW, child.x2 + padX),
        y2: Math.min(nH, child.y2 + padY)
    };

    // Open fullscreen editor normally first (if not already open)
    if (!_cropFsState.open) _cropFsOpen(fileId, fdi);
    // Override viewport to child focus
    _cropFsState.viewBbox = viewBbox;
    _cropFsState.focusedChildIdx = childIdx;
    _cropFsState.focusedChildCls = child.cls;

    // Redraw with child-focused viewport
    requestAnimationFrame(() => {
        _cropFsBuildToolbar();
        _cropFsDraw();
        _cropFsFit();
        _cropFsUpdateSidebar();
        // Auto-activate child for editing
        _activeEditChild = { childIdx, fileId, fdi };
        _cropFsDraw();
    });
}

/** Exit child focus, return to full crop view. */
function _cropFsExitChildFocus() {
    if (!_cropFsState || !_cropFsState.viewBbox) return;
    _cropFsState.viewBbox = null;
    _cropFsState.focusedChildIdx = null;
    _cropFsState.focusedChildCls = null;
    _activeEditChild = null;
    _cropFsBuildToolbar();
    _cropFsDraw();
    _cropFsFit();
    _cropFsUpdateSidebar();
}

function _cropFsNav(dir) {
    if (!_cropFsState.open) return;
    const { fileId, fdi } = _cropFsState;
    const state = _carouselState[fileId];
    if (!state) return;
    const fdiList = fdi.startsWith('1.') || fdi.startsWith('2.') ? UPPER_FDI : LOWER_FDI;
    const available = fdiList.filter(f => state.cards.some(c => c.fdi === f && c.bbox));
    const idx = available.indexOf(fdi);
    if (idx < 0) return;
    const nextIdx = idx + dir;
    if (nextIdx >= 0 && nextIdx < available.length) {
        _activeEditChild = null;
        _cropFsOpen(fileId, available[nextIdx]);
        // Also sync small card activation
        _activateCropCard(fileId, available[nextIdx]);
    }
}

function _cropFsDraw() {
    if (!_cropFsState.open) return;
    const canvas = document.getElementById('crop-fs-canvas');
    canvas.width = _cropFsState.viewBbox ? 1200 : 900;
    _drawCropExpanded(canvas, _cropFsState.opgImg, _cropFsState.card);
    // Apply zoom: display size = canvas intrinsic size × zoom
    const dw = Math.round(canvas.width * _cropFsState.zoom);
    const dh = Math.round(canvas.height * _cropFsState.zoom);
    canvas.style.width = dw + 'px';
    canvas.style.height = dh + 'px';
    const zi = document.getElementById('crop-fs-zoom-info');
    if (zi) zi.textContent = Math.round(_cropFsState.zoom * 100) + '%';
}

function _cropFsFit() {
    if (!_cropFsState.open) return;
    const wrap = document.getElementById('crop-fs-canvas-wrap');
    const canvas = document.getElementById('crop-fs-canvas');
    if (!wrap || !canvas) return;
    // Temporarily draw to get aspect ratio
    canvas.width = _cropFsState.viewBbox ? 1200 : 900;
    _drawCropExpanded(canvas, _cropFsState.opgImg, _cropFsState.card);
    const cw = canvas.width, ch = canvas.height;
    const availW = wrap.clientWidth - 32, availH = wrap.clientHeight - 32;
    const scaleW = availW / cw, scaleH = availH / ch;
    _cropFsState.zoom = Math.min(scaleW, scaleH, 1.5); // cap at 150%
    _cropFsDraw();
}

function _cropFsZoom(factor) {
    _cropFsState.zoom = Math.max(0.2, Math.min(3.0, _cropFsState.zoom * factor));
    _cropFsDraw();
}

function _cropFsBuildToolbar() {
    const { fileId, fdi } = _cropFsState;

    // Annotation class buttons
    const annotBar = document.getElementById('crop-fs-annot-bar');
    annotBar.innerHTML = '';

    // "← Весь кроп" button when in child focus mode
    if (_cropFsState.viewBbox) {
        const backBtn = document.createElement('button');
        backBtn.className = 'cfs-btn';
        backBtn.textContent = '← Весь кроп';
        backBtn.title = 'Вернуться к полному кропу';
        backBtn.style.cssText = 'background:#334155;color:#f0abfc;border:1px solid #a855f7;border-radius:4px;padding:3px 8px;font-size:11px;cursor:pointer;margin-right:6px';
        backBtn.addEventListener('click', _cropFsExitChildFocus);
        annotBar.appendChild(backBtn);
        // Focus indicator
        const focusLabel = document.createElement('span');
        focusLabel.style.cssText = 'color:#a855f7;font-size:10px;margin-right:8px';
        focusLabel.textContent = `Фокус: ${_cropFsState.focusedChildCls || '?'}`;
        annotBar.appendChild(focusLabel);
    }

    for (const ac of ANNOT_CLASSES) {
        const btn = document.createElement('button');
        btn.className = 'cfs-annot-btn';
        btn.textContent = ac.abbr;
        btn.title = ac.cls;
        btn.style.setProperty('--dot-color', ac.color);
        btn.dataset.cls = ac.cls;
        btn.addEventListener('click', () => {
            if (_cropAnnotState.mode === 'draw' && _cropAnnotState.activeClass === ac.cls) {
                _cropFsExitDraw();
            } else {
                _cropFsEnterDraw(ac.cls);
            }
        });
        annotBar.appendChild(btn);
    }
    // Quick statuses
    const sep = document.createElement('span');
    sep.className = 'cfs-sep';
    annotBar.appendChild(sep);
    const QUICK = [{abbr:'Эн',status:'endo',color:'#a855f7'},{abbr:'Ш',status:'post',color:'#f59e0b'}];
    for (const qs of QUICK) {
        const qb = document.createElement('button');
        qb.className = 'cfs-annot-btn';
        qb.textContent = qs.abbr;
        qb.title = `Статус: ${qs.status}`;
        qb.style.setProperty('--dot-color', qs.color);
        qb.addEventListener('click', () => _quickSetToothStatus(fileId, fdi, qs.status, qb));
        annotBar.appendChild(qb);
    }

    // Contour draw button (for polygon drawing in fullscreen)
    const sep2 = document.createElement('span');
    sep2.className = 'cfs-sep';
    annotBar.appendChild(sep2);
    const contourBtn = document.createElement('button');
    contourBtn.className = 'cfs-annot-btn';
    contourBtn.id = 'cfs-contour-btn';
    contourBtn.textContent = '◎';
    contourBtn.title = 'Нарисовать контур (полигон)';
    contourBtn.style.setProperty('--dot-color', '#f0abfc');
    contourBtn.addEventListener('click', () => {
        if (_cropAnnotState.mode === 'draw_polygon') {
            _cropFsExitDraw();
        } else {
            // Use focused child class, or activeEditChild class, or first annotation class
            const cls = _cropFsState.focusedChildCls
                || (_activeEditChild && _cropFsState.card?.children[_activeEditChild.childIdx]?.cls)
                || ANNOT_CLASSES[0]?.cls || 'Crown';
            _cropFsEnterContourDraw(cls);
        }
    });
    annotBar.appendChild(contourBtn);

    // Display mode buttons
    const dispBar = document.getElementById('crop-fs-disp-bar');
    dispBar.innerHTML = '';
    const MODES = [{m:'bbox',i:'▭'},{m:'contour',i:'◎'},{m:'both',i:'▭◎'}];
    for (const dm of MODES) {
        const db = document.createElement('button');
        db.textContent = dm.i;
        db.className = _cropDisplayMode === dm.m ? 'active' : '';
        db.dataset.dm = dm.m;
        db.addEventListener('click', () => {
            _cropDisplayMode = dm.m;
            dispBar.querySelectorAll('button').forEach(b => b.classList.toggle('active', b.dataset.dm === dm.m));
            _cropFsDraw();
            // Also update small card display mode buttons
            document.querySelectorAll('.cc-disp-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.dispMode === dm.m));
        });
        dispBar.appendChild(db);
    }
}

function _cropFsFilterChange() {
    const bri = parseFloat(document.getElementById('crop-fs-brightness').value);
    const con = parseFloat(document.getElementById('crop-fs-contrast').value);
    const { fileId, fdi } = _cropFsState;
    if (!_cropFilterState[fileId]) _cropFilterState[fileId] = {};
    _cropFilterState[fileId][fdi] = { brightness: bri, contrast: con };
    _cropFsDraw();
}

/** Enter contour polygon draw mode in fullscreen. */
function _cropFsEnterContourDraw(cls) {
    const { fileId, fdi, card } = _cropFsState;
    const canvas = document.getElementById('crop-fs-canvas');
    _cropAnnotState.mode = 'draw_polygon';
    _cropAnnotState.activeClass = cls;
    _cropAnnotState.fileId = fileId;
    _cropAnnotState.fdi = fdi;
    _cropAnnotState.card = card;
    _cropAnnotState.canvas = canvas;
    _cropAnnotState.cardEl = canvas.parentElement;
    _cropAnnotState.polygonPoints = [];
    canvas.style.cursor = 'crosshair';
    // Visual feedback
    const cb = document.getElementById('cfs-contour-btn');
    if (cb) cb.classList.add('drawing');
    const info = document.getElementById('crop-fs-info');
    if (info) info.textContent = `Контур ${cls} — кликайте точки | Двойной клик — замкнуть | Esc — отмена`;
}

function _cropFsEnterDraw(cls) {
    const { fileId, fdi, card } = _cropFsState;
    const canvas = document.getElementById('crop-fs-canvas');
    _cropAnnotState.mode = 'draw';
    _cropAnnotState.activeClass = cls;
    _cropAnnotState.fileId = fileId;
    _cropAnnotState.fdi = fdi;
    _cropAnnotState.card = card;
    _cropAnnotState.canvas = canvas;
    _cropAnnotState.cardEl = canvas.parentElement;
    _cropAnnotState.drawStart = null;
    _cropAnnotState.drawCurrent = null;
    canvas.style.cursor = 'crosshair';
    // Highlight active button
    document.querySelectorAll('#crop-fs-annot-bar .cfs-annot-btn').forEach(b =>
        b.classList.toggle('drawing', b.dataset.cls === cls));
}

function _cropFsExitDraw() {
    _cropAnnotState.mode = 'view';
    _cropAnnotState.activeClass = null;
    _cropAnnotState.drawStart = null;
    _cropAnnotState.polygonPoints = [];
    const canvas = document.getElementById('crop-fs-canvas');
    canvas.style.cursor = 'crosshair';
    document.querySelectorAll('#crop-fs-annot-bar .cfs-annot-btn').forEach(b =>
        b.classList.remove('drawing'));
    const cb = document.getElementById('cfs-contour-btn');
    if (cb) cb.classList.remove('drawing');
    _cropFsDraw();
}

function _cropFsUpdateSidebar() {
    const sb = document.getElementById('crop-fs-sidebar');
    if (!_cropFsState.open) { sb.innerHTML = ''; return; }
    const { fileId, fdi, card } = _cropFsState;

    let html = `<h4>FDI ${fdi} — Объекты</h4>`;

    // Child focus mode indicator
    if (_cropFsState.viewBbox && _cropFsState.focusedChildCls) {
        html += `<div style="margin:0 0 8px;padding:4px 8px;background:rgba(168,85,247,0.15);border:1px solid rgba(168,85,247,0.4);border-radius:4px">
            <div style="font-size:10px;color:#c084fc;font-weight:600">Фокус: ${_cropFsState.focusedChildCls}</div>
            <div style="font-size:9px;color:#94a3b8;margin-top:2px">Нарисуйте контур ◎ или Esc для выхода</div>
            <button onclick="_cropFsExitChildFocus()" style="margin-top:4px;font-size:10px;background:#334155;color:#f0abfc;border:1px solid #a855f7;border-radius:3px;padding:2px 6px;cursor:pointer">← Весь кроп</button>
        </div>`;
    }

    // ── GT layers section (source of truth, synced with SVG formula) ──
    const gtRaw = (arenaGroundTruth[fileId] || {})[fdi];
    const _GT_LONG = {endo:'Эндо (каналы)',post:'Штифт',crowned:'Коронка',restored:'Пломба',
        caries:'Кариес',present:'Интактный',missing:'Отсутствует',implant:'Имплантат',
        impl_fixture:'Фикстура',impl_cover:'Заглушка',impl_healing:'Формирователь',
        impl_abutment:'Абатмент',impl_temp_abut:'Врем. абатмент',impl_provisional:'Врем. коронка',
        impl_restored:'Имп.+коронка',attrition:'Стираемость',root:'Корень',bridge:'Мост (понтик)',
        bar:'Балка',impacted:'Ретенция',cantilever:'Консоль',uncertain:'Неопределённо'};
    const _GT_COLORS = {endo:'#a855f7',post:'#f59e0b',crowned:'#06b6d4',restored:'#3b82f6',
        caries:'#ef4444',present:'#475569',missing:'#64748b',implant:'#22c55e',
        impl_fixture:'#22c55e',impl_restored:'#06b6d4',impl_cover:'#84cc16',
        impl_healing:'#eab308',bridge:'#22d3ee',root:'#d946ef',impacted:'#78716c',
        attrition:'#fb923c',cantilever:'#67e8f9',bar:'#a78bfa'};
    if (gtRaw) {
        const gtLayers = typeof parseToothLayers === 'function' ? parseToothLayers(gtRaw) : [{status: gtRaw}];
        const gtAbbr = typeof layersAbbreviation === 'function' ? layersAbbreviation(gtLayers) : gtRaw;
        html += `<div class="crop-fs-gt-badge" style="margin-bottom:6px">GT: <b>${gtAbbr}</b> <span style="opacity:0.6;font-size:10px">(${gtRaw})</span></div>`;
        html += '<div style="margin:4px 0 8px;border-left:2px solid #22c55e;padding-left:6px">';
        html += '<div style="font-size:10px;color:#4ade80;margin-bottom:3px;font-weight:600">Формула (SVG)</div>';
        for (let _li = 0; _li < gtLayers.length; _li++) {
            const layer = gtLayers[_li];
            const color = _GT_COLORS[layer.status] || '#888';
            const label = _GT_LONG[layer.status] || layer.status;
            const surf = layer.surfaces ? ` <span style="color:#94a3b8;font-size:10px">${layer.surfaces.toUpperCase()}</span>` : '';
            const rmBtn = gtLayers.length > 1 ? `<span class="cfs-rm-layer" data-layer-idx="${_li}" title="Удалить слой" style="margin-left:auto;cursor:pointer;color:#ef4444;opacity:0.5;font-size:12px">✕</span>` : '';
            html += `<div style="display:flex;align-items:center;gap:5px;padding:2px 0">
                <span class="crop-fs-child-dot" style="background:${color}"></span>
                <span style="color:#e2e8f0;font-size:11px">${label}${surf}</span>
                ${rmBtn}
            </div>`;
        }
        html += '</div>';
    }

    // Show all / hide all buttons
    const allHidden = card.children.every((c,i) => c._isParentBbox || _cropFsHidden.has(i)) && _cropFsHideParent;
    html += `<div style="margin:8px 0 4px;display:flex;gap:6px">
        <button class="cfs-vis-all" data-action="show" title="Показать все" style="flex:1;padding:3px;font-size:11px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#ccc;cursor:pointer">👁 Все</button>
        <button class="cfs-vis-all" data-action="solo" title="Соло: только выделенный" style="flex:1;padding:3px;font-size:11px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:4px;color:#ccc;cursor:pointer">◉ Соло</button>
    </div>`;

    // ── YOLO detections section (bboxes from neural network) ──
    const hasYolo = card.parentBbox || card.children.some(ch => !ch._isParentBbox);
    if (hasYolo) {
        html += '<div style="margin-top:6px;font-size:10px;color:#64748b;border-top:1px solid #334155;padding-top:4px">YOLO детекции</div>';
    }
    html += '<div style="margin-top:4px">';

    // Parent bbox
    if (card.parentBbox) {
        const isActive = _activeEditChild && _activeEditChild.fileId === fileId
            && _activeEditChild.fdi === fdi
            && card.children[_activeEditChild.childIdx]?._isParentBbox;
        const vis = !_cropFsHideParent;
        html += `<div class="crop-fs-child-item ${isActive?'selected':''} ${!vis?'cfs-hidden':''}" data-idx="parent">
            <span class="cfs-eye" data-eye="parent" title="Видимость">${vis?'👁':'👁‍🗨'}</span>
            <span class="crop-fs-child-dot" style="background:${YOLO_COLORS[card.cls]||'#888'}"></span>
            <span class="crop-fs-child-label">${card.cls} (родит.)</span>
            <span class="crop-fs-child-conf">${Math.round((card.conf||0)*100)}%</span>
        </div>`;
    }

    // Children — hierarchical: group by parent-like classes
    card.children.forEach((ch, i) => {
        if (ch._isParentBbox) return;
        const isActive = _activeEditChild && _activeEditChild.childIdx === i
            && _activeEditChild.fileId === fileId && _activeEditChild.fdi === fdi;
        const color = YOLO_COLORS[ch.cls] || '#888';
        const corrLabel = _getGTCorrectedLabel(fileId, fdi, ch.cls);
        const label = corrLabel ? `${corrLabel} (было: ${ch.cls})` : ch.cls;
        const hasPoly = ch.polygon_pct && ch.polygon_pct.length >= 3;
        const vis = !_cropFsHidden.has(i);
        const isFocused = _cropFsState.focusedChildIdx === i;
        html += `<div class="crop-fs-child-item ${isActive?'selected':''} ${!vis?'cfs-hidden':''} ${isFocused?'cfs-focused':''}" data-idx="${i}">
            <span class="cfs-eye" data-eye="${i}" title="Видимость">${vis?'👁':'👁‍🗨'}</span>
            <span class="crop-fs-child-dot" style="background:${color}"></span>
            <span class="crop-fs-child-label">${label}${hasPoly ? ' ◎' : ''}${ch._manual ? ' ✎' : ''}</span>
            <span class="crop-fs-child-conf">${Math.round((ch.conf||0)*100)}%</span>
            <span class="cfs-focus-btn" data-focus-idx="${i}" title="Фокус на объекте">⊕</span>
        </div>`;
    });

    html += '</div>';
    html += `<div class="crop-fs-help" style="margin-top:16px">
        <b>Управление</b><br>
        <kbd>Колёсико</kbd> или <kbd>＋</kbd><kbd>－</kbd> — зум<br>
        <kbd>⊞ Вписать</kbd> — вернуть в экран<br>
        <b>Клик</b> по объекту — выделить<br>
        <b>Перетащить край</b> — ресайз bbox<br>
        <b>Кнопки Кор/Пл/Кар...</b> — нарисовать bbox<br>
        <kbd>👁</kbd> — скрыть/показать объект<br>
        <kbd>◉ Соло</kbd> — скрыть всё кроме выделенного<br>
        <kbd>←</kbd> <kbd>→</kbd> — навигация по зубам<br>
        <kbd>Esc</kbd> — закрыть
    </div>`;

    sb.innerHTML = html;

    // Eye toggle handlers
    sb.querySelectorAll('.cfs-eye').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const key = el.dataset.eye;
            if (key === 'parent') {
                _cropFsHideParent = !_cropFsHideParent;
            } else {
                const idx = parseInt(key);
                _cropFsHidden.has(idx) ? _cropFsHidden.delete(idx) : _cropFsHidden.add(idx);
            }
            _cropFsDraw();
            _cropFsUpdateSidebar();
        });
    });

    // Show all / Solo handlers
    sb.querySelectorAll('.cfs-vis-all').forEach(el => {
        el.addEventListener('click', () => {
            if (el.dataset.action === 'show') {
                _cropFsHidden.clear();
                _cropFsHideParent = false;
            } else if (el.dataset.action === 'solo') {
                // Solo: hide everything except the active child
                _cropFsHideParent = true;
                card.children.forEach((ch, i) => {
                    if (ch._isParentBbox) return;
                    const isActive = _activeEditChild && _activeEditChild.childIdx === i
                        && _activeEditChild.fileId === fileId && _activeEditChild.fdi === fdi;
                    if (isActive) _cropFsHidden.delete(i);
                    else _cropFsHidden.add(i);
                });
            }
            _cropFsDraw();
            _cropFsUpdateSidebar();
        });
    });

    // Remove GT layer buttons
    sb.querySelectorAll('.cfs-rm-layer').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(el.dataset.layerIdx);
            _removeGTLayer(fileId, fdi, idx);
        });
        el.addEventListener('mouseenter', () => { el.style.opacity = '1'; });
        el.addEventListener('mouseleave', () => { el.style.opacity = '0.5'; });
    });

    // Click handlers for sidebar items (activate child for editing)
    sb.querySelectorAll('.crop-fs-child-item').forEach(el => {
        el.addEventListener('click', () => {
            const idx = el.dataset.idx;
            const canvas = document.getElementById('crop-fs-canvas');
            if (idx === 'parent' && card.parentBbox) {
                const hit = { cls: card.cls, conf: card.conf,
                    x1: card.parentBbox.x1, y1: card.parentBbox.y1,
                    x2: card.parentBbox.x2, y2: card.parentBbox.y2, _isParent: true };
                _activateChildForEdit(hit, card, canvas, canvas.parentElement, fileId, fdi);
            } else {
                const ci = parseInt(idx);
                if (ci >= 0 && ci < card.children.length) {
                    _activateChildForEdit(card.children[ci], card, canvas, canvas.parentElement, fileId, fdi);
                }
            }
        });
    });
    // Focus buttons → open child-focused fullscreen
    sb.querySelectorAll('.cfs-focus-btn').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const idx = parseInt(el.dataset.focusIdx);
            if (idx >= 0 && idx < card.children.length) {
                _cropFsOpenChild(fileId, fdi, idx);
            }
        });
    });
}

// ── Fullscreen crop editor: vertex state, undo/redo, pan, edge-snap ──
let _cropFsVertexState = null; // { dragging, childIdx, vertexIdx }
let _cropFsPanState = null;    // { startX, startY, startScrollX, startScrollY }
const _cropFsUndoStack = [];
const _cropFsRedoStack = [];
const _cropFsHidden = new Set(); // child indices hidden via eye toggle
let _cropFsHideParent = false;   // hide parent bbox
const _CROP_FS_MAX_UNDO = 50;

function _cropFsPushUndo() {
    if (!_cropFsState.open) return;
    const { card } = _cropFsState;
    if (!_activeEditChild) return;
    const ch = card.children[_activeEditChild.childIdx];
    if (!ch) return;
    _cropFsUndoStack.push({
        childIdx: _activeEditChild.childIdx,
        bbox: { x1: ch.x1, y1: ch.y1, x2: ch.x2, y2: ch.y2 },
        polygon_pct: ch.polygon_pct ? ch.polygon_pct.map(p => [...p]) : null
    });
    if (_cropFsUndoStack.length > _CROP_FS_MAX_UNDO) _cropFsUndoStack.shift();
    _cropFsRedoStack.length = 0;
}

function _cropFsUndo() {
    if (!_cropFsState.open || _cropFsUndoStack.length === 0) return;
    const { card } = _cropFsState;
    const snap = _cropFsUndoStack.pop();
    const ch = card.children[snap.childIdx];
    if (!ch) return;
    // Save current for redo
    _cropFsRedoStack.push({
        childIdx: snap.childIdx,
        bbox: { x1: ch.x1, y1: ch.y1, x2: ch.x2, y2: ch.y2 },
        polygon_pct: ch.polygon_pct ? ch.polygon_pct.map(p => [...p]) : null
    });
    Object.assign(ch, snap.bbox);
    ch.polygon_pct = snap.polygon_pct;
    _activeEditChild = { childIdx: snap.childIdx, fileId: _cropFsState.fileId, fdi: _cropFsState.fdi };
    _cropFsDraw(); _cropFsUpdateSidebar();
}

function _cropFsRedo() {
    if (!_cropFsState.open || _cropFsRedoStack.length === 0) return;
    const { card } = _cropFsState;
    const snap = _cropFsRedoStack.pop();
    const ch = card.children[snap.childIdx];
    if (!ch) return;
    _cropFsUndoStack.push({
        childIdx: snap.childIdx,
        bbox: { x1: ch.x1, y1: ch.y1, x2: ch.x2, y2: ch.y2 },
        polygon_pct: ch.polygon_pct ? ch.polygon_pct.map(p => [...p]) : null
    });
    Object.assign(ch, snap.bbox);
    ch.polygon_pct = snap.polygon_pct;
    _activeEditChild = { childIdx: snap.childIdx, fileId: _cropFsState.fileId, fdi: _cropFsState.fdi };
    _cropFsDraw(); _cropFsUpdateSidebar();
}

/** Edge-snap: find highest gradient point near (imgX, imgY) in OPG image. */
function _cropFsEdgeSnap(imgX, imgY, opgImg, radius) {
    radius = radius || 12;
    try {
        const tc = document.createElement('canvas');
        const sz = radius * 2 + 1;
        tc.width = sz; tc.height = sz;
        const tctx = tc.getContext('2d');
        const sx = Math.round(imgX) - radius, sy = Math.round(imgY) - radius;
        tctx.drawImage(opgImg, sx, sy, sz, sz, 0, 0, sz, sz);
        const data = tctx.getImageData(0, 0, sz, sz).data;
        // Sobel gradient magnitude
        let bestGrad = 0, bestX = radius, bestY = radius;
        for (let y = 1; y < sz - 1; y++) {
            for (let x = 1; x < sz - 1; x++) {
                const idx = (i) => data[i * 4]; // use red channel
                const p = (px, py) => idx(py * sz + px);
                const gx = -p(x-1,y-1) - 2*p(x-1,y) - p(x-1,y+1) + p(x+1,y-1) + 2*p(x+1,y) + p(x+1,y+1);
                const gy = -p(x-1,y-1) - 2*p(x,y-1) - p(x+1,y-1) + p(x-1,y+1) + 2*p(x,y+1) + p(x+1,y+1);
                const mag = Math.sqrt(gx*gx + gy*gy);
                if (mag > bestGrad) { bestGrad = mag; bestX = x; bestY = y; }
            }
        }
        if (bestGrad > 20) { // threshold: only snap if there's a real edge
            return { imgX: sx + bestX, imgY: sy + bestY, snapped: true };
        }
    } catch(e) { /* CORS or other error — skip snap */ }
    return { imgX, imgY, snapped: false };
}

/** Hit-test polygon vertices. Returns { vertexIdx } or null. */
function _cropFsHitVertex(canvas, card, opgImg, e) {
    if (!_activeEditChild || !_cropFsState.open) return null;
    const ch = card.children[_activeEditChild.childIdx];
    if (!ch || !ch.polygon_pct || ch.polygon_pct.length < 3) return null;
    const coords = _canvasEventToImgCoords(canvas, card, opgImg, e);
    if (!coords) return null;
    const nW = opgImg?.naturalWidth || 2048, nH = opgImg?.naturalHeight || 1024;
    const hitR = 10 / (_cropFsState.zoom || 1); // pixel radius in canvas space
    const nb = _yoloToNatural(card.bbox, card, opgImg);
    const scX = canvas.width / (nb.x2 - nb.x1), scY = canvas.height / (nb.y2 - nb.y1);
    for (let i = 0; i < ch.polygon_pct.length; i++) {
        const vx = (ch.polygon_pct[i][0] / 100 * nW - nb.x1) * scX;
        const vy = (ch.polygon_pct[i][1] / 100 * nH - nb.y1) * scY;
        const dx = coords.cx - vx, dy = coords.cy - vy;
        if (dx*dx + dy*dy < (hitR * scX) * (hitR * scX) + 100) return { vertexIdx: i };
    }
    return null;
}

/** Find nearest polygon edge for point insertion. Returns { edgeIdx, imgX, imgY } or null. */
function _cropFsNearestEdge(canvas, card, opgImg, e) {
    if (!_activeEditChild || !_cropFsState.open) return null;
    const ch = card.children[_activeEditChild.childIdx];
    if (!ch || !ch.polygon_pct || ch.polygon_pct.length < 3) return null;
    const coords = _canvasEventToImgCoords(canvas, card, opgImg, e);
    if (!coords) return null;
    const nW = opgImg?.naturalWidth || 2048, nH = opgImg?.naturalHeight || 1024;
    let bestDist = Infinity, bestIdx = -1;
    for (let i = 0; i < ch.polygon_pct.length; i++) {
        const j = (i + 1) % ch.polygon_pct.length;
        const ax = ch.polygon_pct[i][0] / 100 * nW, ay = ch.polygon_pct[i][1] / 100 * nH;
        const bx = ch.polygon_pct[j][0] / 100 * nW, by = ch.polygon_pct[j][1] / 100 * nH;
        // Point-to-segment distance
        const dx = bx - ax, dy = by - ay;
        const len2 = dx*dx + dy*dy;
        let t = len2 > 0 ? ((coords.imgX - ax)*dx + (coords.imgY - ay)*dy) / len2 : 0;
        t = Math.max(0, Math.min(1, t));
        const px = ax + t*dx, py = ay + t*dy;
        const dist = Math.sqrt((coords.imgX - px)**2 + (coords.imgY - py)**2);
        if (dist < bestDist) { bestDist = dist; bestIdx = i; }
    }
    if (bestIdx >= 0 && bestDist < 30) return { edgeIdx: bestIdx, imgX: coords.imgX, imgY: coords.imgY };
    return null;
}

// ── Fullscreen crop canvas interaction (mousedown, zoom, etc.) ──
(function() {
    const canvas = document.getElementById('crop-fs-canvas');
    const wrap = document.getElementById('crop-fs-canvas-wrap');

    // Wheel zoom
    wrap.addEventListener('wheel', (e) => {
        if (!_cropFsState.open) return;
        e.preventDefault();
        const factor = e.deltaY < 0 ? 1.15 : 0.87;
        _cropFsZoom(factor);
    }, {passive: false});

    canvas.addEventListener('mousedown', (e) => {
        if (!_cropFsState.open) return;
        const { fileId, fdi, card, opgImg } = _cropFsState;
        const cardEl = canvas.parentElement;

        // Priority 0: vertex drag (polygon point editing)
        if (_activeEditChild && _cropAnnotState.mode !== 'draw') {
            const vHit = _cropFsHitVertex(canvas, card, opgImg, e);
            if (vHit) {
                _cropFsPushUndo();
                _cropFsVertexState = { dragging: true, childIdx: _activeEditChild.childIdx, vertexIdx: vHit.vertexIdx };
                canvas.style.cursor = 'move';
                e.preventDefault(); e.stopPropagation();
                return;
            }
        }

        // Priority 1: child bbox edge → resize
        if (!_childResizeState && _cropAnnotState.mode !== 'draw' && _cropAnnotState.mode !== 'draw_polygon') {
            const chEdge = _getChildBboxEdge(canvas, card, opgImg, e);
            if (chEdge) {
                _cropFsPushUndo();
                if (chEdge._isParentBbox) {
                    let pbChild, pbIdx;
                    const existingPb = card.children.findIndex(c => c._isParentBbox);
                    if (existingPb >= 0) {
                        pbChild = card.children[existingPb]; pbIdx = existingPb;
                    } else {
                        pbChild = { cls: card.cls, conf: card.conf,
                            x1: card.parentBbox.x1, y1: card.parentBbox.y1,
                            x2: card.parentBbox.x2, y2: card.parentBbox.y2,
                            polygon_pct: card.parentBbox.polygon_pct || null, _isParentBbox: true };
                        card.children.push(pbChild); pbIdx = card.children.length - 1;
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
                e.preventDefault(); e.stopPropagation();
                return;
            }
        }

        const coords = _canvasEventToImgCoords(canvas, card, opgImg, e);
        if (!coords) return;

        // Draw mode (bbox)
        if (_cropAnnotState.mode === 'draw') {
            _cropAnnotState.drawStart = coords;
            _cropAnnotState.drawCurrent = coords;
            _cropAnnotState.canvas = canvas;
            _cropAnnotState.card = card;
            _cropAnnotState.cardEl = cardEl;
            e.preventDefault(); e.stopPropagation();
            return;
        }

        // Polygon draw mode — each click adds a point
        if (_cropAnnotState.mode === 'draw_polygon') {
            _cropAnnotState.polygonPoints.push(coords);
            _cropFsDraw();
            // Draw polygon preview on top
            _drawPolygonPreview(canvas, card, opgImg);
            e.preventDefault(); e.stopPropagation();
            return;
        }

        // Hit-test children
        const hit = _hitTestChildBbox(card, coords.imgX, coords.imgY);
        if (hit) {
            _activateChildForEdit(hit, card, canvas, cardEl, fileId, fdi);
            e.stopPropagation();
        } else {
            // Nothing hit → pan mode (if zoomed in)
            if (_activeEditChild) { _activeEditChild = null; _cropFsDraw(); _cropFsUpdateSidebar(); }
            _cropFsPanState = { startX: e.clientX, startY: e.clientY, startScrollX: wrap.scrollLeft, startScrollY: wrap.scrollTop };
            canvas.style.cursor = 'grabbing';
            e.preventDefault();
        }
    });

    // Mousemove: vertex drag / pan / cursor feedback / draw preview
    canvas.addEventListener('mousemove', (e) => {
        if (!_cropFsState.open) return;
        const { card, opgImg, fileId, fdi } = _cropFsState;

        // Vertex dragging
        if (_cropFsVertexState && _cropFsVertexState.dragging) {
            const ch = card.children[_cropFsVertexState.childIdx];
            if (ch && ch.polygon_pct) {
                const coords = _canvasEventToImgCoords(canvas, card, opgImg, e);
                if (coords) {
                    const nW = opgImg?.naturalWidth || 2048, nH = opgImg?.naturalHeight || 1024;
                    // Edge snap (shift key disables snap)
                    let tgtX = coords.imgX, tgtY = coords.imgY;
                    if (!e.shiftKey) {
                        const snap = _cropFsEdgeSnap(coords.imgX, coords.imgY, opgImg, 12);
                        tgtX = snap.imgX; tgtY = snap.imgY;
                    }
                    ch.polygon_pct[_cropFsVertexState.vertexIdx] = [
                        Math.round(tgtX / nW * 10000) / 100,
                        Math.round(tgtY / nH * 10000) / 100
                    ];
                    _cropFsDraw();
                }
            }
            e.preventDefault();
            return;
        }

        // Pan
        if (_cropFsPanState) {
            wrap.scrollLeft = _cropFsPanState.startScrollX - (e.clientX - _cropFsPanState.startX);
            wrap.scrollTop = _cropFsPanState.startScrollY - (e.clientY - _cropFsPanState.startY);
            e.preventDefault();
            return;
        }

        if (_childResizeState || _cropResizeState) return;

        // Polygon draw mode — live preview of cursor line to last point
        if (_cropAnnotState.mode === 'draw_polygon' && _cropAnnotState.polygonPoints.length > 0) {
            _cropFsDraw();
            _drawPolygonPreview(canvas, card, opgImg, e);
            e.preventDefault();
            return;
        }

        if (_cropAnnotState.mode === 'draw' && _cropAnnotState.drawStart) {
            const coords = _canvasEventToImgCoords(canvas, card, opgImg, e);
            if (coords) {
                _cropAnnotState.drawCurrent = coords;
                _drawAnnotPreview(canvas, card, opgImg);
            }
            e.preventDefault();
        } else {
            // Cursor feedback: vertex > edge > child > pan
            const vHit = _activeEditChild ? _cropFsHitVertex(canvas, card, opgImg, e) : null;
            if (vHit) {
                canvas.style.cursor = 'move';
            } else {
                const chEdge = _getChildBboxEdge(canvas, card, opgImg, e);
                if (chEdge) {
                    canvas.style.cursor = _edgeCursor(chEdge.edge);
                } else {
                    const coords = _canvasEventToImgCoords(canvas, card, opgImg, e);
                    if (coords && _hitTestChildBbox(card, coords.imgX, coords.imgY)) {
                        canvas.style.cursor = 'pointer';
                    } else {
                        canvas.style.cursor = _cropAnnotState.mode === 'draw' ? 'crosshair' : 'grab';
                    }
                }
            }
        }
    });

    // Mouseup: vertex drag end / pan end / draw finalization
    canvas.addEventListener('mouseup', (e) => {
        if (!_cropFsState.open) return;

        // Vertex drag end
        if (_cropFsVertexState && _cropFsVertexState.dragging) {
            _cropFsVertexState.dragging = false;
            _cropFsVertexState = null;
            canvas.style.cursor = 'default';
            // Save polygon to server
            const { fileId, fdi, card } = _cropFsState;
            if (_activeEditChild) {
                const ch = card.children[_activeEditChild.childIdx];
                if (ch && ch._annot_id) {
                    const nW = _cropFsState.opgImg?.naturalWidth || 2048, nH = _cropFsState.opgImg?.naturalHeight || 1024;
                    fetch(`/api/panorama/${fileId}/reference-annotations/${ch._annot_id}`, {
                        method: 'PUT', headers: {'Content-Type':'application/json'},
                        body: JSON.stringify({ polygon_pct: ch.polygon_pct,
                            bbox_pct: { x1: ch.x1/nW, y1: ch.y1/nH, x2: ch.x2/nW, y2: ch.y2/nH } })
                    }).catch(err => console.warn('Vertex save failed:', err));
                }
                delete _expertAnnotCache[fileId];
            }
            _cropFsDraw();
            return;
        }

        // Pan end
        if (_cropFsPanState) {
            _cropFsPanState = null;
            canvas.style.cursor = 'grab';
            return;
        }

        // Draw finalization
        if (_cropAnnotState.mode !== 'draw' || !_cropAnnotState.drawStart) return;
        const { fileId, fdi, card, opgImg } = _cropFsState;
        const coords = _canvasEventToImgCoords(canvas, card, opgImg, e);
        if (!coords) return;
        const s = _cropAnnotState.drawStart;
        const x1 = Math.min(s.imgX, coords.imgX), y1 = Math.min(s.imgY, coords.imgY);
        const x2 = Math.max(s.imgX, coords.imgX), y2 = Math.max(s.imgY, coords.imgY);
        if (x2 - x1 < 5 || y2 - y1 < 5) { _cropAnnotState.drawStart = null; _cropFsDraw(); return; }

        const nW = opgImg?.naturalWidth || 2048, nH = opgImg?.naturalHeight || 1024;
        const bbox_pct = { x1: x1/nW, y1: y1/nH, x2: x2/nW, y2: y2/nH };
        const newChild = { cls: _cropAnnotState.activeClass, conf: 1.0, x1, y1, x2, y2, _manual: true };
        card.children.push(newChild);
        fetch(`/api/panorama/${fileId}/reference-annotations`, {
            method: 'POST', headers: {'Content-Type':'application/json'},
            body: JSON.stringify({ fdi, annotation_type: 'child_bbox', label: newChild.cls,
                bbox_pct, details: { source: 'manual_draw' }, source: 'manual_draw' })
        }).then(r => r.json()).then(d => {
            newChild._annot_id = d.id || null;
            _debouncedSaveGT(fileId, fdi, '', `${newChild.cls} manual_draw`, 'manual_draw');
            delete _expertAnnotCache[fileId];
        }).catch(err => console.warn('FS draw save failed:', err));
        _cropAnnotState.drawStart = null;
        _cropFsDraw(); _cropFsUpdateSidebar();
    });

    // Double-click: finalize polygon OR insert vertex on nearest polygon edge
    canvas.addEventListener('dblclick', (e) => {
        // Finalize polygon draw
        if (_cropAnnotState.mode === 'draw_polygon' && _cropAnnotState.polygonPoints.length >= 3) {
            e.preventDefault(); e.stopPropagation();
            _finishPolygonDraw();
            _cropFsExitDraw();
            _cropFsDraw(); _cropFsUpdateSidebar();
            return;
        }
        if (!_cropFsState.open || !_activeEditChild) return;
        const { card, opgImg, fileId } = _cropFsState;
        const ch = card.children[_activeEditChild.childIdx];
        if (!ch || !ch.polygon_pct || ch.polygon_pct.length < 3) return;

        const edgeHit = _cropFsNearestEdge(canvas, card, opgImg, e);
        if (!edgeHit) return;

        _cropFsPushUndo();
        const nW = opgImg?.naturalWidth || 2048, nH = opgImg?.naturalHeight || 1024;
        // Edge snap the new point
        const snap = _cropFsEdgeSnap(edgeHit.imgX, edgeHit.imgY, opgImg, 12);
        const newPt = [
            Math.round(snap.imgX / nW * 10000) / 100,
            Math.round(snap.imgY / nH * 10000) / 100
        ];
        // Insert after edgeIdx
        ch.polygon_pct.splice(edgeHit.edgeIdx + 1, 0, newPt);
        // Select the new vertex for immediate dragging
        _cropFsVertexState = null;
        _cropFsDraw();
        e.preventDefault(); e.stopPropagation();
    });
})();
