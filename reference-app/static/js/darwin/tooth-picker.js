// tooth-picker.js — Arena formula row, picker UI, groups, presets, layers, root editor
// Extracted from darwin_lab.html lines 10682–13522
// ═══════════════════════════════════════════════════════════════


function renderArenaFormulaRow(type, label, sublabel, formula, groundTruth, fileId, editable, codename, score, isChampion, isAlive) {
    const upper = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
    const lower = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];

    function cellHtml(fdi) {
        const rawStatus = (formula || {})[fdi] || '';
        // Parse layered format
        const layers = parseToothLayers(rawStatus);
        const status = layersPrimaryStatus(layers);
        const isLayered = layers.length > 1;

        // For GT comparison: extract primary status of GT
        const gtRaw = groundTruth ? (groundTruth[fdi] || '') : '';
        const gtLayers = parseToothLayers(gtRaw);
        const gtStatus = layersPrimaryStatus(gtLayers);

        let matchClass = '';
        if (type === 'algo' && gtStatus && status) {
            const norm = s => {
                if (['impl_fixture','impl_cover','impl_healing','impl_abutment','impl_temp_abut','impl_provisional','impl_restored','implant'].includes(s)) return 'implant_group';
                if (['present','natural','caries','endo','restored','filling'].includes(s)) return 'tooth_present';
                if (s === 'crown') return 'crowned';
                return s;
            };
            matchClass = norm(status) === norm(gtStatus) ? 'match' : 'mismatch';
        }

        const clickHandler = editable ? `onmousedown="_toothCellMouseDown(event,this,'${fileId}','${fdi}')" oncontextmenu="_bridgeContextMenu(event,this,'${fileId}','${fdi}')"` : '';
        const num = fdi.replace('.','');
        // Combine surfaces from all layers
        const allSurfs = layers.map(l => l.surfaces).join('');
        const surfs = allSurfs || (arenaGTSurfaces[fileId] || {})[fdi] || '';
        const sc = {
            v: surfs.includes('v') ? ' on' : '',
            m: surfs.includes('m') ? ' on' : '',
            o: surfs.includes('o') ? ' on' : '',
            d: surfs.includes('d') ? ' on' : '',
            l: surfs.includes('l') ? ' on' : ''
        };
        const svg = toothSvg(34, sc, fdi);
        const abbr = isLayered ? layersAbbreviation(layers) : surfaceAbbr(status, surfs);
        const layeredClass = isLayered ? 'layered' : '';
        // Rich tooltip for GT, simple for algo
        const note = (type === 'ground-truth' && fileId) ? ((arenaToothNotes[fileId] || {})[fdi] || '') : '';
        const tipFull = (type === 'ground-truth' && fileId)
            ? richTooltip(fdi, rawStatus, fileId)
            : (isLayered ? `${fdi}: ${layers.map(l => l.status+(l.surfaces?':'+l.surfaces:'')).join(' + ')}` : surfaceTooltip(fdi, status, surfs));
        const noteSev = _getNoteSeverity(note);
        const noteDot = note ? `<span class="note-dot${noteSev ? ' severity-'+noteSev : ''}" title="${note.replace(/"/g,'&quot;')}"></span>` : '';
        const noteVis = note ? _getNoteVisuals(note, fdi) : { arrows: '', classes: '' };
        const noteClasses = noteVis.classes ? ' ' + noteVis.classes : '';

        // Root SVG — корневая система зуба (pass rawStatus to detect endo in layered teeth)
        const rootSvgHtml = rootSvg(fdi, status, null, fileId, rawStatus);
        const hasEndo = rawStatus ? rawStatus.split('+').some(p => p.split(':')[0] === 'endo') : status === 'endo';
        const rootClick = (editable && hasEndo) ? `onclick="event.stopPropagation();_openRootPicker('${fileId}','${fdi}',this)" style="cursor:pointer"` : '';

        const midlineClass = (fdi === '1.1' || fdi === '4.1') ? ' midline-right' : '';
        const hasRootAnnotations = fileId && arenaRootData[fileId]?.[fdi] && Object.keys(arenaRootData[fileId][fdi]).length > 0;
        const unmarkedClass = (type === 'ground-truth' && !rawStatus && !hasRootAnnotations) ? ' unmarked' : '';
        const dropHandlers = type === 'ground-truth' ? `ondragover="_cropDragOver(event)" ondrop="_cropDrop(event,'${fileId}','${fdi}')" ondragleave="_cropDragLeave(event)"` : '';
        return `<div class="arena-cell ${status} ${matchClass} ${layeredClass}${noteClasses}${midlineClass}${unmarkedClass}" data-fdi="${fdi}" data-file="${fileId}" ${clickHandler} draggable="false" ${dropHandlers} title="${tipFull}">` +
            `<span class="cell-num">${num}</span><span class="note-arrows-wrap">${svg}${noteVis.arrows}</span><span class="cell-abbr">${abbr}</span>` +
            (rootSvgHtml ? `<span class="cell-root" ${rootClick}>${rootSvgHtml}</span>` : '') +
            `${noteDot}</div>`;
    }

    // Build cells with bridge connectors between linked pairs
    function buildWithConnectors(fdis) {
        let html = '';
        const links = (type === 'ground-truth' && fileId) ? (arenaBridgeLinks[fileId] || {}) : {};
        for (let i = 0; i < fdis.length; i++) {
            html += cellHtml(fdis[i]);
            if (i < fdis.length - 1) {
                const key = makeBridgeKey(fdis[i], fdis[i + 1]);
                if (links[key]) {
                    const connClass = links[key] === 'bar' ? 'bar-connector-bar' : 'bridge-connector-bar';
                    html += `<div class="${connClass}"><div class="conn-bar"></div></div>`;
                }
            }
        }
        return html;
    }
    const upperCells = buildWithConnectors(upper);
    const lowerCells = buildWithConnectors(lower);

    // Score display with breakdown tooltip
    let scoreHtml = '';
    if (type === 'algo' && score != null) {
        const pct = (score * 100).toFixed(0);
        const color = score >= 0.7 ? 'var(--green)' : score >= 0.4 ? 'var(--yellow)' : 'var(--red)';
        // Parse breakdown from sublabel if available
        const tipParts = [`Composite: ${pct}%`];
        if (sublabel) {
            const m_tooth = sublabel.match(/🦷(\d+)/);
            const m_endo = sublabel.match(/🔬(\d+)/);
            const m_path = sublabel.match(/📍(\d+)/);
            if (m_tooth) tipParts.push(`Зубы (50%): ${m_tooth[1]}%`);
            if (m_endo) tipParts.push(`Эндо (30%): ${m_endo[1]}%`);
            if (m_path) tipParts.push(`Патология (20%): ${m_path[1]}%`);
        }
        const tip = tipParts.join('&#10;');
        scoreHtml = `<div class="row-score" style="color:${color}" title="${tip}">${pct}%</div>`;
    } else if (type === 'algo') {
        scoreHtml = `<div class="row-score" style="font-size:11px;color:var(--text-dim)">—</div>`;
    } else if (type === 'ground-truth') {
        scoreHtml = `<div class="row-score" style="font-size:11px;color:var(--text-dim)">GROUND TRUTH</div>`;
    }

    // Vote buttons for algo rows
    let voteHtml = '';
    if (type === 'algo' && codename) {
        const champIcon = isChampion ? '<span title="Champion" style="font-size:10px">★</span>' : '';
        const deadIcon = (isAlive === false) ? '<span title="Disabled" style="font-size:9px;color:var(--text-dim)">off</span>' : '';
        voteHtml = `<div style="display:flex;gap:3px;padding:2px 0;justify-content:flex-end;">
            ${champIcon}${deadIcon}
            <button class="arena-vote-btn vote-up" onclick="expertVote('${codename}','boost');setTimeout(()=>loadArena(),500)" title="Promising — boost">↑</button>
            ${isAlive !== false ?
            `<button class="arena-vote-btn vote-down" onclick="expertVote('${codename}','kill');setTimeout(()=>loadArena(),500)" title="Hopeless — disable">✕</button>` :
            `<button class="arena-vote-btn vote-revive" onclick="expertVote('${codename}','revive');setTimeout(()=>loadArena(),500)" title="Revive">↺</button>`}
        </div>`;
    }
    // GT confirm button — inactive until all 32 teeth marked
    let gtBtnHtml = '';
    if (type === 'ground-truth' && fileId) {
        const _t = (k, p) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k, p) : k;
        const gtFormula = formula || {};
        const filledCount = Object.values(gtFormula).filter(v => v).length;
        const isReady = filledCount >= 32;
        const readyClass = isReady ? 'ready' : '';
        const btnTitle = isReady
            ? _t('fmlSaveTitle')
            : _t('fmlNotReadyTitle', {filled: filledCount});
        const aiHintBtn = filledCount === 0
            ? `<div style="text-align:center;margin-bottom:2px;">
                <button class="gt-confirm-btn" style="background:rgba(168,85,247,0.2);border-color:rgba(168,85,247,0.5);font-size:11px;padding:4px 8px;" id="gt-ai-btn-${fileId}" onclick="prefillGTFromAI(${fileId})" title="Prefill ground truth from AI analysis (you can correct any errors before saving)">${_t('fmlAIPrefill')}</button>
              </div>`
            : `<button class="gt-confirm-btn" style="background:rgba(168,85,247,0.1);border-color:rgba(168,85,247,0.3);font-size:9px;padding:2px 6px;" id="gt-ai-btn-${fileId}" onclick="prefillGTFromAI(${fileId})" title="${_t('fmlAIRetitle')}">🤖</button>`;
        gtBtnHtml = `<div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:flex-end;margin-top:4px">`
            + aiHintBtn
            + `<button class="gt-confirm-btn ${readyClass}" id="gt-btn-${fileId}" onclick="${isReady ? `arenaConfirmGT(${fileId})` : ''}" title="${btnTitle}" style="margin:0">✓</button>`
            + `<span class="gt-save-indicator" id="gt-save-status-${fileId}"></span>`
            + `<button class="gt-tm-btn" id="gt-tm-trigger-${fileId}" onclick="_openTimeMachine(${fileId})" title="${_t('fmlTimeMachineTitle')}">&#128336;</button>`
            + `<button class="crop-toggle-btn active" id="crop-toggle-${fileId}" onclick="_toggleCropCarousel(${fileId})" title="${_t('fmlCropToggle')}">▲▼</button>`
            + `</div>`
            + `<div class="gt-save-banner" id="gt-save-banner-${fileId}" data-file="${fileId}" style="display:flex;align-items:center;gap:10px;margin:6px 0 4px;padding:6px 10px;border-radius:6px;background:rgba(15,23,42,0.4);border:1px solid rgba(148,163,184,0.18);font-size:11px;line-height:1.3;transition:background 0.3s,border-color 0.3s">
                <span class="gt-save-banner-icon" style="font-size:14px;line-height:1">💾</span>
                <span class="gt-save-banner-status" data-i18n-fallback="fmlSaveBannerNoChanges" style="font-weight:600;color:#94a3b8">${_t('fmlSaveBannerNoChanges')}</span>
                <span class="gt-save-banner-meta" style="color:#64748b;font-size:10px;margin-left:auto"></span>
            </div>`;
    }

    const deadStyle = (isAlive === false && type === 'algo') ? 'style="opacity:0.35"' : '';
    // Algo rows get onclick on label to show detail
    const labelClick = (type === 'algo' && codename) ? `onclick="showArenaAlgoDetail('${fileId}','${codename}',this)"` : '';

    return `
    <div class="arena-formula-row ${type === 'ground-truth' ? 'ground-truth' : ''}" ${deadStyle} data-codename="${codename||''}" data-file="${fileId||''}">
        <div class="row-label" ${labelClick}>
            <div>${label}</div>
            <div class="row-sub">${sublabel}${type==='ground-truth' && fileId && sublabel.includes('/32') ? (() => { const gt = arenaGroundTruth[fileId] || {}; const filled = Object.values(gt).filter(v=>v).length; if (filled === 0) return ''; const _um = _getUnmarkedTeethList(fileId); const _missingLbl = (typeof OrisI18n !== 'undefined') ? OrisI18n.t('fmlMissingTeeth') : 'нет:'; return _um ? `<div style="color:rgba(239,68,68,0.8);font-size:8px;line-height:1.2;max-height:24px;overflow:hidden;text-overflow:ellipsis">${_missingLbl} ${_um}</div>` : ''; })() : ''}</div>
            ${voteHtml}
            ${gtBtnHtml}
        </div>
        <div class="row-formula-wrap">
            ${type === 'ground-truth' && fileId ? `<button class="arena-crop-nav nav-left" id="crop-nav-left-${fileId}" onclick="event.stopPropagation();_navCropFromRow('${fileId}',-1)" title="← Предыдущий кроп">‹</button><button class="arena-crop-nav nav-right" id="crop-nav-right-${fileId}" onclick="event.stopPropagation();_navCropFromRow('${fileId}',1)" title="→ Следующий кроп">›</button>` : ''}
            ${type === 'ground-truth' && fileId ? `<div class="crop-carousel crop-carousel-upper" id="crop-carousel-upper-${fileId}" data-file="${fileId}" data-jaw="upper"></div>` : ''}
            <div class="row-cells row-cells-upper">${upperCells}</div>
            <div class="jaw-sep"></div>
            <div class="row-cells row-cells-lower">${lowerCells}</div>
            ${type === 'ground-truth' && fileId ? `<div class="crop-carousel crop-carousel-lower" id="crop-carousel-lower-${fileId}" data-file="${fileId}" data-jaw="lower"></div>` : ''}
        </div>
        ${scoreHtml}
    </div>`;
}

function arenaStatusIcon(s) {
    // Русская стоматологическая конвенция + OPG-специфика
    if (s === 'present')       return '·';   // интактный зуб
    if (s === 'missing')       return 'О';   // отсутствует
    if (s === 'implant' || s === 'impl_fixture') return 'И';
    if (s === 'impl_cover')    return 'ИЗ';  // фикстура + заглушка
    if (s === 'impl_healing')  return 'ИФ';  // + формирователь десны
    if (s === 'impl_abutment') return 'И';   // + абатмент
    if (s === 'impl_temp_abut') return 'И';  // + временный абатмент
    if (s === 'impl_provisional') return 'И'; // + провизорная коронка
    if (s === 'impl_restored') return 'ИК';  // + постоянная коронка
    if (s === 'crowned')       return 'К';   // коронка
    if (s === 'restored')      return 'П';   // пломба/вкладка
    if (s === 'caries')        return 'С';   // кариес
    if (s === 'endo')          return 'Э';   // эндо (каналы запломбированы)
    if (s === 'post')          return 'Ш';   // штифт
    if (s === 'attrition')     return 'Ст';  // стираемость
    if (s === 'root')          return 'R';   // корень
    if (s === 'impacted')      return 'Rt';  // ретинированный
    if (s === 'bridge' || s === 'bridge_pontic') return 'М'; // мост промежуточная часть
    if (s === 'bar')           return 'Б';   // балка
    if (s === 'cantilever')    return 'Кн';  // консоль
    if (s === 'uncertain')     return '?';
    // Legacy fallback
    if (s === 'natural')       return '·';
    if (s === 'crown')         return 'К';
    if (s === 'filling')       return 'П';
    return '';
}

// ── Tooth Status Picker — categorised menu ──
// Group headers and item labels carry an `i18nKey` so OrisI18n can
// translate them at render time (label is a fallback shown when no
// translation is registered). The localStorage cache key was bumped
// from darwin_tooth_groups → darwin_tooth_groups_v2 when the i18n
// keys were introduced; older saves are dropped on first load.
const _DEFAULT_TOOTH_GROUPS = [
    { i18nKey: 'tpHeaderStatus', label: 'СТАТУС ЗУБА', items: [
        { value: 'present',  i18nKey: 'tpItemPresent',   label: 'Интактный',    icon: '·',  color: 'var(--surface2)',          key: '1' },
        { value: 'missing',  i18nKey: 'tpItemMissing',   label: 'Отсутствует',  icon: 'О',  color: 'rgba(75,85,99,0.4)',       key: '0' },
        { value: 'impacted', i18nKey: 'tpItemImpacted',  label: 'Ретинир.',     icon: 'Rt', color: 'rgba(139,92,246,0.35)',   key: '8' },
    ]},
    { i18nKey: 'tpHeaderPathology', label: 'ПАТОЛОГИЯ', items: [
        { value: 'caries',   i18nKey: 'tpItemCaries',    label: 'Кариес',       icon: 'С',  color: 'rgba(251,146,60,0.4)',     key: '2' },
        { value: 'attrition',i18nKey: 'tpItemAttrition', label: 'Стираемость',  icon: 'Ст', color: 'rgba(234,179,8,0.4)',      key: '6' },
        { value: 'root',     i18nKey: 'tpItemRootRem',   label: 'Корень',       icon: 'R',  color: 'rgba(239,68,68,0.35)',     key: '5' },
    ]},
    { i18nKey: 'tpHeaderTreatment', label: 'ЛЕЧЕНИЕ', items: [
        { value: 'restored', i18nKey: 'tpItemRestored', label: 'Пломба',        icon: 'П',  color: 'rgba(59,130,246,0.35)',    key: '3' },
        { value: 'endo',     i18nKey: 'tpItemEndo',     label: 'Эндо',          icon: 'Э',  color: 'rgba(168,85,247,0.4)',     key: '4' },
    ]},
    { i18nKey: 'tpHeaderImplant', label: 'ИМПЛАНТАТ', items: [
        { value: 'impl_fixture',     i18nKey: 'tpItemImplFixture',     label: 'Фикстура',         icon: 'И',  color: 'rgba(16,185,129,0.25)', key: 'q' },
        { value: 'impl_cover',       i18nKey: 'tpItemImplCover',       label: '+ Заглушка',       icon: 'ИЗ', color: 'rgba(16,185,129,0.3)',  key: 'w' },
        { value: 'impl_healing',     i18nKey: 'tpItemImplHealing',     label: '+ Формирователь',  icon: 'ИФ', color: 'rgba(16,185,129,0.4)',  key: 'e' },
        { value: 'impl_abutment',    i18nKey: 'tpItemImplAbutment',    label: '+ Абатмент',        icon: 'И',  color: 'rgba(16,185,129,0.45)', key: 't' },
        { value: 'impl_temp_abut',   i18nKey: 'tpItemImplTempAbut',    label: '+ Врем. абатмент', icon: 'И',  color: 'rgba(16,185,129,0.42)', key: '' },
        { value: 'impl_provisional', i18nKey: 'tpItemImplProvisional', label: '+ Провиз. коронка',icon: 'И',  color: 'rgba(16,185,129,0.48)', key: '' },
        { value: 'impl_restored',    i18nKey: 'tpItemImplRestored',    label: '+ Коронка',         icon: 'ИК', color: 'rgba(16,185,129,0.5)',  key: 'y' },
    ]},
    { i18nKey: 'tpHeaderProsthesis', label: 'ПРОТЕЗ', items: [
        { value: 'post',          i18nKey: 'tpItemPost',         label: 'Штифт',               icon: 'Ш',  color: 'rgba(217,119,6,0.4)',    key: 'r' },
        { value: 'crowned',       i18nKey: 'tpItemCrowned',      label: 'Коронка',             icon: 'К',  color: 'rgba(245,158,11,0.4)',   key: '6' },
        { value: 'bridge',        i18nKey: 'tpItemBridge',       label: 'Понтик (тело моста)', icon: 'М',  color: 'rgba(34,211,238,0.35)',  key: '7' },
        { value: '_smart_bridge', i18nKey: 'tpItemSmartBridge',  label: '🌉 Мост (drag→b)',   icon: '🌉', color: 'rgba(34,211,238,0.45)',  key: 'b' },
        { value: '_smart_bar',    i18nKey: 'tpItemSmartBar',     label: '═ Балка (drag→g)',   icon: '═',  color: 'rgba(168,162,158,0.5)',  key: 'g' },
        { value: 'cantilever',    i18nKey: 'tpItemCantilever',   label: 'Консоль',             icon: 'Кн', color: 'rgba(34,211,238,0.45)',  key: 'u' },
    ]},
    { i18nKey: '', label: '', items: [
        { value: 'uncertain', i18nKey: 'tpItemUncertain', label: 'Не ясно', icon: '?', color: 'rgba(234,179,8,0.3)', key: '9' },
        { value: '',          i18nKey: 'tpItemReset',     label: 'Сброс',   icon: '✕', color: 'transparent',         key: 'Backspace' },
    ]},
];
// Tiny helpers — pull localised label / group label, fall back to
// the hard-coded one if i18n hasn't loaded yet.
function _tpItemLabel(item) {
    if (item.i18nKey && typeof OrisI18n !== 'undefined') return OrisI18n.t(item.i18nKey);
    return item.label || '';
}
function _tpGroupLabel(g) {
    if (g.i18nKey && typeof OrisI18n !== 'undefined') return OrisI18n.t(g.i18nKey);
    return g.label || '';
}
let TOOTH_GROUPS = JSON.parse(localStorage.getItem('darwin_tooth_groups_v2') || 'null') || structuredClone(_DEFAULT_TOOTH_GROUPS);

