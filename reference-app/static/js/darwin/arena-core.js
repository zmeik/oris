// arena-core.js — Arena state, notes, bridges, root data, loadArena, sandbox
// Extracted from darwin_lab.html lines 7690–8686
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// ARENA VIEW
// ═══════════════════════════════════════════════════════════════

let arenaGroundTruth = {};
let arenaBridgeLinks = JSON.parse(localStorage.getItem('darwin_bridge_links') || '{}');
let arenaToothNotes = JSON.parse(localStorage.getItem('darwin_tooth_notes') || '{}');
window.arenaCropOverrides = {};
var arenaRootData = {}; // fileId -> {fdi -> {variant, vertucci:{rootIdx:'Type'}, fillStates:{'ri_ci':stateIdx}}}

function _loadRootData(fileId) {
    // DB data (loaded in loadArena from gtData.root_data) takes priority over localStorage
    if (arenaRootData[fileId] && Object.keys(arenaRootData[fileId]).length > 0) return;
    try {
        const stored = localStorage.getItem('darwinRootData_' + fileId);
        if (stored) arenaRootData[fileId] = JSON.parse(stored);
    } catch(e) {}
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
}
function _saveRootData(fileId) {
    localStorage.setItem('darwinRootData_' + fileId, JSON.stringify(arenaRootData[fileId] || {}));
}

// ═══ Tooth notes (позиционные аномалии, комментарии) ═══
const NOTE_PRESETS = [
    {label: '⬅ Мезиальный дрифт', value: 'мез. дрифт'},
    {label: '➡ Дистальный дрифт', value: 'дист. дрифт'},
    {label: '↻ Ротация', value: 'ротация'},
    {label: '↗ Наклон мезиально', value: 'наклон мез.'},
    {label: '↘ Наклон дистально', value: 'наклон дист.'},
    {label: '↑ Выдвижение', value: 'выдвижение'},
    {label: '↓ Погружение', value: 'погружение'},
    {label: '⇆ Вестибулярно', value: 'вестибул. смещ.'},
    {label: '⇄ Орально', value: 'оральн. смещ.'},
    {label: '⚠ Скученность', value: 'скученность'},
    {label: '⬜ Диастема', value: 'диастема'},
    {label: '⬜ Трема', value: 'трема'},
];

// ═══ Implant complication presets (Pjetursson 2012, Misch 2008, Froum & Rosen 2012) ═══
const IMPLANT_COMPLICATION_PRESETS = [
    // ── Механические (Mechanical) ──
    {label: '⚠ Винт ослаблен', value: '⚠SCR_LOOSE', code: 'SCR_LOOSE', severity: 'warning',
     en: 'Abutment screw loosening', desc: 'Ослабление винта абатмента — 5-8% за 5 лет (Pjetursson 2012)'},
    {label: '🔴 Перелом винта', value: '🔴SCR_FRAC', code: 'SCR_FRAC', severity: 'critical',
     en: 'Abutment screw fracture', desc: 'Перелом винта абатмента — <0.5% (Pjetursson 2012)'},
    {label: '⚠ Неприлегание абатмента', value: '⚠ABT_MISFIT', code: 'ABT_MISFIT', severity: 'warning',
     en: 'Abutment misfit / non-seating', desc: 'Неполная посадка абатмента — зазор >150μm, Misch Group II'},
    {label: '🔴 Перелом абатмента', value: '🔴ABT_FRAC', code: 'ABT_FRAC', severity: 'critical',
     en: 'Abutment fracture', desc: 'Перелом абатмента — <1% (Pjetursson 2012)'},
    {label: '🔴 Перелом имплантата', value: '🔴IMPL_FRAC', code: 'IMPL_FRAC', severity: 'critical',
     en: 'Implant body fracture', desc: 'Перелом тела имплантата — 0.4%, Misch Group IV'},
    {label: '⚠ Скол керамики', value: '⚠VEN_CHIP', code: 'VEN_CHIP', severity: 'warning',
     en: 'Veneer chipping', desc: 'Скол облицовки — 13.5% за 5 лет (Pjetursson 2012)'},
    {label: '⚠ Расцементировка', value: '⚠RET_LOSS', code: 'RET_LOSS', severity: 'warning',
     en: 'Loss of retention', desc: 'Расцементировка протеза — 4.7% (Pjetursson 2012)'},
    {label: '⚠ Несоответствие каркаса', value: '⚠FRM_MISFIT', code: 'FRM_MISFIT', severity: 'warning',
     en: 'Framework misfit', desc: 'Неточная посадка каркаса протеза'},
    // ── Биологические (Biological) ──
    {label: '⚠ Мукозит', value: '⚠PERI_MUC', code: 'PERI_MUC', severity: 'warning',
     en: 'Peri-implant mucositis', desc: 'Периимплантный мукозит — воспаление мягких тканей без потери кости'},
    {label: '⚠ Периимплантит I', value: '⚠PERI_EARLY', code: 'PERI_EARLY', severity: 'warning',
     en: 'Peri-implantitis (early)', desc: 'Начальный периимплантит — потеря кости <25% (Froum & Rosen 2012)'},
    {label: '🔴 Периимплантит II', value: '🔴PERI_MOD', code: 'PERI_MOD', severity: 'critical',
     en: 'Peri-implantitis (moderate)', desc: 'Средний периимплантит — потеря кости 25-50% (Froum & Rosen 2012)'},
    {label: '🔴 Периимплантит III', value: '🔴PERI_ADV', code: 'PERI_ADV', severity: 'critical',
     en: 'Peri-implantitis (advanced)', desc: 'Выраженный периимплантит — потеря кости >50% (Froum & Rosen 2012)'},
    {label: '🔴 Отторжение', value: '🔴OSSEO_FAIL', code: 'OSSEO_FAIL', severity: 'critical',
     en: 'Osseointegration failure', desc: 'Нарушение остеоинтеграции — Misch Group IV'},
    {label: '⚠ Резорбция кости', value: '⚠BL_EXCESS', code: 'BL_EXCESS', severity: 'warning',
     en: 'Excessive marginal bone loss', desc: 'Избыточная резорбция >2мм/год (Albrektsson criteria)'},
    // ── Ятрогенные (Iatrogenic) ──
    {label: '⚠ Неправильная позиция', value: '⚠MALPOS', code: 'MALPOS', severity: 'warning',
     en: 'Implant malposition', desc: 'Неправильная позиция/ангуляция имплантата'},
];

// Note storage: arenaToothNotes[fileId][fdi] = "мез. дрифт, наклон мез." (comma-separated tags)
function _getNoteTags(fileId, fdi) {
    const raw = (arenaToothNotes[fileId] || {})[fdi] || '';
    return raw ? raw.split(', ').filter(Boolean) : [];
}

function toggleToothNoteTag(fileId, fdi, tag) {
    if (!arenaToothNotes[fileId]) arenaToothNotes[fileId] = {};
    const tags = _getNoteTags(fileId, fdi);
    const idx = tags.indexOf(tag);
    if (idx >= 0) tags.splice(idx, 1);
    else tags.push(tag);
    if (tags.length > 0) arenaToothNotes[fileId][fdi] = tags.join(', ');
    else delete arenaToothNotes[fileId][fdi];
    localStorage.setItem('darwin_tooth_notes', JSON.stringify(arenaToothNotes));
    _debouncedSaveGT(fileId);
    const cell = document.querySelector(`.arena-formula-row.ground-truth .arena-cell[data-fdi="${fdi}"][data-file="${fileId}"]`);
    if (cell) _updateNoteIndicator(cell, fileId, fdi);
}

function setToothNote(fileId, fdi, note) {
    if (!arenaToothNotes[fileId]) arenaToothNotes[fileId] = {};
    if (note) arenaToothNotes[fileId][fdi] = note;
    else delete arenaToothNotes[fileId][fdi];
    localStorage.setItem('darwin_tooth_notes', JSON.stringify(arenaToothNotes));
    _debouncedSaveGT(fileId);
    const cell = document.querySelector(`.arena-formula-row.ground-truth .arena-cell[data-fdi="${fdi}"][data-file="${fileId}"]`);
    if (cell) _updateNoteIndicator(cell, fileId, fdi);
}

function _getNoteSeverity(noteStr) {
    if (!noteStr) return '';
    if (noteStr.includes('🔴')) return 'critical';
    if (noteStr.includes('⚠')) return 'warning';
    return '';
}

