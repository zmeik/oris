// implant-library.js — Implant library overlay, SVG auto-match, warp controls
// Extracted from darwin_lab.html lines 6917–7689
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// IMPLANT LIBRARY — Silhouette overlay system
// ═══════════════════════════════════════════════════════════════

const libState = {
    systems: [],           // loaded from API
    selectedSystem: null,  // current system key
    selectedVariant: null, // {diameter, length}
    overlays: [],          // [{implantIdx, system, diameter, length, svgData, x, y, angle, scale}]
    opacity: 0.6,
    svgCache: {},          // cache SVGs: "system_d_l" => svgString
};

function toggleLibPanel() {
    const panel = document.getElementById('lib-panel');
    if (!panel) return;
    const isOpen = panel.classList.toggle('open');
    const btn = document.getElementById('lib-mode-btn');
    if (btn) btn.classList.toggle('active', isOpen);
    if (isOpen && libState.systems.length === 0) {
        loadImplantLibrary();
    }
}

async function loadImplantLibrary() {
    try {
        const resp = await fetch('/api/implant-library');
        const data = await resp.json();
        libState.systems = data.systems || [];
        libState.planmecaLines = data.planmeca_product_lines || {};
        renderLibSystems();
    } catch(e) {
        console.error('Failed to load implant library:', e);
    }
}

function renderLibSystems() {
    const container = document.getElementById('lib-systems');
    if (!container) return;
    container.innerHTML = '';
    libState.systems.forEach(sys => {
        const btn = document.createElement('button');
        btn.className = 'lib-sys-btn';
        const badge = sys.source === 'planmeca_romexis' ? '📋' : '';
        btn.innerHTML = `${badge}${sys.key} <span style="font-size:9px;opacity:0.6">(${sys.n_variants})</span>`;
        const plInfo = sys.product_lines && sys.product_lines.length > 0
            ? `\nProduct lines: ${sys.product_lines.slice(0,5).join(', ')}` : '';
        btn.title = `${sys.manufacturer}, ${sys.country} | ${sys.profile} | ⌀${sys.diameters.join('/')}`
            + `\nИсточник: ${sys.source === 'planmeca_romexis' ? 'Planmeca Romexis SQL каталог' : 'Спецификации производителя'}`
            + plInfo;
        btn.onclick = () => selectLibSystem(sys.key);
        container.appendChild(btn);
    });
}

function selectLibSystem(systemKey) {
    libState.selectedSystem = systemKey;
    // Highlight active
    document.querySelectorAll('.lib-sys-btn').forEach(b => {
        b.classList.toggle('active', b.textContent.startsWith(systemKey));
    });
    // Show variants
    const sys = libState.systems.find(s => s.key === systemKey);
    if (!sys) return;
    renderLibVariants(sys);
    // Load default SVG preview
    const defD = sys.diameters[Math.floor(sys.diameters.length / 2)];
    const defL = sys.lengths[Math.floor(sys.lengths.length / 2)];
    selectLibVariant(defD, defL);
}

function renderLibVariants(sys) {
    const container = document.getElementById('lib-variants');
    if (!container) return;
    container.innerHTML = '';

    // If Planmeca system with product lines — show line selector first
    if (sys.product_lines && sys.product_lines.length > 1) {
        const plDiv = document.createElement('div');
        plDiv.style.cssText = 'margin-bottom:4px;display:flex;flex-wrap:wrap;gap:2px;align-items:center';
        const plLabel = document.createElement('span');
        plLabel.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.4);margin-right:4px';
        plLabel.textContent = '📋 Линейка:';
        plDiv.appendChild(plLabel);

        // "All" button
        const allBtn = document.createElement('button');
        allBtn.className = 'lib-var-btn active';
        allBtn.style.fontSize = '9px';
        allBtn.textContent = `Все (${sys.n_variants})`;
        allBtn.onclick = () => {
            libState.selectedProductLine = null;
            plDiv.querySelectorAll('.lib-var-btn').forEach(b => b.classList.remove('active'));
            allBtn.classList.add('active');
            renderLibDiamLengths(sys, container, null);
        };
        plDiv.appendChild(allBtn);

        sys.product_lines.forEach(pl => {
            const btn = document.createElement('button');
            btn.className = 'lib-var-btn';
            btn.style.fontSize = '9px';
            btn.textContent = pl;
            btn.onclick = () => {
                libState.selectedProductLine = pl;
                plDiv.querySelectorAll('.lib-var-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                renderLibDiamLengths(sys, container, pl);
            };
            plDiv.appendChild(btn);
        });
        container.appendChild(plDiv);
    }

    // Diameter × Length grid
    renderLibDiamLengths(sys, container, null);
}

