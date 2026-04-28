// gt-editor.js — GT copy, save/load/history, time machine, batch prefill, AI
// Extracted from darwin_lab.html lines 8688–9579
// ═══════════════════════════════════════════════════════════════

// ═══ Копирование ГТ между снимками одного пациента ═══
function showGTCopyMenu(e, targetFileId, patientId) {
    e.stopPropagation();
    // Remove any existing menu
    document.querySelectorAll('.gt-copy-menu').forEach(m => m.remove());

    // Find all file_ids for this patient in arenaGroundTruth
    const allFileIds = Object.keys(arenaGroundTruth).map(Number);
    // Get arena cases from DOM to match patient_id
    const caseDivs = document.querySelectorAll('.arena-case[id^="arena-case-"]');
    const siblingFiles = [];
    // Walk through parent group to find sibling snapshots
    const targetCase = document.getElementById(`arena-case-${targetFileId}`);
    if (targetCase) {
        const group = targetCase.closest('.arena-patient-group');
        if (group) {
            group.querySelectorAll('.arena-case').forEach(cd => {
                const fid = parseInt(cd.id.replace('arena-case-', ''));
                if (fid !== targetFileId) {
                    const gt = arenaGroundTruth[fid] || {};
                    const filled = Object.values(gt).filter(v => v).length;
                    siblingFiles.push({ file_id: fid, filled });
                }
            });
        }
    }

    if (siblingFiles.length === 0) return;

    const menu = document.createElement('div');
    menu.className = 'gt-copy-menu';
    menu.innerHTML = `<div style="padding:4px 14px 6px;font-size:10px;color:var(--text-dim);border-bottom:1px solid var(--border)">Копировать эталон из:</div>` +
        siblingFiles.map(s =>
            `<div class="gt-copy-menu-item" onclick="copyGTFromSnapshot(${s.file_id}, ${targetFileId})">
                Снимок file_id=${s.file_id}
                <span class="copy-filled">${s.filled}/32</span>
            </div>`
        ).join('');

    // Position near button
    const rect = e.target.getBoundingClientRect();
    menu.style.position = 'fixed';
    menu.style.left = rect.left + 'px';
    menu.style.top = (rect.bottom + 4) + 'px';
    document.body.appendChild(menu);

    // Close on click outside
    const closeHandler = (ev) => {
        if (!menu.contains(ev.target)) { menu.remove(); document.removeEventListener('click', closeHandler, true); }
    };
    setTimeout(() => document.addEventListener('click', closeHandler, true), 50);
}

function copyGTFromSnapshot(sourceFileId, targetFileId) {
    const sourceGT = arenaGroundTruth[sourceFileId];
    const sourceBridges = arenaBridgeLinks[sourceFileId];
    const sourceNotes = arenaToothNotes[sourceFileId];

    if (!sourceGT || Object.keys(sourceGT).length === 0) {
        alert('Исходный снимок не имеет эталонной разметки');
        return;
    }

    // Deep copy GT formula
    arenaGroundTruth[targetFileId] = JSON.parse(JSON.stringify(sourceGT));

    // Copy bridge links if present
    if (sourceBridges && Object.keys(sourceBridges).length > 0) {
        arenaBridgeLinks[targetFileId] = JSON.parse(JSON.stringify(sourceBridges));
    }

    // Copy notes if present
    if (sourceNotes && Object.keys(sourceNotes).length > 0) {
        arenaToothNotes[targetFileId] = JSON.parse(JSON.stringify(sourceNotes));
    }

    // Copy root data (variants, Vertucci, canal fill states)
    const sourceRoots = arenaRootData[sourceFileId];
    if (sourceRoots && Object.keys(sourceRoots).length > 0) {
        arenaRootData[targetFileId] = JSON.parse(JSON.stringify(sourceRoots));
        _saveRootData(targetFileId);
    }

    // Save to localStorage
    localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
    localStorage.setItem('darwin_bridge_links', JSON.stringify(arenaBridgeLinks));
    localStorage.setItem('darwin_tooth_notes', JSON.stringify(arenaToothNotes));

    // Close menu
    document.querySelectorAll('.gt-copy-menu').forEach(m => m.remove());

    // Save to server FIRST, then reload arena (otherwise loadArena overwrites with old DB data)
    const gt = arenaGroundTruth[targetFileId] || {};
    const savePayload = {...gt};
    if (arenaBridgeLinks[targetFileId]) savePayload._bridge_links = arenaBridgeLinks[targetFileId];
    if (arenaToothNotes[targetFileId]) savePayload._tooth_notes = arenaToothNotes[targetFileId];
    if (arenaRootData[targetFileId]) savePayload._root_data = arenaRootData[targetFileId];
    fetch(`/api/darwin/ground-truth/${targetFileId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            formula: savePayload,
            bridge_links: arenaBridgeLinks[targetFileId] || {},
            tooth_notes: arenaToothNotes[targetFileId] || {},
            root_data: arenaRootData[targetFileId] || {}
        })
    }).then(() => {
        loadArena();
    }).catch(() => {
        loadArena(); // reload anyway
    });
}

// ── GT Save Queue — guaranteed persistence + change tracking ──
const _gtSessionId = crypto.randomUUID ? crypto.randomUUID() :
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16);
    });
let _gtCurrentSeq = {};  // fileId → latest sequence_num from server
let _gtSaving = {};       // fileId → true while save in flight
let _gtPendingChanges = {}; // fileId → [{fdi, oldVal, newVal, source}]
let _gtSaveStatus = {};   // fileId → 'idle'|'saving'|'saved'|'error'|'pending'
let _gtSessionCount = {}; // fileId → number of successful saves this session
let _gtLastSavedAt = {};  // fileId → Date of last successful save
let _gtLastAction = {};   // fileId → {fdi, value, ts} last user action

// Debounced save GT to database
let _gtSaveTimers = {};
function _getUnmarkedTeethTooltip(fileId) {
    const ALL_FDI = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8',
                     '4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
    const gt = arenaGroundTruth[fileId] || {};
    const rd = arenaRootData[fileId] || {};
    const unmarked = ALL_FDI.filter(fdi => !gt[fdi] && !(rd[fdi] && Object.keys(rd[fdi]).length > 0));
    if (unmarked.length === 0) return '';
    return 'Не отмечены (кликните чтобы задать статус): ' + unmarked.map(f => f.replace('.','')).join(', ');
}

function _getUnmarkedTeethList(fileId) {
    const ALL = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8',
                 '4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
    const gt = arenaGroundTruth[fileId] || {};
    const rd = arenaRootData[fileId] || {};
    const um = ALL.filter(f => !gt[f] && !(rd[f] && Object.keys(rd[f]).length > 0));
    return um.length > 0 ? um.map(f => f.replace('.','')).join(', ') : '';
}

function _debouncedSaveGT(fileId, fdi, oldVal, newVal, source) {
    // Track the change
    if (fdi) {
        if (!_gtPendingChanges[fileId]) _gtPendingChanges[fileId] = [];
        _gtPendingChanges[fileId].push({fdi, old_value: oldVal||null, new_value: newVal||null, source: source||'manual'});
        _gtLastAction[fileId] = {fdi, value: newVal || '(clear)', ts: new Date()};
        // Flash the affected tooth cell green so user sees "saving…"
        _flashToothCell(fileId, fdi, 'pending');
    }
    _updateSaveStatus(fileId, 'pending');
    if (_gtSaveTimers[fileId]) clearTimeout(_gtSaveTimers[fileId]);
    _gtSaveTimers[fileId] = setTimeout(() => _flushGTSave(fileId), 800);
}

/** Briefly highlight a tooth cell to confirm a save state transition. */
function _flashToothCell(fileId, fdi, kind) {
    const cells = document.querySelectorAll(`#arena-case-${fileId} .arena-cell[data-fdi="${fdi}"]`);
    const bg = kind === 'pending' ? 'rgba(245,158,11,0.35)'
             : kind === 'saved'   ? 'rgba(34,197,94,0.45)'
             : 'rgba(239,68,68,0.4)';
    cells.forEach(cell => {
        cell.style.transition = 'box-shadow 0.25s';
        cell.style.boxShadow = `inset 0 0 0 2px ${bg}`;
        if (kind === 'saved') {
            setTimeout(() => { cell.style.boxShadow = ''; }, 1500);
        }
    });
}

// ── Heartbeat auto-save: flush pending changes every 30 seconds ──
// Safeguards against browser crash within debounce window.
setInterval(() => {
    for (const fileId of Object.keys(_gtPendingChanges)) {
        if (_gtPendingChanges[fileId]?.length > 0) {
            if (_gtSaveTimers[fileId]) {
                clearTimeout(_gtSaveTimers[fileId]);
                delete _gtSaveTimers[fileId];
            }
            _flushGTSave(fileId);
        }
    }
}, 30000);

function _flushGTSave(fileId, callback) {
    if (_gtSaving[fileId]) {
        // Already saving — retry after current save completes
        setTimeout(() => _flushGTSave(fileId, callback), 500);
        return;
    }
    const gt = arenaGroundTruth[fileId] || {};
    const bl = arenaBridgeLinks[fileId] || {};
    const tn = arenaToothNotes[fileId] || {};
    const rd = arenaRootData[fileId] || {};
    const co = (window.arenaCropOverrides || {})[fileId] || {};
    const changes = _gtPendingChanges[fileId] || [];
    _gtPendingChanges[fileId] = [];
    _gtSaving[fileId] = true;
    _updateSaveStatus(fileId, 'saving');

    fetch(`/api/darwin/ground-truth/${fileId}`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
            formula: gt, bridge_links: bl, tooth_notes: tn,
            root_data: rd, crop_overrides: co,
            session_id: _gtSessionId,
            source: changes.length === 1 ? changes[0].source : 'manual'
        })
    }).then(r => r.json()).then(d => {
        _gtSaving[fileId] = false;
        if (d.sequence_num) _gtCurrentSeq[fileId] = d.sequence_num;
        _gtSessionCount[fileId] = (_gtSessionCount[fileId] || 0) + (changes.length || 1);
        _gtLastSavedAt[fileId] = new Date();
        // Flash every affected cell green
        for (const ch of changes) {
            if (ch.fdi) _flashToothCell(fileId, ch.fdi, 'saved');
        }
        _updateSaveStatus(fileId, 'saved');
        if (callback) callback();
        console.log(`GT saved for file_id=${fileId}, seq=${d.sequence_num}, changes=${d.changes_recorded||0}`);
    }).catch(e => {
        _gtSaving[fileId] = false;
        _updateSaveStatus(fileId, 'error');
        console.warn('GT save failed:', e);
        // Retry once after 2s
        setTimeout(() => {
            _gtSaving[fileId] = false;
            _flushGTSave(fileId, callback);
        }, 2000);
    });
}