// ═══ Note visual arrows — compute arrow HTML + CSS classes from note tags ═══
// Mesial direction in display depends on FDI quadrant:
//   Q1(1.x), Q4(4.x) → mesial = right (toward midline)
//   Q2(2.x), Q3(3.x) → mesial = left  (toward midline)
function _isMesialRight(fdi) {
    return fdi.startsWith('1.') || fdi.startsWith('4.');
}

// Generate a single SVG overlay with all arrows drawn from center
// SVG viewBox 0 0 32 32, center = 16,16
function _getNoteVisuals(noteStr, fdi) {
    if (!noteStr) return { arrows: '', classes: '' };
    const tags = noteStr.split(', ');
    const mR = _isMesialRight(fdi);
    let paths = [];
    const C = 16; // center
    const col = 'rgba(251,191,36,0.9)';
    const colR = 'rgba(239,68,68,0.9)'; // for critical/spacing

    // Arrow helper: line from center toward direction with arrowhead
    // dx,dy = direction vector (will be normalized to length)
    function arrow(dx, dy, len, color) {
        const mag = Math.sqrt(dx*dx + dy*dy);
        const ux = dx/mag, uy = dy/mag;
        const ex = C + ux*len, ey = C + uy*len;
        // Arrowhead: two short lines from tip, angled ±30°
        const aLen = 4;
        const cos30 = 0.866, sin30 = 0.5;
        const lx = ex - aLen*(ux*cos30 - uy*sin30), ly = ey - aLen*(uy*cos30 + ux*sin30);
        const rx = ex - aLen*(ux*cos30 + uy*sin30), ry = ey - aLen*(uy*cos30 - ux*sin30);
        return `<line x1="${C}" y1="${C}" x2="${ex.toFixed(1)}" y2="${ey.toFixed(1)}" stroke="${color || col}" stroke-width="2.2" stroke-linecap="round"/>` +
               `<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${lx.toFixed(1)}" y2="${ly.toFixed(1)}" stroke="${color || col}" stroke-width="1.8" stroke-linecap="round"/>` +
               `<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${rx.toFixed(1)}" y2="${ry.toFixed(1)}" stroke="${color || col}" stroke-width="1.8" stroke-linecap="round"/>`;
    }

    // Curved tilt arrow: arc from center toward a corner
    function tiltArrow(dx, dy, color) {
        const len = 12;
        const ex = C + dx*len, ey = C + dy*len;
        // Control point perpendicular to direction for curve
        const cx = C + dx*len*0.5 - dy*5, cy = C + dy*len*0.5 + dx*5;
        // Arrowhead at tip
        const aLen = 3.5;
        const adx = ex - cx, ady = ey - cy;
        const am = Math.sqrt(adx*adx+ady*ady);
        const aux = adx/am, auy = ady/am;
        const cos30 = 0.866, sin30 = 0.5;
        const lx = ex - aLen*(aux*cos30 - auy*sin30), ly = ey - aLen*(auy*cos30 + aux*sin30);
        const rx = ex - aLen*(aux*cos30 + auy*sin30), ry = ey - aLen*(auy*cos30 - aux*sin30);
        return `<path d="M${C},${C} Q${cx.toFixed(1)},${cy.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}" fill="none" stroke="${color || col}" stroke-width="2" stroke-linecap="round"/>` +
               `<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${lx.toFixed(1)}" y2="${ly.toFixed(1)}" stroke="${color || col}" stroke-width="1.6" stroke-linecap="round"/>` +
               `<line x1="${ex.toFixed(1)}" y1="${ey.toFixed(1)}" x2="${rx.toFixed(1)}" y2="${ry.toFixed(1)}" stroke="${color || col}" stroke-width="1.6" stroke-linecap="round"/>`;
    }

    // Detect combo: drift + tilt same direction → merge into one visual
    const hasMezDrift = tags.includes('мез. дрифт');
    const hasDistDrift = tags.includes('дист. дрифт');
    const hasMezTilt = tags.includes('наклон мез.');
    const hasDistTilt = tags.includes('наклон дист.');
    const comboMez = hasMezDrift && hasMezTilt;
    const comboDist = hasDistDrift && hasDistTilt;

    for (const tag of tags) {
        switch (tag) {
            case 'мез. дрифт':
                if (comboMez) {
                    // Combo: horizontal drift arrow at bottom half
                    paths.push(arrow(mR ? 1 : -1, 0.3, 11));
                } else {
                    paths.push(arrow(mR ? 1 : -1, 0, 13));
                }
                break;
            case 'дист. дрифт':
                if (comboDist) {
                    paths.push(arrow(mR ? -1 : 1, 0.3, 11));
                } else {
                    paths.push(arrow(mR ? -1 : 1, 0, 13));
                }
                break;
            case 'наклон мез.':
                if (comboMez) {
                    // Combo: tilt arrow at top half, shorter
                    paths.push(tiltArrow(mR ? 0.7 : -0.7, -0.85));
                } else {
                    paths.push(tiltArrow(mR ? 0.7 : -0.7, -0.7));
                }
                break;
            case 'наклон дист.':
                if (comboDist) {
                    paths.push(tiltArrow(mR ? -0.7 : 0.7, -0.85));
                } else {
                    paths.push(tiltArrow(mR ? -0.7 : 0.7, -0.7));
                }
                break;
            case 'выдвижение':
                paths.push(arrow(0, -1, 12));
                break;
            case 'погружение':
                paths.push(arrow(0, 1, 12));
                break;
            case 'ротация':
                // Circular arrow (arc + arrowhead)
                paths.push(`<path d="M${C+8},${C-4} A 9 9 0 1 1 ${C+4},${C-8}" fill="none" stroke="${col}" stroke-width="2" stroke-linecap="round"/>` +
                    `<polygon points="${C+4},${C-11} ${C+7},${C-7} ${C+1},${C-7}" fill="${col}"/>`);
                break;
            case 'вестибул. смещ.':
                // Dot-arrow outward (toward viewer) — circle with dot
                paths.push(`<circle cx="${C}" cy="${C}" r="5" fill="none" stroke="${col}" stroke-width="1.8"/>` +
                    `<circle cx="${C}" cy="${C}" r="1.5" fill="${col}"/>`);
                break;
            case 'оральн. смещ.':
                // Cross circle (away from viewer)
                paths.push(`<circle cx="${C}" cy="${C}" r="5" fill="none" stroke="${col}" stroke-width="1.8"/>` +
                    `<line x1="${C-3}" y1="${C-3}" x2="${C+3}" y2="${C+3}" stroke="${col}" stroke-width="1.5"/>` +
                    `<line x1="${C+3}" y1="${C-3}" x2="${C-3}" y2="${C+3}" stroke="${col}" stroke-width="1.5"/>`);
                break;
            case 'скученность':
                // Two converging arrows
                paths.push(arrow(-0.3, 0, 8, colR));
                paths.push(arrow(0.3, 0, 8, colR));
                break;
            case 'диастема':
            case 'трема':
                // Two diverging short arrows
                paths.push(arrow(-1, 0, 8, col));
                paths.push(arrow(1, 0, 8, col));
                // Gap indicator: small vertical line at center
                paths.push(`<line x1="${C}" y1="${C-4}" x2="${C}" y2="${C+4}" stroke="${col}" stroke-width="1.5" stroke-dasharray="2,2"/>`);
                break;
        }
    }

    if (paths.length === 0) return { arrows: '', classes: '' };
    const svg = `<svg class="note-arrows-svg" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${paths.join('')}</svg>`;
    return { arrows: svg, classes: '' };
}

function _updateNoteIndicator(cellEl, fileId, fdi) {
    // Remove old arrows and dot
    cellEl.querySelectorAll('.note-dot,.note-arrows-svg').forEach(el => el.remove());

    const note = (arenaToothNotes[fileId] || {})[fdi];
    if (note) {
        // Severity dot
        const sev = _getNoteSeverity(note);
        const dot = document.createElement('span');
        dot.className = 'note-dot' + (sev ? ` severity-${sev}` : '');
        dot.title = note;
        cellEl.appendChild(dot);

        // Visual arrows — insert into the .note-arrows-wrap (which wraps the tooth-svg)
        const vis = _getNoteVisuals(note, fdi);
        if (vis.arrows) {
            const wrap = cellEl.querySelector('.note-arrows-wrap');
            if (wrap) wrap.insertAdjacentHTML('beforeend', vis.arrows);
            else cellEl.insertAdjacentHTML('beforeend', vis.arrows); // fallback
        }
    }
}
// Все допустимые статусы (GT эксперт + Pipeline AI + суперструктура имплантатов)
const ARENA_STATUS_CYCLE = ['', 'present', 'missing', 'implant', 'impl_fixture', 'impl_healing', 'impl_restored', 'post', 'crowned', 'restored', 'caries', 'endo', 'root', 'impacted', 'bridge', 'bar', 'cantilever', 'uncertain'];