function _saveToothGroups() {
    localStorage.setItem('darwin_tooth_groups_v2', JSON.stringify(TOOTH_GROUPS));
}

function _resetToothGroups() {
    TOOTH_GROUPS = structuredClone(_DEFAULT_TOOTH_GROUPS);
    _saveToothGroups();
    _rebuildPickerFull();
}

// Move item from one group to another
function _moveItemToGroup(itemValue, fromGroupIdx, toGroupIdx) {
    const fromGroup = TOOTH_GROUPS[fromGroupIdx];
    const toGroup = TOOTH_GROUPS[toGroupIdx];
    if (!fromGroup || !toGroup) return;
    const itemIdx = fromGroup.items.findIndex(i => i.value === itemValue);
    if (itemIdx < 0) return;
    const [item] = fromGroup.items.splice(itemIdx, 1);
    toGroup.items.push(item);
    // Remove empty groups (except system ones)
    if (fromGroup.items.length === 0 && fromGroup.label) {
        TOOTH_GROUPS.splice(fromGroupIdx, 1);
    }
    _saveToothGroups();
    _rebuildPickerFull();
    _showGroupsEditor();
}

// Rename a group
function _renameGroup(groupIdx, newLabel) {
    if (TOOTH_GROUPS[groupIdx]) {
        TOOTH_GROUPS[groupIdx].label = newLabel;
        _saveToothGroups();
        _rebuildPickerFull();
    }
}

// Add a new empty group
function _addNewGroup() {
    // Insert before the last (system) group
    const insertIdx = TOOTH_GROUPS.length > 0 ? TOOTH_GROUPS.length - 1 : 0;
    const _t = (k) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k) : k;
    TOOTH_GROUPS.splice(insertIdx, 0, { label: _t('gedNewGroupName'), items: [] });
    _saveToothGroups();
    _rebuildPickerFull();
    _showGroupsEditor();
}

// Delete a group (move items to first group)
function _deleteGroup(groupIdx) {
    const group = TOOTH_GROUPS[groupIdx];
    if (!group || group.items.length > 0) return; // only delete empty groups
    TOOTH_GROUPS.splice(groupIdx, 1);
    _saveToothGroups();
    _rebuildPickerFull();
    _showGroupsEditor();
}

// Rebuild the entire picker HTML after group changes
function _rebuildPickerFull() {
    if (_pickerEl) { _pickerEl.remove(); _pickerEl = null; }
    // Update flat list for keyboard
    window.TOOTH_OPTIONS_FLAT = TOOTH_GROUPS.flatMap(g => g.items);
}

// Re-render the picker (and any stale TOOTH_OPTIONS_FLAT) whenever the
// EN/RU language flips so every group header / item label gets fresh
// strings on the next open.
if (typeof OrisI18n !== 'undefined') {
    OrisI18n.onLangChange(() => {
        _rebuildPickerFull();
        // If a groups-editor overlay is open, rebuild it too.
        const ed = document.getElementById('groups-editor-overlay');
        if (ed) { ed.remove(); _showGroupsEditor(); }
    });
}

// Show/hide groups editor panel
function _showGroupsEditor() {
    let editor = document.getElementById('groups-editor-overlay');
    if (editor) { editor.remove(); return; }

    editor = document.createElement('div');
    editor.id = 'groups-editor-overlay';
    editor.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center;';

    const _t = (k) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k) : k;
    let html = `<div style="background:var(--surface);border:1px solid var(--border);border-radius:12px;padding:20px;max-width:500px;width:90%;max-height:80vh;overflow-y:auto;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
            <div style="font-size:14px;font-weight:700;color:var(--text);">${_t('gedTitle')}</div>
            <span onclick="document.getElementById('groups-editor-overlay').remove()" style="cursor:pointer;font-size:18px;color:var(--text3);">✕</span>
        </div>`;

    TOOTH_GROUPS.forEach((group, gi) => {
        const isSystem = !group.label && group.items.some(i => i.value === '' || i.value === 'uncertain');
        const labelEditable = !isSystem;
        html += `<div style="margin-bottom:12px;border:1px solid var(--border);border-radius:8px;padding:8px;">`;
        if (labelEditable) {
            const groupShown = _tpGroupLabel(group);
            html += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                <input type="text" value="${groupShown}"
                    onchange="_renameGroup(${gi},this.value);document.getElementById('groups-editor-overlay').remove();_showGroupsEditor();"
                    style="flex:1;background:var(--surface2);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:12px;font-weight:700;color:var(--text);">
                ${group.items.length === 0 ? `<span onclick="_deleteGroup(${gi})" style="cursor:pointer;color:var(--red);font-size:11px;" title="${_t('gedDeleteEmpty')}">🗑</span>` : ''}
            </div>`;
        } else {
            html += `<div style="font-size:11px;color:var(--text3);margin-bottom:6px;font-weight:600;">${_t('gedSystemLabel')}</div>`;
        }

        group.items.forEach((item, ii) => {
            html += `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="background:${item.color};padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;min-width:28px;text-align:center;">${item.icon}</span>
                <span style="font-size:11px;color:var(--text);flex:1;">${_tpItemLabel(item)}</span>
                <span style="font-size:9px;color:var(--text3);width:16px;text-align:center;">${item.key === 'Backspace' ? '⌫' : item.key}</span>
                <select onchange="_moveItemToGroup('${item.value}',${gi},parseInt(this.value));this.value=''"
                    style="font-size:10px;background:var(--surface2);border:1px solid var(--border);border-radius:3px;color:var(--text3);padding:1px 4px;width:60px;">
                    <option value="">→</option>`;
            TOOTH_GROUPS.forEach((tg, tgi) => {
                if (tgi !== gi) {
                    html += `<option value="${tgi}">${_tpGroupLabel(tg) || _t('gedSystemLabel')}</option>`;
                }
            });
            html += `</select>
            </div>`;
        });

        html += `</div>`;
    });

    html += `<div style="display:flex;gap:8px;margin-top:8px;">
        <button onclick="_addNewGroup();document.getElementById('groups-editor-overlay').remove();_showGroupsEditor();"
            style="font-size:11px;padding:5px 12px;border-radius:6px;border:1px solid var(--blue);background:rgba(59,130,246,0.15);color:var(--blue);cursor:pointer;">${_t('gedAddGroup')}</button>
        <button onclick="_resetToothGroups();document.getElementById('groups-editor-overlay').remove();_showGroupsEditor();"
            style="font-size:11px;padding:5px 12px;border-radius:6px;border:1px solid var(--text3);background:transparent;color:var(--text3);cursor:pointer;">${_t('gedReset')}</button>
        <div style="flex:1;"></div>
        <button onclick="document.getElementById('groups-editor-overlay').remove()"
            style="font-size:11px;padding:5px 16px;border-radius:6px;border:1px solid var(--green);background:rgba(16,185,129,0.15);color:var(--green);cursor:pointer;">${_t('gedDone')}</button>
    </div>`;

    html += `</div>`;
    editor.innerHTML = html;
    // Close on overlay click
    editor.addEventListener('click', (e) => { if (e.target === editor) editor.remove(); });
    document.body.appendChild(editor);
}

// Composite presets — one-click multi-layer statuses
// Editable via UI ⚙ button, persisted in localStorage
const _DEFAULT_PRESETS = [
    { value: 'endo+post+crowned', label: 'ЭШК',  desc: 'Эндо+Штифт+Коронка',   color: 'rgba(245,158,11,0.3)', key: 'F1' },
    { value: 'endo+post',         label: 'ЭШ',   desc: 'Эндо+Штифт',           color: 'rgba(217,119,6,0.3)',  key: 'F2' },
    { value: 'endo+restored+crowned', label: 'ЭПК', desc: 'Эндо+Пломба+Коронка', color: 'rgba(168,85,247,0.3)', key: 'F3' },
    { value: 'endo+restored',     label: 'ЭП',   desc: 'Эндо+Пломба',          color: 'rgba(139,92,246,0.3)', key: 'F4' },
    { value: 'crowned+caries',   label: 'КС',   desc: 'Коронка+Вторичный кариес', color: 'rgba(251,146,60,0.3)', key: 'F5' },
    { value: 'restored+caries',  label: 'ПС',   desc: 'Пломба+Вторичный кариес',  color: 'rgba(251,146,60,0.25)', key: 'F6' },
];
let COMPOSITE_PRESETS = JSON.parse(localStorage.getItem('darwin_composite_presets') || 'null') || structuredClone(_DEFAULT_PRESETS);
// Reassign F-keys based on position
function _reassignPresetKeys() {
    COMPOSITE_PRESETS.forEach((p, i) => { p.key = 'F' + (i + 1); });
}
_reassignPresetKeys();

// Available layers for building presets
const PRESET_LAYER_OPTIONS = [
    { value: 'endo',     icon: 'Э', label: 'Эндо',     color: 'rgba(168,85,247,0.4)'  },
    { value: 'post',     icon: 'Ш', label: 'Штифт',    color: 'rgba(217,119,6,0.4)'   },
    { value: 'restored', icon: 'П', label: 'Пломба',   color: 'rgba(59,130,246,0.35)' },
    { value: 'crowned',  icon: 'К', label: 'Коронка',  color: 'rgba(245,158,11,0.4)'  },
    { value: 'caries',   icon: 'С', label: 'Кариес',   color: 'rgba(251,146,60,0.4)'  },
    { value: 'root',     icon: 'R', label: 'Корень',   color: 'rgba(239,68,68,0.35)'  },
    { value: 'bridge',      icon: 'М',  label: 'Мост',     color: 'rgba(34,211,238,0.35)' },
    { value: 'cantilever',  icon: 'Кн', label: 'Консоль',  color: 'rgba(34,211,238,0.45)' },
];

function _presetAutoLabel(value) {
    return value.split('+').map(s => {
        const o = PRESET_LAYER_OPTIONS.find(l => l.value === s);
        return o ? o.icon : s[0].toUpperCase();
    }).join('');
}
function _presetAutoDesc(value) {
    return value.split('+').map(s => {
        const o = PRESET_LAYER_OPTIONS.find(l => l.value === s);
        return o ? o.label : s;
    }).join('+');
}
function _presetAutoColor(value) {
    const parts = value.split('+');
    const last = PRESET_LAYER_OPTIONS.find(l => l.value === parts[parts.length - 1]);
    return last ? last.color : 'rgba(168,85,247,0.3)';
}

function _savePresets() {
    _reassignPresetKeys();
    localStorage.setItem('darwin_composite_presets', JSON.stringify(COMPOSITE_PRESETS));
}

function _deletePreset(idx) {
    COMPOSITE_PRESETS.splice(idx, 1);
    _savePresets();
    _rebuildPresetsUI();
}

function _addPresetFromEditor() {
    const checks = document.querySelectorAll('#preset-layer-checks input:checked');
    if (checks.length === 0) return;
    const layers = Array.from(checks).map(c => c.value);
    const value = layers.join('+');
    // Don't add duplicate
    if (COMPOSITE_PRESETS.some(p => p.value === value)) return;
    COMPOSITE_PRESETS.push({
        value, label: _presetAutoLabel(value),
        desc: _presetAutoDesc(value), color: _presetAutoColor(value), key: 'F' + (COMPOSITE_PRESETS.length + 1)
    });
    _savePresets();
    _rebuildPresetsUI();
    // Uncheck all
    checks.forEach(c => { c.checked = false; });
}

function _resetPresetsToDefault() {
    COMPOSITE_PRESETS = structuredClone(_DEFAULT_PRESETS);
    _savePresets();
    _rebuildPresetsUI();
}

function _rebuildPresetsUI() {
    const container = document.getElementById('tp-presets-container');
    if (!container) return;
    let html = '';
    for (let i = 0; i < COMPOSITE_PRESETS.length; i++) {
        const p = COMPOSITE_PRESETS[i];
        html += `<div class="tp-btn tp-preset" style="background:${p.color}" onclick="pickCompositePreset('${p.value}')">
            <span class="tp-icon">⚡</span>${p.label}<span class="tp-key">${p.key}</span>
        </div>`;
    }
    container.innerHTML = html;
    // Also rebuild editor list if open
    const edList = document.getElementById('preset-editor-list');
    if (edList) _renderPresetEditorList(edList);
}

function _renderPresetEditorList(el) {
    let html = '';
    for (let i = 0; i < COMPOSITE_PRESETS.length; i++) {
        const p = COMPOSITE_PRESETS[i];
        html += `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;">
            <span style="background:${p.color};padding:2px 6px;border-radius:4px;font-size:11px;font-weight:600;">${p.label}</span>
            <span style="color:var(--text2);font-size:10px;flex:1;">${p.desc}</span>
            <span style="color:var(--text3);font-size:9px;">${p.key}</span>
            <span style="cursor:pointer;color:var(--red);font-size:13px;padding:0 2px;" onclick="_deletePreset(${i})" title="Удалить">✕</span>
        </div>`;
    }
    el.innerHTML = html;
}

function _togglePresetEditor() {
    let editor = document.getElementById('preset-editor-panel');
    if (editor) { editor.remove(); return; }
    const anchor = document.getElementById('tp-presets-section');
    if (!anchor) return;
    editor = document.createElement('div');
    editor.id = 'preset-editor-panel';
    editor.style.cssText = 'padding:8px;border-top:1px solid var(--border);margin-top:4px;';
    editor.innerHTML = `
        <div style="font-size:10px;color:var(--text2);margin-bottom:6px;font-weight:600;">Текущие шаблоны:</div>
        <div id="preset-editor-list"></div>
        <div style="margin-top:8px;font-size:10px;color:var(--text2);font-weight:600;">Добавить новый:</div>
        <div id="preset-layer-checks" style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px;">
            ${PRESET_LAYER_OPTIONS.map(o => `
                <label style="display:flex;align-items:center;gap:3px;font-size:10px;cursor:pointer;background:${o.color};padding:2px 6px;border-radius:4px;">
                    <input type="checkbox" value="${o.value}" style="width:12px;height:12px;margin:0;">${o.icon} ${o.label}
                </label>
            `).join('')}
        </div>
        <div style="display:flex;gap:6px;margin-top:6px;">
            <button onclick="_addPresetFromEditor()" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid var(--blue);background:rgba(59,130,246,0.2);color:var(--blue);cursor:pointer;">＋ Добавить</button>
            <button onclick="_resetPresetsToDefault()" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid var(--text3);background:transparent;color:var(--text3);cursor:pointer;">↺ Сброс</button>
        </div>
    `;
    anchor.appendChild(editor);
    _renderPresetEditorList(document.getElementById('preset-editor-list'));
}

// Flat list for keyboard lookup (rebuilt on group changes)
var TOOTH_OPTIONS_FLAT = TOOTH_GROUPS.flatMap(g => g.items);

let _pickerEl = null;
let _pickerTarget = null; // {fileId, fdi, cellEl}
let _pickerOpenTime = 0; // timestamp when picker was opened (grace period for outside-click)

// Statuses that need surface selection (which walls are affected)
const SURFACE_STATUSES = ['caries', 'restored', 'endo'];
const SURFACE_LABELS = {v:'V вестиб.', m:'M мезиал.', o:'O окклюз.', d:'D дистал.', l:'L лингв.'};
const SURFACE_COLORS = { caries: '#fb923c', restored: '#3b82f6', endo: '#a855f7' };

// ═══ Layered tooth model ═══
// Format: "layer1+layer2+layer3" where each layer is "status" or "status:surfaces"
// Examples: "endo:mo+restored:mod" (endo with MO surfaces + restoration MOD)
//           "endo+post+crowned" (endo + post + crown, Э+Ш+К)
//           "caries:od" (single layer: caries OD)
// Order matters: base → top (endo → post → crown)

function parseToothLayers(raw) {
    if (!raw) return [];
    // New layered format uses '+' separator
    if (raw.includes('+')) {
        return raw.split('+').map(part => {
            const [status, surfaces] = part.includes(':') ? part.split(':') : [part, ''];
            return { status, surfaces };
        });
    }
    // Legacy single-status format
    const [status, surfaces] = raw.includes(':') ? raw.split(':') : [raw, ''];
    return [{ status, surfaces }];
}

function encodeToothLayers(layers) {
    if (!layers || layers.length === 0) return '';
    return layers.filter(l => l.status && l.status !== 'undefined')
        .map(l => l.surfaces ? `${l.status}:${l.surfaces}` : l.status).join('+');
}

/**
 * Clean incompatible / redundant layer combinations.
 * Rules:
 *  - impl_restored already includes crowned → remove crowned
 *  - impl_* stages incompatible with endo/post (implants have no pulp)
 *  - missing incompatible with treatment layers (but OK with bridge/cantilever/bar)
 */
function _cleanIncompatibleLayers(layers) {
    if (!layers || layers.length <= 1) return layers;
    const statuses = new Set(layers.map(l => l.status));
    const IMPL_STAGES = new Set(['implant','impl_fixture','impl_cover','impl_healing',
        'impl_abutment','impl_temp_abut','impl_provisional','impl_restored']);
    const hasImpl = layers.some(l => IMPL_STAGES.has(l.status));
    const hasImplRestored = statuses.has('impl_restored');
    // Deduplicate impl_* stages: keep only the highest
    const _IR = {implant:0,impl_fixture:1,impl_cover:2,impl_healing:3,impl_abutment:4,impl_temp_abut:5,impl_provisional:6,impl_restored:7};
    const implLayers = layers.filter(l => _IR[l.status] !== undefined);
    let bestImpl = null;
    if (implLayers.length > 1) {
        bestImpl = implLayers.reduce((a, b) => (_IR[b.status]||0) > (_IR[a.status]||0) ? b : a);
    }
    return layers.filter(l => {
        // impl_restored already includes crowned → drop crowned
        if (hasImplRestored && l.status === 'crowned') return false;
        // Implants don't have pulp → endo/post incompatible
        if (hasImpl && (l.status === 'endo' || l.status === 'post')) return false;
        // Deduplicate: drop lower impl stages when higher one exists
        if (bestImpl && _IR[l.status] !== undefined && l !== bestImpl) return false;
        // missing is incompatible with treatments (but not bridge/cantilever/bar)
        if (statuses.has('missing') && l.status !== 'missing'
            && !['bridge','cantilever','bar'].includes(l.status)) return false;
        return true;
    });
}

/** Remove a specific layer by index from a tooth's GT formula. */
function _removeGTLayer(fileId, fdi, layerIndex) {
    const raw = (arenaGroundTruth[fileId] || {})[fdi];
    if (!raw) return;
    const layers = parseToothLayers(raw);
    if (layerIndex < 0 || layerIndex >= layers.length) return;
    layers.splice(layerIndex, 1);
    const encoded = encodeToothLayers(layers);
    if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
    arenaGroundTruth[fileId][fdi] = encoded;
    // Rebuild SVG cell
    const cells = document.querySelectorAll(`.arena-cell[data-fdi="${fdi}"][data-file="${fileId}"]`);
    cells.forEach(cell => {
        if (layers.length > 1) _rebuildCellLayered(cell, fdi, layers);
        else if (layers.length === 1) _rebuildCell(cell, fdi, layers[0].status, layers[0].surfaces || '');
        else _rebuildCell(cell, fdi, '', '');
    });
    localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
    _debouncedSaveGT(fileId, fdi, null, `remove layer #${layerIndex}`, 'layer_remove');
    // Refresh crop obj panel if open
    const cs = _carouselState[fileId];
    if (cs) {
        const card = cs.cards.find(c => c.fdi === fdi);
        if (card) {
            card.gtLayers = layers;
            _refreshCropObjPanel(fileId, fdi);
        }
    }
    // Refresh fullscreen sidebar if open
    if (_cropFsState.open && _cropFsState.fileId == fileId && _cropFsState.fdi === fdi) {
        _cropFsUpdateSidebar();
    }
}

/** Show a context menu for removing individual layers from a tooth's GT formula. */
function _showLayerContextMenu(e, fileId, fdi) {
    e.preventDefault();
    const raw = (arenaGroundTruth[fileId] || {})[fdi];
    if (!raw || !raw.includes('+')) return; // only for multi-layer
    const layers = parseToothLayers(raw);
    if (layers.length < 2) return;

    // Remove existing menu
    const old = document.getElementById('gt-layer-ctx-menu');
    if (old) old.remove();

    const menu = document.createElement('div');
    menu.id = 'gt-layer-ctx-menu';
    menu.style.cssText = `position:fixed;z-index:10000;background:#1e293b;border:1px solid #475569;
        border-radius:6px;padding:4px 0;min-width:180px;box-shadow:0 8px 24px rgba(0,0,0,0.5);
        font-size:12px;color:#e2e8f0;left:${e.clientX}px;top:${e.clientY}px`;

    const header = document.createElement('div');
    header.style.cssText = 'padding:4px 12px;color:#94a3b8;font-size:10px;border-bottom:1px solid #334155';
    header.textContent = `FDI ${fdi} — Удалить слой:`;
    menu.appendChild(header);

    const _GT_LONG = {endo:'Эндо',post:'Штифт',crowned:'Коронка',restored:'Пломба',
        caries:'Кариес',present:'Интактный',missing:'Отсутствует',implant:'Имплантат',
        impl_fixture:'Фикстура',impl_cover:'Заглушка',impl_healing:'Формирователь',
        impl_abutment:'Абатмент',impl_restored:'Имп.+коронка',attrition:'Стираемость',
        root:'Корень',bridge:'Мост',bar:'Балка',impacted:'Ретенция',cantilever:'Консоль'};

    layers.forEach((l, idx) => {
        const item = document.createElement('div');
        item.style.cssText = 'padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:8px';
        item.innerHTML = `<span style="color:#ef4444;font-size:14px">✕</span>
            <span>${_GT_LONG[l.status] || l.status}${l.surfaces ? ' :' + l.surfaces.toUpperCase() : ''}</span>`;
        item.addEventListener('mouseenter', () => { item.style.background = 'rgba(255,255,255,0.08)'; });
        item.addEventListener('mouseleave', () => { item.style.background = ''; });
        item.addEventListener('click', () => {
            _removeGTLayer(fileId, fdi, idx);
            menu.remove();
        });
        menu.appendChild(item);
    });

    document.body.appendChild(menu);
    // Close on click outside
    const closer = (ev) => {
        if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closer, true); }
    };
    setTimeout(() => document.addEventListener('click', closer, true), 0);
}