function renderLibDiamLengths(sys, container, productLine) {
    // Remove old dim grid if any
    const oldGrid = container.querySelector('.lib-dim-grid');
    if (oldGrid) oldGrid.remove();

    const grid = document.createElement('div');
    grid.className = 'lib-dim-grid';
    grid.style.cssText = 'display:flex;flex-wrap:wrap;gap:2px;align-items:center';

    const filteredDiams = productLine
        ? (libState.planmecaLines[sys.key] && libState.planmecaLines[sys.key][productLine]
            ? libState.planmecaLines[sys.key][productLine].diameters : sys.diameters)
        : sys.diameters;
    const filteredLens = productLine
        ? (libState.planmecaLines[sys.key] && libState.planmecaLines[sys.key][productLine]
            ? libState.planmecaLines[sys.key][productLine].lengths : sys.lengths)
        : sys.lengths;

    const label = document.createElement('span');
    label.style.cssText = 'font-size:10px;color:rgba(255,255,255,0.4);margin-right:4px';
    label.textContent = 'Размеры:';
    grid.appendChild(label);

    filteredDiams.forEach(d => {
        const span = document.createElement('span');
        span.style.cssText = 'font-size:9px;color:rgba(255,255,255,0.3);margin:0 2px';
        span.textContent = `⌀${d}:`;
        grid.appendChild(span);
        filteredLens.forEach(l => {
            const btn = document.createElement('button');
            btn.className = 'lib-var-btn';
            btn.textContent = `${d}×${l}`;
            btn.dataset.d = d;
            btn.dataset.l = l;
            btn.onclick = () => selectLibVariant(d, l);
            grid.appendChild(btn);
        });
    });
    container.appendChild(grid);
}

async function selectLibVariant(diameter, length) {
    libState.selectedVariant = {diameter, length};
    // Highlight active
    document.querySelectorAll('.lib-var-btn').forEach(b => {
        b.classList.toggle('active',
            parseFloat(b.dataset.d) === diameter && parseFloat(b.dataset.l) === length);
    });
    // Load SVG preview
    await loadAndShowSvg(libState.selectedSystem, diameter, length);
}

async function loadAndShowSvg(system, diameter, length) {
    // Preview SVG (metallic, with labels)
    const previewKey = `preview_${system}_${diameter}_${length}`;
    if (!libState.svgCache[previewKey]) {
        try {
            const resp = await fetch(`/api/implant-library/${encodeURIComponent(system)}/svg?diameter=${diameter}&length=${length}&w=60&h=130&mode=preview`);
            libState.svgCache[previewKey] = await resp.text();
        } catch(e) {
            console.error('SVG preview load error:', e);
            return;
        }
    }
    const preview = document.getElementById('lib-svg-preview');
    if (preview) {
        preview.innerHTML = libState.svgCache[previewKey];
    }
}

function libUpdateOpacity() {
    const slider = document.getElementById('lib-opacity');
    const val = document.getElementById('lib-opacity-val');
    libState.opacity = parseInt(slider.value) / 100;
    if (val) val.textContent = slider.value + '%';
    libRedrawOverlays();
}