function _updateSaveStatus(fileId, status) {
    _gtSaveStatus[fileId] = status;
    // Legacy small indicator (kept for compatibility)
    const el = document.getElementById(`gt-save-status-${fileId}`);
    if (el) {
        if (status === 'pending')      { el.textContent = '\u25cf'; el.style.color = '#f59e0b'; el.title = 'Несохранённые изменения'; }
        else if (status === 'saving')  { el.textContent = '\u25cc'; el.style.color = '#3b82f6'; el.title = 'Сохранение...'; }
        else if (status === 'saved')   { el.textContent = '\u2713'; el.style.color = '#22c55e'; el.title = 'Сохранено'; }
        else if (status === 'error')   { el.innerHTML = '<span style="color:#ef4444;cursor:pointer" title="Ошибка сохранения — нажмите для повтора">&#10005;</span>'; }
    }
    // Large persistent save banner
    _renderSaveBanner(fileId);
}

function _renderSaveBanner(fileId) {
    const banner = document.getElementById(`gt-save-banner-${fileId}`);
    if (!banner) return;
    const icon = banner.querySelector('.gt-save-banner-icon');
    const statusEl = banner.querySelector('.gt-save-banner-status');
    const metaEl = banner.querySelector('.gt-save-banner-meta');
    if (!icon || !statusEl || !metaEl) return;

    const status = _gtSaveStatus[fileId] || 'idle';
    const pending = (_gtPendingChanges[fileId] || []).length;
    const savedCount = _gtSessionCount[fileId] || 0;
    const lastSavedAt = _gtLastSavedAt[fileId];
    const lastAction = _gtLastAction[fileId];

    function fmtTime(dt) {
        if (!dt) return '—';
        return dt.toLocaleTimeString('ru-RU', {hour12:false});
    }
    function fmtAgo(dt) {
        if (!dt) return '';
        const secs = Math.round((Date.now() - dt.getTime()) / 1000);
        if (secs < 5)   return '«только что»';
        if (secs < 60)  return `${secs}s ago`;
        if (secs < 3600)return `${Math.floor(secs/60)}m ago`;
        return `${Math.floor(secs/3600)}h ago`;
    }

    const _t = (k, p) => (typeof OrisI18n !== 'undefined') ? OrisI18n.t(k, p) : k;
    // {plural:n} is a placeholder we expand here for English ("s" iff
    // n != 1) — Russian has its own pre-pluralised string.
    function _pluralS(n) { return (n === 1) ? '' : 's'; }
    let bg = 'rgba(15,23,42,0.4)', border = 'rgba(148,163,184,0.18)', color = '#94a3b8', iconCh = '💾', statusTxt = _t('fmlSaveBannerNoChanges');
    if (status === 'pending') {
        bg='rgba(245,158,11,0.12)'; border='rgba(245,158,11,0.5)'; color='#fbbf24';
        iconCh='⏳'; statusTxt = _t('fmlSaveBannerPending', {n: pending});
    } else if (status === 'saving') {
        bg='rgba(59,130,246,0.12)'; border='rgba(59,130,246,0.5)'; color='#60a5fa';
        const n = pending || 1;
        iconCh='💾';
        statusTxt = _t('fmlSaveBannerSaving', {n}).replace('{plural:n}', _pluralS(n));
    } else if (status === 'saved') {
        bg='rgba(34,197,94,0.10)'; border='rgba(34,197,94,0.45)'; color='#4ade80';
        iconCh='✅'; statusTxt = _t('fmlSaveBannerSaved', {n: savedCount});
    } else if (status === 'error') {
        bg='rgba(239,68,68,0.15)'; border='rgba(239,68,68,0.6)'; color='#fca5a5';
        iconCh='⚠'; statusTxt = _t('fmlSaveBannerFailed');
    } else { // idle
        if (savedCount > 0) {
            statusTxt = _t('fmlSaveBannerSavedAll', {n: savedCount});
            color='#94a3b8'; iconCh='✅';
        }
    }

    icon.textContent = iconCh;
    statusEl.textContent = statusTxt;
    statusEl.style.color = color;
    banner.style.background = bg;
    banner.style.borderColor = border;

    const parts = [];
    if (lastAction) parts.push(_t('fmlSaveBannerLast', {
        fdi: lastAction.fdi, val: lastAction.value, time: fmtTime(lastAction.ts)
    }));
    if (lastSavedAt) parts.push(_t('fmlSaveBannerSavedAt', {
        time: fmtTime(lastSavedAt), ago: fmtAgo(lastSavedAt)
    }));
    metaEl.textContent = parts.join(' · ');

    // Click-to-retry on error
    banner.onclick = status === 'error' ? () => _flushGTSave(fileId) : null;
    banner.style.cursor = status === 'error' ? 'pointer' : '';
}