function layersPrimaryStatus(layers) {
    // Верхний (последний) слой определяет визуальный класс и цвет
    // Порядок слоёв: base → top (endo → post → crown)
    if (!layers || layers.length === 0) return '';
    return layers[layers.length - 1].status;
}

function layersAbbreviation(layers) {
    if (!layers || layers.length === 0) return '';
    if (layers.length === 1) return surfaceAbbr(layers[0].status, layers[0].surfaces);
    // Collapse implant stages to highest only
    const _IR = {implant:0,impl_fixture:1,impl_cover:2,impl_healing:3,impl_abutment:4,impl_temp_abut:5,impl_provisional:6,impl_restored:7};
    const impl = layers.filter(l => _IR[l.status] !== undefined);
    let deduped = layers;
    if (impl.length > 1) {
        let best = impl[0];
        for (const l of impl) { if ((_IR[l.status]||0) > (_IR[best.status]||0)) best = l; }
        deduped = layers.filter(l => _IR[l.status] === undefined || l === best);
    }
    // Composite: Э+Ш+К etc.
    const LAYER_ABBR = {
        endo: 'Э', post: 'Ш', crowned: 'К', restored: 'П', caries: 'С',
        present: '·', missing: 'О', implant: 'И', impl_fixture: 'И',
        impl_cover: 'ИЗ', impl_healing: 'ИФ', impl_abutment: 'И',
        impl_temp_abut: 'И', impl_provisional: 'И',
        impl_restored: 'ИК', attrition: 'Ст', root: 'R', bridge: 'М', bar: 'Б',
        impacted: 'Rt', cantilever: 'Кн', uncertain: '?'
    };
    return deduped.map(l => {
        let a = LAYER_ABBR[l.status] || l.status[0]?.toUpperCase() || '?';
        if (l.surfaces) a += l.surfaces.toUpperCase();
        return a;
    }).join('');
}

function _ensurePicker() {
    if (_pickerEl) return;
    _pickerEl = document.createElement('div');
    _pickerEl.className = 'tooth-picker';

    const _t = (k) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k) : k;
    let html = `<div class="tp-title" style="display:flex;justify-content:space-between;align-items:center;"><span></span><span onclick="_showGroupsEditor()" style="cursor:pointer;font-size:12px;opacity:0.5;" title="${_t('tpSettingsTitle')}">⚙</span></div><div class="tp-status-page">`;
    for (const group of TOOTH_GROUPS) {
        html += `<div class="tp-group">`;
        const gLabel = _tpGroupLabel(group);
        if (gLabel) html += `<div class="tp-group-label">${gLabel}</div>`;
        html += `<div class="tp-grid">`;
        for (const o of group.items) {
            const keyLabel = o.key === 'Backspace' ? '⌫' : o.key;
            const oLabel = _tpItemLabel(o);
            const tip = STATUS_TOOLTIPS[o.value] || oLabel;
            html += `<div class="tp-btn" data-value="${o.value}" style="background:${o.color}" onclick="pickToothStatus('${o.value}')" title="${tip}">
                <span class="tp-icon">${o.icon}</span>${oLabel}<span class="tp-key">${keyLabel}</span>
            </div>`;
        }
        html += `</div></div>`;
    }
    // Composite presets section (editable)
    html += `<div class="tp-group" id="tp-presets-section"><div class="tp-group-label" style="display:flex;align-items:center;justify-content:space-between;">${_t('tpHeaderPresets')}<span style="cursor:pointer;font-size:13px;opacity:0.6;" onclick="_togglePresetEditor()" title="${_t('tpEditPresetsTitle')}">⚙</span></div><div class="tp-grid" id="tp-presets-container">`;
    for (const p of COMPOSITE_PRESETS) {
        html += `<div class="tp-btn tp-preset" style="background:${p.color}" onclick="pickCompositePreset('${p.value}')">
            <span class="tp-icon">⚡</span>${p.label}<span class="tp-key">${p.key}</span>
        </div>`;
    }
    html += `</div></div>`;

    // Bridge toggle — shown only in batch mode, hidden by default
    html += `<div class="tp-group tp-bridge-toggle" id="tp-bridge-toggle" style="display:none;">
        <div class="tp-group-label">${_t('tpHeaderLinks')}</div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <label style="display:flex;align-items:center;gap:5px;cursor:pointer;padding:2px 0;">
                <input type="checkbox" id="tp-bridge-check" style="width:14px;height:14px;margin:0;accent-color:rgb(34,211,238);">
                <span style="font-size:10px;color:rgba(34,211,238,0.9);">${_t('tpBridgeAddLink')}</span>
            </label>
            <button onclick="_bridgeLinkOnlyBatch()" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid rgba(34,211,238,0.5);background:rgba(34,211,238,0.15);color:rgba(34,211,238,0.9);cursor:pointer;font-weight:600;">${_t('tpBridgeLinkOnly')}</button>
            <button onclick="_bridgeUnlinkBatch()" style="font-size:10px;padding:3px 10px;border-radius:4px;border:1px solid rgba(239,68,68,0.4);background:rgba(239,68,68,0.1);color:rgba(239,68,68,0.8);cursor:pointer;">${_t('tpBridgeUnlink')}</button>
        </div>
    </div>`;

    html += `</div>`;

    // Surface picker panel (step 2 for caries/restored)
    html += `<div class="tp-surfaces" id="tp-surfaces">
        <div class="tp-surf-title">${_t('tpSurfacesTitle')}</div>
        <svg class="tp-surf-svg" viewBox="0 0 24 24" width="80" height="80">
            <polygon class="sf-btn sf-btn-v" data-sf="v" points="0,0 24,0 17,7 7,7"/>
            <polygon class="sf-btn sf-btn-d" data-sf="d" points="24,0 24,24 17,17 17,7"/>
            <polygon class="sf-btn sf-btn-l" data-sf="l" points="24,24 0,24 7,17 17,17"/>
            <polygon class="sf-btn sf-btn-m" data-sf="m" points="0,24 0,0 7,7 7,17"/>
            <polygon class="sf-btn sf-btn-o" data-sf="o" points="7,7 17,7 17,17 7,17"/>
            <line x1="0" y1="0" x2="7" y2="7" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
            <line x1="24" y1="0" x2="17" y2="7" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
            <line x1="24" y1="24" x2="17" y2="17" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
            <line x1="0" y1="24" x2="7" y2="17" stroke="rgba(255,255,255,0.25)" stroke-width="0.5"/>
            <text x="12" y="5" font-size="4" fill="rgba(255,255,255,0.5)" text-anchor="middle" pointer-events="none">V</text>
            <text x="21" y="13" font-size="4" fill="rgba(255,255,255,0.5)" text-anchor="middle" pointer-events="none">D</text>
            <text x="12" y="21" font-size="4" fill="rgba(255,255,255,0.5)" text-anchor="middle" pointer-events="none">L</text>
            <text x="3" y="13" font-size="4" fill="rgba(255,255,255,0.5)" text-anchor="middle" pointer-events="none">M</text>
            <text x="12" y="13" font-size="4" fill="rgba(255,255,255,0.5)" text-anchor="middle" pointer-events="none">O</text>
        </svg>
        <button class="tp-surf-done" onclick="_surfaceDone()">${_t('tpSurfaceDone')}</button>
    </div>`;

    // Root / canal section
    html += `<div class="tp-section" id="tp-roots-section" style="display:none;border-top:1px solid rgba(255,255,255,0.1);margin-top:6px;padding-top:6px;">
        <div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.5);margin-bottom:4px;">${_t('tpHeaderRoots')}</div>
        <div id="tp-variant-btns" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px;"></div>
        <div id="tp-dilac-controls" style="margin-bottom:6px;display:none;"></div>
        <div id="tp-vertucci-selectors" style="margin-bottom:6px;"></div>
        <div id="tp-root-preview" style="background:rgba(15,17,23,0.6);border-radius:6px;padding:8px;text-align:center;min-height:80px;"></div>
        <div style="font-size:9px;color:rgba(255,255,255,0.35);margin-top:4px;text-align:center;">Клик на канал = цикл заполнения</div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:6px;text-align:center;">
          Клик на апекс = периапикальная находка (PAI, Ørstavik 1986)
        </div>
        <div style="display:flex;gap:4px;justify-content:center;margin-top:3px;font-size:9px;flex-wrap:wrap;">
          <span style="cursor:pointer;padding:1px 4px;border-radius:3px;background:rgba(255,255,255,0.05);" onclick="_cyclePeriapical()" title="Клик = следующее состояние">
            <span id="tp-periap-label" style="color:var(--text-dim)">● Норма</span>
          </span>
        </div>
        <details style="font-size:8px;color:var(--text-dim);margin-top:4px;cursor:pointer;">
          <summary style="color:var(--text-dim);opacity:0.7;">📖 Справка PAI + литература</summary>
          <div style="padding:4px;background:rgba(0,0,0,0.2);border-radius:4px;margin-top:3px;line-height:1.5;">
            <b>PAI 1</b> — Норма: интактная lamina dura<br>
            <b>PAI 2</b> — Расш. периодонт. щель: ранний признак воспаления<br>
            <b>PAI 3</b> — Периапик. поражение <5мм: очаг разрежения<br>
            <b>PAI 4</b> — Периапик. поражение ≥5мм: выраженный очаг<br>
            <b>PAI 5</b> — Обширное поражение >10мм: показана КЛКТ<br>
            <hr style="border-color:var(--border);margin:4px 0;">
            <i>На рентгенограмме невозможно отличить гранулёму от кисты — дифференциация только гистологически.</i><br>
            <span style="opacity:0.6;">Ørstavik D. J Endod. 1986;12(4):167-71. PMID:3457698<br>
            Bender IB, Seltzer S. Oral Surg. 1961;14(12):1485-97<br>
            Natkin E et al. Oral Surg. 1984;57(1):82-94</span>
          </div>
        </details>
        <div style="font-size:9px;color:var(--text-dim);margin-top:4px;text-align:center;">
          Клик на бифуркацию = Glickman I-IV · Клик на бок корня = лат. дефект
        </div>
        <div style="display:flex;gap:4px;justify-content:center;margin-top:2px;font-size:8px;color:var(--text-dim);flex-wrap:wrap;">
          <span style="color:var(--yel)">◼ Ф1</span>
          <span style="color:var(--gold)">◼ Ф2</span>
          <span style="color:var(--red)">◼ Ф3-4</span>
          <span>|</span>
          <span style="color:rgba(168,85,247,0.8)">│V↓</span>
          <span style="color:rgba(59,130,246,0.8)">│H—</span>
          <span style="color:rgba(234,179,8,0.8)">│U</span>
        </div>
        <details style="font-size:8px;color:var(--text-dim);margin-top:3px;cursor:pointer;">
          <summary style="opacity:0.7;">📖 Справка: фуркация + пародонт</summary>
          <div style="padding:4px;background:rgba(0,0,0,0.2);border-radius:4px;margin-top:3px;line-height:1.5;">
            <b>Фуркация (Glickman 1955)</b><br>
            I — начальная (на OPG не видна)<br>
            II — неполная потеря кости между корнями<br>
            III — сквозной дефект (видно разрежение)<br>
            IV — обнажённая фуркация<br>
            <b>Латеральные дефекты</b><br>
            V↓ — вертикальный (angular) · H— — горизонтальный · U — кратер<br>
            <b>Эндо-перио</b><br>
            J — J-образное (от апекса к краю) · ◯ — Halo · ⊕ — комбинированное<br>
            <hr style="border-color:var(--border);margin:4px 0;">
            <span style="opacity:0.6;">Glickman I. J Periodontol. 1958;29:5-15<br>
            Hamp SE et al. J Clin Periodontol. 1975;2:126-35<br>
            Simon JH et al. J Periodontol. 1972;43:202-8</span>
          </div>
        </details>
        <div id="tp-wear-section" style="margin-top:4px;"></div>
        <div id="tp-fracture-section" style="margin-top:4px;"></div>
        <div id="tp-implant-count-section" style="margin-top:4px;display:none;"></div>
    </div>`;

    _pickerEl.innerHTML = html;
    document.body.appendChild(_pickerEl);

    // Enable drag-select for surface polygons
    _initSurfaceDrag();

    // Drag picker by title bar
    const titleBar = _pickerEl.querySelector('.tp-title');
    if (titleBar) {
        let dragging = false, dx = 0, dy = 0;
        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') return;
            dragging = true;
            const rect = _pickerEl.getBoundingClientRect();
            dx = e.clientX - rect.left;
            dy = e.clientY - rect.top;
            e.preventDefault();
        });
        document.addEventListener('mousemove', (e) => {
            if (!dragging) return;
            _pickerEl.style.left = (e.clientX - dx) + 'px';
            _pickerEl.style.top = (e.clientY - dy) + 'px';
            _pickerEl.style.right = 'auto';
            _pickerEl.style.bottom = 'auto';
        });
        document.addEventListener('mouseup', () => { dragging = false; });
    }

    // Close on outside click (with grace period to prevent immediate close after drag)
    document.addEventListener('click', (e) => {
        if (!_pickerEl.classList.contains('open')) return;
        // Grace period: don't close if picker just opened (within 200ms)
        if (_pickerOpenTime && Date.now() - _pickerOpenTime < 200) return;
        if (!_pickerEl.contains(e.target)) {
            const cell = _pickerTarget?.cellEl;
            if (e.target !== cell && !cell?.contains(e.target)) {
                _pickerEl.classList.remove('open');
            }
        }
    });

    // Keyboard shortcuts while picker is open
    document.addEventListener('keydown', (e) => {
        if (!_pickerEl.classList.contains('open')) return;
        // If surface panel is active, handle surface keys
        const surfPanel = document.getElementById('tp-surfaces');
        if (surfPanel && surfPanel.classList.contains('active')) {
            const sfKey = {v:'v',m:'m',o:'o',d:'d',l:'l'}[e.key.toLowerCase()];
            if (sfKey) {
                const btn = surfPanel.querySelector(`.sf-btn-${sfKey}`);
                if (btn) _toggleSurface(sfKey, btn);
                e.preventDefault(); return;
            }
            if (e.key === 'Enter') { _surfaceDone(); e.preventDefault(); return; }
            if (e.key === 'Escape') { _surfaceDone(); e.preventDefault(); return; }
            return;
        }
        // F1-F3: composite presets
        const preset = COMPOSITE_PRESETS.find(p => p.key === e.key);
        if (preset) { pickCompositePreset(preset.value); e.preventDefault(); return; }
        const opt = TOOTH_OPTIONS_FLAT.find(o => o.key === e.key);
        if (opt) { pickToothStatus(opt.value); e.preventDefault(); }
        if (e.key === 'Escape') { _pickerEl.classList.remove('open'); e.preventDefault(); }
    });
}

// ═══ Multi-tooth drag selection ═══
let _toothDragActive = false;
let _toothDragFileId = null;
let _toothDragCells = []; // [{fdi, cellEl}]

