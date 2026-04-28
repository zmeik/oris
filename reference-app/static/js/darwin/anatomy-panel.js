/* ============================================================
   anatomy-panel.js
   Reference-app implementation of paper §2.1 Figure 2 caption:
     "side panel — the anatomical landmarks block with mandibular
      canal, mental foramen, maxillary sinus, and TMJ findings"

   Production behaviour reference:
     patient_viewer/templates/panorama_segmentation.html — each
     anatomical structure carries a `bbox` (x1,y1,x2,y2 in OPG
     natural coords); hovering an entry in the side list calls
     highlightAnatomyBbox(bbox) which draws a dashed rectangle on
     the OPG canvas; clicking pins the highlight (sticky) until the
     user clicks elsewhere. We mirror that here: each anatomy
     <li> hover/click toggles a dashed rectangle on a transparent
     SVG overlay placed absolutely over the production
     <img id="arena-opg-img-{fileId}">. This way reviewers SEE
     where on the panorama each landmark sits, instead of just
     reading status text.

   Plus a compact change-history strip below the formula (the
   "bottom — change history with sequence numbers and source
   provenance" piece of Figure 2 caption).
   ============================================================ */
(function () {
  'use strict';

  // ──────────────────────────────────────────────
  // Region descriptors. Mirrors dental_scene_graph.py contents but
  // condensed to what the side panel offers.
  // ──────────────────────────────────────────────
  const REGIONS = [
    {
      id: 'mandibular_canal',
      label: 'Mandibular canal',
      sides: ['right', 'left'],
      colour: '#22d3ee',                    // cyan — like production "Каналы"
      icon: '〰',
      fields: [
        { key: 'visibility', label: 'Visibility',
          options: ['clearly_visible', 'partially_visible', 'not_visible', 'obliterated'] },
        { key: 'distance_to_alveolar_crest_mm', label: 'Dist. to crest (mm)', input: 'number', step: 0.1 },
      ],
    },
    {
      id: 'mental_foramen',
      label: 'Mental foramen',
      sides: ['right', 'left'],
      colour: '#22d3ee',
      icon: '◯',
      fields: [
        { key: 'visibility', label: 'Visibility',
          options: ['clearly_visible', 'partially_visible', 'not_visible'] },
        { key: 'shape', label: 'Shape',
          options: ['round', 'oval', 'irregular'] },
      ],
    },
    {
      id: 'maxillary_sinus',
      label: 'Maxillary sinus',
      sides: ['right', 'left'],
      colour: '#60a5fa',                    // blue — like production "Синусы"
      icon: '🫁',
      fields: [
        { key: 'status', label: 'Status',
          options: ['normal', 'mucosal_thickening', 'polyp', 'antrolith',
                    'opacification', 'sinusitis', 'oroantral_communication'] },
        { key: 'distance_to_crest_mm', label: 'Dist. to crest (mm)', input: 'number', step: 0.1 },
      ],
    },
    {
      id: 'tmj_condyle',
      label: 'TMJ condyle',
      sides: ['right', 'left'],
      colour: '#a78bfa',                    // purple — like production "TMJ"
      icon: '🦴',
      bbox_key_template: 'tmj_{side}_condyle',
      fields: [
        { key: 'morphology', label: 'Morphology',
          options: ['normal', 'flattened', 'rounded', 'pointed', 'deformed'] },
        { key: 'surface_contour', label: 'Surface',
          options: ['smooth', 'irregular', 'erosive'] },
      ],
    },
    {
      id: 'airway_pharyngeal',
      label: 'Pharyngeal airway',
      sides: null,
      colour: '#fbbf24',                    // amber — airway distinct from rest
      icon: '🌬',
      fields: [
        { key: 'shape', label: 'Shape',
          options: ['normal', 'narrowed', 'obliterated'] },
      ],
    },
  ];

  function regionKey(region, side) {
    if (region.bbox_key_template) {
      return region.bbox_key_template.replace('{side}', side || '');
    }
    return side ? `${region.id}_${side}` : region.id;
  }

  // ──────────────────────────────────────────────
  // State
  // ──────────────────────────────────────────────
  let _state = {
    fileId: null,
    anatomy: {},
    pinned: null,             // { recordKey, region, side } or null
    expanded: null,           // recordKey of the card whose <details> is open
    dirty: false,
  };

  function currentFileId() {
    if (typeof window.ARENA_FILE_ID === 'number') return window.ARENA_FILE_ID;
    if (window.AppState && typeof window.AppState.fileId === 'number') return window.AppState.fileId;
    const m = /file_id=(\d+)/.exec(location.search);
    if (m) return parseInt(m[1], 10);
    return 1001;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  // ──────────────────────────────────────────────
  // OPG overlay — paint a dashed rectangle over the panorama at the
  // anatomy bbox, in the same way production highlightAnatomyBbox does.
  // We attach an SVG layer once per OPG <img>; the SVG renders bboxes
  // in the image's natural coordinate space via viewBox so it scales
  // automatically as the user resizes the window.
  // ──────────────────────────────────────────────
  function ensureOverlay(fileId) {
    const img = document.getElementById(`arena-opg-img-${fileId}`);
    if (!img) return null;
    // Read natural dimensions; fall back to 2000×1058 if image not yet loaded.
    const W = img.naturalWidth || 2000;
    const H = img.naturalHeight || 1058;
    let svg = document.getElementById(`anatomy-overlay-${fileId}`);
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.id = `anatomy-overlay-${fileId}`;
      svg.classList.add('apan-opg-overlay');
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      svg.setAttribute('preserveAspectRatio', img.style.objectFit === 'contain' ? 'xMidYMid meet' : 'xMidYMid slice');
      // Fallback: match the rendering most production setups use
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      svg.style.position    = 'absolute';
      svg.style.inset       = '0';
      svg.style.width       = '100%';
      svg.style.height      = '100%';
      svg.style.pointerEvents = 'none';
      svg.style.zIndex      = '5';
      // Insert as sibling so it overlays the image without breaking layout
      const parent = img.parentElement;
      if (parent) {
        if (getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
        parent.appendChild(svg);
      }
    } else {
      // Image dimensions may have updated since first paint
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    }
    return svg;
  }

  function clearOverlay(fileId) {
    const svg = document.getElementById(`anatomy-overlay-${fileId}`);
    if (svg) svg.innerHTML = '';
  }

  function paintBbox(fileId, bbox, region, sticky = false) {
    const svg = ensureOverlay(fileId);
    if (!svg || !bbox) return;
    svg.innerHTML = '';
    const x = bbox.x1, y = bbox.y1;
    const w = bbox.x2 - bbox.x1, h = bbox.y2 - bbox.y1;
    const colour = region?.colour || '#22d3ee';
    const dash = sticky ? '' : '8 4';

    // Rectangle
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('x', x);
    rect.setAttribute('y', y);
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('fill', 'none');
    rect.setAttribute('stroke', colour);
    rect.setAttribute('stroke-width', '4');
    if (dash) rect.setAttribute('stroke-dasharray', dash);
    rect.setAttribute('opacity', '0.95');
    svg.appendChild(rect);

    // Label box
    if (region) {
      const labelBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      labelBg.setAttribute('x', x);
      labelBg.setAttribute('y', Math.max(0, y - 22));
      labelBg.setAttribute('width', Math.max(120, region.label.length * 9 + 20));
      labelBg.setAttribute('height', 20);
      labelBg.setAttribute('fill', colour);
      labelBg.setAttribute('opacity', '0.85');
      labelBg.setAttribute('rx', '2');
      svg.appendChild(labelBg);

      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', x + 6);
      text.setAttribute('y', Math.max(14, y - 7));
      text.setAttribute('fill', '#0b1220');
      text.setAttribute('font-family', 'IBM Plex Mono, monospace');
      text.setAttribute('font-size', '13');
      text.setAttribute('font-weight', '600');
      text.textContent = region.label;
      svg.appendChild(text);
    }
  }

  // ──────────────────────────────────────────────
  // Side-panel render (compact: structure list + status pills,
  // expandable details on click). Hover triggers the OPG overlay.
  // ──────────────────────────────────────────────
  function regionStatusPill(region, side) {
    const recordKey = regionKey(region, side);
    const r = _state.anatomy[recordKey] || {};
    const statusField = region.fields.find(f =>
      ['visibility', 'status', 'morphology', 'shape'].includes(f.key)
    );
    if (!statusField || !r[statusField.key]) {
      return '<span class="apan-status apan-status-empty">—</span>';
    }
    const v = r[statusField.key];
    const cls = (v === 'normal' || v === 'clearly_visible' || v === 'intact')
      ? 'apan-status-ok'
      : (v === 'not_visible' || v === 'obliterated' || v === 'perforated' ||
         v === 'opacification' || v === 'sinusitis')
        ? 'apan-status-bad'
        : 'apan-status-warn';
    return `<span class="apan-status ${cls}">${v.replace(/_/g, ' ')}</span>`;
  }

  function fieldEditor(recordKey, field) {
    const record = _state.anatomy[recordKey] || {};
    const v = record[field.key] ?? '';
    if (field.input === 'number') {
      return `<input type="number" step="${field.step || 1}" value="${v}"
                     data-region="${recordKey}" data-field="${field.key}"
                     class="apan-input">`;
    }
    if (field.input === 'text') {
      return `<input type="text" value="${escapeHtml(v)}"
                     data-region="${recordKey}" data-field="${field.key}"
                     class="apan-input">`;
    }
    const opts = field.options.map(opt =>
      `<option value="${opt}"${opt === v ? ' selected' : ''}>${opt.replace(/_/g, ' ')}</option>`
    ).join('');
    return `<select data-region="${recordKey}" data-field="${field.key}" class="apan-input">
              <option value=""${!v ? ' selected' : ''}>—</option>${opts}
            </select>`;
  }

  function renderRegionRow(region, side) {
    const recordKey = regionKey(region, side);
    const sideLabel = side ? side[0].toUpperCase() + side.slice(1) : '—';
    const expanded  = (_state.expanded === recordKey);
    const pinned    = (_state.pinned && _state.pinned.recordKey === recordKey);

    const editors = region.fields.map(field => `
      <div class="apan-field">
        <label>${field.label}</label>
        ${fieldEditor(recordKey, field)}
      </div>
    `).join('');

    return `
      <div class="apan-row${pinned ? ' pinned' : ''}" data-record-key="${recordKey}"
           data-region-id="${region.id}" ${side ? `data-side="${side}"` : ''}>
        <div class="apan-row-head">
          <span class="apan-row-icon" style="background:${region.colour}22;color:${region.colour}">${region.icon}</span>
          <span class="apan-row-label">${region.label}</span>
          ${side ? `<span class="apan-row-side">${sideLabel}</span>` : ''}
          <span class="apan-row-spacer"></span>
          ${regionStatusPill(region, side)}
          <button class="apan-row-toggle" type="button" aria-expanded="${expanded}">
            ${expanded ? '▾' : '▸'}
          </button>
        </div>
        <div class="apan-row-body" style="display:${expanded ? 'grid' : 'none'}">
          ${editors}
        </div>
      </div>`;
  }

  function render() {
    const host = document.getElementById('anatomy-panel-root');
    if (!host) return;
    const fileId = _state.fileId;
    const groups = REGIONS.map(region => {
      const rows = (region.sides || [null]).map(side => renderRegionRow(region, side)).join('');
      return `<div class="apan-group" data-region-id="${region.id}"><div class="apan-group-rows">${rows}</div></div>`;
    }).join('');
    host.innerHTML = `
      <div class="apan-head">
        <span class="apan-title">Anatomical landmarks</span>
        <span class="apan-hint">hover a row to highlight on the panorama · click to pin / unpin · ▸ to edit</span>
        <span class="apan-meta">file_id <b>${fileId ?? '—'}</b></span>
        <button class="apan-save" id="apan-save" disabled>Save anatomy</button>
      </div>
      ${groups}
    `;
    bindRows(host);
  }

  function bindRows(host) {
    host.querySelectorAll('.apan-row').forEach(rowEl => {
      const recordKey = rowEl.dataset.recordKey;
      const regionId  = rowEl.dataset.regionId;
      const side      = rowEl.dataset.side || null;
      const region    = REGIONS.find(r => r.id === regionId);

      // Hover → highlight on OPG (unless something is pinned)
      rowEl.addEventListener('mouseenter', () => {
        if (_state.pinned) return;
        const bbox = (_state.anatomy[recordKey] || {}).bbox;
        if (bbox && _state.fileId) paintBbox(_state.fileId, bbox, region, false);
      });
      rowEl.addEventListener('mouseleave', () => {
        if (_state.pinned) return;
        if (_state.fileId) clearOverlay(_state.fileId);
      });

      // Click on row body / icon / label / status → toggle pin
      const headEl = rowEl.querySelector('.apan-row-head');
      headEl.addEventListener('click', e => {
        if (e.target.closest('.apan-row-toggle')) return;       // expand/collapse handled separately
        const bbox = (_state.anatomy[recordKey] || {}).bbox;
        if (_state.pinned && _state.pinned.recordKey === recordKey) {
          _state.pinned = null;
          if (_state.fileId) clearOverlay(_state.fileId);
        } else {
          _state.pinned = { recordKey, region, side };
          if (bbox && _state.fileId) paintBbox(_state.fileId, bbox, region, true);
        }
        render();
      });

      // Toggle expand → show editors
      rowEl.querySelector('.apan-row-toggle').addEventListener('click', e => {
        e.stopPropagation();
        _state.expanded = (_state.expanded === recordKey) ? null : recordKey;
        render();
      });
    });

    host.querySelectorAll('.apan-input').forEach(el => {
      el.addEventListener('change', () => {
        const recordKey = el.dataset.region;
        const fieldKey  = el.dataset.field;
        const v = el.type === 'number'
          ? (el.value === '' ? null : parseFloat(el.value))
          : el.value;
        _state.anatomy[recordKey] = { ...(_state.anatomy[recordKey] || {}) };
        if (v === '' || v === null) delete _state.anatomy[recordKey][fieldKey];
        else _state.anatomy[recordKey][fieldKey] = v;
        // never strip the bbox during edits; preserve it
        if (Object.keys(_state.anatomy[recordKey]).length === 0) {
          delete _state.anatomy[recordKey];
        }
        _state.dirty = true;
        const sb = document.getElementById('apan-save');
        if (sb) sb.disabled = false;
        render();
      });
    });

    const sb = document.getElementById('apan-save');
    if (sb) sb.addEventListener('click', save);
  }

  // ──────────────────────────────────────────────
  // Load / save
  // ──────────────────────────────────────────────
  async function load(fileId) {
    _state.fileId = fileId;
    _state.pinned = null;
    _state.expanded = null;
    try {
      const r = await fetch(`/api/anatomy/${fileId}`);
      const d = await r.json();
      _state.anatomy = d.anatomical_landmarks || {};
    } catch (err) {
      console.warn('anatomy load failed', err);
      _state.anatomy = {};
    }
    _state.dirty = false;
    if (_state.fileId) clearOverlay(_state.fileId);
    render();
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
      if (typeof window.__chistRefresh === 'function') window.__chistRefresh();
    } catch (err) {
      btn.textContent = 'Save failed';
      btn.disabled = false;
      console.error('anatomy save failed', err);
    }
  }

  // ──────────────────────────────────────────────
  // Change-history strip — paper §2.1 Figure 2 caption "bottom"
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
  // Boot — poll for ARENA_FILE_ID until production darwin populates it
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
  window.__anatomyReload = () => load(currentFileId());
  document.addEventListener('DOMContentLoaded', tick);
})();