async function libAutoMatch() {
    // Auto-match implant silhouettes to detected implants using backend axis + bbox data
    const ang = lastAssessmentData?.angulation;
    const results = lastAssessmentData?.results;
    if (!ang || !ang.axes || ang.axes.length === 0) {
        console.warn('libAutoMatch: no angulation data available');
        updateAngHint && updateAngHint('Нет данных об имплантатах. Загрузите Implant Assessment сначала.');
        return;
    }

    // Determine system from DB implant data or use selected
    let systemKey = libState.selectedSystem;
    if (!systemKey) {
        // Try to detect from patient's implant records
        systemKey = 'DURAVIT'; // most common default
        // Auto-select in UI
        selectLibSystem(systemKey);
    }

    libState.overlays = [];

    for (let i = 0; i < ang.axes.length; i++) {
        const axis = ang.axes[i];
        const bbox = axis.bbox || {};
        const bboxW = (bbox.x2 || 0) - (bbox.x1 || 0);
        const bboxH = (bbox.y2 || 0) - (bbox.y1 || 0);

        // Ask backend for best size match
        try {
            const resp = await fetch(`/api/implant-library/${encodeURIComponent(systemKey)}/match`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({bbox_w: bboxW, bbox_h: bboxH})
            });
            const match = await resp.json();
            if (match.error) continue;

            const line = axis.axis_line;
            if (!line) continue;

            // Load overlay SVG (clean, no margins/labels) for this variant
            const cacheKey = `overlay_${systemKey}_${match.diameter}_${match.length}`;
            if (!libState.svgCache[cacheKey]) {
                const svgResp = await fetch(`/api/implant-library/${encodeURIComponent(systemKey)}/svg?diameter=${match.diameter}&length=${match.length}&w=100&h=250&mode=overlay`);
                libState.svgCache[cacheKey] = await svgResp.text();
            }

            // Calculate overlay position: center on axis, scale to match bbox
            const axisTopX = line.top.x, axisTopY = line.top.y;
            const axisBotX = line.bottom.x, axisBotY = line.bottom.y;
            const axisCX = (axisTopX + axisBotX) / 2;
            const axisCY = (axisTopY + axisBotY) / 2;
            const axisLen = Math.sqrt((axisBotX - axisTopX)**2 + (axisBotY - axisTopY)**2);

            // Angle of axis from vertical (for SVG rotation)
            const angleDeg = axis.measured_angle || 0;

            libState.overlays.push({
                implantIdx: i,
                system: systemKey,
                diameter: match.diameter,
                length: match.length,
                fdi: axis.fdi || `I${i+1}`,
                svgKey: cacheKey,
                cx: axisCX,
                cy: axisCY,
                axisLen: axisLen,
                bboxW: bboxW,
                bboxH: bboxH,
                angleDeg: angleDeg,
                matchScore: match.match_score,
                symmetryQuality: line.symmetry_quality || 0,
                warp: {topSX:1, midSX:1, botSX:1, topSY:1, midSY:1, botSY:1},
            });
        } catch(e) {
            console.error(`Match error for implant ${i}:`, e);
        }
    }

    libRedrawOverlays();
    _overlaySaveDebounced();  // Auto-save after auto-match

    // Update variant selection to show auto-matched info
    if (libState.overlays.length > 0) {
        const first = libState.overlays[0];
        selectLibVariant(first.diameter, first.length);
        // Update overlay count hint
        const hint = document.getElementById('lib-overlay-count');
        if (hint) hint.textContent = `${libState.overlays.length} наложено`;
    }
}