function _toothCellMouseDown(e, cellEl, fileId, fdi) {
    if (e.button !== 0) return;

    // In correction mode, don't open picker — let the click handler manage correction
    if (typeof _correctionState !== 'undefined' && _correctionState.active) {
        return;  // correction click handler will handle it via event delegation
    }

    // Ctrl+Click / Cmd+Click → YOLO correction mode (не пикер)
    // Не перехватываем событие — пусть дойдёт до document click handler
    if (e.ctrlKey || e.metaKey) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    // ═══ KEY UX FIX: open picker IMMEDIATELY on mousedown ═══
    // Previously picker opened on mouseup — user would hold button,
    // move mouse looking for buttons, accidentally triggering drag.
    // Now: picker opens instantly. If user drags ≥8px, picker closes → batch mode.
    // NOTE: Do NOT call _syncCarouselFromFormula here — formula click = picker only,
    // crop card click = expand only. Two separate gestures for two separate actions.
    openToothPicker(fileId, fdi, cellEl, e);

    // Start drag tracking (backup for multi-tooth selection)
    _toothDragActive = true;
    _toothDragFileId = fileId;
    _toothDragCells = [{fdi, cellEl}];
    const _dragStartX = e.clientX;
    const _dragStartY = e.clientY;
    let _dragThresholdMet = false;
    const DRAG_THRESHOLD = 8; // px — minimum movement before multi-select activates

    // Find the formula-wrap to scope drag
    const wrap = cellEl.closest('.row-formula-wrap');
    if (!wrap) { _toothDragActive = false; return; }

    // Suppress native browser drag & text selection during our custom drag
    const onSelectStart = (ev) => { ev.preventDefault(); };
    const onDragStart = (ev) => { ev.preventDefault(); };
    document.addEventListener('selectstart', onSelectStart);
    document.addEventListener('dragstart', onDragStart);

    const onMove = (ev) => {
        if (!_toothDragActive) return;
        ev.preventDefault();

        // Check if drag threshold met
        if (!_dragThresholdMet) {
            const dx = ev.clientX - _dragStartX;
            const dy = ev.clientY - _dragStartY;
            if (Math.sqrt(dx*dx + dy*dy) < DRAG_THRESHOLD) return;
            _dragThresholdMet = true;
            // Drag started — close the single-tooth picker, switch to batch mode
            if (_pickerEl && _pickerEl.classList.contains('open')) {
                _pickerEl.classList.remove('open');
            }
            cellEl.classList.add('drag-selected');
        }

        const el = document.elementFromPoint(ev.clientX, ev.clientY);
        if (!el) return;
        const cell = el.closest('.arena-cell');
        if (cell && wrap.contains(cell) && cell.dataset.fdi &&
            !_toothDragCells.find(c => c.fdi === cell.dataset.fdi)) {
            _toothDragCells.push({fdi: cell.dataset.fdi, cellEl: cell});
            cell.classList.add('drag-selected');
        }
    };

    const onUp = (ev) => {
        document.removeEventListener('mouseup', onUp);
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('selectstart', onSelectStart);
        document.removeEventListener('dragstart', onDragStart);
        _toothDragActive = false;

        // Clear visual selection
        _toothDragCells.forEach(c => c.cellEl.classList.remove('drag-selected'));

        if (_dragThresholdMet && _toothDragCells.length > 1) {
            // Multi-select drag completed — open batch picker
            openBatchToothPicker(fileId, _toothDragCells, cellEl, ev);
        }
        // else: single click — picker already opened on mousedown, do nothing
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
}

// Batch picker: apply status to all selected teeth at once
// ═══ Bridge context menu (right-click on GT cell) ═══
function _bridgeContextMenu(e, cellEl, fileId, fdi) {
    e.preventDefault();
    e.stopPropagation();
    // Remove any existing context menus
    document.querySelectorAll('.bridge-ctx-menu,.note-ctx-menu').forEach(m => m.remove());

    const leftFdi = getAdjacentFdi(fdi, 'left');
    const rightFdi = getAdjacentFdi(fdi, 'right');
    const links = arenaBridgeLinks[fileId] || {};

    // ── Bridge section ──
    let bridgeBtns = '';
    if (rightFdi) {
        const rKey = makeBridgeKey(fdi, rightFdi);
        const rLinked = !!links[rKey];
        bridgeBtns += `<button onclick="toggleBridgeLink('${fileId}','${fdi}','${rightFdi}');this.closest('.note-ctx-menu').remove()">
            ${rLinked ? '✕ Разъединить →' : '🔗 Связать →'} ${rightFdi}</button>`;
    }
    if (leftFdi) {
        const lKey = makeBridgeKey(fdi, leftFdi);
        const lLinked = !!links[lKey];
        bridgeBtns += `<button onclick="toggleBridgeLink('${fileId}','${fdi}','${leftFdi}');this.closest('.note-ctx-menu').remove()">
            ${lLinked ? '✕ Разъединить ←' : '🔗 Связать ←'} ${leftFdi}</button>`;
    }

    // ── Note section (multi-tag toggle) ──
    const activeTags = _getNoteTags(fileId, fdi);
    const currentNote = (arenaToothNotes[fileId] || {})[fdi] || '';

    // Detect if this tooth is an implant (show complication presets)
    const toothStatus = (arenaGroundTruth[fileId] || {})[fdi] || '';
    const isImplant = /impl|implant/.test(toothStatus);

    const mR = _isMesialRight(fdi);
    // Swap arrows for Q1/Q4: mesial=right, distal=left (opposite of default ⬅/➡)
    const _noteLabel = (p) => {
        if (!mR) return p.label; // Q2/Q3: default arrows correct (mesial=left)
        // Q1/Q4: flip mesial/distal arrows
        return p.label
            .replace('⬅ Мезиальный', '➡ Мезиальный')
            .replace('➡ Дистальный', '⬅ Дистальный')
            .replace('↗ Наклон мезиально', '↗ Наклон мезиально') // ↗ is fine for right
            .replace('↘ Наклон дистально', '↙ Наклон дистально');
    };
    let notePresetBtns = NOTE_PRESETS.map(p => {
        const isOn = activeTags.includes(p.value);
        const lbl = _noteLabel(p);
        return `<button class="note-tag-btn" data-tag="${p.value}"
            onclick="_noteTagToggle(this,'${fileId}','${fdi}','${p.value}')"
            style="${isOn ? 'background:rgba(251,191,36,0.2);font-weight:600;border-left:2px solid rgba(251,191,36,0.7)' : ''}">${isOn ? '✓ ' : ''}${lbl}</button>`;
    }).join('');

    // Implant complication buttons (shown for implant teeth, collapsible for others)
    let implantBtns = '';
    const implComps = IMPLANT_COMPLICATION_PRESETS.map(p => {
        const isOn = activeTags.includes(p.value);
        const bgColor = p.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
        const borderColor = p.severity === 'critical' ? 'rgba(239,68,68,0.6)' : 'rgba(245,158,11,0.6)';
        return `<button class="note-tag-btn" data-tag="${p.value}" title="${p.desc}\n${p.en}"
            onclick="_noteTagToggle(this,'${fileId}','${fdi}','${p.value}')"
            style="${isOn ? `background:${bgColor};font-weight:600;border-left:2px solid ${borderColor}` : ''}">${isOn ? '✓ ' : ''}${p.label}</button>`;
    }).join('');

    if (isImplant) {
        implantBtns = `<div style="font-size:9px;color:rgba(239,68,68,0.7);padding:2px 10px;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid var(--border);padding-top:6px">🦴 Осложнения имплантата</div>${implComps}`;
    } else {
        implantBtns = `<details style="margin-top:4px;border-top:1px solid var(--border);padding-top:4px">
            <summary style="font-size:9px;color:var(--text-dim);padding:2px 10px;cursor:pointer;text-transform:uppercase;letter-spacing:0.5px">🦴 Осложнения имплантата</summary>${implComps}</details>`;
    }

    const noteInputHtml = `<div class="note-input-row">
        <input type="text" id="_noteCustomInput" placeholder="+ свой тег..." maxlength="40">
        <button onclick="_noteAddCustom('${fileId}','${fdi}')">＋</button>
    </div>`;

    const clearBtn = currentNote
        ? `<button onclick="setToothNote('${fileId}','${fdi}','');this.closest('.note-ctx-menu').remove()" style="color:var(--red)">✕ Убрать все</button>`
        : '';

    const notesSummary = activeTags.length > 0 ? ` (${activeTags.length}): ${activeTags.join(', ')}` : '';

    // ── Root pathology section (periapical, furcation, lateral, endo-perio, TWI, canals) ──
    const rd = (arenaRootData[fileId] || {})[fdi] || {};
    const typeId = FDI_TO_TYPE[fdi];
    const toothLib = typeId ? TOOTH_LIBRARY[typeId] : null;
    const variantObj = toothLib ? (toothLib.variants.find(v => v.id === rd.variant) || toothLib.variants.find(v => v.isDefault) || toothLib.variants[0]) : null;
    const nRoots = variantObj ? variantObj.roots.length : 1;
    const rawGT = (arenaGroundTruth[fileId] || {})[fdi] || '';
    const hasEndo = rawGT.split('+').some(p => p.split(':')[0] === 'endo');

    // Current states for display
    const pa0 = rd.periapical?.[0];
    const paLabel = pa0 ? (PERIAPICAL_STATES.find(s => s.key === _periapKey(pa0.type))?.nameRU || '—') : '—';
    const furc0 = rd.furcation?.[0];
    const furcLabel = furc0 ? FURCATION_STATES[furc0.grade]?.nameRU || '—' : '—';
    const lat0m = rd.lateral?.['0_m'];
    const lat0mLabel = lat0m ? (LATERAL_STATES.find(s => s.key === lat0m.type)?.nameRU || '—') : '—';
    const lat0d = rd.lateral?.['0_d'];
    const lat0dLabel = lat0d ? (LATERAL_STATES.find(s => s.key === lat0d.type)?.nameRU || '—') : '—';
    const ep0 = rd.endoPerio?.[0];
    const epLabel = ep0 ? (ENDOPERIO_STATES.find(s => s.key === ep0.type)?.nameRU || '—') : '—';
    const twiVal = rd.wear?.twi || 0;
    const fs00 = rd.fillStates?.['0_0'];
    const canalLabel = hasEndo ? (fs00 !== undefined ? FILL_STATES[fs00]?.label || '?' : '?') : '—';

    let rootPathBtns = `
        <button class="note-tag-btn" onclick="_ctxCyclePeriapical('${fileId}','${fdi}');_ctxRefreshRootSection(this,'${fileId}','${fdi}')" style="${pa0 ? 'background:rgba(239,68,68,0.15);border-left:2px solid var(--red)' : ''}">
            📍 Периапикально: ${paLabel}</button>`;
    if (nRoots > 1) {
        rootPathBtns += `
        <button class="note-tag-btn" onclick="_ctxCycleFurcation('${fileId}','${fdi}');_ctxRefreshRootSection(this,'${fileId}','${fdi}')" style="${furc0 ? 'background:rgba(234,179,8,0.15);border-left:2px solid var(--gold)' : ''}">
            🔀 Фуркация: ${furcLabel}</button>`;
    }
    rootPathBtns += `
        <button class="note-tag-btn" onclick="_ctxCycleLateral('${fileId}','${fdi}','0','m');_ctxRefreshRootSection(this,'${fileId}','${fdi}')" style="${lat0m?.type && lat0m.type!=='none' ? 'background:rgba(168,85,247,0.15);border-left:2px solid rgba(168,85,247,0.7)' : ''}">
            📐 Лат. мез.: ${lat0mLabel}</button>
        <button class="note-tag-btn" onclick="_ctxCycleLateral('${fileId}','${fdi}','0','d');_ctxRefreshRootSection(this,'${fileId}','${fdi}')" style="${lat0d?.type && lat0d.type!=='none' ? 'background:rgba(59,130,246,0.15);border-left:2px solid var(--blue)' : ''}">
            📐 Лат. дист.: ${lat0dLabel}</button>
        <button class="note-tag-btn" onclick="_ctxCycleEndoPerio('${fileId}','${fdi}');_ctxRefreshRootSection(this,'${fileId}','${fdi}')" style="${ep0?.type && ep0.type!=='none' ? 'background:rgba(239,68,68,0.15);border-left:2px solid var(--red)' : ''}">
            🔗 Эндо-перио: ${epLabel}</button>
        <button class="note-tag-btn" onclick="_ctxCycleTWI('${fileId}','${fdi}');_ctxRefreshRootSection(this,'${fileId}','${fdi}')" style="${twiVal > 0 ? 'background:rgba(234,179,8,0.15);border-left:2px solid var(--gold)' : ''}">
            📊 Стираемость: TWI ${twiVal}</button>`;
    if (hasEndo) {
        rootPathBtns += `
        <button class="note-tag-btn" onclick="_ctxCycleCanal('${fileId}','${fdi}');_ctxRefreshRootSection(this,'${fileId}','${fdi}')" style="${fs00 ? 'background:rgba(34,197,94,0.15);border-left:2px solid var(--green)' : ''}">
            🦷 Канал R1: ${canalLabel}</button>`;
    }

    const menu = document.createElement('div');
    menu.className = 'note-ctx-menu';
    menu.innerHTML = `
        <div style="font-size:10px;color:var(--text-dim);padding:2px 10px;margin-bottom:2px;font-weight:600">${(typeof OrisI18n !== 'undefined') ? OrisI18n.t('pickerTitleTooth', {fdi}) : 'Зуб ' + fdi}</div>
        ${bridgeBtns ? `<div style="font-size:9px;color:var(--text-dim);padding:2px 10px;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px">Мост</div>${bridgeBtns}` : ''}
        <div style="font-size:9px;color:var(--text-dim);padding:2px 10px;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid var(--border);padding-top:6px">🦷 Патология корня</div>
        ${rootPathBtns}
        <div style="font-size:9px;color:var(--text-dim);padding:2px 10px;margin-top:4px;text-transform:uppercase;letter-spacing:0.5px;border-top:1px solid var(--border);padding-top:6px">📝 Заметки${notesSummary}</div>
        ${notePresetBtns}
        ${implantBtns}
        ${noteInputHtml}
        ${clearBtn}
    `;

    const rect = cellEl.getBoundingClientRect();
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';
    // Adjust position if would overflow
    document.body.appendChild(menu);
    const menuRect = menu.getBoundingClientRect();
    if (menuRect.bottom > window.innerHeight - 8) menu.style.top = (rect.top - menuRect.height - 4) + 'px';
    if (menuRect.right > window.innerWidth - 8) menu.style.left = (window.innerWidth - menuRect.width - 8) + 'px';

    // Close on Escape or outside click
    setTimeout(() => {
        const inp = document.getElementById('_noteCustomInput');
        if (inp) {
            inp.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') {
                    const val = inp.value.trim();
                    if (val) { toggleToothNoteTag(fileId, fdi, val); inp.value = ''; }
                } else if (ev.key === 'Escape') {
                    menu.remove();
                }
            });
        }
        document.addEventListener('click', function _cl(ev) {
            if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', _cl); }
        });
        document.addEventListener('keydown', function _esc(ev) {
            if (ev.key === 'Escape') { menu.remove(); document.removeEventListener('keydown', _esc); }
        });
    }, 50);
}

// Toggle a note tag in the context menu (update button visually without closing menu)
function _noteTagToggle(btn, fileId, fdi, tag) {
    toggleToothNoteTag(fileId, fdi, tag);
    const isNowOn = _getNoteTags(fileId, fdi).includes(tag);
    // Find preset in either list
    const preset = NOTE_PRESETS.find(p => p.value === tag) || IMPLANT_COMPLICATION_PRESETS.find(p => p.value === tag);
    const isImplComp = IMPLANT_COMPLICATION_PRESETS.find(p => p.value === tag);
    if (isImplComp) {
        const bgColor = isImplComp.severity === 'critical' ? 'rgba(239,68,68,0.15)' : 'rgba(245,158,11,0.15)';
        const borderColor = isImplComp.severity === 'critical' ? 'rgba(239,68,68,0.6)' : 'rgba(245,158,11,0.6)';
        btn.style.background = isNowOn ? bgColor : '';
        btn.style.fontWeight = isNowOn ? '600' : '';
        btn.style.borderLeft = isNowOn ? `2px solid ${borderColor}` : '';
    } else {
        btn.style.background = isNowOn ? 'rgba(251,191,36,0.2)' : '';
        btn.style.fontWeight = isNowOn ? '600' : '';
        btn.style.borderLeft = isNowOn ? '2px solid rgba(251,191,36,0.7)' : '';
    }
    if (preset) btn.textContent = (isNowOn ? '✓ ' : '') + preset.label;
}

function _noteAddCustom(fileId, fdi) {
    const inp = document.getElementById('_noteCustomInput');
    if (!inp) return;
    const val = inp.value.trim();
    if (!val) return;
    toggleToothNoteTag(fileId, fdi, val);
    inp.value = '';
}

function openBatchToothPicker(fileId, cells, anchorEl, event) {
    _ensurePicker();
    // Store batch target
    _pickerTarget = { fileId, fdi: cells[0].fdi, cellEl: anchorEl, batch: cells };

    // Position near anchor — measure actual height
    const rect = anchorEl.getBoundingClientRect();
    _pickerEl.style.top = '-9999px';
    _pickerEl.style.left = '-9999px';
    _pickerEl.classList.add('open');
    const pickerH = _pickerEl.offsetHeight;
    const pickerW = _pickerEl.offsetWidth || 270;
    _pickerEl.classList.remove('open');

    let top = rect.bottom + 4;
    let left = rect.left - 80;
    if (top + pickerH > window.innerHeight - 8) top = rect.top - pickerH - 4;
    if (top < 8) top = 8;
    if (left < 8) left = 8;
    if (left + pickerW > window.innerWidth) left = window.innerWidth - pickerW - 8;
    _pickerEl.style.top = top + 'px';
    _pickerEl.style.left = left + 'px';

    // Title shows selected teeth
    const fdiList = cells.map(c => c.fdi).join(', ');
    _pickerEl.querySelector('.tp-title span').textContent = `Зубы: ${fdiList} (${cells.length} шт.)`;
    _pickerEl.querySelectorAll('.tp-btn').forEach(o => o.classList.remove('active'));

    // Reset surface panel
    const surfPanel = document.getElementById('tp-surfaces');
    if (surfPanel) surfPanel.classList.remove('active');
    _pickerEl.querySelector('.tp-status-page').style.display = '';

    // Show bridge toggle for batch mode
    const bridgeToggle = document.getElementById('tp-bridge-toggle');
    if (bridgeToggle) bridgeToggle.style.display = '';
    const bridgeCheck = document.getElementById('tp-bridge-check');
    if (bridgeCheck) bridgeCheck.checked = false;

    // Update right-side detail panel with first tooth in batch
    _updateToothDetailPanel(fileId, cells[0].fdi);

    _pickerOpenTime = Date.now();
    _pickerEl.classList.add('open');
}

function openToothPicker(fileId, fdi, cellEl, event) {
    _ensurePicker();
    _pickerTarget = { fileId, fdi, cellEl };
    _layerAddMode = false;
    if (_pickerEl) _pickerEl.classList.remove('layer-add-mode');

    // Position near the cell — measure actual picker height
    const rect = cellEl.getBoundingClientRect();
    // Temporarily show offscreen to measure
    _pickerEl.style.top = '-9999px';
    _pickerEl.style.left = '-9999px';
    _pickerEl.classList.add('open');
    const pickerH = _pickerEl.offsetHeight;
    const pickerW = _pickerEl.offsetWidth || 270;
    _pickerEl.classList.remove('open');

    let top = rect.bottom + 4;
    let left = rect.left - 80;
    // Flip upward if would go off bottom
    if (top + pickerH > window.innerHeight - 8) {
        top = rect.top - pickerH - 4;
    }
    // If still off top, pin to top
    if (top < 8) top = 8;
    if (left < 8) left = 8;
    if (left + pickerW > window.innerWidth) left = window.innerWidth - pickerW - 8;
    _pickerEl.style.top = top + 'px';
    _pickerEl.style.left = left + 'px';

    // Parse current layers
    const raw = (arenaGroundTruth[fileId] || {})[fdi] || '';
    const layers = parseToothLayers(raw);
    const primary = layersPrimaryStatus(layers);

    // Show title with current layers info
    const _ttp = (k, p) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k, p) : k;
    let titleText = _ttp('pickerTitleTooth', {fdi});
    if (layers.length > 1) {
        titleText += ` [${layersAbbreviation(layers)}]`;
    }
    _pickerEl.querySelector('.tp-title span').textContent = titleText;

    // Update layer info strip
    let layerInfoEl = _pickerEl.querySelector('.tp-layer-info');
    if (!layerInfoEl) {
        layerInfoEl = document.createElement('div');
        layerInfoEl.className = 'tp-layer-info';
        _pickerEl.querySelector('.tp-title').after(layerInfoEl);
    }
    if (layers.length > 0) {
        const chips = layers.map(l => {
            const lbl = arenaStatusIcon(l.status) + (l.surfaces ? ':'+l.surfaces.toUpperCase() : '');
            return `<span class="tp-layer-chip">${lbl}</span>`;
        }).join('');
        layerInfoEl.innerHTML = `<div style="display:flex;gap:3px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
            ${chips}
            <button class="tp-add-layer-btn" onclick="_layerAddMode=true;_pickerEl.querySelector('.tp-title span').textContent='${(typeof OrisI18n !== 'undefined') ? OrisI18n.t('pickerTitleTooth', {fdi}) : 'Зуб ' + fdi} — ' + ((typeof OrisI18n !== 'undefined') ? OrisI18n.t('pickerAddLayer') : '＋слой');_pickerEl.classList.add('layer-add-mode')" title="${(typeof OrisI18n !== 'undefined') ? OrisI18n.t('pickerAddLayerTitle') : 'Добавить слой (Э+Ш+К)'}">${(typeof OrisI18n !== 'undefined') ? OrisI18n.t('pickerAddLayer') : '＋слой'}</button>
        </div>`;
    } else {
        layerInfoEl.innerHTML = '';
    }

    _pickerEl.querySelectorAll('.tp-btn').forEach(o => {
        o.classList.toggle('active', o.dataset.value === primary);
    });
    // Reset surface panel
    const surfPanel = document.getElementById('tp-surfaces');
    if (surfPanel) surfPanel.classList.remove('active');
    _pickerEl.querySelector('.tp-status-page').style.display = '';

    // Hide bridge toggle in single-tooth mode
    const bridgeToggle2 = document.getElementById('tp-bridge-toggle');
    if (bridgeToggle2) bridgeToggle2.style.display = 'none';

    // Render root section
    _renderRootSection(fileId, fdi);

    // Update right-side detail panel
    _updateToothDetailPanel(fileId, fdi);

    _pickerOpenTime = Date.now();
    _pickerEl.classList.add('open');
}

// Open picker directly at root section (for clicking root cell on endo teeth)
function _openRootPicker(fileId, fdi, rootSpan) {
    const cellEl = rootSpan.closest('.arena-cell');
    if (!cellEl) return;
    openToothPicker(fileId, fdi, cellEl);
    // Don't auto-scroll — picker opens at top showing layers/surfaces.
    // User scrolls down to root section when needed.
}

let _pickerPendingStatus = ''; // status waiting for surface selection

// ═══ Auto-bridge: link all adjacent teeth in batch ═══
function _autoBridgeBatch(fileId, batch) {
    const bridgeCheck = document.getElementById('tp-bridge-check');
    if (!bridgeCheck || !bridgeCheck.checked) return;
    if (!batch || batch.length < 2) return;
    const UPPER = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
    const LOWER = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
    const fdis = batch.map(c => c.fdi);
    // Sort by position in arch
    const posOf = (fdi) => {
        let idx = UPPER.indexOf(fdi);
        if (idx >= 0) return idx;
        idx = LOWER.indexOf(fdi);
        return idx >= 0 ? idx + 100 : 999;
    };
    fdis.sort((a, b) => posOf(a) - posOf(b));
    if (!arenaBridgeLinks[fileId]) arenaBridgeLinks[fileId] = {};
    for (let i = 0; i < fdis.length - 1; i++) {
        // Only link if adjacent in same arch
        const a = fdis[i], b = fdis[i + 1];
        const aU = UPPER.indexOf(a), bU = UPPER.indexOf(b);
        const aL = LOWER.indexOf(a), bL = LOWER.indexOf(b);
        if ((aU >= 0 && bU >= 0 && Math.abs(aU - bU) === 1) ||
            (aL >= 0 && bL >= 0 && Math.abs(aL - bL) === 1)) {
            const key = makeBridgeKey(a, b);
            arenaBridgeLinks[fileId][key] = true;
        }
    }
    localStorage.setItem('darwin_bridge_links', JSON.stringify(arenaBridgeLinks));
}

// ═══ Save GT immediately (not debounced) then reload arena ═══
function _saveGTThenReload(fileId) {
    if (_gtSaveTimers[fileId]) clearTimeout(_gtSaveTimers[fileId]);
    _flushGTSave(fileId, () => loadArena());
}