// Refresh banner "ago" text every 5 sec so user sees live timestamp
setInterval(() => {
    for (const fid of Object.keys(_gtLastSavedAt)) _renderSaveBanner(parseInt(fid, 10));
}, 5000);

// Re-render every GT save banner + every GT row-sub when the language
// flips. The banners cache state per file_id (saving / saved / error /
// pending counters), so we just call _renderSaveBanner on each known
// file. The GT row-sub recomputes its `filled / missing` text from
// arenaGroundTruth without an API round-trip.
function _refreshGTRowSubsForLang() {
    if (typeof OrisI18n === 'undefined' || typeof arenaGroundTruth === 'undefined') return;
    const _t = (k, p) => OrisI18n.t(k, p);
    const ALL32 = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1','2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8',
                   '4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1','3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];
    document.querySelectorAll('.arena-formula-row.ground-truth').forEach(row => {
        const fileId = row.dataset.file;
        if (!fileId) return;
        // Re-translate the leading "🎯 Ground truth …" label
        const labelDiv = row.querySelector('.row-label > div:first-child');
        if (labelDiv) labelDiv.textContent = '🎯 ' + _t('fmlGTRowLabel');
        const sub = row.querySelector('.row-sub');
        if (!sub) return;
        const gt = arenaGroundTruth[fileId] || {};
        const filled = ALL32.filter(f => gt[f]).length;
        if (filled >= 32) {
            sub.innerHTML = _t('fmlMarkedFull');
        } else {
            // Try to keep the "missing teeth" hint if the helper exists
            let umTeeth = '';
            try { if (typeof _getUnmarkedTeethList === 'function') umTeeth = _getUnmarkedTeethList(parseInt(fileId, 10)) || ''; } catch (_) {}
            sub.innerHTML = _t('fmlMarkedSub', {n: filled})
                + (umTeeth ? ` <span style="color:rgba(239,68,68,0.8);font-size:9px">· ${_t('fmlMissingTeeth')} ${umTeeth}</span>` : '');
        }
    });
}
if (typeof OrisI18n !== 'undefined') {
    OrisI18n.onLangChange(() => {
        _refreshGTRowSubsForLang();
        for (const fid of Object.keys(_gtLastSavedAt)) _renderSaveBanner(parseInt(fid, 10));
        // Banners on rows that haven't saved yet — walk all visible banners
        document.querySelectorAll('[id^="gt-save-banner-"]').forEach(b => {
            const fid = parseInt(b.dataset.file, 10);
            if (fid && !_gtLastSavedAt[fid]) _renderSaveBanner(fid);
        });
    });
}

// ── beforeunload: flush pending saves via sendBeacon ──
window.addEventListener('beforeunload', () => {
    // Flush any pending changes tracked in _gtPendingChanges
    for (const fileId of Object.keys(_gtPendingChanges)) {
        if (_gtPendingChanges[fileId]?.length > 0 || _gtSaveTimers[fileId]) {
            const gt = arenaGroundTruth[fileId] || {};
            const bl = arenaBridgeLinks[fileId] || {};
            const tn = arenaToothNotes[fileId] || {};
            const co = (window.arenaCropOverrides || {})[fileId] || {};
            const payload = JSON.stringify({
                formula: gt, bridge_links: bl, tooth_notes: tn,
                crop_overrides: co,
                session_id: _gtSessionId, source: 'beforeunload'
            });
            navigator.sendBeacon(`/api/darwin/ground-truth/${fileId}`,
                new Blob([payload], {type: 'application/json'}));
        }
    }
    // Also flush for any fileId that has a pending debounce timer
    for (const fileId of Object.keys(_gtSaveTimers)) {
        if (_gtSaveTimers[fileId]) {
            clearTimeout(_gtSaveTimers[fileId]);
            const gt = arenaGroundTruth[fileId] || {};
            const bl = arenaBridgeLinks[fileId] || {};
            const tn = arenaToothNotes[fileId] || {};
            const co = (window.arenaCropOverrides || {})[fileId] || {};
            if (Object.keys(gt).length > 0) {
                const payload = JSON.stringify({
                    formula: gt, bridge_links: bl, tooth_notes: tn,
                    crop_overrides: co,
                    session_id: _gtSessionId, source: 'beforeunload'
                });
                navigator.sendBeacon(`/api/darwin/ground-truth/${fileId}`,
                    new Blob([payload], {type: 'application/json'}));
            }
        }
    }
});

// ── visibilitychange: flush pending saves when tab becomes hidden ──
// Safety net: catches cases where user switches tabs before beforeunload fires
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
        for (const fileId of Object.keys(_gtSaveTimers || {})) {
            if (_gtSaveTimers[fileId]) {
                clearTimeout(_gtSaveTimers[fileId]);
                _gtSaveTimers[fileId] = null;
                _flushGTSave(fileId);
            }
        }
        // Also flush crop override auto-saves
        for (const fileId of Object.keys(_cropAutoSaveTimers || {})) {
            if (_cropAutoSaveTimers[fileId]) {
                clearTimeout(_cropAutoSaveTimers[fileId]);
                _cropAutoSaveTimers[fileId] = null;
                const co = (window.arenaCropOverrides || {})[fileId];
                if (co && Object.keys(co).length > 0) {
                    navigator.sendBeacon(`/api/darwin/crop-overrides/${fileId}`,
                        new Blob([JSON.stringify({ crop_overrides: co, session_id: _gtSessionId })],
                            {type: 'application/json'}));
                }
            }
        }
    }
});