function libRedrawOverlays() {
    const canvas = document.getElementById('lib-overlay-canvas');
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const img = document.getElementById('opg-viewer-img');
    if (!img || !opgViewer) return;

    canvas.width = wrap.scrollWidth;
    canvas.height = wrap.scrollHeight;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (libState.overlays.length === 0) return;

    // Get current transform from opgViewer state (same as angRedraw uses)
    const zoom = opgViewer.zoom || 1;
    const panX = opgViewer.panX || 0;
    const panY = opgViewer.panY || 0;

    // Pre-load all SVGs as images, then draw all at once
    const loadPromises = libState.overlays.map(ov => {
        const svgStr = libState.svgCache[ov.svgKey];
        if (!svgStr) return Promise.resolve(null);

        return new Promise(resolve => {
            const svgBlob = new Blob([svgStr], {type: 'image/svg+xml'});
            const url = URL.createObjectURL(svgBlob);
            const imgEl = new Image();
            imgEl.onload = () => {
                resolve({img: imgEl, url, ov});
            };
            imgEl.onerror = () => {
                URL.revokeObjectURL(url);
                resolve(null);
            };
            imgEl.src = url;
        });
    });

    Promise.all(loadPromises).then(items => {
        // Clear again in case of race condition
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        items.forEach(item => {
            if (!item) return;
            const {img: svgImg, url, ov} = item;

            // Convert image pixel coords to screen coords
            const screenX = panX + ov.cx * zoom;
            const screenY = panY + ov.cy * zoom;
            const targetH = ov.bboxH * zoom;
            const targetW = ov.bboxW * zoom;

            ctx.save();
            ctx.globalAlpha = libState.opacity;
            ctx.translate(screenX, screenY);
            ctx.rotate(ov.angleDeg * Math.PI / 180);

            // ── Warp-aware drawing ──
            const warp = ov.warp || {topSX:1, midSX:1, botSX:1, topSY:1, midSY:1, botSY:1};
            const hasWarp = warp.topSX !== 1 || warp.midSX !== 1 || warp.botSX !== 1 ||
                            warp.topSY !== 1 || warp.midSY !== 1 || warp.botSY !== 1;

            if (!hasWarp) {
                // Standard uniform draw
                ctx.drawImage(svgImg, -targetW/2, -targetH/2, targetW, targetH);
            } else {
                // Trapezoid warp: draw in N horizontal strips with interpolated scaleX/scaleY
                const N_STRIPS = 24;
                const srcH = svgImg.naturalHeight || svgImg.height;
                const srcW = svgImg.naturalWidth || svgImg.width;
                const stripSrcH = srcH / N_STRIPS;

                // Compute warped total height per strip for Y deformation
                let warpedStrips = [];
                for (let s = 0; s < N_STRIPS; s++) {
                    const t = (s + 0.5) / N_STRIPS;  // 0..1 from top to bottom
                    // Quadratic interpolation: top(0)→mid(0.5)→bot(1)
                    let sx, sy;
                    if (t <= 0.5) {
                        const u = t / 0.5;
                        sx = warp.topSX * (1 - u) + warp.midSX * u;
                        sy = warp.topSY * (1 - u) + warp.midSY * u;
                    } else {
                        const u = (t - 0.5) / 0.5;
                        sx = warp.midSX * (1 - u) + warp.botSX * u;
                        sy = warp.midSY * (1 - u) + warp.botSY * u;
                    }
                    warpedStrips.push({sx, sy});
                }

                // Calculate total warped height
                const nomStripH = targetH / N_STRIPS;
                const totalWarpH = warpedStrips.reduce((sum, ws) => sum + nomStripH * ws.sy, 0);
                const hOffset = -totalWarpH / 2;

                let curY = hOffset;
                for (let s = 0; s < N_STRIPS; s++) {
                    const {sx, sy} = warpedStrips[s];
                    const stripH = nomStripH * sy;
                    const stripW = targetW * sx;
                    const srcY = s * stripSrcH;
                    ctx.drawImage(svgImg,
                        0, srcY, srcW, stripSrcH,           // source rect
                        -stripW/2, curY, stripW, stripH + 1  // dest rect (warped)
                    );
                    curY += stripH;
                }
            }

            // Minimal FDI label above the overlay (no axis/dimension clutter)
            ctx.setLineDash([]);
            ctx.font = 'bold 10px monospace';
            ctx.fillStyle = '#00ffc8';
            ctx.globalAlpha = 0.95;
            ctx.textAlign = 'center';
            ctx.fillText(`${ov.fdi}`, 0, -targetH/2 - 5);
            ctx.font = '8px monospace';
            ctx.fillStyle = 'rgba(255,255,255,0.6)';
            ctx.fillText(`⌀${ov.diameter}×${ov.length}`, 0, -targetH/2 - 16);

            // ── Draw warp handles if warp panel is open ──
            if (warpState.active && warpState.selectedIdx === ov.implantIdx) {
                ctx.globalAlpha = 1.0;
                const handleR = 6;
                // Top handle (platform)
                ctx.fillStyle = '#a78bfa';
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 2;
                ctx.setLineDash([]);
                ctx.beginPath(); ctx.arc(-targetW/2 * (warp.topSX), -targetH/2, handleR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.arc(targetW/2 * (warp.topSX), -targetH/2, handleR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                // Mid handle
                ctx.fillStyle = '#818cf8';
                ctx.beginPath(); ctx.arc(-targetW/2 * (warp.midSX), 0, handleR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.arc(targetW/2 * (warp.midSX), 0, handleR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                // Bottom handle (apex)
                ctx.fillStyle = '#6d28d9';
                ctx.beginPath(); ctx.arc(-targetW/2 * (warp.botSX), targetH/2, handleR, 0, Math.PI*2); ctx.fill(); ctx.stroke();
                ctx.beginPath(); ctx.arc(targetW/2 * (warp.botSX), targetH/2, handleR, 0, Math.PI*2); ctx.fill(); ctx.stroke();

                // Region zone label
                ctx.font = '9px sans-serif';
                ctx.fillStyle = '#c4b5fd';
                ctx.globalAlpha = 0.8;
                ctx.fillText('▲ платформа', -targetW/2 - 20, -targetH/2 - 8);
                ctx.fillText('▼ апекс', -targetW/2 - 20, targetH/2 + 16);
            }

            ctx.restore();
            URL.revokeObjectURL(url);
        });
    });
}

function libClearOverlays() {
    libState.overlays = [];
    libRedrawOverlays();
    _overlaySaveDebounced();
}

// ═══════════════════════════════════════════════════════════════
// OVERLAY STATE — auto-save/load (Фаза 2.1)
// ═══════════════════════════════════════════════════════════════

let _overlaySaveTimer = null;
function _overlaySaveDebounced() {
    if (_overlaySaveTimer) clearTimeout(_overlaySaveTimer);
    _overlaySaveTimer = setTimeout(_overlaySave, 2000);
}

async function _overlaySave() {
    if (!currentFileId) return;
    const payload = libState.overlays.map(ov => ({
        fdi: ov.fdi, system: ov.system, diameter: ov.diameter, length: ov.length,
        cx: Math.round(ov.cx), cy: Math.round(ov.cy), angleDeg: ov.angleDeg,
        bboxW: Math.round(ov.bboxW), bboxH: Math.round(ov.bboxH),
        warp: ov.warp || {topSX:1,midSX:1,botSX:1,topSY:1,midSY:1,botSY:1},
        matchScore: ov.matchScore || 0, source: ov.source || 'auto',
        implantIdx: ov.implantIdx,
    }));
    try {
        const resp = await fetch(`/api/panorama/${currentFileId}/overlay-state`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({overlays: payload}),
        });
        if (resp.ok) {
            const d = await resp.json();
            console.log(`[overlay-state] saved ${d.saved} overlays at ${d.saved_at}`);
        }
    } catch(e) { console.warn('[overlay-state] save error:', e); }
}

async function _overlayLoad(fileId) {
    try {
        const resp = await fetch(`/api/panorama/${fileId}/overlay-state`);
        if (!resp.ok) return;
        const data = await resp.json();
        if (!data.overlays || data.overlays.length === 0) return;
        console.log(`[overlay-state] loaded ${data.overlays.length} overlays from ${data.saved_at}`);
        // Восстановить оверлеи
        data.overlays.forEach(ov => {
            // Нужно восстановить SVG-ключ
            const svgKey = `${ov.system}_${ov.diameter}_${ov.length}`;
            if (!libState.svgCache[svgKey]) {
                // Загрузить SVG из библиотеки
                const sys = encodeURIComponent(ov.system);
                fetch(`/api/implant-library/${sys}/silhouette?diameter=${ov.diameter}&length=${ov.length}&mode=overlay`)
                    .then(r => r.text())
                    .then(svg => { libState.svgCache[svgKey] = svg; libRedrawOverlays(); });
            }
            libState.overlays.push({...ov, svgKey});
        });
        libRedrawOverlays();
    } catch(e) { console.warn('[overlay-state] load error:', e); }
}

// ═══════════════════════════════════════════════════════════════
// LOCAL WARP — per-implant non-uniform distortion correction
// ═══════════════════════════════════════════════════════════════
//
// Принцип: имплантат имеет фиксированные размеры из каталога.
// На OPG дисторсия неравномерна — верх может быть сжат иначе чем низ.
// Особенно во фронтальном отделе (Mh < 1.0, горизонтальное сжатие).
// Warp позволяет сжимать/расширять верх/середину/низ независимо,
// пока силуэт не совпадёт с рентгеновским изображением.

const warpState = {
    active: false,
    selectedIdx: -1,  // implantIdx of selected overlay
    dragging: null,    // {zone:'top'|'mid'|'bot', axis:'x'|'y', startVal}
};

function toggleWarpPanel() {
    const panel = document.getElementById('warp-panel');
    if (!panel) return;
    const isOpen = panel.classList.toggle('open');
    const btn = document.getElementById('warp-mode-btn');
    if (btn) btn.classList.toggle('active', isOpen);
    warpState.active = isOpen;

    if (isOpen) {
        warpPopulateImplants();
        // Listen on the parent canvas container — handles are checked by coord proximity
        // pointer-events stays 'none' on lib-overlay-canvas so pan/zoom still works
        const container = document.getElementById('opg-viewer-canvas');
        if (container) {
            container.addEventListener('mousedown', warpHandleMouseDown, true); // capture phase
        }
    } else {
        const container = document.getElementById('opg-viewer-canvas');
        if (container) {
            container.removeEventListener('mousedown', warpHandleMouseDown, true);
        }
        warpState.selectedIdx = -1;
    }
    libRedrawOverlays();
}

function warpPopulateImplants() {
    const container = document.getElementById('warp-impl-select');
    if (!container) return;

    if (libState.overlays.length === 0) {
        container.innerHTML = '<span style="font-size:10px;color:rgba(255,255,255,0.4)">Сначала наложите силуэты (🦷 Библиотека → 🔍 Подобрать)</span>';
        document.getElementById('warp-controls').style.display = 'none';
        return;
    }

    container.innerHTML = '<span style="font-size:10px;color:rgba(255,255,255,0.4);margin-right:4px">Имплантат:</span>';
    libState.overlays.forEach((ov, i) => {
        const btn = document.createElement('button');
        btn.className = 'warp-impl-btn' + (warpState.selectedIdx === ov.implantIdx ? ' active' : '');
        btn.textContent = `${ov.fdi} ⌀${ov.diameter}×${ov.length}`;
        btn.onclick = () => warpSelectImplant(ov.implantIdx);
        container.appendChild(btn);
    });
}

function warpSelectImplant(idx) {
    warpState.selectedIdx = idx;

    // Highlight button
    document.querySelectorAll('.warp-impl-btn').forEach((b, i) => {
        const ov = libState.overlays[i];
        if (ov) b.classList.toggle('active', ov.implantIdx === idx);
    });

    // Show controls
    const controls = document.getElementById('warp-controls');
    if (controls) controls.style.display = 'block';

    // Load current warp values into sliders
    const ov = libState.overlays.find(o => o.implantIdx === idx);
    if (!ov) return;
    if (!ov.warp) ov.warp = {topSX:1, midSX:1, botSX:1, topSY:1, midSY:1, botSY:1};

    const w = ov.warp;
    _warpSetSlider('warp-top-sx', w.topSX);
    _warpSetSlider('warp-mid-sx', w.midSX);
    _warpSetSlider('warp-bot-sx', w.botSX);
    _warpSetSlider('warp-top-sy', w.topSY);
    _warpSetSlider('warp-mid-sy', w.midSY);
    _warpSetSlider('warp-bot-sy', w.botSY);

    // Info
    const info = document.getElementById('warp-info');
    if (info) info.textContent = `${ov.fdi} | ${ov.system} ⌀${ov.diameter}×${ov.length}`;

    libRedrawOverlays();
}

function _warpSetSlider(id, val) {
    const el = document.getElementById(id);
    if (el) el.value = Math.round(val * 100);
    const valEl = document.getElementById(id + '-val');
    if (valEl) valEl.textContent = val.toFixed(2) + '×';
}

function warpSliderChanged() {
    const ov = libState.overlays.find(o => o.implantIdx === warpState.selectedIdx);
    if (!ov) return;
    if (!ov.warp) ov.warp = {topSX:1, midSX:1, botSX:1, topSY:1, midSY:1, botSY:1};

    const ids = ['warp-top-sx','warp-mid-sx','warp-bot-sx','warp-top-sy','warp-mid-sy','warp-bot-sy'];
    const keys = ['topSX','midSX','botSX','topSY','midSY','botSY'];
    ids.forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) {
            const v = parseInt(el.value) / 100;
            ov.warp[keys[i]] = v;
            const valEl = document.getElementById(id + '-val');
            if (valEl) valEl.textContent = v.toFixed(2) + '×';
        }
    });

    libRedrawOverlays();
}