// ═══ Bridge-only: link batch without changing status ═══
function _bridgeLinkOnlyBatch() {
    if (!_pickerTarget) return;
    const { fileId, batch } = _pickerTarget;
    if (!batch || batch.length < 2) return;
    // Force-check the bridge checkbox so _autoBridgeBatch works
    const cb = document.getElementById('tp-bridge-check');
    if (cb) cb.checked = true;
    _autoBridgeBatch(fileId, batch);
    _pickerEl.classList.remove('open');
    _saveGTThenReload(fileId);
}

// ═══ Unlink all bridge connections in batch ═══
function _bridgeUnlinkBatch() {
    if (!_pickerTarget) return;
    const { fileId, batch } = _pickerTarget;
    if (!batch || batch.length < 2) return;
    if (!arenaBridgeLinks[fileId]) return;
    const fdis = batch.map(c => c.fdi);
    for (let i = 0; i < fdis.length; i++) {
        for (let j = i + 1; j < fdis.length; j++) {
            const key = makeBridgeKey(fdis[i], fdis[j]);
            delete arenaBridgeLinks[fileId][key];
        }
    }
    localStorage.setItem('darwin_bridge_links', JSON.stringify(arenaBridgeLinks));
    _pickerEl.classList.remove('open');
    _saveGTThenReload(fileId);
}

// Layer-aware status picking
// ═══ Composite preset — one click for multi-layer status ═══
function pickCompositePreset(encoded) {
    if (!_pickerTarget) return;
    const { fileId, batch } = _pickerTarget;
    const layers = _cleanIncompatibleLayers(parseToothLayers(encoded));
    encoded = encodeToothLayers(layers);
    if (!layers.length) return;

    if (batch && batch.length > 0) {
        // Apply to all teeth in batch
        for (const { fdi, cellEl } of batch) {
            if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
            arenaGroundTruth[fileId][fdi] = encoded;
            _rebuildCellLayered(cellEl, fdi, layers);
        }
        _autoBridgeBatch(fileId, batch);
    } else {
        _applyToothLayered(layers);
    }

    _pickerEl.classList.remove('open');
    if (batch && batch.length > 1 && document.getElementById('tp-bridge-check')?.checked) {
        _saveGTThenReload(fileId); // save bridge links first, then reload
    } else {
        _debouncedSaveGT(fileId);
    }
}

// Shift+click or picking on a tooth that already has a status → ADD LAYER
// Regular click on empty tooth → SET single status
let _layerAddMode = false; // true = adding to existing layers

function pickToothStatus(value) {
    if (!_pickerTarget) return;
    const { fileId, fdi, cellEl, batch } = _pickerTarget;

    // Empty value = reset
    if (!value) {
        _layerAddMode = false;
        if (_pickerEl) _pickerEl.classList.remove('layer-add-mode');
        _applyToothStatus('', '');
        return;
    }

    // Smart bridge: auto-detect abutments, pontics, and CANTILEVERS
    // Rule: end position without support (missing/empty) → cantilever, not pontic
    if (value === '_smart_bridge') {
        if (!batch || batch.length < 2) {
            alert('Выделите несколько зубов (drag-select) для установки моста');
            return;
        }
        if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
        // First pass: classify each position as support or gap
        const roles = batch.map((t, i) => {
            const curGT = arenaGroundTruth[fileId][t.fdi] || '';
            const isImpl = curGT.includes('impl');
            const hasSupport = isImpl || (curGT && curGT !== 'missing' && curGT !== 'bridge' && curGT !== 'bar' && curGT !== 'cantilever');
            return { ...t, curGT, isImpl, hasSupport };
        });
        // Second pass: assign statuses with cantilever auto-detection
        // Find first and last support positions
        const firstSupport = roles.findIndex(r => r.hasSupport);
        const lastSupport = roles.length - 1 - [...roles].reverse().findIndex(r => r.hasSupport);
        for (let i = 0; i < roles.length; i++) {
            const r = roles[i];
            if (r.hasSupport) {
                // Abutment: implant → impl_restored, natural → crowned
                if (r.isImpl) {
                    arenaGroundTruth[fileId][r.fdi] = 'impl_restored';
                    _rebuildCellLayered(r.cellEl, r.fdi, parseToothLayers('impl_restored'));
                } else {
                    const layers = parseToothLayers(r.curGT);
                    if (!layers.find(l => l.status === 'crowned')) {
                        layers.push({status: 'crowned', surfaces: ''});
                    }
                    arenaGroundTruth[fileId][r.fdi] = encodeToothLayers(layers);
                    _rebuildCellLayered(r.cellEl, r.fdi, layers);
                }
            } else if (i < firstSupport || i > lastSupport) {
                // CANTILEVER: gap at the edge, beyond any support
                arenaGroundTruth[fileId][r.fdi] = 'cantilever';
                _rebuildCell(r.cellEl, r.fdi, 'cantilever', '');
            } else {
                // PONTIC: gap between supports
                arenaGroundTruth[fileId][r.fdi] = 'bridge';
                _rebuildCell(r.cellEl, r.fdi, 'bridge', '');
            }
        }
        // Auto-bridge links between ALL adjacent teeth (always, no checkbox needed)
        {
            const UPPER = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
            const LOWER = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
            if (!arenaBridgeLinks[fileId]) arenaBridgeLinks[fileId] = {};
            const fdis = batch.map(c => c.fdi);
            const posOf = (fdi) => { let i = UPPER.indexOf(fdi); if (i >= 0) return i; i = LOWER.indexOf(fdi); return i >= 0 ? i+100 : 999; };
            fdis.sort((a, b) => posOf(a) - posOf(b));
            for (let i = 0; i < fdis.length - 1; i++) {
                const a = fdis[i], b = fdis[i+1];
                const aU = UPPER.indexOf(a), bU = UPPER.indexOf(b);
                const aL = LOWER.indexOf(a), bL = LOWER.indexOf(b);
                if ((aU >= 0 && bU >= 0 && Math.abs(aU-bU) === 1) ||
                    (aL >= 0 && bL >= 0 && Math.abs(aL-bL) === 1)) {
                    arenaBridgeLinks[fileId][makeBridgeKey(a, b)] = true;
                }
            }
            localStorage.setItem('darwin_bridge_links', JSON.stringify(arenaBridgeLinks));
        }
        localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
        _pickerEl.classList.remove('open');
        // Save immediately to DB (not debounced) so loadArena picks up bridge links
        _saveGTThenReload(fileId);
        return;
    }

    // Smart bar: implant bar with auto-cantilever detection
    // Implants keep status, gaps between implants → bar, gaps at edges → cantilever
    if (value === '_smart_bar') {
        if (!batch || batch.length < 2) {
            alert('Выделите несколько зубов (drag-select) для установки балки');
            return;
        }
        if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
        // Classify: who has support (implant or existing tooth)
        const roles = batch.map((t, i) => {
            const curGT = arenaGroundTruth[fileId][t.fdi] || '';
            const isImpl = curGT.includes('impl');
            const hasSupport = isImpl || (curGT && curGT !== 'missing' && curGT !== 'bar' && curGT !== 'cantilever' && curGT !== 'bridge');
            return { ...t, curGT, isImpl, hasSupport };
        });
        const firstSupport = roles.findIndex(r => r.hasSupport);
        const lastSupport = roles.length - 1 - [...roles].reverse().findIndex(r => r.hasSupport);
        for (let i = 0; i < roles.length; i++) {
            const r = roles[i];
            if (r.hasSupport) {
                // Keep implant/tooth status — bar sits on top
            } else if (firstSupport < 0 || i < firstSupport || i > lastSupport) {
                // CANTILEVER: edge gap beyond any support
                arenaGroundTruth[fileId][r.fdi] = 'cantilever';
                _rebuildCell(r.cellEl, r.fdi, 'cantilever', '');
            } else {
                // BAR segment between supports
                arenaGroundTruth[fileId][r.fdi] = 'bar';
                _rebuildCell(r.cellEl, r.fdi, 'bar', '');
            }
        }
        // Create bar links (reuse bridge link storage with 'bar' type)
        {
            const UPPER = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
            const LOWER = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
            if (!arenaBridgeLinks[fileId]) arenaBridgeLinks[fileId] = {};
            const fdis = batch.map(c => c.fdi);
            const posOf = (fdi) => { let i = UPPER.indexOf(fdi); if (i >= 0) return i; i = LOWER.indexOf(fdi); return i >= 0 ? i+100 : 999; };
            fdis.sort((a, b) => posOf(a) - posOf(b));
            for (let i = 0; i < fdis.length - 1; i++) {
                const a = fdis[i], b = fdis[i+1];
                const aU = UPPER.indexOf(a), bU = UPPER.indexOf(b);
                const aL = LOWER.indexOf(a), bL = LOWER.indexOf(b);
                if ((aU >= 0 && bU >= 0 && Math.abs(aU-bU) === 1) ||
                    (aL >= 0 && bL >= 0 && Math.abs(aL-bL) === 1)) {
                    arenaBridgeLinks[fileId][makeBridgeKey(a, b)] = 'bar';
                }
            }
            localStorage.setItem('darwin_bridge_links', JSON.stringify(arenaBridgeLinks));
        }
        localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
        _pickerEl.classList.remove('open');
        _saveGTThenReload(fileId);
        return;
    }

    // Attrition → cycle TWI directly (stored in rootData) + set GT status
    if (value === 'attrition') {
        const { fileId, fdi, cellEl, batch } = _pickerTarget;
        const targets = batch || [{fdi, cellEl}];
        for (const t of targets) {
            const rd = (arenaRootData[fileId] || {})[t.fdi] || {};
            const curTwi = rd.wear?.twi || 0;
            const nextTwi = curTwi < 4 ? curTwi + 1 : 0;
            _setTWI(fileId, t.fdi, nextTwi);
            // Also set GT status so tooth counts as marked
            if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
            const curGT = arenaGroundTruth[fileId][t.fdi] || '';
            if (!curGT || curGT === 'attrition') {
                // Set or keep attrition as primary status; clear if TWI=0
                arenaGroundTruth[fileId][t.fdi] = nextTwi > 0 ? 'attrition' : '';
                _rebuildCell(t.cellEl, t.fdi, nextTwi > 0 ? 'attrition' : '', '');
            }
            // If tooth already has another status (e.g. crowned), keep it — TWI is in rootData
        }
        localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
        _debouncedSaveGT(fileId);
        // Update filled counter
        const _rd = arenaRootData[fileId] || {};
        const ALL32t = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8',
                       '4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
        const filled = ALL32t.filter(f => arenaGroundTruth[fileId]?.[f] || (_rd[f] && Object.keys(_rd[f]).length > 0)).length;
        const row = (targets[0].cellEl || cellEl).closest('.arena-formula-row');
        const sub = row?.querySelector('.row-sub');
        if (sub) {
            const _tp = (k, p) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k, p) : k;
            sub.innerHTML = filled >= 32 ? _tp('fmlMarkedFull') : _tp('fmlMarkedSub', {n: filled});
        }
        // Update picker title
        const tw = TWI_STATES[targets[0] ? ((arenaRootData[fileId]?.[targets[0].fdi]?.wear?.twi) || 0) : 0];
        const titleEl = _pickerEl?.querySelector('.tp-title span');
        if (titleEl) titleEl.textContent = `Зуб ${fdi} — TWI ${tw?.twi || 0}: ${tw?.nameRU || ''}`;
        return;
    }

    // Endo → ALWAYS skip surface picker, apply directly (canals are what matters, not surfaces)
    // Surfaces can be added later via +слой if needed
    if (value === 'endo') {
        const rawCheck = (arenaGroundTruth[fileId] || {})[fdi] || '';
        const layersCheck = parseToothLayers(rawCheck);
        if (!layersCheck.find(l => l.status === 'endo')) {
            if (layersCheck.length > 0) {
                // Add endo layer to existing layers
                layersCheck.push({status: 'endo', surfaces: ''});
                _applyToothLayered(layersCheck);
            } else {
                // First status on empty tooth — set endo directly
                _applyToothStatus('endo', '');
            }
        }
        _layerAddMode = false;
        if (_pickerEl) _pickerEl.classList.remove('layer-add-mode');
        _renderRootSection(fileId, fdi);
        return;
    }

    // If status needs surface selection → show surface panel
    if (SURFACE_STATUSES.includes(value)) {
        _pickerPendingStatus = value;
        _pickerEl.querySelector('.tp-status-page').style.display = 'none';
        const surfPanel = document.getElementById('tp-surfaces');
        surfPanel.classList.add('active');
        const color = SURFACE_COLORS[value] || '#fff';
        surfPanel.querySelectorAll('.sf-btn').forEach(btn => {
            btn.style.fill = 'transparent';
            btn.style.stroke = 'rgba(255,255,255,0.25)';
            btn.classList.remove('on');
        });
        const SURF_TITLES = {caries:'С — Кариес: отметьте стенки', restored:'П — Пломба: отметьте стенки', endo:'Э — Эндо: отметьте стенки реставрации'};
        // Detect secondary caries: if tooth already has crown/restoration + user picks caries
        const curRaw = (arenaGroundTruth[fileId] || {})[fdi] || '';
        const curLayers = parseToothLayers(curRaw);
        const isSecondary = value === 'caries' && curLayers.some(l => ['crowned','restored'].includes(l.status));
        const surfTitle = isSecondary ? 'С — Вторичный кариес: отметьте стенки разгерметизации' : (SURF_TITLES[value] || 'Отметьте стенки');
        surfPanel.querySelector('.tp-surf-title').textContent = surfTitle;
        // Add clinical hint for secondary caries
        let hintEl = surfPanel.querySelector('.tp-surf-hint');
        if (isSecondary) {
            if (!hintEl) { hintEl = document.createElement('div'); hintEl.className = 'tp-surf-hint'; surfPanel.querySelector('.tp-surf-title').after(hintEl); }
            hintEl.innerHTML = '<span style="font-size:8px;color:var(--text-dim);line-height:1.4;display:block;margin:3px 0;">Рентген. признак: разрежение у края коронки/пломбы. На OPG видны только выраженные поражения (ICDAS 4-6).<br><i style="opacity:0.5">Bravo M et al. Caries Res. 2010;44(5):445-9</i></span>';
        } else if (hintEl) { hintEl.remove(); }
        surfPanel.querySelector('.tp-surf-done').style.background = color;
        // Mirror M/D — mesial is always toward midline
        // Q1/Q4 (right side in display): center is RIGHT → M=RIGHT, D=LEFT
        // Q2/Q3 (left side in display):  center is LEFT  → M=LEFT,  D=RIGHT (SVG default)
        const targetFdi = (batch && batch.length > 0) ? batch[0].fdi : fdi;
        const isRightSide = targetFdi.startsWith('1.') || targetFdi.startsWith('4.');
        const mPoly = surfPanel.querySelector('.sf-btn-m');
        const dPoly = surfPanel.querySelector('.sf-btn-d');
        const mText = surfPanel.querySelector('text:nth-of-type(4)'); // M label
        const dText = surfPanel.querySelector('text:nth-of-type(2)'); // D label
        if (isRightSide) {
            // Q1/Q4: M on right, D on left
            mPoly.setAttribute('points', '24,0 24,24 17,17 17,7'); // right
            dPoly.setAttribute('points', '0,24 0,0 7,7 7,17');     // left
            if (mText) { mText.setAttribute('x', '21'); }
            if (dText) { dText.setAttribute('x', '3'); }
        } else {
            // Q2/Q3: M on left (default), D on right (default)
            mPoly.setAttribute('points', '0,24 0,0 7,7 7,17');     // left
            dPoly.setAttribute('points', '24,0 24,24 17,17 17,7'); // right
            if (mText) { mText.setAttribute('x', '3'); }
            if (dText) { dText.setAttribute('x', '21'); }
        }
        // Restore previously saved surfaces (from the specific layer if layered)
        const raw = (arenaGroundTruth[fileId] || {})[fdi] || '';
        const layers = parseToothLayers(raw);
        const existingLayer = layers.find(l => l.status === value);
        const prevSurf = existingLayer ? existingLayer.surfaces : '';
        for (const ch of prevSurf) {
            const btn = surfPanel.querySelector(`.sf-btn-${ch}`);
            if (btn) { btn.classList.add('on'); btn.style.fill = color; btn.style.stroke = color; }
        }
        return;
    }

    // Non-surface status
    // Check if we should add as layer or replace
    const raw = (arenaGroundTruth[fileId] || {})[fdi] || '';
    const existingLayers = parseToothLayers(raw);

    // Composable statuses: endo, post, crowned, restored can stack
    const COMPOSABLE = ['endo', 'post', 'crowned', 'restored', 'caries', 'attrition'];
    // Auto-layer: if tooth already has a composable status and new status is also composable → add layer
    // No need to explicitly press "+слой" for common combos
    const existingIsComposable = existingLayers.length > 0 && existingLayers.every(l => COMPOSABLE.includes(l.status));
    if (existingIsComposable && COMPOSABLE.includes(value)) {
        if (!existingLayers.find(l => l.status === value)) {
            existingLayers.push({ status: value, surfaces: '' });
        }
        _applyToothLayered(existingLayers);
        _layerAddMode = false;
        if (_pickerEl) _pickerEl.classList.remove('layer-add-mode');
        // Re-render root section (canals become clickable after adding endo)
        _renderRootSection(fileId, fdi);
        return;
    }

    _layerAddMode = false;
    if (_pickerEl) _pickerEl.classList.remove('layer-add-mode');
    _applyToothStatus(value, '');
}

let _surfDragging = false;
let _surfDragMode = null; // 'on' or 'off' — determined by first surface state

function _toggleSurface(sf, btn) {
    const color = SURFACE_COLORS[_pickerPendingStatus] || '#fff';
    if (btn.classList.contains('on')) {
        btn.classList.remove('on');
        btn.style.fill = 'transparent';
        btn.style.stroke = 'rgba(255,255,255,0.25)';
    } else {
        btn.classList.add('on');
        btn.style.fill = color;
        btn.style.stroke = color;
    }
}

// Set surface to specific state (for drag-select)
function _setSurface(btn, on) {
    const color = SURFACE_COLORS[_pickerPendingStatus] || '#fff';
    if (on && !btn.classList.contains('on')) {
        btn.classList.add('on');
        btn.style.fill = color;
        btn.style.stroke = color;
    } else if (!on && btn.classList.contains('on')) {
        btn.classList.remove('on');
        btn.style.fill = 'transparent';
        btn.style.stroke = 'rgba(255,255,255,0.25)';
    }
}

// Drag-select surfaces: mousedown on svg starts, mouseover on polygons applies
function _initSurfaceDrag() {
    const svg = _pickerEl.querySelector('.tp-surf-svg');
    if (!svg || svg._dragInited) return;
    svg._dragInited = true;

    svg.querySelectorAll('.sf-btn').forEach(poly => {
        poly.addEventListener('mousedown', (e) => {
            e.preventDefault();
            _surfDragging = true;
            // Determine drag mode: if this surface is ON → we're turning surfaces OFF (drag-remove)
            _surfDragMode = poly.classList.contains('on') ? false : true;
            _setSurface(poly, _surfDragMode);
        });
        poly.addEventListener('mouseenter', (e) => {
            if (_surfDragging) {
                _setSurface(poly, _surfDragMode);
            }
        });
    });

    document.addEventListener('mouseup', () => { _surfDragging = false; _surfDragMode = null; });
}

function _surfaceDone() {
    // Collect active surfaces
    const surfPanel = document.getElementById('tp-surfaces');
    const surfs = Array.from(surfPanel.querySelectorAll('.sf-btn.on')).map(b => b.dataset.sf).join('');

    // Reset panel
    surfPanel.classList.remove('active');
    _pickerEl.querySelector('.tp-status-page').style.display = '';

    if (!_pickerTarget) return;
    const { fileId, fdi } = _pickerTarget;

    // Check if we should merge into existing layers
    const raw = (arenaGroundTruth[fileId] || {})[fdi] || '';
    const existingLayers = parseToothLayers(raw);

    const COMPOSABLE2 = ['endo', 'post', 'crowned', 'restored', 'caries', 'attrition'];
    const existingComposable = existingLayers.length > 0 && existingLayers.every(l => COMPOSABLE2.includes(l.status));
    // Auto-layer: if existing layers are composable and new status is composable → merge
    if (((_layerAddMode && existingLayers.length > 0) || (existingComposable && COMPOSABLE2.includes(_pickerPendingStatus)))) {
        // Update or add this layer in existing stack
        const idx = existingLayers.findIndex(l => l.status === _pickerPendingStatus);
        if (idx >= 0) {
            existingLayers[idx].surfaces = surfs;
        } else {
            existingLayers.push({ status: _pickerPendingStatus, surfaces: surfs });
        }
        _applyToothLayered(existingLayers);
    } else {
        _applyToothStatus(_pickerPendingStatus, surfs);
    }
    // Re-render root section so canals become clickable after adding endo
    _renderRootSection(fileId, fdi);
    _pickerPendingStatus = '';
}