// ── GT History Panel ──
async function _loadGTHistory(fileId) {
    const panel = document.getElementById(`gt-history-${fileId}`);
    if (!panel) return;
    const list = panel.querySelector('.gt-history-list');
    if (!list) return;
    if (list.dataset.loaded) return; // already loaded

    list.innerHTML = '<div style="padding:4px 8px;font-size:9px;color:#64748b">Загрузка...</div>';
    try {
        const r = await fetch(`/api/darwin/ground-truth/${fileId}/history?limit=50`);
        const d = await r.json();
        if (!d.history || d.history.length === 0) {
            list.innerHTML = '<div style="padding:4px 8px;font-size:9px;color:#64748b">Нет истории изменений</div>';
            return;
        }
        list.innerHTML = '';
        for (const h of d.history) {
            const item = document.createElement('div');
            item.className = `gt-history-item${h.change_type === 'bulk_prefill' ? ' bulk' : ''}`;
            const time = h.created_at ? new Date(h.created_at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '';
            const date = h.created_at ? new Date(h.created_at).toLocaleDateString('ru',{day:'2-digit',month:'2-digit'}) : '';

            if (h.change_type === 'bulk_prefill' || h.change_type === 'rollback') {
                item.innerHTML = `<span class="h-time" title="${date}">${time}</span>` +
                    `<span style="color:#a855f7">${h.change_type === 'rollback' ? '\u21ba Откат' : '\ud83e\udd16 Заполнение'}</span>` +
                    `<span class="h-source">${h.source}</span>`;
            } else {
                const oldAbbr = h.old_value ? _statusAbbr(h.old_value) : '\u2014';
                const newAbbr = h.new_value ? _statusAbbr(h.new_value) : '\u2014';
                item.innerHTML = `<span class="h-time" title="${date}">${time}</span>` +
                    `<span class="h-fdi">${h.fdi||''}</span>` +
                    `<span class="h-old">${oldAbbr}</span>` +
                    `<span class="h-arrow">\u2192</span>` +
                    `<span class="h-new">${newAbbr}</span>` +
                    `<span class="h-source">${h.source}</span>`;
            }
            item.dataset.seq = h.sequence_num;
            item.addEventListener('click', () => _jumpToSnapshot(fileId, h.sequence_num));
            list.appendChild(item);
        }
        list.dataset.loaded = '1';
    } catch(e) {
        list.innerHTML = '<div style="padding:4px 8px;font-size:9px;color:#ef4444">Ошибка загрузки</div>';
    }
}

/**
 * Toggle history scope: 'file' = per-file GT history, 'all' = cross-file expert_actions timeline.
 */
async function _toggleHistoryScope(fileId, scope, btn) {
    const panel = document.getElementById(`gt-history-${fileId}`);
    if (!panel) return;
    const list = panel.querySelector('.gt-history-list');
    if (!list) return;

    // Toggle active button style
    panel.querySelectorAll('.gt-scope-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.scope === scope);
        b.style.background = b.dataset.scope === scope ? '#334155' : 'transparent';
        b.style.color = b.dataset.scope === scope ? '#cbd5e1' : '#64748b';
    });

    if (scope === 'file') {
        // Reload per-file history
        list.dataset.loaded = '';
        _loadGTHistory(fileId);
        return;
    }

    // Cross-file: fetch from expert_actions API
    list.innerHTML = '<div style="padding:4px 8px;font-size:9px;color:#64748b">Загрузка всех действий...</div>';
    try {
        const r = await fetch('/api/expert/timeline?limit=30&type=tooth_status');
        const d = await r.json();
        if (!d.items || d.items.length === 0) {
            list.innerHTML = '<div style="padding:4px 8px;font-size:9px;color:#64748b">Нет записей</div>';
            return;
        }
        list.innerHTML = '';
        const ACTION_ICONS = {tooth_status:'🦷', crop_override:'📐', rollback:'↩', bulk_prefill:'⚡',
            bridge_link:'🌉', tooth_note:'📝', fdi_correction:'🔗', seg_correction:'✎', field_verify:'✓',
            bbox_resize:'⬜', contour_draw:'✎◎', crop_resize:'📐'};
        for (const item of d.items) {
            const div = document.createElement('div');
            div.className = 'gt-history-item';
            const time = item.created_at ? new Date(item.created_at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'}) : '';
            const date = item.created_at ? new Date(item.created_at).toLocaleDateString('ru',{day:'2-digit',month:'2-digit'}) : '';
            const icon = ACTION_ICONS[item.action_type] || '?';
            const isThisFile = item.file_id === fileId;
            const fileTag = isThisFile ? '' : `<span style="color:#f59e0b;font-size:8px">fid:${item.file_id}</span>`;
            const oldA = item.old_value ? _statusAbbr(item.old_value) : '';
            const newA = item.new_value ? _statusAbbr(item.new_value) : '';
            const arrow = oldA && newA ? ' → ' : '';

            div.innerHTML = `<span class="h-time" title="${date}">${time}</span>` +
                `<span>${icon}</span>` +
                `<span class="h-fdi">${item.fdi||''}</span>` +
                (oldA ? `<span class="h-old">${oldA}</span>` : '') +
                (arrow ? `<span class="h-arrow">→</span>` : '') +
                (newA ? `<span class="h-new">${newA}</span>` : '') +
                ` ${fileTag}`;
            div.style.background = isThisFile ? 'rgba(37,99,235,0.08)' : '';
            list.appendChild(div);
        }
        list.innerHTML += `<div style="padding:4px 8px;font-size:9px;text-align:center"><a href="/expert-dashboard" target="_blank" style="color:#60a5fa">Показать все ${d.total} записей ↗</a></div>`;
    } catch(e) {
        list.innerHTML = '<div style="padding:4px 8px;font-size:9px;color:#ef4444">Ошибка загрузки</div>';
    }
}

function _statusAbbr(val) {
    if (!val) return '\u2014';
    const map = {'present':'Инт','missing':'Нет','implant':'Имп','impl_restored':'ИК',
        'impl_fixture':'ИФ','impl_cover':'ИЗ','impl_healing':'ИФ','impl_abutment':'Имп',
        'crowned':'Кор','endo':'Эн','restored':'Пл',
        'caries':'Кар','bridge':'Мост','root_piece':'Кор'};
    const primary = val.includes('+') ? val.split('+').pop().split(':')[0] : val.split(':')[0];
    return map[primary] || val.substring(0, 6);
}

// ── Time Machine ──
let _tmState = {}; // fileId → {active, seq, maxSeq, cache:{seq→formula}}

async function _jumpToSnapshot(fileId, seq) {
    const tm = _tmState[fileId] || { active: false, cache: {} };
    _tmState[fileId] = tm;

    // Fetch snapshot
    let snapshot = tm.cache[seq];
    if (!snapshot) {
        try {
            const r = await fetch(`/api/darwin/ground-truth/${fileId}/snapshot/${seq}`);
            snapshot = await r.json();
            tm.cache[seq] = snapshot;
        } catch(e) { console.warn('Snapshot fetch failed:', e); return; }
    }

    if (!snapshot.formula) return;

    // Enter Time Machine mode
    tm.active = true;
    tm.seq = seq;

    // Apply snapshot to visual cells (without saving)
    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;

    // Store live GT for restoration
    if (!tm.liveGT) {
        tm.liveGT = JSON.parse(JSON.stringify(arenaGroundTruth[fileId] || {}));
        tm.liveBL = JSON.parse(JSON.stringify(arenaBridgeLinks[fileId] || {}));
        tm.liveTN = JSON.parse(JSON.stringify(arenaToothNotes[fileId] || {}));
    }

    // Apply snapshot to arenaGroundTruth temporarily
    arenaGroundTruth[fileId] = snapshot.formula;
    arenaBridgeLinks[fileId] = snapshot.bridge_links || {};
    arenaToothNotes[fileId] = snapshot.tooth_notes || {};

    // Re-render the GT row
    _refreshArenaGTRow(fileId);

    // Show Time Machine controls
    _showTimeMachineBar(fileId, seq, snapshot);

    // Add visual indicator
    const gtRow = caseEl.querySelector('.arena-formula-row[data-algo="GT"],.arena-formula-row.ground-truth');
    if (gtRow) gtRow.classList.add('gt-tm-active');
}

function _exitTimeMachine(fileId) {
    const tm = _tmState[fileId];
    if (!tm || !tm.active) return;

    // Restore live GT
    arenaGroundTruth[fileId] = tm.liveGT;
    arenaBridgeLinks[fileId] = tm.liveBL || {};
    arenaToothNotes[fileId] = tm.liveTN || {};
    tm.active = false;
    tm.liveGT = null;

    // Re-render
    _refreshArenaGTRow(fileId);

    // Remove Time Machine UI
    const tmBar = document.getElementById(`gt-tm-bar-${fileId}`);
    if (tmBar) tmBar.remove();

    const caseEl = document.getElementById(`arena-case-${fileId}`);
    const gtRow = caseEl?.querySelector('.arena-formula-row[data-algo="GT"],.arena-formula-row.ground-truth');
    if (gtRow) gtRow.classList.remove('gt-tm-active');
}

async function _restoreSnapshot(fileId, seq) {
    try {
        const r = await fetch(`/api/darwin/ground-truth/${fileId}/rollback/${seq}`, {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({session_id: _gtSessionId})
        });
        const d = await r.json();
        if (d.formula) {
            arenaGroundTruth[fileId] = d.formula;
            arenaBridgeLinks[fileId] = d.bridge_links || {};
            arenaToothNotes[fileId] = d.tooth_notes || {};
            // Reset TM state
            const tm = _tmState[fileId];
            if (tm) { tm.active = false; tm.liveGT = null; }
            _refreshArenaGTRow(fileId);
            const tmBar = document.getElementById(`gt-tm-bar-${fileId}`);
            if (tmBar) tmBar.remove();
            _updateSaveStatus(fileId, 'saved');
        }
    } catch(e) { console.warn('Rollback failed:', e); }
}

function _showTimeMachineBar(fileId, seq, snapshot) {
    let tmBar = document.getElementById(`gt-tm-bar-${fileId}`);
    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;

    const gtRow = caseEl.querySelector('.arena-formula-row[data-algo="GT"],.arena-formula-row.ground-truth');
    if (!gtRow) return;

    if (!tmBar) {
        tmBar = document.createElement('div');
        tmBar.id = `gt-tm-bar-${fileId}`;
        tmBar.className = 'gt-timemachine';
        gtRow.parentElement.insertBefore(tmBar, gtRow);
    }

    const time = snapshot.created_at ? new Date(snapshot.created_at).toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '';
    const date = snapshot.created_at ? new Date(snapshot.created_at).toLocaleDateString('ru',{day:'2-digit',month:'2-digit'}) : '';

    tmBar.innerHTML =
        `<span class="tm-label">Time machine</span>` +
        `<button class="tm-btn" onclick="_exitTimeMachine(${fileId})" title="Return to current version">\u2715 Exit</button>` +
        `<span class="tm-label">${date} ${time} | step ${seq}</span>` +
        `<button class="tm-btn" onclick="_restoreSnapshot(${fileId},${seq})" title="Restore this version">\u21ba Restore</button>`;
}

/**
 * Open Time Machine — triggered by visible button in GT row.
 * Opens history panel & jumps to latest snapshot.
 */
async function _openTimeMachine(fileId) {
    // Toggle the history panel — second click closes it. Previously the
    // function force-set panel.open = true so a second click did nothing.
    const panel = document.getElementById(`gt-history-${fileId}`);
    if (!panel) return;
    panel.open = !panel.open;
    if (!panel.open) return;        // closing: nothing to load
    // Opening: fetch latest snapshot and jump to it
    try {
        const r = await fetch(`/api/darwin/ground-truth/${fileId}/history?limit=1`);
        const d = await r.json();
        if (d.history && d.history.length > 0) {
            _jumpToSnapshot(fileId, d.history[0].sequence_num);
        } else {
            // No history yet — show message
            const list = panel.querySelector('.gt-history-list');
            if (list) list.innerHTML = '<div style="padding:4px 8px;font-size:9px;color:#64748b">Нет истории изменений</div>';
        }
    } catch(e) {
        console.warn('_openTimeMachine failed:', e);
    }
}

// Helper: refresh GT row visual cells after changing arenaGroundTruth
function _refreshArenaGTRow(fileId) {
    const caseEl = document.getElementById(`arena-case-${fileId}`);
    if (!caseEl) return;
    const gt = arenaGroundTruth[fileId] || {};
    const allCells = caseEl.querySelectorAll('.arena-formula-row.ground-truth .arena-cell');
    allCells.forEach(cell => {
        const fdi = cell.dataset.fdi;
        if (!fdi) return;
        const rawStatus = gt[fdi] || '';
        _updateArenaCellVisual(cell, fdi, rawStatus, fileId);
    });
}

// Update a single arena cell's visual state using existing _rebuildCell / _rebuildCellLayered
function _updateArenaCellVisual(cell, fdi, rawStatus, fileId) {
    if (!rawStatus) {
        // Empty / unmarked tooth
        cell.className = 'arena-cell unmarked';
        cell.dataset.fdi = fdi;
        cell.dataset.file = fileId;
        const svg = toothSvg(34, {}, fdi);
        cell.innerHTML = `<span class="cell-num">${fdi.replace('.','')}</span><span class="note-arrows-wrap">${svg}</span><span class="cell-abbr"></span>`;
        cell.title = `${fdi}: не задан`;
        return;
    }
    const layers = parseToothLayers(rawStatus);
    if (layers.length > 1) {
        _rebuildCellLayered(cell, fdi, layers);
    } else {
        const status = layers[0]?.status || rawStatus.split(':')[0];
        const surfaces = layers[0]?.surfaces || '';
        _rebuildCell(cell, fdi, status, surfaces);
    }
}

// ── Batch GT pre-populate from V5b results ──
async function batchPrepopulateGT(mode) {
    const btn = document.getElementById('batch-gt-btn');
    const status = document.getElementById('batch-gt-status');
    if (btn) btn.disabled = true;
    if (status) status.textContent = mode === 'preview' ? '⏳ Сканирую...' : '⏳ Применяю...';
    try {
        const resp = await fetch('/api/darwin/batch-prepopulate-gt', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ mode, filter: 'no_gt', overwrite: false })
        });
        const data = await resp.json();
        if (data.error) {
            if (status) status.innerHTML = `<span style="color:var(--red)">Ошибка: ${data.error}</span>`;
            return;
        }
        const s = data.summary;
        if (mode === 'preview') {
            const implCount = s.total_implants || 0;
            if (status) status.innerHTML = `Найдено <b>${s.candidates}</b> OPG (${s.total_teeth_mapped} зубов, ${implCount} имплантатов) `;
            // Show apply button
            if (s.candidates > 0) {
                const applyBtn = document.createElement('button');
                applyBtn.className = 'sbx-btn';
                applyBtn.style.cssText = 'color:var(--green);border-color:rgba(34,197,94,0.4);font-size:11px;padding:2px 8px;';
                applyBtn.textContent = `✓ Применить к ${s.candidates}`;
                applyBtn.onclick = () => batchPrepopulateGT('apply');
                status.appendChild(applyBtn);
            }
        } else {
            // Applied
            if (status) status.innerHTML = `<span style="color:var(--green)">✓ Заполнено ${s.applied} OPG (${s.total_teeth_mapped} зубов). Обновляю...</span>`;
            // Reload arena to pick up new GT data
            setTimeout(() => {
                arenaGroundTruth = {};
                localStorage.removeItem('darwin_ground_truth');
                loadArena();
            }, 500);
        }
    } catch(e) {
        console.error('Batch GT error:', e);
        if (status) status.innerHTML = `<span style="color:var(--red)">Ошибка: ${e.message}</span>`;
    } finally {
        if (btn) btn.disabled = false;
    }
}