function warpReset() {
    const ov = libState.overlays.find(o => o.implantIdx === warpState.selectedIdx);
    if (!ov) return;
    ov.warp = {topSX:1, midSX:1, botSX:1, topSY:1, midSY:1, botSY:1};
    warpSelectImplant(warpState.selectedIdx);
}

function warpCopyAll() {
    const ov = libState.overlays.find(o => o.implantIdx === warpState.selectedIdx);
    if (!ov || !ov.warp) return;

    // Determine region of the selected implant (left/anterior/right based on cx)
    const img = opgViewer?.img;
    if (!img) return;
    const imgW = img.naturalWidth || 1000;
    const relX = ov.cx / imgW;
    // Region: left molar (0-0.25), left premolar (0.25-0.4), anterior (0.4-0.6), right premolar (0.6-0.75), right molar (0.75-1)
    const getRegion = (rx) => {
        if (rx < 0.25) return 'left_molar';
        if (rx < 0.4) return 'left_premolar';
        if (rx < 0.6) return 'anterior';
        if (rx < 0.75) return 'right_premolar';
        return 'right_molar';
    };
    const srcRegion = getRegion(relX);
    const warpCopy = {...ov.warp};

    let count = 0;
    libState.overlays.forEach(o => {
        if (o.implantIdx === ov.implantIdx) return;
        const oRegion = getRegion(o.cx / imgW);
        if (oRegion === srcRegion) {
            o.warp = {...warpCopy};
            count++;
        }
    });

    const regionNames = {
        left_molar: 'левые моляры', left_premolar: 'левые премоляры',
        anterior: 'передний отдел', right_premolar: 'правые премоляры', right_molar: 'правые моляры'
    };
    const info = document.getElementById('warp-info');
    if (info) info.textContent = `Скопировано на ${count} имплантат(ов) в регионе «${regionNames[srcRegion]}»`;
    libRedrawOverlays();
}