/* ═══ Root section in picker (Vertucci-aware) ═══ */
function _renderRootSection(fileId, fdi) {
    const section = document.getElementById('tp-roots-section');
    if (!section) return;
    const typeId = FDI_TO_TYPE[fdi];
    if (!typeId) { section.style.display = 'none'; return; }
    const tooth = TOOTH_LIBRARY[typeId];
    if (!tooth) { section.style.display = 'none'; return; }

    section.style.display = '';

    // Current root data
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    const rd = arenaRootData[fileId][fdi] || {};
    const activeVariantId = rd.variant || (tooth.variants.find(v => v.isDefault) || tooth.variants[0]).id;
    const activeVariant = tooth.variants.find(v => v.id === activeVariantId) || tooth.variants[0];
    const vertucciOverrides = rd.vertucci || {...activeVariant.defaultVertucci};
    const fillStates = rd.fillStates || {};

    // Variant buttons
    const varBtns = document.getElementById('tp-variant-btns');
    varBtns.innerHTML = tooth.variants.map(v => {
        const active = v.id === activeVariantId ? ' active' : '';
        return `<div class="tp-roots-variant-btn${active}" data-vid="${v.id}" onclick="_pickRootVariant('${fileId}','${fdi}','${v.id}')">
            ${v.name.ru}${v.freq < 100 ? `<span class="freq-badge">${v.freq}%</span>` : ''}
        </div>`;
    }).join('');

    // Dilaceration controls — show if any root has |cv| >= 5 or variant name contains "дилац"
    const hasDilac = activeVariant.roots.some(r => Math.abs(r.cv) >= 5) || activeVariant.id.includes('dilac');
    const dilacDiv = document.getElementById('tp-dilac-controls');
    if (hasDilac) {
        const cvOverrides = rd.cvOverrides || {};
        let dilacHtml = '<div style="font-size:9px;color:var(--text-dim);margin-bottom:3px;">ДИЛАЦЕРАЦИЯ</div>';
        activeVariant.roots.forEach((root, ri) => {
            if (Math.abs(root.cv) < 5 && !activeVariant.id.includes('dilac')) return;
            const curCv = cvOverrides[ri] !== undefined ? cvOverrides[ri] : root.cv;
            const dir = curCv >= 0 ? 'distal' : 'mesial';
            const mag = Math.abs(curCv);
            const nm = (CANAL_NAMES[typeId] || [])[ri];
            const label = nm ? nm.singleEN : `R${ri+1}`;
            dilacHtml += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;">
                <span style="font-size:10px;color:var(--text-dim);min-width:24px;">${label}</span>
                <button class="tp-roots-variant-btn${dir==='distal'?' active':''}" style="padding:2px 6px;font-size:9px;"
                    onclick="_setCvDirection('${fileId}','${fdi}',${ri},1,${mag})">Дист.</button>
                <button class="tp-roots-variant-btn${dir==='mesial'?' active':''}" style="padding:2px 6px;font-size:9px;"
                    onclick="_setCvDirection('${fileId}','${fdi}',${ri},-1,${mag})">Мез.</button>
                <input type="range" min="3" max="20" value="${mag}" style="width:60px;height:14px;accent-color:var(--purple);"
                    oninput="_setCvMagnitude('${fileId}','${fdi}',${ri},${dir==='distal'?1:-1},+this.value)"
                    title="${mag}°">
                <span style="font-size:9px;color:var(--text-dim);min-width:20px;">${mag}°</span>
            </div>`;
        });
        dilacDiv.innerHTML = dilacHtml;
        dilacDiv.style.display = '';
    } else {
        dilacDiv.innerHTML = '';
        dilacDiv.style.display = 'none';
    }

    // Vertucci selectors per root
    const vertSel = document.getElementById('tp-vertucci-selectors');
    const names = CANAL_NAMES[typeId] || [];
    vertSel.innerHTML = activeVariant.roots.map((root, ri) => {
        const poss = activeVariant.possibleVertucci[ri] || ['I'];
        const cur = vertucciOverrides[ri] || activeVariant.defaultVertucci[ri] || 'I';
        const nm = names[ri] ? `${names[ri].singleEN}` : `R${ri+1}`;
        const opts = poss.map(v =>
            `<option value="${v}" ${v===cur?'selected':''}>${v} (${VERTUCCI_SCHEMAS[v].formula})</option>`
        ).join('');
        return `<div class="tp-vertucci-row"><label>${nm}:</label>
            <select onchange="_pickRootVertucci('${fileId}','${fdi}',${ri},this.value)">${opts}</select></div>`;
    }).join('');

    // Hemisection / root removal (only for multi-rooted teeth)
    if (activeVariant.roots.length > 1) {
        const removedRoots = rd.removedRoots || {};
        let hemiHtml = '<div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.5);margin-top:8px;margin-bottom:3px;">✂ ГЕМИСЕКЦИЯ / ROOT REMOVAL</div>';
        hemiHtml += '<div style="font-size:8px;color:rgba(255,255,255,0.3);margin-bottom:3px;">Отметьте удалённые корни (при гемисекции/ампутации):</div>';
        hemiHtml += '<div style="display:flex;gap:4px;flex-wrap:wrap;">';
        activeVariant.roots.forEach((root, ri) => {
            const nm = names[ri] ? names[ri].singleEN : `R${ri+1}`;
            const nmRU = names[ri] ? names[ri].single : `Корень ${ri+1}`;
            const isRemoved = !!removedRoots[ri];
            const bg = isRemoved ? 'background:rgba(239,68,68,0.25);border:1px solid rgba(239,68,68,0.5);color:rgba(239,68,68,0.9);' : '';
            hemiHtml += `<div class="tp-roots-variant-btn${isRemoved?' active':''}" style="padding:2px 8px;font-size:9px;${bg}" ` +
                `title="${isRemoved ? nmRU+' удалён (гемисекция). Клик: восстановить.' : 'Клик: отметить '+nmRU+' как удалённый (гемисекция/ампутация корня).'}" ` +
                `onclick="_toggleRootRemoved('${fileId}','${fdi}',${ri})">${isRemoved ? '✂ ' : ''}${nm}${isRemoved ? ' удалён' : ''}</div>`;
        });
        hemiHtml += '</div>';
        // Insert before Vertucci selectors — find or create container
        let hemiDiv = document.getElementById('tp-hemisection');
        if (!hemiDiv) {
            hemiDiv = document.createElement('div');
            hemiDiv.id = 'tp-hemisection';
            vertSel.parentNode.insertBefore(hemiDiv, vertSel.nextSibling);
        }
        hemiDiv.innerHTML = hemiHtml;
    } else {
        const hemiDiv = document.getElementById('tp-hemisection');
        if (hemiDiv) hemiDiv.innerHTML = '';
    }

    // TWI (tooth wear) section
    const wearSec = document.getElementById('tp-wear-section');
    if (wearSec) {
        const wearData = rd.wear || {};
        const curTwi = wearData.twi || 0;
        let wearHtml = '<div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.5);margin-top:8px;margin-bottom:3px;">СТИРАЕМОСТЬ / WEAR</div>';
        wearHtml += '<div style="display:flex;gap:3px;margin-bottom:4px;">';
        for (let t = 0; t <= 4; t++) {
            const tw = TWI_STATES[t];
            const active = curTwi === t;
            const bg = active && t > 0 ? 'background:' + tw.color + ';color:#000;' : '';
            wearHtml += `<div class="tp-roots-variant-btn${active?' active':''}" style="padding:2px 6px;font-size:9px;min-width:28px;text-align:center;${bg}" onclick="_setTWI('${fileId}','${fdi}',${t})">TWI ${t}</div>`;
        }
        wearHtml += '</div>';
        wearHtml += `<span id="tp-twi-cycle" style="cursor:pointer;padding:1px 6px;border-radius:3px;background:rgba(255,255,255,0.05);font-size:9px;margin-left:4px;" onclick="_cycleTWI()" title="Клик = следующий TWI">`;
        if (curTwi > 0) {
            wearHtml += `<span style="color:${TWI_STATES[curTwi].color}">TWI${curTwi}: ${TWI_STATES[curTwi].nameRU}</span>`;
        } else {
            wearHtml += `<span style="color:var(--text-dim)">TWI0: Нет потери</span>`;
        }
        wearHtml += '</span>';
        wearSec.innerHTML = wearHtml;
    }

    // ── Fracture section ──
    const fracSec = document.getElementById('tp-fracture-section');
    if (fracSec) {
        const frac0 = rd.fracture?.[0];
        const curFracState = frac0 ? FRACTURE_STATES.find(s => s.key === frac0.type) : FRACTURE_STATES[0];
        const cfState = rd.crownFracture ? CROWN_FRACTURE_STATES.find(s => s.key === rd.crownFracture.type) : CROWN_FRACTURE_STATES[0];
        const fracTips = {
            none: 'Нет признаков перелома',
            vrf: 'Вертикальный перелом корня — зигзаг вдоль оси. Признаки: halo, J-резорбция, расш. PDL. Прогноз — экстракция.',
            hrz_cervical: 'Горизонтальный перелом в шеечной ⅓. Плохой прогноз (55-73% неудач).',
            hrz_middle: 'Горизонтальный перелом в средней ⅓. Умеренный прогноз, шинирование 4 нед.',
            hrz_apical: 'Горизонтальный перелом в апикальной ⅓. Благоприятный прогноз (~77% заживление).'
        };
        let fracHtml = '<div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.5);margin-top:8px;margin-bottom:3px;">⚡ ПЕРЕЛОМЫ / FRACTURES</div>';
        fracHtml += '<div style="font-size:8px;color:rgba(255,255,255,0.3);margin-bottom:4px;">Корень — выберите тип перелома (AAE + Andreasen):</div>';
        // Root fracture buttons
        fracHtml += '<div style="display:flex;gap:3px;margin-bottom:4px;flex-wrap:wrap;">';
        for (const fs of FRACTURE_STATES) {
            const active = (curFracState?.key || 'none') === fs.key;
            const bg = active && fs.key !== 'none' ? `background:${fs.color};color:#fff;` : '';
            fracHtml += `<div class="tp-roots-variant-btn${active?' active':''}" style="padding:2px 6px;font-size:9px;min-width:28px;text-align:center;${bg}" title="${fracTips[fs.key] || ''}" onclick="_ctxCycleFractureToState('${fileId}','${fdi}','${fs.key}')">${fs.label}</div>`;
        }
        fracHtml += '</div>';
        if (curFracState && curFracState.key !== 'none') {
            fracHtml += `<div style="font-size:8px;color:rgba(255,255,255,0.5);line-height:1.3;margin-bottom:2px;padding:3px 6px;background:rgba(220,38,38,0.08);border-radius:3px;">⚡ ${curFracState.nameRU}</div>`;
            if (curFracState.desc) fracHtml += `<div style="font-size:8px;color:rgba(255,255,255,0.35);line-height:1.3;margin-bottom:2px;padding:0 6px;">${curFracState.desc}</div>`;
            if (curFracState.ref) fracHtml += `<div style="font-size:7px;color:rgba(255,255,255,0.2);padding:0 6px;margin-bottom:4px;">📖 ${curFracState.ref}</div>`;
        }
        // Crown fracture buttons
        fracHtml += '<div style="font-size:8px;color:rgba(255,255,255,0.3);margin-bottom:2px;margin-top:4px;">Коронка — раскол или трещина (если видно на OPG):</div>';
        fracHtml += '<div style="display:flex;gap:3px;margin-bottom:4px;">';
        const cfTips = {
            none: 'Нет перелома коронки',
            split: 'Раскол зуба — полное разделение на два фрагмента через пульповую камеру. На OPG видна щель.',
            cracked: 'Подозрение на трещину — на OPG косвенные признаки: расш. PDL, нарушение lamina dura с одной стороны.'
        };
        for (const cs of CROWN_FRACTURE_STATES) {
            const active = (cfState?.key || 'none') === cs.key;
            const bg = active && cs.key !== 'none' ? `background:${cs.color};color:#fff;` : '';
            fracHtml += `<div class="tp-roots-variant-btn${active?' active':''}" style="padding:2px 6px;font-size:9px;${bg}" title="${cfTips[cs.key] || ''}" onclick="_ctxCycleCrownFractureToState('${fileId}','${fdi}','${cs.key}')">${cs.key === 'none' ? '—' : cs.nameRU}</div>`;
        }
        fracHtml += '</div>';
        if (cfState && cfState.key !== 'none' && cfState.desc) {
            fracHtml += `<div style="font-size:8px;color:rgba(255,255,255,0.35);line-height:1.3;padding:0 6px;">${cfState.desc}</div>`;
        }
        fracSec.innerHTML = fracHtml;
    }

    // ── Implant count section (only for impl_* statuses) ──
    const implCountSec = document.getElementById('tp-implant-count-section');
    if (implCountSec) {
        const gtStatus = (arenaGroundTruth[fileId] || {})[fdi] || '';
        const isImpl = gtStatus.includes('impl');
        if (isImpl) {
            const curCount = rd.implant_count || 1;
            let icHtml = '<div style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.5);margin-top:8px;margin-bottom:3px;">⬡ ИМПЛАНТАТОВ В ПОЗИЦИИ</div>';
            icHtml += '<div style="font-size:8px;color:rgba(255,255,255,0.3);margin-bottom:4px;">Если >1 имплантат в одной FDI-позиции (напр. 3 импл. на 2 позиции):</div>';
            icHtml += '<div style="display:flex;align-items:center;gap:6px;">';
            icHtml += `<button class="tp-roots-variant-btn" style="padding:2px 10px;font-size:12px;" title="Уменьшить число имплантатов" onclick="_setImplCount('${fileId}','${fdi}',-1)">−</button>`;
            icHtml += `<span style="font-size:14px;font-weight:700;color:var(--green);min-width:24px;text-align:center;" id="tp-impl-count-val">${curCount}</span>`;
            icHtml += `<button class="tp-roots-variant-btn" style="padding:2px 10px;font-size:12px;" title="Увеличить число имплантатов" onclick="_setImplCount('${fileId}','${fdi}',1)">+</button>`;
            icHtml += '</div>';
            implCountSec.innerHTML = icHtml;
            implCountSec.style.display = '';
        } else {
            implCountSec.innerHTML = '';
            implCountSec.style.display = 'none';
        }
    }

    // Update periapical legend label
    _updatePeriapLabel(fileId, fdi);

    // SVG preview
    _renderRootPreview(fileId, fdi, typeId, activeVariant, vertucciOverrides, fillStates);
}

function _renderRootPreview(fileId, fdi, typeId, variant, vertucciOverrides, fillStates) {
    const preview = document.getElementById('tp-root-preview');
    if (!preview) return;
    const tooth = TOOTH_LIBRARY[typeId];
    const {vb, W, H, ny, cx} = tooth.svg;
    const isUpper = tooth.upper;
    const scale = 1.2;
    const svgW = Math.round(W * scale);
    const svgH = Math.round(H * scale);
    const svgId = 'tpRootPreviewSvg';

    // Determine endo status from current GT
    const raw = (arenaGroundTruth[fileId] || {})[fdi] || '';
    const layers = parseToothLayers(raw);
    const primaryStatus = layersPrimaryStatus(layers);
    const isEndo = primaryStatus === 'endo' || layers.some(l => l.status === 'endo');

    let inner = '';

    // Crown placeholder
    inner += `<rect x="${cx - tooth.svg.nw/2}" y="${ny - 20}" width="${tooth.svg.nw}" height="20" rx="3"
        fill="rgba(210,195,165,0.10)" stroke="rgba(170,140,90,0.50)" stroke-width="0.6" opacity="0.5"/>`;

    // cvOverrides for dilaceration
    const cvOvrP = (arenaRootData[fileId]?.[fdi]?.cvOverrides) || {};
    const effRootsP = variant.roots.map((r, ri) => cvOvrP[ri] !== undefined ? {...r, cv: cvOvrP[ri]} : r);

    // Furcation
    if (variant.roots.length > 1) {
        const fp = buildFurcation(effRootsP, ny, cx);
        if (fp) inner += `<path d="${fp}" fill="none" stroke="rgba(170,140,90,0.50)" stroke-width="0.8" opacity="0.6"/>`;
    }

    // Roots and canals
    const names = CANAL_NAMES[typeId] || [];
    const removedRootsPv = (arenaRootData[fileId]?.[fdi]?.removedRoots) || {};
    variant.roots.forEach((root, ri) => {
        const effRoot = cvOvrP[ri] !== undefined ? {...root, cv: cvOvrP[ri]} : root;
        const contour = buildRootContour(effRoot, ny, cx);
        // Hemisection: removed root → ghost outline + ✂ + clickable to toggle back
        if (removedRootsPv[ri]) {
            inner += `<path d="${contour.d}" fill="none" stroke="rgba(239,68,68,0.25)" stroke-width="1" stroke-dasharray="4,4" opacity="0.6"/>`;
            const rcx = cx + (effRoot.ox||0), rcy = ny + effRoot.l * 0.5;
            if (isUpper) {
                inner += `<g transform="translate(${rcx},${rcy}) scale(1,-1)"><text x="0" y="0" style="font-size:12px;fill:rgba(239,68,68,0.6);text-anchor:middle;dominant-baseline:middle;cursor:pointer" onclick="_toggleRootRemoved('${fileId}','${fdi}',${ri})">✂</text></g>`;
            } else {
                inner += `<text x="${rcx}" y="${rcy}" style="font-size:12px;fill:rgba(239,68,68,0.6);text-anchor:middle;dominant-baseline:middle;cursor:pointer" onclick="_toggleRootRemoved('${fileId}','${fdi}',${ri})">✂</text>`;
            }
            return; // skip canals, pathology for removed root
        }
        inner += `<path d="${contour.d}" fill="rgba(210,195,165,0.10)" stroke="rgba(170,140,90,0.50)" stroke-width="0.8"/>`;
        inner += `<circle cx="${contour.apexX}" cy="${contour.apexY - effRoot.tw * 0.8}" r="1.2"
            fill="none" stroke="rgba(156,163,175,0.5)" stroke-width="0.4" opacity="0.5"/>`;

        const vType = (vertucciOverrides[ri] !== undefined) ? vertucciOverrides[ri] : (variant.defaultVertucci[ri] || 'I');
        const cPaths = getCanalPaths(effRoot, ny, cx, vType);

        cPaths.forEach((cp, ci) => {
            if (cp.ghost && !isEndo) return;
            const stKey = `${ri}_${ci}`;
            const stIdx = fillStates[stKey] || 0;
            const st = FILL_STATES[stIdx];

            if (!isEndo) {
                // Always clickable in picker — so user can set fill state right after choosing endo
                inner += `<path d="${cp.d}" fill="none" stroke="rgba(156,163,175,0.5)" stroke-width="0.7"
                    stroke-dasharray="3,2" opacity="0.45" class="canal-path" data-root="${ri}" data-canal="${ci}" data-svg="${svgId}"/>`;
            } else if (cp.ghost) {
                inner += `<path d="${cp.d}" fill="none" stroke="${st.color}" stroke-width="0.5"
                    stroke-dasharray="2,2" opacity="0.3" class="canal-path" data-root="${ri}" data-canal="${ci}" data-svg="${svgId}"/>`;
            } else {
                // For endo unknown — show bright green solid (clearly distinct from intact gray dashed)
                const endoUnknown = isEndo && st.key === 'unknown';
                const cColor = endoUnknown ? '#22c55e' : st.color;
                const sw = endoUnknown ? 2.5 : (st.key === 'unknown' ? 0.8 : 1.5);
                if (st.lengthFrac < 1.0 && st.key !== 'unknown') {
                    inner += `<path d="${cp.d}" fill="none" stroke="rgba(85,85,85,0.25)" stroke-width="0.5" stroke-dasharray="3,2"/>`;
                    inner += `<path d="${cp.d}" fill="none" stroke="${cColor}" stroke-width="${sw}"
                        pathLength="100" stroke-dasharray="${st.lengthFrac*100} ${100}"
                        class="canal-path" data-root="${ri}" data-canal="${ci}" data-svg="${svgId}"/>`;
                } else if (st.overfill) {
                    inner += `<path d="${cp.d}" fill="none" stroke="${cColor}" stroke-width="${sw}"
                        class="canal-path" data-root="${ri}" data-canal="${ci}" data-svg="${svgId}"/>`;
                    inner += `<line x1="${cp.foramenX}" y1="${cp.foramenY}" x2="${cp.foramenX}" y2="${cp.foramenY+6}"
                        stroke="${cColor}" stroke-width="${sw}"/>`;
                    inner += `<circle cx="${cp.foramenX}" cy="${cp.foramenY+6}" r="2.2" fill="${cColor}" opacity="0.5"/>`;
                } else {
                    const dash = endoUnknown ? '' : (st.dasharray === 'none' ? '' : `stroke-dasharray="${st.dasharray}"`);
                    const opacity = endoUnknown ? 'opacity="0.6"' : '';
                    inner += `<path d="${cp.d}" fill="none" stroke="${cColor}" stroke-width="${sw}" ${dash} ${opacity}
                        class="canal-path" data-root="${ri}" data-canal="${ci}" data-svg="${svgId}"/>`;
                }
                if (!st.overfill) {
                    inner += `<circle cx="${cp.foramenX}" cy="${cp.foramenY}" r="0.9" fill="${st.color}" opacity="0.6"/>`;
                }
            }
        });

        // Canal name labels
        if (names[ri]) {
            const n = names[ri];
            const vType2 = vertucciOverrides[ri] || variant.defaultVertucci[ri] || 'I';
            const schema = VERTUCCI_SCHEMAS[vType2];
            const lbl = schema.foramina > 1 ? (n.multi ? n.multi[0] : n.single) : n.single;
            const lblEN = schema.foramina > 1 ? (n.multiEN ? n.multiEN[0] : n.singleEN) : n.singleEN;
            const lx = cx + effRoot.ox + effRoot.cv;
            const ly = ny + effRoot.l + 12;
            if (isUpper) {
                inner += `<g transform="translate(${lx},${ly}) scale(1,-1)">
                    <text x="0" y="0" style="font-size:7px;fill:rgba(156,163,175,0.7);text-anchor:middle;pointer-events:none">${lbl}/${lblEN}</text>
                </g>`;
            } else {
                inner += `<text x="${lx}" y="${ly}" style="font-size:7px;fill:rgba(156,163,175,0.7);text-anchor:middle;pointer-events:none">${lbl}/${lblEN}</text>`;
            }
        }
    });

    // Post (штифт) in preview — dark thick line in main canal
    const rawP = (arenaGroundTruth[fileId] || {})[fdi] || '';
    const hasPostP = rawP.split('+').some(p => p.split(':')[0] === 'post');
    if (hasPostP && variant.roots.length > 0) {
        const mainRoot = variant.roots[0];
        const effMR = cvOvrP[0] !== undefined ? {...mainRoot, cv: cvOvrP[0]} : mainRoot;
        const postTop = ny + 4;
        const postBot = ny + effMR.l * 0.55;
        const postCx = cx + (effMR.ox || 0);
        const cvP = effMR.cv || 0;
        const midS = cvP * 0.8;
        inner += `<line x1="${postCx + midS*0.2}" y1="${postTop}" x2="${postCx + midS*0.5}" y2="${postBot}" stroke="rgba(80,70,50,0.9)" stroke-width="4" stroke-linecap="round"/>`;
        inner += `<line x1="${postCx + midS*0.2}" y1="${postTop}" x2="${postCx + midS*0.5}" y2="${postBot}" stroke="rgba(180,160,120,0.5)" stroke-width="2" stroke-linecap="round"/>`;
    }

    // Periapical findings in preview
    const periapDataP = (arenaRootData[fileId]?.[fdi]?.periapical) || {};
    variant.roots.forEach((root, ri) => {
        const effRoot3 = cvOvrP[ri] !== undefined ? {...root, cv: cvOvrP[ri]} : root;
        const contour = buildRootContour(effRoot3, ny, cx);
        const pa = periapDataP[ri];
        const paIdx = pa ? PERIAPICAL_STATES.findIndex(s => s.key === _periapKey(pa.type)) : 0;
        const pS = PERIAPICAL_STATES[paIdx >= 0 ? paIdx : 0];
        if (pS.key === 'widened_pdl') {
            // PDL widening — highlighted root contour
            inner += `<path d="${contour.d}" fill="none" stroke="${pS.color}" stroke-width="3.5" stroke-dasharray="3,2" opacity="0.85"/>`;
        } else if (pS.r > 0) {
            if (pS.blur > 0) inner += `<circle cx="${contour.apexX}" cy="${contour.apexY}" r="${pS.r*1.5}" fill="${pS.color}" opacity="0.3" filter="url(#blur2)"/>`;
            inner += `<circle cx="${contour.apexX}" cy="${contour.apexY}" r="${pS.r}" fill="${pS.color}" stroke="rgba(239,68,68,0.7)" stroke-width="0.8"/>`;
        }
        // Invisible click target at apex area
        inner += `<circle cx="${contour.apexX}" cy="${contour.apexY}" r="10" fill="transparent" class="apex-click" data-root="${ri}" data-svg="${svgId}" style="cursor:pointer"/>`;
    });

    // Furcation click targets in preview
    if (variant.roots.length > 1) {
        const furcDataPv = (arenaRootData[fileId]?.[fdi]?.furcation) || {};
        for (let fi = 0; fi < variant.roots.length - 1; fi++) {
            const r1 = variant.roots[fi], r2 = variant.roots[fi+1];
            const fx = cx + ((r1.ox||0) + (r2.ox||0)) / 2;
            const fy = ny + Math.min(r1.l, r2.l) * 0.15;
            const fg = furcDataPv[fi]?.grade || 0;
            const fState = FURCATION_STATES[fg];
            if (fg > 0) {
                const fr = fg >= 3 ? 8 : 5;
                inner += `<circle cx="${fx}" cy="${fy}" r="${fr}" fill="${fState.color}" opacity="0.6"/>`;
                if (isUpper) {
                    inner += `<g transform="translate(${fx},${fy}) scale(1,-1)"><text x="0" y="4" style="font-size:7px;fill:#fff;text-anchor:middle;font-weight:700">${fState.label}</text></g>`;
                } else {
                    inner += `<text x="${fx}" y="${fy+3}" style="font-size:7px;fill:#fff;text-anchor:middle;font-weight:700">${fState.label}</text>`;
                }
            }
            inner += `<circle cx="${fx}" cy="${fy}" r="10" fill="transparent" class="furc-click" data-furc="${fi}" style="cursor:pointer"/>`;
        }
    }

    // Lateral defect click targets (left/right sides of each root)
    const latDataPv = (arenaRootData[fileId]?.[fdi]?.lateral) || {};
    variant.roots.forEach((root, ri) => {
        const effR4 = cvOvrP[ri] !== undefined ? {...root, cv: cvOvrP[ri]} : root;
        const rcx3 = cx + (effR4.ox||0);
        for (const side of ['m', 'd']) {
            const ld = latDataPv[`${ri}_${side}`];
            const ls = ld ? LATERAL_STATES.find(s => s.key === ld.type) : LATERAL_STATES[0];
            const sx = side === 'm' ? rcx3 - (effR4.bw||10)*0.55 : rcx3 + (effR4.bw||10)*0.55;
            const sy1 = ny + 6, sy2 = ny + effR4.l * 0.65;
            if (ls && ls.key !== 'none') {
                if (ls.key === 'vertical') {
                    inner += `<line x1="${sx}" y1="${sy1}" x2="${sx - (side==='m'?3:-3)}" y2="${sy2}" stroke="${ls.color}" stroke-width="2.5" opacity="0.7"/>`;
                } else if (ls.key === 'horizontal') {
                    inner += `<line x1="${sx}" y1="${sy1}" x2="${sx}" y2="${sy1 + effR4.l*0.3}" stroke="${ls.color}" stroke-width="3" opacity="0.6"/>`;
                } else {
                    inner += `<line x1="${sx}" y1="${sy1}" x2="${sx}" y2="${sy2}" stroke="${ls.color}" stroke-width="2" stroke-dasharray="3,2" opacity="0.6"/>`;
                }
            }
            // Clickable strip along root side
            inner += `<rect x="${sx-4}" y="${sy1}" width="8" height="${sy2-sy1}" fill="transparent" class="lateral-click" data-root="${ri}" data-side="${side}" style="cursor:pointer"/>`;
        }
    });

    // Endo-perio visualization in preview (same as miniature but larger)
    const epDataPv = (arenaRootData[fileId]?.[fdi]?.endoPerio) || {};
    variant.roots.forEach((root, ri) => {
        const ep = epDataPv[ri];
        if (!ep || ep.type === 'none') return;
        const eps = ENDOPERIO_STATES.find(s => s.key === ep.type);
        if (!eps) return;
        const effR5 = cvOvrP[ri] !== undefined ? {...root, cv: cvOvrP[ri]} : root;
        const contour = buildRootContour(effR5, ny, cx);
        if (ep.type === 'j_shaped') {
            const rcx4 = cx + (effR5.ox||0);
            inner += `<path d="M ${contour.apexX},${contour.apexY} Q ${rcx4 - (effR5.bw||10)*0.6},${ny + effR5.l*0.5} ${rcx4 - (effR5.bw||10)*0.4},${ny+6}" fill="none" stroke="${eps.color}" stroke-width="3" stroke-dasharray="4,3" opacity="0.7"/>`;
        } else if (ep.type === 'halo') {
            inner += `<path d="${contour.d}" fill="none" stroke="${eps.color}" stroke-width="3" opacity="0.4"/>`;
        } else {
            inner += `<circle cx="${contour.apexX}" cy="${contour.apexY}" r="5" fill="${eps.color}" opacity="0.5"/>`;
            const rcx4 = cx + (effR5.ox||0);
            inner += `<line x1="${contour.apexX}" y1="${contour.apexY}" x2="${rcx4}" y2="${ny+6}" stroke="${eps.color}" stroke-width="1.5" stroke-dasharray="3,2" opacity="0.5"/>`;
        }
    });

    // TWI visualization in preview
    const wearDataP = (arenaRootData[fileId]?.[fdi]?.wear) || {};
    if (wearDataP.twi >= 1) {
        const wLine = ny - 2;
        const wLen = tooth.svg.nw * 0.8;
        const wColor = wearDataP.twi >= 3 ? 'var(--red)' : wearDataP.twi >= 2 ? 'var(--gold)' : 'var(--yel)';
        const wSw = wearDataP.twi >= 3 ? 3.5 : wearDataP.twi >= 2 ? 2.5 : 1.5;
        inner += `<line x1="${cx - wLen/2}" y1="${wLine}" x2="${cx + wLen/2}" y2="${wLine}" stroke="${wColor}" stroke-width="${wSw}" stroke-linecap="round" opacity="0.8"/>`;
        // TWI label
        if (isUpper) {
            inner += `<g transform="translate(${cx + wLen/2 + 4},${wLine}) scale(1,-1)"><text x="0" y="0" style="font-size:7px;fill:${wColor};opacity:0.8">TWI${wearDataP.twi}</text></g>`;
        } else {
            inner += `<text x="${cx + wLen/2 + 4}" y="${wLine + 3}" style="font-size:7px;fill:${wColor};opacity:0.8">TWI${wearDataP.twi}</text>`;
        }
    }

    // ── Fracture visualization in preview ──
    const fracDataPv = (arenaRootData[fileId]?.[fdi]?.fracture) || {};
    variant.roots.forEach((root, ri) => {
        const fr = fracDataPv[ri];
        if (!fr || fr.type === 'none') return;
        const fState = FRACTURE_STATES.find(s => s.key === fr.type);
        if (!fState) return;
        const effR6 = cvOvrP[ri] !== undefined ? {...root, cv: cvOvrP[ri]} : root;
        const rcx5 = cx + (effR6.ox || 0);
        if (fr.type === 'vrf') {
            const startY = ny + effR6.l * 0.15, endY = ny + effR6.l * 0.85;
            const steps = 6, stepH = (endY - startY) / steps;
            const zw = (effR6.bw || 10) * 0.15;
            let d = `M ${rcx5},${startY}`;
            for (let i = 1; i <= steps; i++) d += ` L ${rcx5 + (i%2===0 ? -zw : zw)},${startY + stepH*i}`;
            inner += `<path d="${d}" fill="none" stroke="${fState.color}" stroke-width="2.5" stroke-linecap="round" opacity="0.85"/>`;
        } else {
            let fracY;
            if (fr.type === 'hrz_cervical') fracY = ny + effR6.l * 0.2;
            else if (fr.type === 'hrz_middle') fracY = ny + effR6.l * 0.5;
            else fracY = ny + effR6.l * 0.8;
            const halfW = (effR6.bw || 10) * 0.5;
            inner += `<line x1="${rcx5-halfW}" y1="${fracY}" x2="${rcx5+halfW}" y2="${fracY}" stroke="${fState.color}" stroke-width="2.5" stroke-dasharray="4,2" opacity="0.8"/>`;
        }
    });
    const cfDataPv = (arenaRootData[fileId]?.[fdi]?.crownFracture);
    if (cfDataPv && cfDataPv.type && cfDataPv.type !== 'none') {
        const cfs = CROWN_FRACTURE_STATES.find(s => s.key === cfDataPv.type);
        if (cfs) {
            const crownTop = ny - 12;
            if (cfDataPv.type === 'split') {
                inner += `<line x1="${cx}" y1="${crownTop}" x2="${cx}" y2="${ny}" stroke="${cfs.color}" stroke-width="2.5" opacity="0.8"/>`;
            } else {
                inner += `<line x1="${cx-3}" y1="${crownTop}" x2="${cx+2}" y2="${ny}" stroke="${cfs.color}" stroke-width="1.8" stroke-dasharray="3,2" opacity="0.6"/>`;
            }
        }
    }

    const defsP = '<defs><filter id="blur2"><feGaussianBlur stdDeviation="1.5"/></filter></defs>';
    // Mesial/distal orientation: Q1/Q4 need horizontal mirror
    const needMirrorXP = fdi && _isMesialRight(fdi);
    let flipAttrP;
    if (needMirrorXP && isUpper) {
        flipAttrP = `transform="translate(${W},${H}) scale(-1,-1)"`;
    } else if (needMirrorXP) {
        flipAttrP = `transform="translate(${W},0) scale(-1,1)"`;
    } else if (isUpper) {
        flipAttrP = `transform="translate(0,${H}) scale(1,-1)"`;
    } else {
        flipAttrP = '';
    }
    preview.innerHTML = `<svg id="${svgId}" width="${svgW}" height="${svgH}" viewBox="${vb}">
        <g ${flipAttrP}>${defsP}${inner}</g></svg>`;

    // Add invisible fat click targets for canals (thin paths are hard to click)
    preview.querySelectorAll('.canal-path').forEach(cp => {
        const d = cp.getAttribute('d');
        if (!d) return;
        const fat = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        fat.setAttribute('d', d);
        fat.setAttribute('fill', 'none');
        fat.setAttribute('stroke', 'transparent');
        fat.setAttribute('stroke-width', '12');
        fat.setAttribute('style', 'cursor:pointer');
        fat.setAttribute('class', 'canal-fat-click');
        fat.dataset.root = cp.dataset.root;
        fat.dataset.canal = cp.dataset.canal;
        fat.dataset.svg = cp.dataset.svg;
        cp.parentNode.appendChild(fat);
    });

    // Attach canal click handlers for fill state cycling
    preview.querySelectorAll('.canal-path, .canal-fat-click').forEach(el => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const ri = el.dataset.root, ci = el.dataset.canal;
            const stKey = `${ri}_${ci}`;
            if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
            if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
            if (!arenaRootData[fileId][fdi].fillStates) arenaRootData[fileId][fdi].fillStates = {};
            arenaRootData[fileId][fdi].fillStates[stKey] = ((arenaRootData[fileId][fdi].fillStates[stKey] || 0) + 1) % FILL_STATES.length;
            _saveRootData(fileId);
            _renderRootSection(fileId, fdi);
            _refreshCellRoot(fileId, fdi);
        });
    });

    // Apex click handlers for periapical cycling
    preview.querySelectorAll('.apex-click').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const ri = parseInt(el.dataset.root);
            if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
            if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
            if (!arenaRootData[fileId][fdi].periapical) arenaRootData[fileId][fdi].periapical = {};
            const cur = arenaRootData[fileId][fdi].periapical[ri];
            const curIdx = cur ? PERIAPICAL_STATES.findIndex(s => s.key === _periapKey(cur.type)) : 0;
            const nextIdx = (curIdx + 1) % PERIAPICAL_STATES.length;
            const next = PERIAPICAL_STATES[nextIdx];
            if (next.key === 'none') {
                delete arenaRootData[fileId][fdi].periapical[ri];
            } else {
                arenaRootData[fileId][fdi].periapical[ri] = {type: next.key, pai: next.pai};
            }
            _saveRootData(fileId);
            _renderRootSection(fileId, fdi);
            _refreshCellRoot(fileId, fdi);
        });
    });

    // Furcation click handlers
    preview.querySelectorAll('.furc-click').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const fi = parseInt(el.dataset.furc);
            if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
            if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
            if (!arenaRootData[fileId][fdi].furcation) arenaRootData[fileId][fdi].furcation = {};
            const cur = arenaRootData[fileId][fdi].furcation[fi]?.grade || 0;
            const next = (cur + 1) % FURCATION_STATES.length;
            if (next === 0) { delete arenaRootData[fileId][fdi].furcation[fi]; }
            else { arenaRootData[fileId][fdi].furcation[fi] = {grade: next}; }
            _saveRootData(fileId);
            _renderRootSection(fileId, fdi);
            _refreshCellRoot(fileId, fdi);
        });
    });

    // Lateral defect click handlers
    preview.querySelectorAll('.lateral-click').forEach(el => {
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            const ri = el.dataset.root, side = el.dataset.side;
            const key = `${ri}_${side}`;
            if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
            if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
            if (!arenaRootData[fileId][fdi].lateral) arenaRootData[fileId][fdi].lateral = {};
            const cur = arenaRootData[fileId][fdi].lateral[key];
            const curIdx = cur ? LATERAL_STATES.findIndex(s => s.key === cur.type) : 0;
            const nextIdx = (curIdx + 1) % LATERAL_STATES.length;
            const next = LATERAL_STATES[nextIdx];
            if (next.key === 'none') { delete arenaRootData[fileId][fdi].lateral[key]; }
            else { arenaRootData[fileId][fdi].lateral[key] = {type: next.key}; }
            _saveRootData(fileId);
            _renderRootSection(fileId, fdi);
            _refreshCellRoot(fileId, fdi);
        });
    });
}