// ═══ Bridge link helpers ═══
function makeBridgeKey(fdi1, fdi2) {
    return [fdi1, fdi2].sort().join('-');
}
function toggleBridgeLink(fileId, fdi1, fdi2) {
    if (!arenaBridgeLinks[fileId]) arenaBridgeLinks[fileId] = {};
    const key = makeBridgeKey(fdi1, fdi2);
    if (arenaBridgeLinks[fileId][key]) delete arenaBridgeLinks[fileId][key];
    else arenaBridgeLinks[fileId][key] = true;
    localStorage.setItem('darwin_bridge_links', JSON.stringify(arenaBridgeLinks));
    _debouncedSaveGT(fileId);
    loadArena(); // re-render to show connectors
}
function getAdjacentFdi(fdi, direction) {
    const UPPER = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
    const LOWER = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
    for (const row of [UPPER, LOWER]) {
        const idx = row.indexOf(fdi);
        if (idx >= 0) {
            if (direction === 'right' && idx < row.length - 1) return row[idx + 1];
            if (direction === 'left' && idx > 0) return row[idx - 1];
        }
    }
    return null;
}

async function loadArena() {
    // Load sandbox list on first call
    await loadSandboxList();

    const sbxParam = currentSandboxId && currentSandboxId !== 'RUDN' ? `?sandbox_id=${currentSandboxId}` : '';
    const resp = await fetch('/api/darwin/test-cases' + sbxParam);
    const data = await resp.json();
    const cases = data;

    const container = document.getElementById('arena-cases');
    // Show loading indicator
    let _loadingBanner = document.getElementById('arena-loading-banner');
    if (!_loadingBanner) {
        _loadingBanner = document.createElement('div');
        _loadingBanner.id = 'arena-loading-banner';
        _loadingBanner.style.cssText = 'position:fixed;top:70px;left:50%;transform:translateX(-50%);z-index:9999;background:#6366f1;color:#fff;padding:10px 24px;border-radius:8px;font-size:13px;box-shadow:0 4px 16px rgba(0,0,0,0.4);display:flex;align-items:center;gap:10px';
        _loadingBanner.innerHTML = '<span style="animation:spin 1s linear infinite;display:inline-block">⟳</span> <span id="arena-loading-text">Loading Arena…</span>';
        document.body.appendChild(_loadingBanner);
        // Add spin animation
        if (!document.getElementById('arena-spin-style')) {
            const style = document.createElement('style');
            style.id = 'arena-spin-style';
            style.textContent = '@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}';
            document.head.appendChild(style);
        }
    }
    _loadingBanner.style.display = 'flex';
    const _updateLoading = (msg) => { const el = document.getElementById('arena-loading-text'); if (el) el.textContent = msg; };

    // Save scroll position before re-rendering
    const mainPanel = container.closest('.main') || container.parentElement;
    const savedScroll = mainPanel ? mainPanel.scrollTop : 0;
    container.innerHTML = '';

    // Load ground truth from DATABASE first, then fallback to localStorage
    _updateLoading(`Loading ground truth: 0/${cases.length}…`);
    let _gtLoaded = 0;
    for (const tc of cases) {
        try {
            const gtResp = await fetch(`/api/darwin/ground-truth/${tc.file_id}`);
            const gtData = await gtResp.json();
            if (gtData.formula && Object.keys(gtData.formula).length > 0) {
                arenaGroundTruth[tc.file_id] = gtData.formula;
            }
            if (gtData.bridge_links && Object.keys(gtData.bridge_links).length > 0) {
                arenaBridgeLinks[tc.file_id] = gtData.bridge_links;
            }
            if (gtData.tooth_notes && Object.keys(gtData.tooth_notes).length > 0) {
                arenaToothNotes[tc.file_id] = gtData.tooth_notes;
            }
            if (gtData.root_data && Object.keys(gtData.root_data).length > 0) {
                arenaRootData[tc.file_id] = gtData.root_data;
            }
            if (gtData.crop_overrides && Object.keys(gtData.crop_overrides).length > 0) {
                window.arenaCropOverrides[tc.file_id] = gtData.crop_overrides;
            }
        } catch(e) { console.warn('GT DB fetch failed for', tc.file_id); }
        _gtLoaded++;
        _updateLoading(`Loading ground truth: ${_gtLoaded}/${cases.length}…`);
    }
    // Fallback: merge localStorage (DB takes priority)
    try {
        const saved = localStorage.getItem('darwin_ground_truth');
        if (saved) {
            const local = JSON.parse(saved);
            for (const fid of Object.keys(local)) {
                if (!arenaGroundTruth[fid] || Object.keys(arenaGroundTruth[fid]).filter(k=>arenaGroundTruth[fid][k]).length === 0) {
                    arenaGroundTruth[fid] = local[fid];
                }
            }
        }
    } catch(e) {}

    // Sanitize loaded GT: clean incompatible layers (e.g. impl_restored+implant → impl_restored)
    for (const fid of Object.keys(arenaGroundTruth)) {
        const formula = arenaGroundTruth[fid];
        if (!formula) continue;
        let changed = false;
        for (const [tooth, raw] of Object.entries(formula)) {
            if (!raw || !raw.includes('+')) continue;
            const layers = parseToothLayers(raw);
            const cleaned = _cleanIncompatibleLayers(layers);
            const reencoded = encodeToothLayers(cleaned);
            if (reencoded !== raw) {
                formula[tooth] = reencoded;
                changed = true;
                console.log(`GT sanitize ${fid}/${tooth}: "${raw}" → "${reencoded}"`);
            }
        }
        if (changed) {
            // Auto-save cleaned formula to DB
            _debouncedSaveGT(fid);
        }
    }

    // Load saved surface data from localStorage
    try {
        const savedSurf = localStorage.getItem('darwin_gt_surfaces');
        if (savedSurf) arenaGTSurfaces = JSON.parse(savedSurf);
    } catch(e) {}

    // Load root data for all cases
    for (const tc of cases) {
        _loadRootData(tc.file_id);
    }

    // ── Group cases by patient_id ──
    const patientGroups = new Map(); // patient_id → [case, case, ...]
    for (const tc of cases) {
        const pid = tc.patient_id;
        if (!patientGroups.has(pid)) patientGroups.set(pid, []);
        patientGroups.get(pid).push(tc);
    }

    for (const [patientId, groupCases] of patientGroups) {
        const isGroup = groupCases.length > 1;
        const firstName = groupCases[0].first_name || '';
        const surname = groupCases[0].surname || '';

        // Create patient group wrapper (or single case wrapper)
        const groupDiv = document.createElement('div');
        if (isGroup) {
            const _t = (k, p) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k, p) : k;
            groupDiv.className = 'arena-patient-group';
            groupDiv.innerHTML = `<div class="arena-patient-group-header">
                <h2>${surname} ${firstName}</h2>
                <span class="group-badge" data-i18n="groupBadge" data-i18n-params='${JSON.stringify({n: groupCases.length})}'>${_t('groupBadge', {n: groupCases.length})}</span>
                <a href="/patient/${patientId}/verify" target="_blank" style="color:#60a5fa;font-size:11px;text-decoration:none;margin-left:8px;padding:3px 10px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.35);border-radius:4px;font-weight:500" title="${_t('cardOpenInTab')}">${_t('cardLink')}</a>
            </div>`;
        }

        for (let si = 0; si < groupCases.length; si++) {
            const tc = groupCases[si];
            // Load all algorithm results for this file_id
            let algData = {algorithms: []};
            try {
                const algResp = await fetch(`/api/darwin/arena/${tc.file_id}`);
                algData = await algResp.json();
            } catch(e) { console.warn('Arena: no algo data for', tc.file_id); }

            // Sort algorithms by score descending (best at top)
            algData.algorithms.sort((a, b) => (b.score || 0) - (a.score || 0));

            const caseDiv = document.createElement('div');
            caseDiv.className = 'arena-case';
            caseDiv.id = `arena-case-${tc.file_id}`;
            caseDiv.dataset.patientId = tc.patient_id;

            const gt = arenaGroundTruth[tc.file_id] || {};
            const gtFilled = Object.values(gt).filter(v => v).length;

            // Split algorithms: leader (top-1) shown always, rest collapsed
            let leaderHtml = '', restHtml = '';
            // Sort by score desc for leader extraction
            const sortedAlgs = [...algData.algorithms].sort((a, b) => (b.score || 0) - (a.score || 0));
            const top3 = sortedAlgs.slice(0, 3);
            for (let ai = 0; ai < sortedAlgs.length; ai++) {
                const a = sortedAlgs[ai];
                const rowHtml = renderArenaFormulaRow('algo', a.codename,
                    `${a.config_summary} · conf ${(a.confidence||0).toFixed(2)}`,
                    a.formula, gt, tc.file_id, false, a.codename, a.score, a.is_champion, a.is_alive);
                if (ai === 0) {
                    leaderHtml = rowHtml; // Leader shown outside <details>
                } else {
                    restHtml += rowHtml;
                }
            }
            // Summary with top-3 scores
            const top3Text = top3.map((a, i) => {
                const medal = ['🥇','🥈','🥉'][i];
                const pct = a.score != null ? `${Math.round(a.score * 100)}%` : '—';
                return `${medal}${a.codename} ${pct}`;
            }).join('  ');
            const restCount = sortedAlgs.length - 1;

            // GT copy button — show if other snapshots of same patient exist with GT data
            let gtCopyBtn = '';
            if (isGroup) {
                const otherSnaps = groupCases.filter(c => c.file_id !== tc.file_id);
                const snapOptions = otherSnaps.map(c => {
                    const otherGt = arenaGroundTruth[c.file_id] || {};
                    const otherFilled = Object.values(otherGt).filter(v => v).length;
                    return { file_id: c.file_id, filled: otherFilled };
                }).filter(s => s.filled > 0);
                if (snapOptions.length > 0) {
                    const _t2 = (k) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k) : k;
                    gtCopyBtn = `<button class="gt-copy-btn" onclick="showGTCopyMenu(event, ${tc.file_id}, ${patientId})" title="${_t2('copyGtTitle')}">${_t2('copyGtBtn')}</button>`;
                }
            }

            // Title: full name for solo cases, snapshot index for groups
            const _tt = (k, p) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k, p) : k;
            const cardLinkHtml = `<a href="/patient/${tc.patient_id}/verify" target="_blank" style="color:#60a5fa;font-size:11px;text-decoration:none;margin-left:8px;padding:2px 8px;background:rgba(96,165,250,0.12);border:1px solid rgba(96,165,250,0.35);border-radius:4px;font-weight:500" title="${_tt('cardOpenInTab')}">${_tt('cardLink')}</a>`;
            const titleHtml = isGroup
                ? `<h3 class="snap-title"><span class="snap-idx" data-i18n="snapshotIndex" data-i18n-params='${JSON.stringify({n: si+1}).replace(/'/g, "&#39;")}'>${_tt('snapshotIndex', {n: si+1})}</span> <span style="color:var(--text-dim);font-size:11px">file_id=${tc.file_id}</span> ${gtCopyBtn}</h3>`
                : `<h2 style="font-size:16px;margin-bottom:2px;font-weight:600">${surname} ${firstName} <span style="color:var(--text-dim);font-size:12px;font-weight:400">file_id=${tc.file_id}</span>${cardLinkHtml}</h2>`;

            caseDiv.innerHTML = `
                ${titleHtml}
                <div class="case-meta">${tc.label || tc.test_case_label || ''}</div>

                <details class="card-hint-collapsible" id="card-hint-wrap-${tc.file_id}" style="margin:6px 0 10px" ontoggle="localStorage.setItem('cardHintOpen_${tc.file_id}', this.open ? '1' : '0')">
                    <summary id="card-hint-summary-${tc.file_id}" style="cursor:pointer;list-style:none;padding:7px 12px;border-radius:6px;background:rgba(251,191,36,0.07);border:1px solid rgba(251,191,36,0.25);font-size:12px;color:#fbbf24;display:flex;align-items:center;gap:8px;user-select:none">
                        <span style="font-size:11px;transition:transform 0.15s">▸</span>
                        <b data-i18n="cardHintBold">${_tt('cardHintBold')}</b>
                        <span id="card-hint-summary-text-${tc.file_id}" style="color:#cbd5e1;font-weight:500;opacity:0.9;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" data-i18n="cardHintLoading">${_tt('cardHintLoading')}</span>
                    </summary>
                    <div class="card-hint-bar" id="card-hint-${tc.file_id}" style="padding:10px 12px;margin-top:4px;border-radius:6px;background:linear-gradient(180deg,rgba(251,191,36,0.04),rgba(251,191,36,0.01));border:1px solid rgba(251,191,36,0.18);font-size:12px;color:#e2e8f0;line-height:1.55">
                        <span style="opacity:0.65;color:#fbbf24" data-i18n="cardHintChecking">${_tt('cardHintChecking')}</span>
                    </div>
                </details>

                <div class="arena-body">
                    <div class="arena-opg-col">
                        <div class="arena-opg-wrap" data-file="${tc.file_id}" data-zoom="1" data-px="0" data-py="0"
                             onwheel="arenaOPGZoom(event,this)" onmousedown="arenaOPGPanStart(event,this)" ondblclick="arenaOPGFit(this)">
                            <img class="arena-opg" id="arena-opg-img-${tc.file_id}" src="/panorama/${tc.file_id}/image" alt="OPG">
                            <canvas class="arena-opg-highlight-canvas" id="arena-opg-canvas-${tc.file_id}"></canvas>
                        </div>
                        <div class="arena-opg-toolbar" id="arena-opg-toolbar-${tc.file_id}">
                            <button class="opg-filter-btn active" data-i18n="filterOriginal" onclick="arenaOPGFilter(${tc.file_id},'original',this)">${_tt('filterOriginal')}</button>
                            <button class="opg-filter-btn" data-i18n="filterClahe" onclick="arenaOPGFilter(${tc.file_id},'clahe',this)">${_tt('filterClahe')}</button>
                            <button class="opg-filter-btn" data-i18n="filterContrast" onclick="arenaOPGFilter(${tc.file_id},'contrast',this)">${_tt('filterContrast')}</button>
                            <button class="opg-filter-btn" data-i18n="filterBone" onclick="arenaOPGFilter(${tc.file_id},'bone_window',this)">${_tt('filterBone')}</button>
                            <button class="opg-filter-btn" data-i18n="filterInvert" onclick="arenaOPGFilter(${tc.file_id},'inverted',this)">${_tt('filterInvert')}</button>
                            <span style="flex:1"></span>
                            <button class="opg-filter-btn" data-i18n="filterObjectsOff" data-i18n-title="filterObjectsTitle" onclick="_toggleOPGChildrenView(${tc.file_id},this)" title="${_tt('filterObjectsTitle')}">${_tt('filterObjectsOff')}</button>
                            <button class="opg-filter-btn" data-i18n="filterFdi" data-i18n-title="filterFdiTitle" onclick="_toggleFDIGridOverlay(${tc.file_id},this)" title="${_tt('filterFdiTitle')}">${_tt('filterFdi')}</button>
                            <button class="opg-filter-btn" data-i18n="filterSegments" onclick="arenaOPGToggleSeg(${tc.file_id},this)">${_tt('filterSegments')}</button>
                            <button class="opg-filter-btn" data-i18n="filterExpert" data-i18n-title="filterExpertTitle" onclick="_toggleExpertOverlay(${tc.file_id},this)" title="${_tt('filterExpertTitle')}">${_tt('filterExpert')}</button>
                        </div>
                        <div class="arena-legend">
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1)">·</div>Инт.</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(75,85,99,0.3)">О</div>Нет</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(16,185,129,0.25)">И</div>Фикс.</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(16,185,129,0.3)">ИЗ</div>+Загл.</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(16,185,129,0.4)">ИФ</div>+Форм.</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(16,185,129,0.5)">ИК</div>+Кор.</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(245,158,11,0.4)">К</div>Кор.</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(59,130,246,0.3)">П</div>Пл.</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(251,146,60,0.4)">С</div>Кар.</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(168,85,247,0.4)">Э</div>Эн.</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(239,68,68,0.3)">R</div>Кор.</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(34,211,238,0.35)">М</div>Мост</div>
                            <div class="leg-item"><div class="leg-dot" style="background:rgba(34,211,238,0.45)">Кн</div>Конс.</div>
                            <div class="leg-item"><div class="leg-dot" style="box-shadow:inset 0 0 0 1.5px var(--red)"></div>Ошибка</div>
                        </div>
                        <div class="gt-text-formula" id="gt-text-formula-${tc.file_id}"
                             style="font-family:'SF Mono',Monaco,Consolas,monospace;font-size:11px;color:#94a3b8;
                                    padding:8px 10px;background:rgba(15,23,42,0.6);border-radius:4px;margin:4px 0;
                                    white-space:pre;overflow-x:auto;line-height:1.6;
                                    letter-spacing:0.3px;border:1px solid rgba(255,255,255,0.06);"></div>
                    </div>
                    <div class="arena-formulas-col">
                        <div class="arena-formulas" id="arena-formulas-${tc.file_id}">
                            ${(() => {
                                const _t = (k, p) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k, p) : k;
                                const sub = gtFilled >= 32 ? _t('fmlMarkedFull') : _t('fmlMarkedSub', {n: gtFilled});
                                return renderArenaFormulaRow('ground-truth', '🎯 ' + _t('fmlGTRowLabel'), sub, gt, null, tc.file_id, true);
                            })()}
                            ${leaderHtml ? `<div class="arena-leader-row" style="border-left:2px solid var(--green);padding-left:2px;">${leaderHtml}</div>` : ''}
                            <details class="arena-algos-collapsible">
                                <summary style="font-size:11px;color:var(--text-dim);cursor:pointer;padding:4px 0;">${restCount} more algorithm${restCount === 1 ? '' : 's'}: ${top3Text}</summary>
                                ${restHtml}
                            </details>
                        </div>
                        <div class="arena-done-status" id="arena-done-status-${tc.file_id}" style="margin-top:4px;font-size:11px;color:var(--text-dim);text-align:center"></div>
                        <details class="gt-history-panel" id="gt-history-${tc.file_id}" ontoggle="if(this.open) _loadGTHistory(${tc.file_id})">
                            <summary>&#128336; Change history
                                <a href="/expert-dashboard" target="_blank" style="float:right;font-size:9px;color:#60a5fa;font-weight:400;margin-right:8px" title="Open full expert dashboard">All actions ↗</a>
                            </summary>
                            <div style="display:flex;gap:4px;padding:2px 6px;font-size:9px;">
                                <button class="gt-scope-btn active" data-scope="file" onclick="_toggleHistoryScope(${tc.file_id},'file',this)" style="padding:1px 6px;border:1px solid #475569;border-radius:3px;background:#334155;color:#cbd5e1;cursor:pointer;font-size:9px;">This file</button>
                                <button class="gt-scope-btn" data-scope="all" onclick="_toggleHistoryScope(${tc.file_id},'all',this)" style="padding:1px 6px;border:1px solid #475569;border-radius:3px;background:transparent;color:#64748b;cursor:pointer;font-size:9px;">All files</button>
                            </div>
                            <div class="gt-history-list"></div>
                        </details>
                    </div>
                    <div class="arena-detail-col">
                        <div id="tooth-detail-card-${tc.file_id}" style="display:none;margin-bottom:8px;">
                            <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px;">
                                <div style="font-size:14px;font-weight:700;margin-bottom:8px;">
                                    Tooth <span id="td-fdi-${tc.file_id}"></span> <span id="td-status-${tc.file_id}" style="font-size:11px;color:var(--text-dim);"></span>
                                </div>
                                <div id="td-root-preview-${tc.file_id}" style="text-align:center;margin-bottom:8px;"></div>
                                <div id="td-pathology-btns-${tc.file_id}"></div>
                            </div>
                        </div>
                        <div class="td-placeholder" id="td-placeholder-${tc.file_id}" data-i18n="clickToothToSeeDetails">${_tt('clickToothToSeeDetails')}</div>
                        <div class="arena-detail-panel" id="arena-detail-${tc.file_id}">
                            <div class="arena-detail-empty" data-i18n="clickAlgoToSeeDetails">${_tt('clickAlgoToSeeDetails')}</div>
                        </div>
                    </div>
                </div>
            `;

            if (isGroup) {
                groupDiv.appendChild(caseDiv);
            } else {
                // Solo case — style as standalone card
                caseDiv.style.borderRadius = '10px';
                caseDiv.style.border = '1px solid var(--border)';
                caseDiv.style.marginBottom = '20px';
                container.appendChild(caseDiv);
            }
            // Fire-and-forget card-hint fetch (non-blocking)
            _loadCardHints(tc.file_id);
        }

        if (isGroup) container.appendChild(groupDiv);
    }

    // ── Sandbox file listing (files not yet in arena) ──
    if (currentSandboxId && currentSandboxId !== 'RUDN') {
        try {
            const filesResp = await fetch(`/api/darwin/sandbox/${currentSandboxId}/files`);
            const sbxFiles = await filesResp.json();
            const inArenaIds = new Set(cases.map(c => c.file_id));
            const notInArena = sbxFiles.filter(f => !inArenaIds.has(f.file_id));
            if (notInArena.length > 0) {
                const filesDiv = document.createElement('div');
                filesDiv.style.cssText = 'border:1px dashed var(--border);border-radius:8px;padding:12px;margin-bottom:16px;';
                filesDiv.innerHTML = `<div style="font-size:12px;font-weight:600;margin-bottom:8px;color:var(--text)">Файлы в sandbox (не в арене): ${notInArena.length}</div>` +
                    notInArena.map(f => `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 8px;border-bottom:1px solid var(--border);font-size:11px">
                        <div>
                            <strong style="color:var(--text)">${f.label || f.filename}</strong>
                            <span style="color:var(--text-dim);margin-left:6px">id=${f.file_id}</span>
                        </div>
                        <button onclick="_sandboxAddToArena(${f.file_id})" style="padding:2px 10px;border-radius:4px;border:1px solid var(--green);background:rgba(16,185,129,0.15);color:var(--green);cursor:pointer;font-size:10px">+ В арену</button>
                    </div>`).join('');
                container.appendChild(filesDiv);
            }
        } catch(e) { console.warn('sandbox files load failed', e); }
    }

    // ── "+" кнопка для добавления новых кейсов ──
    const addBtn = document.createElement('div');
    addBtn.className = 'arena-add-case';
    if (currentSandboxId && currentSandboxId !== 'RUDN') {
        addBtn.innerHTML = `
            <button class="arena-add-btn" onclick="openSandboxImportDialog()" title="Импортировать OPG в sandbox">
                <span style="font-size:24px;line-height:1">+</span>
                <span style="font-size:11px">Import OPG</span>
            </button>`;
    } else {
        addBtn.innerHTML = `
            <button class="arena-add-btn" onclick="openArenaAddDialog()" title="Add a patient case to the arena">
                <span style="font-size:24px;line-height:1">+</span>
                <span style="font-size:11px">Add case</span>
            </button>`;
    }
    container.appendChild(addBtn);

    // Restore scroll position after re-rendering
    if (mainPanel && savedScroll > 0) {
        requestAnimationFrame(() => { mainPanel.scrollTop = savedScroll; });
    }

    // Align bridge/bar connectors to actual SVG crown positions
    requestAnimationFrame(() => _alignConnectors());

    // Preload YOLO detections for hover-highlight + init crop carousels
    _updateLoading('Loading tooth crops…');
    const _arenaFiles = [];
    document.querySelectorAll('.arena-case[id^="arena-case-"]').forEach(ac => {
        const fid = ac.id.replace('arena-case-', '');
        if (fid) _arenaFiles.push(fid);
    });
    let _cropsLoaded = 0;
    for (const fid of _arenaFiles) {
        _loadYoloDetections(fid).then(data => {
            _cropsLoaded++;
            _updateLoading(`Tooth crops: ${_cropsLoaded}/${_arenaFiles.length}…`);
            if (_cropsLoaded >= _arenaFiles.length) {
                const banner = document.getElementById('arena-loading-banner');
                if (banner) banner.style.display = 'none';
                window.dispatchEvent(new Event('arena-loaded'));
                // Fire card-hint fetches for all visible cases (non-blocking)
                document.querySelectorAll('[id^="card-hint-"]').forEach(el => {
                    const fid = parseInt(el.id.replace('card-hint-', ''), 10);
                    if (fid) _loadCardHints(fid);
                });
            }
            if (!data) return;
            const opgImg = document.getElementById(`arena-opg-img-${fid}`);
            if (opgImg) {
                const doInit = () => _initCropCarousel(fid);
                if (opgImg.complete && opgImg.naturalWidth > 0) doInit();
                else opgImg.addEventListener('load', doInit);
            }
        });
    }
    // Fallback: hide banner after 30s even if not all loaded
    setTimeout(() => { const b = document.getElementById('arena-loading-banner'); if (b) b.style.display = 'none'; }, 30000);
}