// ── Batch W0→GT (YOLO+SemiT-SAM) for K08.1 ──
async function batchW0ToGT(mode) {
    const btn = document.getElementById('batch-w0-btn');
    const status = document.getElementById('batch-gt-status');
    if (btn) btn.disabled = true;
    const limit = mode === 'preview' ? 200 : 20;  // apply 20 at a time (SemiT-SAM is slow)
    if (status) status.textContent = mode === 'preview' ? '⏳ Сканирую w0...' : '⏳ SemiT-SAM анализ (~2мин)...';
    try {
        const resp = await fetch('/api/darwin/batch-w0-to-gt', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ mode, filter: 'k081', limit })
        });
        const data = await resp.json();
        if (data.error) {
            if (status) status.innerHTML = `<span style="color:var(--red)">${data.error}</span>`;
            return;
        }
        const s = data.summary;
        if (mode === 'preview') {
            if (status) status.innerHTML = `W0: <b>${s.total_w0}</b> K08.1 OPG (${s.have_semit_cache} кэш, ${s.need_semit_run} нужен SemiT) `;
            if (s.total_w0 > 0) {
                const applyBtn = document.createElement('button');
                applyBtn.className = 'sbx-btn';
                applyBtn.style.cssText = 'color:var(--cyan);border-color:rgba(34,211,238,0.4);font-size:11px;padding:2px 8px;';
                applyBtn.textContent = `✓ Обработать ${Math.min(20, s.total_w0)}`;
                applyBtn.onclick = () => batchW0ToGT('apply');
                status.appendChild(applyBtn);
            }
        } else {
            if (status) status.innerHTML = `<span style="color:var(--cyan)">✓ W0→GT: ${s.applied} OPG обработано. Обновляю...</span>`;
            setTimeout(() => {
                arenaGroundTruth = {};
                localStorage.removeItem('darwin_ground_truth');
                loadArena();
            }, 500);
        }
    } catch(e) {
        console.error('W0→GT error:', e);
        if (status) status.innerHTML = `<span style="color:var(--red)">${e.message}</span>`;
    } finally {
        if (btn) btn.disabled = false;
    }
}