function warpApplyToImage() {
    // TODO: Apply local canvas warp to the underlying OPG image region
    // This would use canvas 2D transforms to warp a rectangular region of the image
    const info = document.getElementById('warp-info');
    if (info) info.textContent = 'Деформация записана. Применение к снимку — в разработке.';
}

// ── Handle dragging on canvas ──
function warpHandleMouseDown(e) {
    if (!warpState.active || warpState.selectedIdx < 0) return;
    const ov = libState.overlays.find(o => o.implantIdx === warpState.selectedIdx);
    if (!ov) return;

    const container = document.getElementById('opg-viewer-canvas');
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const zoom = opgViewer.zoom || 1;
    const panX = opgViewer.panX || 0;
    const panY = opgViewer.panY || 0;

    // Screen coords of implant center
    const screenX = panX + ov.cx * zoom;
    const screenY = panY + ov.cy * zoom;
    const targetH = ov.bboxH * zoom;
    const targetW = ov.bboxW * zoom;

    const warp = ov.warp || {topSX:1, midSX:1, botSX:1, topSY:1, midSY:1, botSY:1};
    const angle = (ov.angleDeg || 0) * Math.PI / 180;

    // Transform mouse coords to implant-local coords (undo rotation + translation)
    const dx = mx - screenX;
    const dy = my - screenY;
    const cosA = Math.cos(-angle);
    const sinA = Math.sin(-angle);
    const lx = dx * cosA - dy * sinA;
    const ly = dx * sinA + dy * cosA;

    // Check proximity to handles
    const handleR = 10;
    const handles = [
        {zone:'top', y: -targetH/2, sx: warp.topSX},
        {zone:'mid', y: 0, sx: warp.midSX},
        {zone:'bot', y: targetH/2, sx: warp.botSX},
    ];

    for (const h of handles) {
        const hxL = -targetW/2 * h.sx;
        const hxR = targetW/2 * h.sx;
        const hy = h.y;
        if (Math.abs(ly - hy) < handleR && (Math.abs(lx - hxL) < handleR || Math.abs(lx - hxR) < handleR)) {
            warpState.dragging = {
                zone: h.zone,
                axis: 'x',
                startMouseX: e.clientX,
                startVal: h.sx,
                baseW: targetW,
                ovIdx: ov.implantIdx,
            };
            e.preventDefault();
            e.stopPropagation();
            window.addEventListener('mousemove', warpHandleMouseMove);
            window.addEventListener('mouseup', warpHandleMouseUp);
            return;
        }
    }
}

function warpHandleMouseMove(e) {
    if (!warpState.dragging) return;
    const d = warpState.dragging;
    const ov = libState.overlays.find(o => o.implantIdx === d.ovIdx);
    if (!ov || !ov.warp) return;

    const deltaX = e.clientX - d.startMouseX;
    // Convert pixel delta to scale change
    const scaleDelta = (deltaX * 2) / Math.max(d.baseW, 20);
    let newVal = Math.max(0.3, Math.min(2.5, d.startVal + scaleDelta));

    const keyMap = {top:'topSX', mid:'midSX', bot:'botSX'};
    ov.warp[keyMap[d.zone]] = newVal;

    // Update sliders
    _warpSetSlider('warp-' + d.zone.substring(0,3) + '-sx', newVal);

    libRedrawOverlays();
}

function warpHandleMouseUp(e) {
    warpState.dragging = null;
    window.removeEventListener('mousemove', warpHandleMouseMove);
    window.removeEventListener('mouseup', warpHandleMouseUp);
    _overlaySaveDebounced();  // Auto-save after warp adjustment
}

// Redraw overlays when viewer changes (zoom/pan)
const _origOPGApply = typeof opgViewerApply === 'function' ? opgViewerApply : null;