// ═══ Align bridge/bar connectors to SVG crown level ═══
function _alignConnectors() {
    const connectors = document.querySelectorAll('.bridge-connector-bar, .bar-connector-bar');
    for (const conn of connectors) {
        const bar = conn.querySelector('.conn-bar');
        if (!bar) continue;
        // Find previous and next sibling cells
        const prevCell = conn.previousElementSibling;
        const nextCell = conn.nextElementSibling;
        if (!prevCell || !nextCell) continue;
        // Get the .note-arrows-wrap (SVG crown) from both neighbors
        const prevSvg = prevCell.querySelector('.note-arrows-wrap');
        const nextSvg = nextCell.querySelector('.note-arrows-wrap');
        if (!prevSvg || !nextSvg) continue;
        // Calculate top and bottom of SVG in connector's coordinate space
        const connRect = conn.getBoundingClientRect();
        const parentRect = conn.parentElement.getBoundingClientRect();
        const prevRect = prevSvg.getBoundingClientRect();
        const nextRect = nextSvg.getBoundingClientRect();
        // Use the overlap region of both SVGs
        const topPx = Math.max(prevRect.top, nextRect.top) - parentRect.top;
        const bottomPx = Math.min(prevRect.bottom, nextRect.bottom) - parentRect.top;
        if (bottomPx > topPx) {
            bar.style.top = topPx + 'px';
            bar.style.height = (bottomPx - topPx) + 'px';
        }
    }
}