// "🤖" button: prefill GT from AI W5 synthesis
async function prefillGTFromAI(fileId) {
    const btn = document.getElementById(`gt-ai-btn-${fileId}`);
    if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
    try {
        const resp = await fetch(`/api/darwin/ai-hint/${fileId}`);
        const data = await resp.json();

        // ── Auto-analysis queued: waiting for Claude CLI ──
        if (data.auto_analysis === 'queued') {
            const statusEl = document.getElementById(`arena-done-status-${fileId}`);
            if (statusEl) {
                statusEl.innerHTML = `<span style="color:var(--yellow)">⏳ В очереди на анализ. Скажи Клоду «продолжай» — он обработает автоматически.</span>`;
            }
            if (btn) { btn.textContent = '🔄'; btn.disabled = false; }
            _pollAnalysisStatus(fileId);
            return;
        }
        // ── Auto-analysis done but not yet in hint (just completed) ──
        if (data.auto_analysis === 'running') {
            const statusEl = document.getElementById(`arena-done-status-${fileId}`);
            if (statusEl) {
                statusEl.innerHTML = `<span style="color:var(--yellow)">⏳ Анализ выполняется...</span>`;
            }
            if (btn) btn.textContent = '⏳';
            _pollAnalysisStatus(fileId);
            return;
        }

        // ── Auto-analysis error ──
        if (data.auto_analysis === 'error') {
            const statusEl = document.getElementById(`arena-done-status-${fileId}`);
            if (statusEl) {
                statusEl.innerHTML = `<span style="color:var(--red)">Ошибка анализа: ${data.auto_error || 'unknown'}. Попробуйте ещё раз.</span>`;
            }
            if (btn) { btn.textContent = '🤖'; btn.disabled = false; }
            return;
        }

        // ── No data and no auto-analysis available ──
        if (!data.formula || Object.keys(data.formula).length === 0) {
            const statusEl = document.getElementById(`arena-done-status-${fileId}`);
            if (statusEl) {
                statusEl.innerHTML = `<span style="color:var(--text-dim)">Нет данных для подсказки (API недоступен). Разметьте вручную.</span>`;
            }
            if (btn) { btn.textContent = '🤖'; btn.disabled = false; }
            return;
        }

        // ── Got formula — apply it ──
        _applyAIFormula(fileId, data);
    } catch(e) {
        console.error('AI hint error:', e);
        if (btn) { btn.textContent = '🤖'; btn.disabled = false; }
    }
}

// Prefill GT from patient card implant data (FDI positions from dissertation)
async function prefillGTFromCard(fileId) {
    const btn = document.getElementById(`gt-card-btn-${fileId}`);
    if (btn) { btn.textContent = '⏳'; btn.disabled = true; }
    try {
        const resp = await fetch(`/api/darwin/prefill-from-card/${fileId}`);
        const data = await resp.json();
        if (data.error || !data.formula || data.count === 0) {
            const statusEl = document.getElementById(`arena-done-status-${fileId}`);
            if (statusEl) {
                statusEl.innerHTML = `<span style="color:var(--yellow)">Нет данных FDI в карте. Укажите позиции имплантатов в Dissertation Case Viewer.</span>`;
            }
            if (btn) { btn.textContent = '📋'; btn.disabled = false; }
            return;
        }
        // Card data is authoritative for implant positions:
        // 1. Set correct positions to impl_restored
        // 2. Clear wrong implant markers from positions NOT in card
        if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};
        const cardPositions = new Set(Object.keys(data.formula));
        let merged = 0, overwritten = 0, cleared = 0;
        // Step 1: set correct implant positions
        for (const [fdi, status] of Object.entries(data.formula)) {
            const existing = arenaGroundTruth[fileId][fdi];
            if (existing && existing !== status) overwritten++;
            arenaGroundTruth[fileId][fdi] = status;
            merged++;
        }
        // Step 2: clear wrong implant statuses at positions NOT in card
        for (const [fdi, val] of Object.entries(arenaGroundTruth[fileId])) {
            if (fdi.startsWith('_')) continue;
            if (cardPositions.has(fdi)) continue;
            if (typeof val === 'string' && (val === 'implant' || val.startsWith('impl'))) {
                arenaGroundTruth[fileId][fdi] = '';
                cleared++;
            }
        }
        localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
        _debouncedSaveGT(fileId);

        const statusEl = document.getElementById(`arena-done-status-${fileId}`);
        if (statusEl) {
            const systems = Object.entries(data.sources).map(([fdi, sys]) => `${fdi}=${sys || '?'}`).join(', ');
            const owMsg = overwritten > 0 ? `, ${overwritten} исправл.` : '';
            const clMsg = cleared > 0 ? `, ${cleared} ошибочных убрано` : '';
            statusEl.innerHTML = `<span style="color:var(--green)">📋 Из карты: ${merged} имплантатов${owMsg}${clMsg} (${systems}). Проверьте и дополните формулу.</span>`;
        }
        if (btn) { btn.textContent = '📋'; btn.disabled = false; }
        setTimeout(() => loadArena(), 500);
    } catch(e) {
        console.error('Card prefill error:', e);
        if (btn) { btn.textContent = '📋'; btn.disabled = false; }
    }
}

