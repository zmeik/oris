/* ============================================================
   anatomy-panel.js
   Reference-app side panel for paper §2.1 Figure 2 caption:
     "side panel — the anatomical landmarks block with mandibular
      canal, mental foramen, maxillary sinus, and TMJ findings"
   Plus a compact change-history strip (the "bottom — change history
   with sequence numbers and source provenance" piece).
   No framework — vanilla JS, hooked into the production darwin
   ARENA_FILE_ID global so it follows the user's case selector.
   ============================================================ */
(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // Region descriptors. Mirrors dental_scene_graph.py contents but
  // condensed to what the UI offers as editable fields.
  // ──────────────────────────────────────────────
  const REGIONS = [
    {
      id: 'mandibular_canal',
      label: 'Mandibular canal',
      sides: ['right', 'left'],
      fields: [
        { key: 'visibility', label: 'Visibility',
          options: ['clearly_visible', 'partially_visible', 'not_visible', 'obliterated'] },
        { key: 'course', label: 'Course',
          options: ['normal', 'lingual_loop', 'anterior_loop', 'bifid', 'trifid'] },
        { key: 'distance_to_alveolar_crest_mm', label: 'Dist. to crest (mm)', input: 'number', step: 0.1 },
      ],
    },
    {
      id: 'mental_foramen',
      label: 'Mental foramen',
      sides: ['right', 'left'],
      fields: [
        { key: 'visibility', label: 'Visibility',
          options: ['clearly_visible', 'partially_visible', 'not_visible'] },
        { key: 'location_fdi', label: 'Location (FDI)', input: 'text' },
        { key: 'shape', label: 'Shape',
          options: ['round', 'oval', 'irregular'] },
      ],
    },
    {
      id: 'maxillary_sinus',
      label: 'Maxillary sinus',
      sides: ['right', 'left'],
      fields: [
        { key: 'status', label: 'Status',
          options: ['normal', 'mucosal_thickening', 'polyp', 'antrolith',
                    'opacification', 'sinusitis', 'oroantral_communication'] },
        { key: 'floor_integrity', label: 'Floor',
          options: ['intact', 'perforated', 'uncertain'] },
        { key: 'pneumatization', label: 'Pneumatization',
          options: ['normal', 'increased', 'septated'] },
        { key: 'distance_to_crest_mm', label: 'Dist. to crest (mm)', input: 'number', step: 0.1 },
      ],
    },
    {
      id: 'tmj_condyle',
      label: 'TMJ condyle',
      sides: ['right', 'left'],
      fields: [
        { key: 'morphology', label: 'Morphology',
          options: ['normal', 'flattened', 'rounded', 'pointed', 'deformed'] },
        { key: 'surface_contour', label: 'Surface',
          options: ['smooth', 'irregular', 'erosive'] },
        { key: 'bone_density', label: 'Density',
          options: ['normal', 'sclerotic', 'osteoporotic'] },
      ],
    },
    {
      id: 'airway_pharyngeal',
      label: 'Pharyngeal airway',
      sides: null,
      fields: [
        { key: 'shape', label: 'Shape',
          options: ['normal', 'narrowed', 'obliterated'] },
        { key: 'tongue_position', label: 'Tongue',
          options: ['normal', 'elevated', 'retropositioned'] },
      ],
    },
  ];

  // ──────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────
  let _state = { fileId: null, anatomy: {}, dirty: false };

  function currentFileId() {
    if (typeof window.ARENA_FILE_ID === 'number') return window.ARENA_FILE_ID;
    if (window.AppState && typeof window.AppState.fileId === 'number') return window.AppState.fileId;
    const m = /file_id=(\d+)/.exec(location.search);
    if (m) return parseInt(m[1], 10);
    return 1001;
  }

  // ──────────────────────────────────────────────
  // Render helpers
  // ──────────────────────────────────────────────
  function regionKey(region, side) {
    return side ? `${region.id}_${side}` : region.id;
  }

  function fieldEditor(region, side, field) {
    const recordKey = regionKey(region, side);
    const record = _state.anatomy[recordKey] || {};
    const v = record[field.key] ?? '';

    if (field.input === 'number') {
      return `<input type="number" step="${field.step || 1}" value="${v}"
                     data-region="${recordKey}" data-field="${field.key}"
                     class="apan-input">`;
    }
    if (field.input === 'text') {
      return `<input type="text" value="${escapeHtml(String(v))}"
                     data-region="${recordKey}" data-field="${field.key}"
                     class="apan-input">`;
    }
    // dropdown
    const opts = field.options.map(opt =>
      `<option value="${opt}"${opt === v ? ' selected' : ''}>${opt.replace(/_/g, ' ')}</option>`
    ).join('');
    return `<select data-region="${recordKey}" data-field="${field.key}" class="apan-input">
              <option value=""${!v ? ' selected' : ''}>—</option>${opts}
            </select>`;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function regionStatusPill(region, side) {
    const recordKey = regionKey(region, side);
    const r = _state.anatomy[recordKey] || {};
    // Find a representative "status" field to summarise
    const statusField = region.fields.find(f =>
      ['visibility', 'status', 'morphology', 'shape'].includes(f.key)
    );
    if (!statusField || !r[statusField.key]) {
      return '<span class="apan-status apan-status-empty">—</span>';
    }
    const v = r[statusField.key];
    const cls = (v === 'normal' || v === 'clearly_visible' || v === 'intact')
      ? 'apan-status-ok'
      : (v === 'not_visible' || v === 'obliterated' || v === 'perforated' || v === 'opacification' || v === 'sinusitis')
        ? 'apan-status-bad'
        : 'apan-status-warn';
    return `<span class="apan-status ${cls}">${v.replace(/_/g, ' ')}</span>`;
  }

  function renderRegionCard(region) {
    const sideRows = (region.sides || [null]).map(side => {
      const sideLabel = side ? side[0].toUpperCase() + side.slice(1) : '—';
      const fields = region.fields.map(field => `
        <div class="apan-field">
          <label>${field.label}</label>
          ${fieldEditor(region, side, field)}
        </div>
      `).join('');
      return `
        <details class="apan-side" ${(_state.openCard === regionKey(region, side)) ? 'open' : ''}>
          <summary>
            <span class="apan-side-label">${sideLabel}</span>
            ${regionStatusPill(region, side)}
            <span class="apan-summary-spacer"></span>
            <span class="apan-summary-toggle">▾</span>
          </summary>
          <div class="apan-fields">${fields}</div>
        </details>`;
    }).join('');
    return `
      <div class="apan-card" data-region-id="${region.id}">
        <header class="apan-card-head">${region.label}</header>
        ${sideRows}
      </div>`;
  }

  function renderRoot(host) {
    host.innerHTML = `
      <div class="apan-head">
        <span class="apan-title">Anatomical findings</span>
        <span class="apan-meta" id="apan-meta">file_id <b id="apan-file-id">—</b></span>
        <button class="apan-save" id="apan-save" disabled>Save anatomy</button>
      </div>
      <div class="apan-grid">
        ${REGIONS.map(renderRegionCard).join('')}
      </div>
    `;
    document.getElementById('apan-file-id').textContent = _state.fileId;
    bindEditors(host);
  }

  function bindEditors(host) {
    host.querySelectorAll('.apan-input').forEach(el => {
      el.addEventListener('change', () => {
        const recordKey = el.dataset.region;
        const fieldKey  = el.dataset.field;
        const v = el.type === 'number'
          ? (el.value === '' ? null : parseFloat(el.value))
          : el.value;
        _state.anatomy[recordKey] = { ..._state.anatomy[recordKey] };
        if (v === '' || v === null) {
          delete _state.anatomy[recordKey][fieldKey];
        } else {
          _state.anatomy[recordKey][fieldKey] = v;
        }
        if (Object.keys(_state.anatomy[recordKey]).length === 0) {
          delete _state.anatomy[recordKey];
        }
        _state.dirty = true;
        document.getElementById('apan-save').disabled = false;
        // Re-render only the relevant card to refresh the summary pill
        // without losing focus elsewhere; cheap full re-render is OK at
        // this size (≤ 10 cards).
        const focusedKey = el.dataset.region + '|' + el.dataset.field;
        renderRoot(host);
        const sel = host.querySelector(`[data-region="${el.dataset.region}"][data-field="${el.dataset.field}"]`);
        if (sel) sel.focus();
      });
    });

    document.getElementById('apan-save').addEventListener('click', save);
  }

  async function load(fileId) {
    _state.fileId = fileId;
    try {
      const r = await fetch(`/api/anatomy/${fileId}`);
      const d = await r.json();
      _state.anatomy = d.anatomical_landmarks || {};
    } catch (err) {
      console.warn('anatomy load failed', err);
      _state.anatomy = {};
    }
    _state.dirty = false;
    const host = document.getElementById('anatomy-panel-root');
    if (host) renderRoot(host);
  }

  async function save() {
    if (!_state.fileId) return;
    const btn = document.getElementById('apan-save');
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const r = await fetch(`/api/anatomy/${_state.fileId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ anatomical_landmarks: _state.anatomy }),
      });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      _state.dirty = false;
      btn.textContent = 'Saved ✓';
      setTimeout(() => { btn.textContent = 'Save anatomy'; }, 1400);
      // Refresh history strip if present
      if (typeof window.__chistRefresh === 'function') window.__chistRefresh();
    } catch (err) {
      btn.textContent = 'Save failed';
      btn.disabled = false;
      console.error('anatomy save failed', err);
    }
  }

  // ──────────────────────────────────────────────
  // Change-history strip
  // ──────────────────────────────────────────────
  async function renderHistoryStrip() {
    const host = document.getElementById('change-history-strip');
    if (!host) return;
    const fileId = currentFileId();
    try {
      const r = await fetch(`/api/darwin/ground-truth/${fileId}/history?limit=12`);
      const d = await r.json();
      const rows = (d.history || []).slice(0, 12);
      if (!rows.length) {
        host.innerHTML = '<div class="chist-empty">No edits yet</div>';
        return;
      }
      host.innerHTML = `
        <div class="chist-head">
          <span class="chist-title">Change history</span>
          <span class="chist-meta">${rows.length} recent · file_id ${fileId}</span>
        </div>
        <div class="chist-list">
          ${rows.map(r => {
            const srcCls = r.source === 'ai_prefill' ? 'chist-ai'
                         : r.source === 'ai_prefill_then_manual' ? 'chist-mix'
                         : 'chist-manual';
            const srcLabel = r.source === 'ai_prefill' ? 'AI'
                           : r.source === 'ai_prefill_then_manual' ? 'AI+EXP'
                           : 'EXP';
            const fdi = r.fdi || '—';
            const diff = r.change_type === 'anatomy_update'
              ? `anatomy: ${r.new_value ? r.new_value.slice(0, 60) : ''}`
              : (r.old_value || r.new_value)
                ? `${r.old_value || '∅'} → ${r.new_value || '∅'}`
                : r.change_type;
            return `
              <div class="chist-row">
                <span class="chist-seq">#${r.sequence_num}</span>
                <span class="chist-src ${srcCls}">${srcLabel}</span>
                <span class="chist-fdi">${fdi}</span>
                <span class="chist-diff" title="${escapeHtml(diff)}">${escapeHtml(diff)}</span>
                <span class="chist-time">${(r.created_at || '').slice(11, 19)}</span>
              </div>`;
          }).join('')}
        </div>`;
    } catch (err) {
      host.innerHTML = '<div class="chist-empty">history fetch failed</div>';
    }
  }
  window.__chistRefresh = renderHistoryStrip;

  // ──────────────────────────────────────────────
  // Boot — wait until production arena-core sets ARENA_FILE_ID
  // (it does so once the sandbox file list has loaded)
  // ──────────────────────────────────────────────
  let _lastFileId = null;
  function tick() {
    const id = currentFileId();
    if (id && id !== _lastFileId) {
      _lastFileId = id;
      load(id);
      renderHistoryStrip();
    }
  }
  setInterval(tick, 1500);
  // Also expose for manual trigger by other modules
  window.__anatomyReload = () => load(currentFileId());
  document.addEventListener('DOMContentLoaded', tick);
})();