// ═══ Dialog: add a new case to the arena ═══
function openArenaAddDialog() {
    let dlg = document.getElementById('arena-add-dialog');
    if (!dlg) {
        dlg = document.createElement('div');
        dlg.id = 'arena-add-dialog';
        dlg.className = 'arena-add-dialog-overlay';
        dlg.innerHTML = `
            <div class="arena-add-dialog-box">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
                    <h3 style="margin:0;font-size:14px">Add a case to the arena</h3>
                    <button onclick="this.closest('.arena-add-dialog-overlay').style.display='none'"
                        style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
                </div>
                <div style="display:flex;gap:8px;margin-bottom:8px">
                    <input id="arena-add-search" type="text" placeholder="Фамилия или P-номер..."
                        style="flex:1;padding:6px 10px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:12px"
                        oninput="_arenaSearchCandidates(this.value)">
                    <label style="display:flex;align-items:center;gap:4px;font-size:11px;color:var(--text-dim);white-space:nowrap">
                        <input type="checkbox" id="arena-add-k081" onchange="_arenaSearchCandidates(document.getElementById('arena-add-search').value)">К08.1
                    </label>
                </div>
                <div id="arena-add-results" style="max-height:300px;overflow-y:auto;font-size:12px"></div>
            </div>`;
        document.body.appendChild(dlg);
    }
    dlg.style.display = 'flex';
    document.getElementById('arena-add-search').value = '';
    document.getElementById('arena-add-results').innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center">Введите фамилию для поиска</div>';
    document.getElementById('arena-add-search').focus();
}