// ═══ Auto-populate GT from YOLO + SemiT-SAM ═══

const _autoPopulatedFiles = new Set();

/**
 * Infer GT status for a single FDI from YOLO detections.
 * Returns string like 'filled', 'impl_restored', 'endo+crowned', or null if no detections.
 */
function _yoloToGTStatus(fdi, fdiMap, detections, semitBboxes) {
    const idxList = fdiMap[fdi] || [];
    const dets = idxList.map(idx => detections.find(d => d.idx === idx)).filter(Boolean);

    if (!dets.length) {
        // No YOLO detections — use SemiT-SAM presence
        return semitBboxes[fdi] ? 'present' : 'missing';
    }

    const classes = dets.map(d => d.cls);
    const hasImplant = classes.includes('Implant');
    const hasCrown = classes.includes('Crown');
    const hasFilling = classes.includes('Filling');
    const hasEndo = classes.includes('Root canal obturation');
    const hasCaries = classes.includes('Caries');
    const hasRoot = classes.includes('Root Piece');

    if (hasImplant) return hasCrown ? 'impl_restored' : 'implant';
    if (hasRoot) return 'root';
    if (hasEndo) {
        const layers = ['endo'];
        if (hasCrown) layers.push('crowned');
        else if (hasFilling) layers.push('filled');
        return layers.join('+');
    }
    if (hasCrown) return 'crowned';
    if (hasFilling) return 'filled';
    if (hasCaries) return 'caries';
    return 'present';
}

/**
 * Auto-populate GT formula from YOLO detections + SemiT-SAM FDI mapping.
 *
 * Two modes:
 * 1. Full populate — GT completely empty → fill all 32 teeth
 * 2. Partial fill — GT partially filled → fill only empty cells, detect conflicts
 *
 * Called from _initCropCarousel() after YOLO data is loaded.
 * Returns true if any changes made.
 */
function autoPopulateGTFromYOLO(fileId) {
    if (_autoPopulatedFiles.has(+fileId)) return false;

    const data = _yoloCache[fileId];
    if (!data || !data.semit_bboxes || Object.keys(data.semit_bboxes).length < 3) return false;

    const { semit_bboxes: semitBboxes, fdi_map: fdiMap, detections } = data;
    const gt = arenaGroundTruth[fileId] || {};
    const filledCount = Object.entries(gt).filter(([k, v]) => !k.startsWith('_') && v).length;
    const isFullEmpty = filledCount === 0;

    _autoPopulatedFiles.add(+fileId);

    // All 32 FDI positions
    const ALL_FDI = [];
    for (let q = 1; q <= 4; q++)
        for (let t = 1; t <= 8; t++)
            ALL_FDI.push(`${q}.${t}`);

    let filled = 0, conflicts = 0;
    const conflictList = [];

    if (isFullEmpty) {
        // Mode 1: full populate
        const formula = {};
        for (const fdi of ALL_FDI) {
            formula[fdi] = _yoloToGTStatus(fdi, fdiMap || {}, detections || [], semitBboxes);
        }
        arenaGroundTruth[fileId] = formula;
        filled = Object.values(formula).filter(v => v && v !== 'missing' && v !== 'present').length;
    } else {
        // Mode 2: fill empty cells + detect conflicts
        if (!arenaGroundTruth[fileId]) arenaGroundTruth[fileId] = {};

        for (const fdi of ALL_FDI) {
            const yoloStatus = _yoloToGTStatus(fdi, fdiMap || {}, detections || [], semitBboxes);
            const existing = arenaGroundTruth[fileId][fdi] || '';

            if (!existing) {
                // Empty cell → fill from YOLO
                arenaGroundTruth[fileId][fdi] = yoloStatus;
                filled++;
            } else {
                // Existing value → check for conflict
                const _IMPL = new Set(['implant','impl_restored','impl_healing','impl_cover']);
                const _MISSING = new Set(['missing','']);
                const gtIsPresent = !_MISSING.has(existing);
                const yoloIsPresent = !_MISSING.has(yoloStatus);
                // Conflict: GT=missing but YOLO sees something (or vice versa)
                if (gtIsPresent !== yoloIsPresent) {
                    conflicts++;
                    conflictList.push({ fdi, gt: existing, yolo: yoloStatus });
                }
            }
        }
    }

    // Save if changes made
    if (filled > 0 || isFullEmpty) {
        localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
        _debouncedSaveGT(fileId, null, null, null, 'yolo_auto_populate');
    }

    // Store conflicts for rendering (accessible by tooth-picker)
    window._yoloConflicts = window._yoloConflicts || {};
    window._yoloConflicts[fileId] = conflictList;

    // Build status message
    const gt2 = arenaGroundTruth[fileId] || {};
    const pathology = Object.values(gt2).filter(v => v && v !== 'missing' && v !== 'present').length;
    const missing = Object.values(gt2).filter(v => v === 'missing').length;
    const present = Object.values(gt2).filter(v => v === 'present').length;

    let statusMsg = '';
    if (isFullEmpty) {
        statusMsg = `<span style="color:var(--cyan)">🔬 YOLO авто: ${pathology} с патологией, ${present} интактных, ${missing} отсутств. Проверьте ✓</span>`;
    } else if (filled > 0 || conflicts > 0) {
        const parts = [];
        if (filled > 0) parts.push(`<span style="color:var(--cyan)">+${filled} дозаполнено</span>`);
        if (conflicts > 0) parts.push(`<span style="color:var(--yellow)">⚠ ${conflicts} конфл. GT↔YOLO</span>`);
        statusMsg = `🔬 ${parts.join(' | ')}`;
    }

    // Re-render Arena, then show status + conflict markers
    if (filled > 0 || isFullEmpty) {
        setTimeout(() => {
            loadArena().then(() => {
                setTimeout(() => {
                    if (statusMsg) {
                        const statusEl = document.getElementById(`arena-done-status-${fileId}`);
                        if (statusEl) statusEl.innerHTML = statusMsg;
                    }
                    _renderYoloConflicts(fileId);
                }, 300);
            });
        }, 600);
    } else if (conflicts > 0) {
        // No new fills but conflicts found — mark them without reloading
        setTimeout(() => _renderYoloConflicts(fileId), 200);
    }

    return filled > 0 || isFullEmpty;
}

/**
 * Render conflict markers on GT cells where GT contradicts YOLO.
 * Adds a yellow triangle to cells where GT=missing but YOLO detected objects (or vice versa).
 */
function _renderYoloConflicts(fileId) {
    const conflicts = (window._yoloConflicts || {})[fileId];
    if (!conflicts || !conflicts.length) return;

    for (const { fdi, gt, yolo } of conflicts) {
        const cell = document.querySelector(
            `.arena-formula-row.ground-truth .arena-cell[data-file="${fileId}"][data-fdi="${fdi}"]`
        );
        if (!cell) continue;
        // Skip if already marked
        if (cell.querySelector('.yolo-conflict-badge')) continue;

        const badge = document.createElement('span');
        badge.className = 'yolo-conflict-badge';
        badge.title = `Конфликт: GT="${gt}" но YOLO видит "${yolo}"`;
        badge.textContent = '⚠';
        badge.style.cssText = 'position:absolute;top:1px;right:1px;color:#f59e0b;font-size:10px;z-index:5;cursor:help;text-shadow:0 0 3px rgba(0,0,0,0.8)';
        cell.style.position = 'relative';
        cell.appendChild(badge);
    }
}