function _pickRootVariant(fileId, fdi, vid) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    const tooth = TOOTH_LIBRARY[FDI_TO_TYPE[fdi]];
    const variant = tooth.variants.find(v => v.id === vid);
    arenaRootData[fileId][fdi].variant = vid;
    arenaRootData[fileId][fdi].vertucci = {...variant.defaultVertucci};
    arenaRootData[fileId][fdi].fillStates = {};
    _saveRootData(fileId);
    _renderRootSection(fileId, fdi);
    _refreshCellRoot(fileId, fdi);
}

function _pickRootVertucci(fileId, fdi, ri, val) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].vertucci) {
        const typeId = FDI_TO_TYPE[fdi];
        const tooth = TOOTH_LIBRARY[typeId];
        const vid = arenaRootData[fileId][fdi].variant || (tooth.variants.find(v => v.isDefault) || tooth.variants[0]).id;
        const variant = tooth.variants.find(v => v.id === vid) || tooth.variants[0];
        arenaRootData[fileId][fdi].vertucci = {...variant.defaultVertucci};
    }
    arenaRootData[fileId][fdi].vertucci[ri] = val;
    // Clear fill states for this root
    const fs = arenaRootData[fileId][fdi].fillStates || {};
    Object.keys(fs).forEach(k => { if (k.startsWith(`${ri}_`)) delete fs[k]; });
    arenaRootData[fileId][fdi].fillStates = fs;
    _saveRootData(fileId);
    _renderRootSection(fileId, fdi);
    _refreshCellRoot(fileId, fdi);
}

function _setCvDirection(fileId, fdi, ri, sign, mag) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].cvOverrides) arenaRootData[fileId][fdi].cvOverrides = {};
    arenaRootData[fileId][fdi].cvOverrides[ri] = sign * mag;
    _saveRootData(fileId);
    _renderRootSection(fileId, fdi);
    _refreshCellRoot(fileId, fdi);
}

function _cycleTWI() {
    if (!_pickerTarget) return;
    const { fileId, fdi } = _pickerTarget;
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    const wearData = arenaRootData[fileId][fdi].wear || {};
    const curTwi = wearData.twi || 0;
    const nextTwi = (curTwi + 1) % 5; // 0→1→2→3→4→0
    _setTWI(fileId, fdi, nextTwi);
}

function _setCvMagnitude(fileId, fdi, ri, sign, mag) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].cvOverrides) arenaRootData[fileId][fdi].cvOverrides = {};
    arenaRootData[fileId][fdi].cvOverrides[ri] = sign * mag;
    _saveRootData(fileId);
    _renderRootSection(fileId, fdi);
    _refreshCellRoot(fileId, fdi);
}