let _arenaSearchTimer = null;
function _arenaSearchCandidates(q) {
    clearTimeout(_arenaSearchTimer);
    _arenaSearchTimer = setTimeout(async () => {
        const cohort = document.getElementById('arena-add-k081')?.checked ? 'k081' : '';
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (cohort) params.set('cohort', cohort);
        params.set('limit', '20');

        const resp = await fetch(`/api/darwin/arena/candidates?${params}`);
        const candidates = await resp.json();
        const container = document.getElementById('arena-add-results');

        if (candidates.length === 0) {
            container.innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center">Ничего не найдено</div>';
            return;
        }

        container.innerHTML = candidates.map(c => {
            const inArena = c.already_in_arena;
            const stage = c.pipeline_stage || '—';
            return `<div class="arena-candidate ${inArena ? 'in-arena' : ''}" style="display:flex;justify-content:space-between;align-items:center;padding:6px 8px;border-bottom:1px solid var(--border);${inArena ? 'opacity:0.5' : ''}">
                <div>
                    <strong>${c.surname || ''} ${c.first_name || ''}</strong>
                    <span style="color:var(--text-dim);font-size:10px;margin-left:6px">file_id=${c.file_id} · ${stage}</span>
                </div>
                ${inArena
                    ? '<span style="font-size:10px;color:var(--text-dim)">уже в арене</span>'
                    : `<button onclick="_arenaAddCase(${c.file_id},${c.patient_id},this)" style="padding:3px 10px;border-radius:4px;border:1px solid var(--green);background:rgba(16,185,129,0.15);color:var(--green);cursor:pointer;font-size:11px">+ Добавить</button>`
                }
            </div>`;
        }).join('');
    }, 300);
}

async function _arenaAddCase(fileId, patientId, btn) {
    btn.disabled = true;
    btn.textContent = '...';
    try {
        const resp = await fetch('/api/darwin/arena/add', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({file_id: fileId, patient_id: patientId})
        });
        const data = await resp.json();
        if (data.status === 'ok') {
            btn.textContent = '✓';
            btn.style.borderColor = 'var(--green)';
            // Reload arena, then auto-try AI hint for the new file
            setTimeout(() => {
                document.getElementById('arena-add-dialog').style.display = 'none';
                loadArena();
                // After arena renders, auto-trigger AI hint
                setTimeout(() => prefillGTFromAI(fileId), 1200);
            }, 500);
        } else {
            btn.textContent = data.message || 'Ошибка';
        }
    } catch(e) {
        btn.textContent = 'Ошибка';
        console.error(e);
    }
}

// ═══ SANDBOX — управление тестовыми наборами ═══
let currentSandboxId = localStorage.getItem('darwin_sandbox_id') || 'RUDN';