// Apply AI formula result to GT
function _applyAIFormula(fileId, data) {
    arenaGroundTruth[fileId] = data.formula;
    localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));
    _debouncedSaveGT(fileId);

    const statusEl = document.getElementById(`arena-done-status-${fileId}`);
    if (statusEl) {
        const n = Object.values(data.formula).filter(v => v).length;
        const conf = data.confidence ? ` (conf ${(data.confidence*100).toFixed(0)}%)` : '';
        const src = data.source?.startsWith('arena_leader:')
            ? `🏆 ${data.leader_codename} (Gen ${data.leader_generation})`
            : data.source === 'w5_synthesis' ? '🔬 Pipeline W5' : '🤖 AutoAnalyzer';
        statusEl.innerHTML = `<span style="color:var(--purple)">🤖 ${src} предзаполнил ${n}/32 зубов${conf}. Проверьте и исправьте, затем ✓</span>`;
    }

    const btn = document.getElementById(`gt-ai-btn-${fileId}`);
    if (btn) { btn.textContent = '🤖'; btn.disabled = false; }
    setTimeout(() => loadArena(), 500);
}

// Poll auto-analysis status until done
let _pollTimers = {};
function _pollAnalysisStatus(fileId) {
    if (_pollTimers[fileId]) clearTimeout(_pollTimers[fileId]);

    _pollTimers[fileId] = setTimeout(async () => {
        try {
            const resp = await fetch(`/api/darwin/analysis-status/${fileId}`);
            const st = await resp.json();

            if (st.status === 'done') {
                // Analysis complete — fetch the hint again (now has data)
                delete _pollTimers[fileId];
                const statusEl = document.getElementById(`arena-done-status-${fileId}`);
                if (statusEl) statusEl.innerHTML = `<span style="color:var(--green)">✓ Анализ завершён! Загружаю формулу...</span>`;
                // Re-fetch hint — now should have data
                const hintResp = await fetch(`/api/darwin/ai-hint/${fileId}`);
                const hintData = await hintResp.json();
                if (hintData.formula && Object.keys(hintData.formula).length > 0) {
                    _applyAIFormula(fileId, hintData);
                } else {
                    if (statusEl) statusEl.innerHTML = `<span style="color:var(--yellow)">Анализ завершён, но формула пуста. Нажмите 🤖 повторно.</span>`;
                    const btn = document.getElementById(`gt-ai-btn-${fileId}`);
                    if (btn) { btn.textContent = '🤖'; btn.disabled = false; }
                }
            } else if (st.status === 'error') {
                delete _pollTimers[fileId];
                const statusEl = document.getElementById(`arena-done-status-${fileId}`);
                if (statusEl) statusEl.innerHTML = `<span style="color:var(--red)">Ошибка: ${st.error || 'unknown'}</span>`;
                const btn = document.getElementById(`gt-ai-btn-${fileId}`);
                if (btn) { btn.textContent = '🤖'; btn.disabled = false; }
            } else {
                // Still running/queued — keep polling
                const statusEl = document.getElementById(`arena-done-status-${fileId}`);
                if (statusEl) {
                    const dots = '.'.repeat((Date.now() / 500 | 0) % 4);
                    statusEl.innerHTML = `<span style="color:var(--yellow)">⏳ AI анализирует${dots}</span>`;
                }
                _pollAnalysisStatus(fileId);
            }
        } catch(e) {
            console.error('Poll error:', e);
            _pollAnalysisStatus(fileId); // retry
        }
    }, 3000); // poll every 3 seconds
}

// "Готово" button: save GT to DB, rescore algorithms, re-sort rows
async function arenaConfirmGT(fileId) {
    const statusEl = document.getElementById(`arena-done-status-${fileId}`);
    const gt = arenaGroundTruth[fileId] || {};
    const filled = Object.values(gt).filter(v => v).length;

    if (filled < 10) {
        if (statusEl) statusEl.textContent = `Заполнено только ${filled}/32 — разметьте больше зубов`;
        return;
    }

    if (statusEl) statusEl.textContent = 'Сохранение и пересчёт...';

    try {
        const resp = await fetch(`/api/darwin/ground-truth/${fileId}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({formula: gt, bridge_links: arenaBridgeLinks[fileId] || {}, tooth_notes: arenaToothNotes[fileId] || {}, root_data: arenaRootData[fileId] || {}})
        });
        const data = await resp.json();

        // Also persist in localStorage as backup
        localStorage.setItem('darwin_ground_truth', JSON.stringify(arenaGroundTruth));

        if (statusEl) statusEl.textContent = `Сохранено! Пересчитано ${data.rescored || 0} алгоритмов.`;

        // Re-sort algorithm rows by score (from DB response)
        if (data.results && data.results.length > 0) {
            const formulasDiv = document.getElementById(`arena-formulas-${fileId}`);
            if (formulasDiv) {
                // Keep GT row, rebuild algo rows sorted by new scores
                const gtRow = formulasDiv.querySelector('.arena-formula-row.ground-truth');
                const sorted = data.results.sort((a, b) => (b.score || 0) - (a.score || 0));

                let highHtml = '', lowHtml = '', lowCnt = 0;
                for (let si = 0; si < sorted.length; si++) {
                    const a = sorted[si];
                    // Build sublabel with breakdown
                    const bd = a.score_breakdown || {};
                    let subParts = [`${((a.score||0)*100).toFixed(0)}%`];
                    if (bd.tooth_status != null) subParts.push(`🦷${(bd.tooth_status*100).toFixed(0)}`);
                    if (bd.root_canal != null) subParts.push(`🔬${(bd.root_canal*100).toFixed(0)}`);
                    if (bd.pathology != null) subParts.push(`📍${(bd.pathology*100).toFixed(0)}`);
                    const rowH = renderArenaFormulaRow('algo', a.codename,
                        subParts.join(' · '),
                        a.formula, gt, fileId, false, a.codename, a.score, a.is_champion, a.is_alive);
                    const isLeader = si === 0;
                    if (a.score != null && a.score <= 0.75 && !isLeader) {
                        lowHtml += rowH; lowCnt++;
                    } else {
                        highHtml += rowH;
                    }
                }
                let lowSection = '';
                if (lowCnt > 0) {
                    lowSection = `<details class="arena-low-score"><summary>ещё ${lowCnt} алгоритм${lowCnt > 4 ? 'ов' : lowCnt > 1 ? 'а' : ''} (≤75%) ▾</summary>${lowHtml}</details>`;
                }

                formulasDiv.innerHTML = '';
                if (gtRow) formulasDiv.appendChild(gtRow);
                formulasDiv.insertAdjacentHTML('beforeend', highHtml + lowSection);
            }
        }

        // Flash success
        const btn = document.querySelector(`#arena-case-${fileId} .arena-done-btn`);
        if (btn) {
            btn.style.background = 'var(--surface2)';
            btn.textContent = '✅ Сохранено';
            setTimeout(() => { btn.style.background = 'var(--green)'; btn.textContent = '✅ Готово — сохранить и пересчитать'; }, 3000);
        }
    } catch(e) {
        if (statusEl) statusEl.textContent = 'Ошибка: ' + e.message;
    }
}