function _setImplCount(fileId, fdi, delta) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    const cur = arenaRootData[fileId][fdi].implant_count || 1;
    const next = Math.max(1, Math.min(5, cur + delta));
    arenaRootData[fileId][fdi].implant_count = next;
    _saveRootData(fileId);
    // Update displayed value
    const valEl = document.getElementById('tp-impl-count-val');
    if (valEl) valEl.textContent = next;
    // Rebuild cell to show/hide badge
    const cell = document.querySelector(`.arena-formula-row.ground-truth .arena-cell[data-file="${fileId}"][data-fdi="${fdi}"]`);
    if (cell) {
        const raw = (arenaGroundTruth[fileId] || {})[fdi] || '';
        const layers = parseToothLayers(raw);
        if (layers.length > 0) _rebuildCellLayered(cell, fdi, layers);
        else _rebuildCell(cell, fdi, layersPrimaryStatus(layers) || raw, '');
    }
}

function _setTWI(fileId, fdi, twi) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    // Apply to batch if available
    const targets = (_pickerTarget && _pickerTarget.batch) ? _pickerTarget.batch.map(t => t.fdi) : [fdi];
    for (const f of targets) {
        if (!arenaRootData[fileId][f]) arenaRootData[fileId][f] = {};
        if (twi === 0) {
            delete arenaRootData[fileId][f].wear;
        } else {
            arenaRootData[fileId][f].wear = {twi};
        }
        _refreshCellRoot(fileId, f);
    }
    _saveRootData(fileId);
    _renderRootSection(fileId, fdi);
}

function _cyclePeriapical() {
    if (!_pickerTarget) return;
    const { fileId, fdi } = _pickerTarget;
    const ri = 0;
    // Determine next state from current tooth
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].periapical) arenaRootData[fileId][fdi].periapical = {};
    const cur = arenaRootData[fileId][fdi].periapical[ri];
    const curIdx = cur ? PERIAPICAL_STATES.findIndex(s => s.key === _periapKey(cur.type)) : 0;
    const nextIdx = (curIdx + 1) % PERIAPICAL_STATES.length;
    const next = PERIAPICAL_STATES[nextIdx];
    // Apply to batch if available
    const targets = (_pickerTarget.batch) ? _pickerTarget.batch.map(t => t.fdi) : [fdi];
    for (const f of targets) {
        if (!arenaRootData[fileId][f]) arenaRootData[fileId][f] = {};
        if (!arenaRootData[fileId][f].periapical) arenaRootData[fileId][f].periapical = {};
        if (next.key === 'none') {
            delete arenaRootData[fileId][f].periapical[ri];
        } else {
            arenaRootData[fileId][f].periapical[ri] = {type: next.key, pai: next.pai};
        }
        _refreshCellRoot(fileId, f);
    }
    _saveRootData(fileId);
    _renderRootSection(fileId, fdi);
}

// Context menu cycling wrappers (don't need _pickerTarget)
function _ctxCyclePeriapical(fileId, fdi) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].periapical) arenaRootData[fileId][fdi].periapical = {};
    const cur = arenaRootData[fileId][fdi].periapical[0];
    const curIdx = cur ? PERIAPICAL_STATES.findIndex(s => s.key === _periapKey(cur.type)) : 0;
    const next = PERIAPICAL_STATES[(curIdx + 1) % PERIAPICAL_STATES.length];
    if (next.key === 'none') delete arenaRootData[fileId][fdi].periapical[0];
    else arenaRootData[fileId][fdi].periapical[0] = {type: next.key, pai: next.pai};
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
}
function _ctxCycleFurcation(fileId, fdi) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].furcation) arenaRootData[fileId][fdi].furcation = {};
    const cur = arenaRootData[fileId][fdi].furcation[0]?.grade || 0;
    const next = (cur + 1) % FURCATION_STATES.length;
    if (next === 0) delete arenaRootData[fileId][fdi].furcation[0];
    else arenaRootData[fileId][fdi].furcation[0] = {grade: next};
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
}
function _ctxCycleLateral(fileId, fdi, ri, side) {
    const key = `${ri}_${side}`;
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].lateral) arenaRootData[fileId][fdi].lateral = {};
    const cur = arenaRootData[fileId][fdi].lateral[key];
    const curIdx = cur ? LATERAL_STATES.findIndex(s => s.key === cur.type) : 0;
    const next = LATERAL_STATES[(curIdx + 1) % LATERAL_STATES.length];
    if (next.key === 'none') delete arenaRootData[fileId][fdi].lateral[key];
    else arenaRootData[fileId][fdi].lateral[key] = {type: next.key};
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
}
function _ctxCycleEndoPerio(fileId, fdi) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].endoPerio) arenaRootData[fileId][fdi].endoPerio = {};
    const cur = arenaRootData[fileId][fdi].endoPerio[0];
    const curIdx = cur ? ENDOPERIO_STATES.findIndex(s => s.key === cur.type) : 0;
    const next = ENDOPERIO_STATES[(curIdx + 1) % ENDOPERIO_STATES.length];
    if (next.key === 'none') delete arenaRootData[fileId][fdi].endoPerio[0];
    else arenaRootData[fileId][fdi].endoPerio[0] = {type: next.key};
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
}
function _ctxCycleTWI(fileId, fdi) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    const cur = arenaRootData[fileId][fdi].wear?.twi || 0;
    const next = (cur + 1) % 5;
    if (next === 0) delete arenaRootData[fileId][fdi].wear;
    else arenaRootData[fileId][fdi].wear = {twi: next};
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
}
function _toggleRootRemoved(fileId, fdi, ri) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].removedRoots) arenaRootData[fileId][fdi].removedRoots = {};
    if (arenaRootData[fileId][fdi].removedRoots[ri]) {
        delete arenaRootData[fileId][fdi].removedRoots[ri];
        if (Object.keys(arenaRootData[fileId][fdi].removedRoots).length === 0) delete arenaRootData[fileId][fdi].removedRoots;
    } else {
        arenaRootData[fileId][fdi].removedRoots[ri] = true;
    }
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
    _renderRootSection(fileId, fdi);
}
function _ctxCycleFracture(fileId, fdi) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].fracture) arenaRootData[fileId][fdi].fracture = {};
    const cur = arenaRootData[fileId][fdi].fracture[0];
    const curIdx = cur ? FRACTURE_STATES.findIndex(s => s.key === cur.type) : 0;
    const next = FRACTURE_STATES[(curIdx + 1) % FRACTURE_STATES.length];
    if (next.key === 'none') delete arenaRootData[fileId][fdi].fracture[0];
    else arenaRootData[fileId][fdi].fracture[0] = {type: next.key};
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
}
function _ctxCycleCrownFracture(fileId, fdi) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    const cur = arenaRootData[fileId][fdi].crownFracture;
    const curIdx = cur ? CROWN_FRACTURE_STATES.findIndex(s => s.key === cur.type) : 0;
    const next = CROWN_FRACTURE_STATES[(curIdx + 1) % CROWN_FRACTURE_STATES.length];
    if (next.key === 'none') delete arenaRootData[fileId][fdi].crownFracture;
    else arenaRootData[fileId][fdi].crownFracture = {type: next.key};
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
}
function _ctxCycleFractureToState(fileId, fdi, stateKey) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].fracture) arenaRootData[fileId][fdi].fracture = {};
    if (stateKey === 'none') delete arenaRootData[fileId][fdi].fracture[0];
    else arenaRootData[fileId][fdi].fracture[0] = {type: stateKey};
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
    _renderRootSection(fileId, fdi);
}
function _ctxCycleCrownFractureToState(fileId, fdi, stateKey) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (stateKey === 'none') delete arenaRootData[fileId][fdi].crownFracture;
    else arenaRootData[fileId][fdi].crownFracture = {type: stateKey};
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
    _renderRootSection(fileId, fdi);
}
function _ctxCycleCanal(fileId, fdi) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].fillStates) arenaRootData[fileId][fdi].fillStates = {};
    const cur = arenaRootData[fileId][fdi].fillStates['0_0'] || 0;
    arenaRootData[fileId][fdi].fillStates['0_0'] = (cur + 1) % FILL_STATES.length;
    _saveRootData(fileId); _refreshCellRoot(fileId, fdi);
}
function _ctxRefreshRootSection(btn, fileId, fdi) {
    // Rebuild the context menu to show updated values
    const menu = btn.closest('.note-ctx-menu');
    if (menu) { menu.remove(); _bridgeContextMenu({preventDefault:()=>{},stopPropagation:()=>{}}, document.querySelector(`.arena-cell[data-fdi="${fdi}"][data-file="${fileId}"]`), fileId, fdi); }
}

// ═══ Tooth detail panel (right side, always-visible pathology controls) ═══

function _ctxCycleCanalSpecific(fileId, fdi, stKey) {
    if (!arenaRootData[fileId]) arenaRootData[fileId] = {};
    if (!arenaRootData[fileId][fdi]) arenaRootData[fileId][fdi] = {};
    if (!arenaRootData[fileId][fdi].fillStates) arenaRootData[fileId][fdi].fillStates = {};
    const cur = arenaRootData[fileId][fdi].fillStates[stKey] || 0;
    arenaRootData[fileId][fdi].fillStates[stKey] = (cur + 1) % FILL_STATES.length;
    _saveRootData(fileId);
    _refreshCellRoot(fileId, fdi);
}

function _updateToothDetailPanel(fileId, fdi) {
    const card = document.getElementById('tooth-detail-card-' + fileId);
    const placeholder = document.getElementById('td-placeholder-' + fileId);
    if (!card) return;
    card.style.display = '';
    if (placeholder) placeholder.style.display = 'none';
    // Force-show the detail column on small screens
    const col = card.closest('.arena-detail-col');
    if (col) col.classList.add('force-show');

    document.getElementById('td-fdi-' + fileId).textContent = fdi;
    const rawGT = (arenaGroundTruth[fileId] || {})[fdi] || '';
    const layers = parseToothLayers(rawGT);
    const abbr = layersAbbreviation(layers);
    document.getElementById('td-status-' + fileId).textContent = abbr ? '[' + abbr + ']' : '';

    // Root data
    const rd = (arenaRootData[fileId] || {})[fdi] || {};
    const typeId = FDI_TO_TYPE[fdi];
    const toothLib = typeId ? TOOTH_LIBRARY[typeId] : null;
    const variantObj = toothLib ? (toothLib.variants.find(v => v.id === rd.variant) || toothLib.variants.find(v => v.isDefault) || toothLib.variants[0]) : null;
    const nRoots = variantObj ? variantObj.roots.length : 1;
    const hasEndo = rawGT.split('+').some(p => p.split(':')[0] === 'endo');

    const btnsDiv = document.getElementById('td-pathology-btns-' + fileId);
    if (!btnsDiv) return;

    let html = '';

    // ── КАНАЛЫ section (only if endo) ──
    if (hasEndo) {
        html += '<div class="td-section-header">КАНАЛЫ</div>';
        if (variantObj) {
            const names = CANAL_NAMES[typeId] || [];
            variantObj.roots.forEach((root, ri) => {
                const vType = (rd.vertucci || {})[ri] || variantObj.defaultVertucci?.[ri] || 'I';
                const schema = VERTUCCI_SCHEMAS[vType];
                const nCanals = schema?.foramina || 1;
                for (let ci = 0; ci < nCanals; ci++) {
                    const stKey = ri + '_' + ci;
                    const stIdx = rd.fillStates?.[stKey] || 0;
                    const st = FILL_STATES[stIdx];
                    const nm = names[ri]?.single || ('R' + (ri + 1));
                    const active = stIdx > 0;
                    html += '<button class="td-btn' + (active ? ' active' : '') + '" style="' + (active ? 'border-left-color:' + st.color : '') + '" ' +
                        'onclick="_ctxCycleCanalSpecific(\'' + fileId + '\',\'' + fdi + '\',\'' + stKey + '\');_updateToothDetailPanel(\'' + fileId + '\',\'' + fdi + '\')">' +
                        nm + ' К' + (ci + 1) + ': ' + st.label + '</button>';
                }
            });
        }
    }

    // ── ПЕРИАПИКАЛЬНО section ──
    html += '<div class="td-section-header">ПЕРИАПИКАЛЬНО</div>';
    const pa0 = rd.periapical?.[0];
    const paState = pa0 ? PERIAPICAL_STATES.find(s => s.key === _periapKey(pa0.type)) : PERIAPICAL_STATES[0];
    html += '<button class="td-btn' + (pa0 ? ' active' : '') + '" style="' + (pa0 ? 'border-left-color:' + (paState?.color || 'var(--red)') : '') + '" ' +
        'title="Клик: следующая стадия периапикального поражения (PAI 1→5 по Ørstavik). Кликайте на кружки у апексов корней в превью SVG." ' +
        'onclick="_ctxCyclePeriapical(\'' + fileId + '\',\'' + fdi + '\');_updateToothDetailPanel(\'' + fileId + '\',\'' + fdi + '\')">' +
        (paState?.nameRU || 'Норма') + '</button>';
    if (pa0 && paState?.desc) {
        html += `<div style="font-size:8px;color:var(--text-dim);padding:2px 8px;line-height:1.4;margin-bottom:2px;">${paState.desc}</div>`;
    }

    // ── ПАРОДОНТ section ──
    html += '<div class="td-section-header">ПАРОДОНТ</div>';
    if (nRoots > 1) {
        const furc0 = rd.furcation?.[0];
        const fState = furc0 ? FURCATION_STATES[furc0.grade] : FURCATION_STATES[0];
        html += '<button class="td-btn' + (furc0 ? ' active' : '') + '" style="' + (furc0 ? 'border-left-color:' + fState.color : '') + '" ' +
            'title="Клик: следующая степень поражения фуркации (Glickman I→IV). Кликайте между корнями в превью SVG." ' +
            'onclick="_ctxCycleFurcation(\'' + fileId + '\',\'' + fdi + '\');_updateToothDetailPanel(\'' + fileId + '\',\'' + fdi + '\')">' +
            'Фуркация: ' + fState.nameRU + '</button>';
    }

    // Lateral defects per side
    for (const side of ['m', 'd']) {
        const key = '0_' + side;
        const ld = rd.lateral?.[key];
        const ls = ld ? LATERAL_STATES.find(s => s.key === ld.type) : LATERAL_STATES[0];
        const label = side === 'm' ? 'Лат. мез.' : 'Лат. дист.';
        const isActive = ld?.type && ld.type !== 'none';
        html += '<button class="td-btn' + (isActive ? ' active' : '') + '" style="' + (isActive ? 'border-left-color:' + ls.color : '') + '" ' +
            'title="Клик: тип костного дефекта (вертикальный/горизонтальный/кратер). Кликайте по бокам корня в превью SVG." ' +
            'onclick="_ctxCycleLateral(\'' + fileId + '\',\'' + fdi + '\',\'0\',\'' + side + '\');_updateToothDetailPanel(\'' + fileId + '\',\'' + fdi + '\')">' +
            label + ': ' + (ls?.nameRU || '\u2014') + '</button>';
    }

    // Endo-perio
    const ep0 = rd.endoPerio?.[0];
    const eps = ep0 ? ENDOPERIO_STATES.find(s => s.key === ep0.type) : ENDOPERIO_STATES[0];
    const epActive = ep0?.type && ep0.type !== 'none';
    html += '<button class="td-btn' + (epActive ? ' active' : '') + '" style="' + (epActive ? 'border-left-color:' + eps.color : '') + '" ' +
        'title="Клик: тип эндо-перио поражения (J-образное/Halo/Комбинированное). Видны как разрежение от апекса к шейке." ' +
        'onclick="_ctxCycleEndoPerio(\'' + fileId + '\',\'' + fdi + '\');_updateToothDetailPanel(\'' + fileId + '\',\'' + fdi + '\')">' +
        'Эндо-перио: ' + (eps?.nameRU || '\u2014') + '</button>';
    // Hint for endo-perio
    if (epActive) {
        const epHints = {
            j_shaped: 'Непрерывное разрежение от апекса вдоль корня к маргинальной кости. Признак: эндо-инфекция распространилась через латеральный канал или перфорацию.',
            halo: 'Кольцеобразное разрежение вокруг корня. Может быть резорбция или хроническое воспаление.',
            combined: 'Два отдельных очага: периапикальный + маргинальный. Оба процесса одновременно.'
        };
        html += `<div style="font-size:8px;color:var(--text-dim);padding:2px 8px;line-height:1.4;margin-bottom:2px;">${epHints[ep0.type] || ''}</div>`;
    }

    // ── СТИРАЕМОСТЬ section ──
    html += '<div class="td-section-header">СТИРАЕМОСТЬ</div>';
    const twiVal = rd.wear?.twi || 0;
    const tw = TWI_STATES[twiVal];
    html += '<button class="td-btn' + (twiVal > 0 ? ' active' : '') + '" style="' + (twiVal > 0 ? 'border-left-color:' + tw.color : '') + '" ' +
        'title="Клик: следующая степень стираемости (TWI 0→4). Индекс износа по Lussi 2017."' +
        'onclick="_ctxCycleTWI(\'' + fileId + '\',\'' + fdi + '\');_updateToothDetailPanel(\'' + fileId + '\',\'' + fdi + '\')">' +
        'TWI ' + twiVal + ': ' + tw.nameRU + '</button>';

    // ── ПЕРЕЛОМЫ section ──
    html += '<div class="td-section-header">ПЕРЕЛОМЫ</div>';
    const frac0 = rd.fracture?.[0];
    const fracState = frac0 ? FRACTURE_STATES.find(s => s.key === frac0.type) : FRACTURE_STATES[0];
    const fracActive = frac0?.type && frac0.type !== 'none';
    html += '<button class="td-btn' + (fracActive ? ' active' : '') + '" style="' + (fracActive ? 'border-left-color:' + (fracState?.color || 'var(--red)') : '') + '" ' +
        'title="Клик: циклировать тип перелома корня (— → VRF → H⅓↑ → H⅓M → H⅓A → —). Классификация AAE + Andreasen." ' +
        'onclick="_ctxCycleFracture(\'' + fileId + '\',\'' + fdi + '\');_updateToothDetailPanel(\'' + fileId + '\',\'' + fdi + '\')">' +
        'Корень: ' + (fracState?.nameRU || 'Нет перелома') + '</button>';
    if (fracActive && fracState?.desc) {
        html += `<div style="font-size:8px;color:var(--text-dim);padding:2px 8px;line-height:1.4;margin-bottom:2px;">${fracState.desc}</div>`;
        if (fracState.ref) html += `<div style="font-size:7px;color:rgba(255,255,255,0.25);padding:0 8px;margin-bottom:4px;">📖 ${fracState.ref}</div>`;
    }
    const cfState2 = rd.crownFracture ? CROWN_FRACTURE_STATES.find(s => s.key === rd.crownFracture.type) : CROWN_FRACTURE_STATES[0];
    const cfActive = rd.crownFracture?.type && rd.crownFracture.type !== 'none';
    html += '<button class="td-btn' + (cfActive ? ' active' : '') + '" style="' + (cfActive ? 'border-left-color:' + (cfState2?.color || 'var(--orange)') : '') + '" ' +
        'title="Клик: циклировать перелом коронки (— → Раскол → Трещина → —). Видно на OPG: щель между фрагментами (split) или расш. PDL (cracked)." ' +
        'onclick="_ctxCycleCrownFracture(\'' + fileId + '\',\'' + fdi + '\');_updateToothDetailPanel(\'' + fileId + '\',\'' + fdi + '\')">' +
        'Коронка: ' + (cfState2?.nameRU || 'Нет') + '</button>';
    if (cfActive && cfState2?.desc) {
        html += `<div style="font-size:8px;color:var(--text-dim);padding:2px 8px;line-height:1.4;margin-bottom:2px;">${cfState2.desc}</div>`;
    }

    btnsDiv.innerHTML = html;
}

function _updatePeriapLabel(fileId, fdi) {
    const label = document.getElementById('tp-periap-label');
    if (!label) return;
    const rd = (arenaRootData[fileId] || {})[fdi] || {};
    const pa = (rd.periapical || {})[0];
    if (!pa || pa.type === 'none') {
        label.textContent = '\u25cf \u041d\u043e\u0440\u043c\u0430';
        label.style.color = 'var(--text-dim)';
    } else {
        const pS = PERIAPICAL_STATES.find(s => s.key === _periapKey(pa.type));
        if (pS) {
            label.textContent = '\u25cf ' + pS.nameRU;
            label.style.color = pS.color;
        }
    }
}

function _refreshCellRoot(fileId, fdi) {
    // Re-render the root SVG in the formula cell
    const cell = document.querySelector(`.arena-cell[data-fdi="${fdi}"][data-file="${fileId}"]`);
    if (!cell) return;
    const rootSpan = cell.querySelector('.cell-root');
    const raw = (arenaGroundTruth[fileId] || {})[fdi] || '';
    const layers = parseToothLayers(raw);
    const status = layersPrimaryStatus(layers) || 'present';
    const newRoot = rootSvg(fdi, status, null, fileId, raw);
    if (rootSpan) {
        rootSpan.innerHTML = newRoot;
    } else if (newRoot) {
        const span = document.createElement('span');
        span.className = 'cell-root';
        span.innerHTML = newRoot;
        cell.appendChild(span);
    }
}