async function loadSandboxList() {
    const sel = document.getElementById('arena-sandbox-select');
    if (!sel) return;
    try {
        const resp = await fetch('/api/darwin/sandboxes');
        const sbxList = await resp.json();
        // Keep RUDN option, add sandboxes
        sel.innerHTML = '<option value="RUDN">Synthetic Demo Sandbox</option>';
        sbxList.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.name} (${s.file_count})`;
            sel.appendChild(opt);
        });
        sel.value = currentSandboxId;
        // If stored sandbox no longer exists, fallback to RUDN
        if (sel.value !== currentSandboxId) {
            currentSandboxId = 'RUDN';
            localStorage.setItem('darwin_sandbox_id', 'RUDN');
            sel.value = 'RUDN';
        }
        _updateSandboxUI();
    } catch(e) { console.warn('loadSandboxList failed', e); }
}

function switchSandbox(sbxId) {
    currentSandboxId = sbxId;
    localStorage.setItem('darwin_sandbox_id', sbxId);
    _updateSandboxUI();
    loadArena();
}

function _updateSandboxUI() {
    const isSandbox = currentSandboxId && currentSandboxId !== 'RUDN';
    document.getElementById('sbx-import-btn').style.display = isSandbox ? '' : 'none';
    document.getElementById('sbx-delete-btn').style.display = isSandbox ? '' : 'none';
    const countEl = document.getElementById('arena-sandbox-count');
    if (isSandbox) {
        countEl.textContent = `sandbox: ${currentSandboxId}`;
        countEl.style.display = '';
    } else {
        countEl.style.display = 'none';
    }
}

function openNewSandboxDialog() {
    const name = prompt('Название нового набора тестовых снимков:');
    if (!name || !name.trim()) return;
    const desc = prompt('Описание (необязательно):', '') || '';
    fetch('/api/darwin/sandboxes', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({name: name.trim(), description: desc.trim()})
    }).then(r => r.json()).then(data => {
        if (data.id) {
            currentSandboxId = data.id;
            localStorage.setItem('darwin_sandbox_id', data.id);
            loadSandboxList();
            loadArena();
        } else {
            alert(data.error || 'Ошибка создания sandbox');
        }
    }).catch(e => alert('Ошибка: ' + e));
}

async function deleteSandbox() {
    if (currentSandboxId === 'RUDN') return;
    const sel = document.getElementById('arena-sandbox-select');
    const name = sel.options[sel.selectedIndex]?.textContent || currentSandboxId;
    if (!confirm(`Удалить sandbox "${name}" и все его данные? Это действие необратимо.`)) return;
    try {
        const resp = await fetch(`/api/darwin/sandboxes/${currentSandboxId}`, {method: 'DELETE'});
        const data = await resp.json();
        if (data.status === 'deleted') {
            currentSandboxId = 'RUDN';
            localStorage.setItem('darwin_sandbox_id', 'RUDN');
            await loadSandboxList();
            loadArena();
        } else {
            alert(data.error || 'Ошибка');
        }
    } catch(e) { alert('Ошибка: ' + e); }
}

function openSandboxImportDialog() {
    if (currentSandboxId === 'RUDN') return;
    let dlg = document.getElementById('sandbox-import-dialog');
    if (!dlg) {
        dlg = document.createElement('div');
        dlg.id = 'sandbox-import-dialog';
        dlg.className = 'sandbox-import-overlay';
        dlg.innerHTML = `
            <div class="sandbox-import-box">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                    <h3 style="margin:0;font-size:14px">Импорт OPG в sandbox</h3>
                    <button onclick="this.closest('.sandbox-import-overlay').style.display='none'"
                        style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">✕</button>
                </div>
                <div id="sbx-import-drop" class="sandbox-import-drop" onclick="document.getElementById('sbx-import-files').click()">
                    Перетащите файлы сюда или кликните для выбора<br>
                    <span style="font-size:10px;color:var(--text-dim)">jpg, png, dcm</span>
                    <input type="file" id="sbx-import-files" multiple accept=".jpg,.jpeg,.png,.bmp,.tif,.tiff,.dcm"
                        onchange="_handleSandboxFiles(this.files)">
                </div>
                <div id="sbx-import-list" class="sandbox-import-files"></div>
                <div style="margin-top:8px;border-top:1px solid var(--border);padding-top:8px">
                    <div style="font-size:11px;color:var(--text-dim);margin-bottom:6px">Или: импорт из папки на диске</div>
                    <div style="display:flex;gap:6px">
                        <input id="sbx-folder-path" type="text" placeholder="/path/to/images"
                            style="flex:1;padding:4px 8px;border-radius:6px;border:1px solid var(--border);background:var(--bg);color:var(--text);font-size:11px">
                        <button onclick="_importSandboxFolder()" class="sbx-btn">Импорт</button>
                    </div>
                </div>
                <div id="sbx-import-status" style="margin-top:8px;font-size:11px;color:var(--text-dim)"></div>
            </div>`;
        document.body.appendChild(dlg);

        // Drag & drop handlers
        const drop = dlg.querySelector('#sbx-import-drop');
        drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('dragover'); });
        drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
        drop.addEventListener('drop', e => {
            e.preventDefault(); drop.classList.remove('dragover');
            _handleSandboxFiles(e.dataTransfer.files);
        });
    }
    dlg.style.display = 'flex';
    document.getElementById('sbx-import-list').innerHTML = '';
    document.getElementById('sbx-import-status').textContent = '';
}

async function _handleSandboxFiles(files) {
    const listEl = document.getElementById('sbx-import-list');
    const statusEl = document.getElementById('sbx-import-status');
    listEl.innerHTML = '';
    statusEl.textContent = `Loading ${files.length} files…`;

    let ok = 0, fail = 0;
    for (const f of files) {
        const fd = new FormData();
        fd.append('file', f);
        fd.append('label', f.name.replace(/\.[^.]+$/, ''));
        try {
            const resp = await fetch(`/api/darwin/sandbox/${currentSandboxId}/import-image`, {
                method: 'POST', body: fd
            });
            const data = await resp.json();
            if (data.file_id) {
                listEl.innerHTML += `<div class="sif-item"><span class="sif-name">${f.name}</span><span style="color:var(--green)">✓ id=${data.file_id}</span></div>`;
                ok++;
            } else {
                listEl.innerHTML += `<div class="sif-item"><span class="sif-name">${f.name}</span><span style="color:var(--red)">${data.error||'ошибка'}</span></div>`;
                fail++;
            }
        } catch(e) {
            listEl.innerHTML += `<div class="sif-item"><span class="sif-name">${f.name}</span><span style="color:var(--red)">ошибка сети</span></div>`;
            fail++;
        }
    }
    statusEl.textContent = `Готово: ${ok} загружено${fail ? `, ${fail} ошибок` : ''}`;
    if (ok > 0) loadSandboxList();
}

async function _importSandboxFolder() {
    const path = document.getElementById('sbx-folder-path').value.trim();
    if (!path) return;
    const statusEl = document.getElementById('sbx-import-status');
    statusEl.textContent = 'Импорт из папки...';
    try {
        const resp = await fetch(`/api/darwin/sandbox/${currentSandboxId}/import-folder`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({folder_path: path})
        });
        const data = await resp.json();
        if (data.imported !== undefined) {
            statusEl.textContent = `Импортировано: ${data.imported} файлов`;
            const listEl = document.getElementById('sbx-import-list');
            (data.files || []).forEach(f => {
                listEl.innerHTML += `<div class="sif-item"><span class="sif-name">${f.filename}</span><span style="color:var(--green)">✓ id=${f.file_id}</span></div>`;
            });
            if (data.imported > 0) loadSandboxList();
        } else {
            statusEl.textContent = data.error || 'Ошибка';
        }
    } catch(e) { statusEl.textContent = 'Ошибка: ' + e; }
}

async function _sandboxAddToArena(fileId) {
    try {
        const resp = await fetch(`/api/darwin/sandbox/${currentSandboxId}/add-to-arena`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({file_id: fileId})
        });
        const data = await resp.json();
        if (data.status === 'added' || data.status === 'already_in_arena') {
            loadArena();
        }
    } catch(e) { console.error(e); }
}

/** Card-NLP hint bar: fetch implant FDIs documented in the patient's diary and
 *  colour-code them against the current GT.
 *
 *  Green  = card FDI is implant-marked in GT (match)
 *  Yellow = card FDI is in GT but NOT as implant (semantic mismatch)
 *  Red    = card FDI absent from GT entirely (likely missed)
 *  Grey   = GT has implant at FDI that card does NOT mention (orphan — possibly a later visit)
 */
// FDI rows for adjacency (used for shift detection). Each row is arranged
// mesial-to-distal in a single jaw half.
const _FDI_UPPER = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
const _FDI_LOWER = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];

function _findShiftTarget(fdi, gt, cardSet) {
    // Returns {to, distance, direction} if an adjacent FDI (±1 in the same
    // jaw row) has "implant" in GT and is NOT mentioned in the card — i.e. the
    // implant that the card put at `fdi` is actually sitting at a neighbour.
    for (const row of [_FDI_UPPER, _FDI_LOWER]) {
        const idx = row.indexOf(fdi);
        if (idx < 0) continue;
        const tryOffsets = [[1,'→'],[-1,'←']];
        for (const [off, arr] of tryOffsets) {
            const nb = row[idx + off];
            if (!nb) continue;
            const val = gt[nb] || '';
            if (/implant|impl_/i.test(val) && !cardSet.has(nb)) {
                return {to: nb, distance: Math.abs(off), direction: arr};
            }
        }
    }
    return null;
}

function _chPill({fdi, kind, gtVal, shiftTo, title}) {
    const pad = 'padding:4px 10px;border-radius:14px;font-size:12px;font-weight:600;line-height:1.3;display:inline-flex;align-items:center;gap:5px;white-space:nowrap;cursor:help';
    if (kind === 'match') {
        return `<span style="${pad};background:rgba(34,197,94,0.18);color:#4ade80;border:1px solid rgba(34,197,94,0.5)" title="${title}"><span style="font-size:11px">✓</span><b>${fdi}</b></span>`;
    }
    if (kind === 'shift') {
        // Visual: "card 1.5 → image 1.4"  (arrow shows the detected shift)
        return `<span style="${pad};background:rgba(251,191,36,0.22);color:#fcd34d;border:1px solid rgba(251,191,36,0.6)" title="${title}">
                    <span style="font-size:10px;opacity:0.75;font-weight:500">карта</span>
                    <b style="text-decoration:line-through;text-decoration-color:rgba(252,211,77,0.6)">${fdi}</b>
                    <span style="font-size:13px;font-weight:700;color:#fde68a">→</span>
                    <b>${shiftTo}</b>
                    <span style="font-size:10px;opacity:0.75;font-weight:500">снимок</span>
                </span>`;
    }
    if (kind === 'missing') {
        // Card mentions implant at this FDI, but GT has NO entry anywhere near.
        return `<span style="${pad};background:rgba(239,68,68,0.18);color:#fca5a5;border:1px solid rgba(239,68,68,0.55)" title="${title}"><span style="font-size:11px">❌</span><b>${fdi}</b><span style="font-size:10px;font-weight:400;opacity:0.85">нет в GT</span></span>`;
    }
    // conflict (yellow) without adjacent-shift match
    return `<span style="${pad};background:rgba(251,191,36,0.18);color:#fcd34d;border:1px solid rgba(251,191,36,0.55)" title="${title}"><span style="font-size:11px">⚠</span><b>${fdi}</b><span style="font-size:10px;font-weight:400;opacity:0.85">в GT: ${gtVal}</span></span>`;
}

/** Card-NLP hint bar: fetch implant FDIs documented in the patient's diary and
 *  colour-code them against the current GT. Shows card → GT triangulation.
 */
async function _loadCardHints(fileId) {
    const el = document.getElementById(`card-hint-${fileId}`);
    if (!el) return;
    const summaryEl = document.getElementById(`card-hint-summary-text-${fileId}`);
    const detailsEl = document.getElementById(`card-hint-wrap-${fileId}`);
    const setSummary = (txt) => { if (summaryEl) summaryEl.textContent = txt; };
    // Restore collapse state from localStorage (default: collapsed)
    if (detailsEl) {
        const saved = localStorage.getItem(`cardHintOpen_${fileId}`);
        detailsEl.open = saved === '1';
    }
    const _t = (k, p) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k, p) : k;
    try {
        const resp = await fetch(`/api/darwin/card-hints/${fileId}`);
        if (!resp.ok) {
            el.innerHTML = `<span style="opacity:0.5;color:#94a3b8">${_t('cardHintNoCard')}</span>`;
            setSummary(_t('cardHintNoCard'));
            return;
        }
        const data = await resp.json();
        const cardFdis = data.fdi_list || [];
        if (cardFdis.length === 0) {
            el.innerHTML = `<span style="opacity:0.5;color:#94a3b8">${_t('cardHintNoImplants')}</span>`;
            setSummary(_t('cardHintNImplants', {n: 0}));
            return;
        }
        const gt = arenaGroundTruth[fileId] || {};
        const cardSet = new Set(cardFdis);

        let nMatch = 0, nShift = 0, nConflict = 0, nMissing = 0;
        const pills = cardFdis.map(fdi => {
            const val = gt[fdi] || '';
            if (/implant|impl_/i.test(val)) {
                nMatch++;
                return _chPill({fdi, kind: 'match',
                    title: `Match: карта и эталон согласованы — имплантат ${fdi}`});
            }
            // Try to detect an FDI-shift: is an adjacent position an implant
            // in GT that the card doesn't already claim?
            const shift = _findShiftTarget(fdi, gt, cardSet);
            if (shift) {
                nShift++;
                return _chPill({fdi, kind: 'shift', shiftTo: shift.to,
                    title: `Сдвиг FDI: карта пишет имплантат на ${fdi}, но на снимке имплантат стоит на соседнем ${shift.to}. Скорее всего опечатка/сдвиг в записи карты.`});
            }
            if (!val) {
                nMissing++;
                return _chPill({fdi, kind: 'missing',
                    title: `Карта упоминает имплантат ${fdi}, но в эталоне НИЧЕГО рядом не отмечено — проверь снимок.`});
            }
            nConflict++;
            return _chPill({fdi, kind: 'conflict', gtVal: val,
                title: `Карта документирует имплантат на позиции ${fdi}. В эталоне этот FDI имеет статус "${val}" и соседние FDI тоже не имплантаты. Проверь снимок.`});
        });

        // Orphan implants in GT (present but not in card)
        const gtImplants = Object.entries(gt)
            .filter(([k, v]) => !k.startsWith('_') && /implant|impl_/i.test(String(v)))
            .map(([k]) => k)
            .filter(k => !cardSet.has(k));

        // Word form for Russian: 1 имплантат / 2-4 имплантата / 5+ имплантатов
        const plural = (n) => {
            const mod10 = n % 10, mod100 = n % 100;
            if (mod100 >= 11 && mod100 <= 14) return 'имплантатов';
            if (mod10 === 1) return 'имплантат';
            if (mod10 >= 2 && mod10 <= 4) return 'имплантата';
            return 'имплантатов';
        };

        // Legend chips for the header
        const legendChips = [];
        legendChips.push(`<span style="color:#4ade80;white-space:nowrap"><b>✓ ${nMatch}</b> совпадает</span>`);
        if (nShift > 0) legendChips.push(`<span style="color:#fcd34d;white-space:nowrap" title="Имплантат есть, но в карте записан не на том FDI — сдвиг на соседний зуб"><b>→ ${nShift}</b> сдвиг FDI</span>`);
        if (nConflict > 0) legendChips.push(`<span style="color:#fcd34d;white-space:nowrap" title="Карта пишет имплантат, но ни на этой, ни на соседних FDI в эталоне имплантата нет"><b>⚠ ${nConflict}</b> не найден рядом</span>`);
        if (nMissing > 0) legendChips.push(`<span style="color:#fca5a5;white-space:nowrap"><b>❌ ${nMissing}</b> нет в GT</span>`);

        const orphanBlock = gtImplants.length > 0 ? `
            <div style="padding-top:8px;margin-top:2px;border-top:1px dashed rgba(148,163,184,0.18);display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                <span style="font-size:11px;color:#94a3b8;opacity:0.85;white-space:nowrap">В эталоне <b style="font-weight:600">${gtImplants.length}</b> имп. без упоминания в карте:</span>
                ${gtImplants.map(f => `<span style="padding:2px 9px;border-radius:10px;background:rgba(148,163,184,0.13);color:#cbd5e1;border:1px solid rgba(148,163,184,0.3);font-size:11px;font-weight:600" title="GT отмечает имплантат ${f}, но карта об этом не упоминает (может быть поздний визит)">${f}</span>`).join('')}
            </div>` : '';

        // Tiny one-liner footer (kept minimal after user feedback)
        const reviewHint = (nShift + nConflict + nMissing) > 0
            ? `<span style="color:#94a3b8;font-size:10px;font-style:italic;opacity:0.8">Стрелка показывает где имплантат на самом деле. Решайте по снимку.</span>`
            : '';

        // One-liner for the collapsed <summary> bar
        const parts = [`${cardFdis.length} имп.`, `✓${nMatch}`];
        if (nShift > 0) parts.push(`→${nShift}`);
        if (nConflict > 0) parts.push(`⚠${nConflict}`);
        if (nMissing > 0) parts.push(`❌${nMissing}`);
        setSummary(parts.join('  ·  '));

        el.innerHTML = `
            <div style="display:flex;flex-direction:column;gap:8px">
                <div style="display:flex;align-items:center;justify-content:flex-end;gap:14px;flex-wrap:wrap;font-size:11px;font-weight:500;row-gap:6px">
                    ${legendChips.join('')}
                </div>
                <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
                    ${pills.join('')}
                </div>
                ${reviewHint ? `<div style="padding-top:4px">${reviewHint}</div>` : ''}
                ${orphanBlock}
            </div>
        `;
    } catch(e) {
        console.warn('card-hints fetch failed', fileId, e);
        el.innerHTML = `<span style="opacity:0.5;color:#94a3b8">${_t('cardHintError')}</span>`;
    }
}
window._loadCardHints = _loadCardHints;
// Re-render every visible card-hints panel when the language flips so
// "Карта не найдена" / "0 implants in patient card" / pluralised totals
// move with the rest of the UI.
if (typeof OrisI18n !== 'undefined') {
    OrisI18n.onLangChange(() => {
        document.querySelectorAll('[id^="card-hint-"]').forEach(el => {
            const m = el.id.match(/^card-hint-(\d+)$/);
            if (m) _loadCardHints(parseInt(m[1], 10));
        });
    });
}

