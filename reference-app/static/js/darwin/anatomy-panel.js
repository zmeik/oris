/* ============================================================
   anatomy-panel.js — change-history strip ONLY
   ============================================================
   The original (commit 820ef81) version of this file shipped a
   bbox-overlay anatomy summary in the bottom of /play. Reviewer
   feedback: now that /play/anatomy/<file_id> exists as a dedicated
   full-page editor (commit dcdb10d), the in-play summary duplicates
   it. So this file shrank to its other role — populating the
   change-history strip on /play with sequence_num + source pills
   for both tooth and anatomy edits, matching the paper Figure 2
   caption "bottom — change history with sequence numbers and
   source provenance".
   ============================================================ */
(function () {
  'use strict';

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
  }

  function currentFileId() {
    if (typeof window.ARENA_FILE_ID === 'number') return window.ARENA_FILE_ID;
    if (window.AppState && typeof window.AppState.fileId === 'number') return window.AppState.fileId;
    const m = /file_id=(\d+)/.exec(location.search);
    if (m) return parseInt(m[1], 10);
    return 1001;
  }

  // ──────────────────────────────────────────────
  // Change-history strip (paper §2.1 Figure 2 caption, "bottom")
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
            const fdi = r.fdi || (r.change_type && r.change_type.startsWith('anatomy') ? '🦴' : '—');
            let diff;
            if (r.change_type === 'anatomy_template_update') {
              diff = `anatomy template update: ${r.new_value ? r.new_value.slice(0, 60) : ''}`;
            } else if (r.change_type === 'anatomy_update') {
              diff = `anatomy: ${r.new_value ? r.new_value.slice(0, 60) : ''}`;
            } else if (r.old_value || r.new_value) {
              diff = `${r.old_value || '∅'} → ${r.new_value || '∅'}`;
            } else {
              diff = r.change_type;
            }
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
  // Exposed so other modules (e.g. the GT save flow in tooth-picker.js,
  // or the anatomy editor in another tab via postMessage if we add it
  // later) can request a refresh.
  window.__chistRefresh = renderHistoryStrip;

  // ──────────────────────────────────────────────
  // Boot — poll for ARENA_FILE_ID until production darwin populates it
  // ──────────────────────────────────────────────
  let _lastFileId = null;
  function tick() {
    const id = currentFileId();
    if (id && id !== _lastFileId) {
      _lastFileId = id;
      renderHistoryStrip();
    }
  }
  setInterval(tick, 1500);
  document.addEventListener('DOMContentLoaded', tick);
})();
