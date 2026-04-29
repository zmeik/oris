// metrics.js — Metrics table, McNemar, MMORAL benchmark, confusion drilldown
// Extracted from darwin_lab.html lines 2544–2830
// ═══════════════════════════════════════════════════════════════

// ── Metrics view: Precision/Recall/F1 per algorithm ──
async function loadMetrics() {
    const content = document.getElementById('metrics-content');
    if (!content) return;
    content.innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center">Загрузка...</div>';

    const cat = document.getElementById('metrics-category-filter').value;
    const minN = document.getElementById('metrics-min-n').checked ? 5 : 0;
    const url = cat ? `/api/darwin/metrics?category=${cat}` : '/api/darwin/metrics';

    try {
        const r = await fetch(url);
        const d = await r.json();
        let algos = d.algorithms || [];
        // Filter by min n
        algos = algos.filter(a => a.n_files_compared >= minN);

        if (algos.length === 0) {
            content.innerHTML = '<div style="color:var(--text-dim);padding:20px;text-align:center">Нет данных. Заполните ground truth в Арене для нескольких файлов.</div>';
            return;
        }

        // Build table: rows = algorithms, columns = categories
        const cats = cat ? [cat] : ['tooth_present','missing','implant','crowned','endo','restored','caries','bridge','root_only'];
        let html = '<table style="width:100%;border-collapse:collapse;font-size:11px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.1)">';
        html += '<thead><tr style="background:rgba(255,255,255,0.05)"><th style="text-align:left;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.15)">Алгоритм</th><th style="text-align:right;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.15)">N снимков</th>';
        for (const c of cats) html += `<th style="text-align:center;padding:6px 8px;border-bottom:1px solid rgba(255,255,255,0.15)">${c}</th>`;
        html += '</tr></thead><tbody>';

        // Sort algorithms by tooth_present F1 desc (best first)
        algos.sort((a, b) => (b.metrics.tooth_present?.f1 || 0) - (a.metrics.tooth_present?.f1 || 0));

        for (const a of algos) {
            html += `<tr style="border-bottom:1px solid rgba(255,255,255,0.05)">`;
            html += `<td style="padding:6px 8px;font-weight:600;color:#ddd">${a.algorithm}</td>`;
            html += `<td style="padding:6px 8px;text-align:right;color:var(--text-dim)">${a.n_files_compared}</td>`;
            for (const c of cats) {
                const m = a.metrics[c];
                if (!m || m.n === 0 || (m.tp + m.fn === 0)) {
                    html += `<td style="padding:6px 8px;text-align:center;color:#444">—</td>`;
                    continue;
                }
                const f1 = m.f1;
                const p = m.precision;
                const r = m.recall;
                // Color code F1: >0.8 green, 0.6-0.8 yellow, <0.6 red
                const color = f1 === null ? '#666' : f1 >= 0.8 ? '#22c55e' : f1 >= 0.6 ? '#eab308' : '#ef4444';
                const f1Str = f1 === null ? '—' : f1.toFixed(2);
                const tooltip = `TP=${m.tp} FP=${m.fp} FN=${m.fn} TN=${m.tn}\nPrecision=${p ?? '—'}\nRecall=${r ?? '—'}\nF1=${f1Str}`;
                html += `<td style="padding:6px 8px;text-align:center;color:${color};font-weight:600;cursor:pointer;text-decoration:underline dotted" title="${tooltip}&#10;Click → drilldown" onclick="showConfusionDrilldown('${a.algorithm.replace(/'/g,"\\'")}','${c}')">${f1Str}</td>`;
            }
            html += '</tr>';
        }
        html += '</tbody></table>';

        // Legend
        html += '<div style="margin-top:14px;font-size:11px;color:var(--text-dim);display:flex;gap:18px;flex-wrap:wrap">';
        html += '<span><b style="color:#22c55e">●</b> F1 ≥ 0.80 — отлично</span>';
        html += '<span><b style="color:#eab308">●</b> 0.60 ≤ F1 &lt; 0.80 — приемлемо</span>';
        html += '<span><b style="color:#ef4444">●</b> F1 &lt; 0.60 — слабо</span>';
        html += '<span><b style="color:#444">—</b> нет данных (0 положительных случаев)</span>';
        html += '<span style="margin-left:auto">Hover ячейки → детали (TP/FP/FN/TN)</span>';
        html += '</div>';

        // McNemar comparison tool (A2)
        html += '<div style="margin-top:20px;padding:14px;border:1px solid var(--border);border-radius:8px;background:var(--surface2,#1a1a2e)">';
        html += '<h4 style="margin:0 0 10px 0;font-size:13px;color:var(--text)">📊 McNemar χ² — сравнение алгоритмов</h4>';
        html += '<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">';
        html += `<select id="mcnemar-algo-a" style="padding:4px 8px;border-radius:4px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:11px">`;
        for (const a of d.algorithms) html += `<option value="${a.algorithm}">${a.algorithm}</option>`;
        html += '</select>';
        html += '<span style="color:var(--text-dim);font-size:11px">vs</span>';
        html += `<select id="mcnemar-algo-b" style="padding:4px 8px;border-radius:4px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:11px">`;
        for (const a of d.algorithms) html += `<option value="${a.algorithm}" ${a.algorithm === 'Darwin_C1' ? 'selected' : ''}>${a.algorithm}</option>`;
        html += '</select>';
        html += `<select id="mcnemar-cat" style="padding:4px 8px;border-radius:4px;background:var(--surface);border:1px solid var(--border);color:var(--text);font-size:11px">`;
        html += ['tooth_present','missing','implant','crowned','endo','restored','caries'].map(c => `<option value="${c}">${c}</option>`).join('');
        html += '</select>';
        html += '<button onclick="_runMcNemar()" style="padding:4px 12px;border-radius:4px;background:#6366f1;border:none;color:#fff;font-size:11px;cursor:pointer">Сравнить</button>';
        html += '<span id="mcnemar-result" style="font-size:11px;color:var(--text-dim)"></span>';
        html += '</div></div>';

        content.innerHTML = html;
    } catch(e) {
        content.innerHTML = `<div style="color:var(--red);padding:20px;text-align:center">Ошибка: ${e.message}</div>`;
    }

    // Also load MMoral external benchmark results
    loadMmoralBenchmark();
}

async function loadMmoralBenchmark() {
    const el = document.getElementById('mmoral-content');
    if (!el) return;
    el.innerHTML = '<div style="color:var(--text-dim)">Загрузка...</div>';
    try {
        const r = await fetch('/api/darwin/mmoral-results');
        if (!r.ok) {
            el.innerHTML = '<div style="color:var(--text-dim)">MMoral бенчмарк не запущен. Запустите: <code>cd patient_viewer && python3 mmoral_runner.py status</code></div>';
            return;
        }
        const d = await r.json();

        // Header: overall accuracy
        const accColor = d.accuracy >= 0.9 ? '#22c55e' : d.accuracy >= 0.75 ? '#eab308' : '#ef4444';
        let html = `<div style="display:flex;gap:24px;align-items:baseline;margin-bottom:12px">`;
        html += `<div><span style="font-size:24px;font-weight:700;color:${accColor}">${(d.accuracy*100).toFixed(1)}%</span> <span style="color:var(--text-dim);font-size:11px">общая точность</span></div>`;
        html += `<div style="color:var(--text-dim)">${d.correct} / ${d.answered} верных ответов</div>`;
        html += `<div style="color:var(--text-dim)">из ${d.total_questions} вопросов в датасете</div>`;
        html += `</div>`;

        // Per-category breakdown
        if (d.by_category && d.by_category.length > 0) {
            html += `<table style="width:100%;border-collapse:collapse;font-size:11px">`;
            html += `<thead><tr style="background:rgba(255,255,255,0.05)"><th style="text-align:left;padding:4px 8px">Категория</th><th style="text-align:right;padding:4px 8px">N</th><th style="text-align:right;padding:4px 8px">Верных</th><th style="text-align:right;padding:4px 8px">Accuracy</th></tr></thead><tbody>`;
            for (const c of d.by_category) {
                const aColor = c.accuracy >= 0.9 ? '#22c55e' : c.accuracy >= 0.75 ? '#eab308' : '#ef4444';
                html += `<tr><td style="padding:4px 8px">${c.category}</td><td style="padding:4px 8px;text-align:right;color:var(--text-dim)">${c.n}</td><td style="padding:4px 8px;text-align:right;color:var(--text-dim)">${c.correct}</td><td style="padding:4px 8px;text-align:right;color:${aColor};font-weight:600">${(c.accuracy*100).toFixed(1)}%</td></tr>`;
            }
            html += `</tbody></table>`;
        }
        html += `<div style="margin-top:8px;color:var(--text-dim);font-size:10px">Источник: ${d.source}</div>`;

        el.innerHTML = html;
    } catch(e) {
        el.innerHTML = `<div style="color:var(--red)">Ошибка: ${e.message}</div>`;
    }
}

// ═══════════════════════════════════════════════════════════════
// McNEMAR χ² TEST (A2 — для диссертации)
// ═══════════════════════════════════════════════════════════════

async function _runMcNemar() {
    const a = document.getElementById('mcnemar-algo-a').value;
    const b = document.getElementById('mcnemar-algo-b').value;
    const cat = document.getElementById('mcnemar-cat').value;
    const out = document.getElementById('mcnemar-result');
    if (a === b) { out.innerHTML = '<span style="color:#eab308">Выберите разные алгоритмы</span>'; return; }
    out.innerHTML = '<span style="color:var(--text-dim)">Считаю...</span>';

    try {
        const r = await fetch(`/api/darwin/mcnemar/${encodeURIComponent(a)}/${encodeURIComponent(b)}/${cat}`);
        const d = await r.json();
        if (d.error) { out.innerHTML = `<span style="color:#ef4444">${d.error}</span>`; return; }

        const pStr = d.p_value !== null ? d.p_value.toFixed(4) : '—';
        const sigColor = d.significant ? '#22c55e' : '#ef4444';
        const sigText = d.significant ? `✓ значимо (p=${pStr})` : `✗ не значимо (p=${pStr})`;
        const betterText = d.better ? ` → <b>${d.better}</b> лучше` : '';

        out.innerHTML = `<span style="color:${sigColor}">${sigText}</span>` +
            `<span style="color:var(--text-dim);margin-left:8px">χ²=${d.chi2 ?? '—'} · n=${d.n_paired} · A✓B✗=${d.n10} · A✗B✓=${d.n01}</span>` +
            `<span style="color:var(--text);margin-left:4px">${betterText}</span>`;
    } catch(e) {
        out.innerHTML = `<span style="color:#ef4444">Ошибка: ${e.message}</span>`;
    }
}


// ═══════════════════════════════════════════════════════════════
// CONFUSION MATRIX DRILLDOWN (A1 — для диссертации)
// ═══════════════════════════════════════════════════════════════

async function showConfusionDrilldown(algo, category) {
    let dlg = document.getElementById('confusion-drilldown-dlg');
    if (!dlg) {
        dlg = document.createElement('div');
        dlg.id = 'confusion-drilldown-dlg';
        dlg.className = 'confusion-overlay';
        dlg.innerHTML = `<div class="confusion-box">
            <div class="cm-header">
                <h3 style="font-size:14px;margin:0" id="cm-title">Loading...</h3>
                <button onclick="this.closest('.confusion-overlay').style.display='none'"
                    style="background:none;border:none;color:var(--text-dim);font-size:18px;cursor:pointer">&#10005;</button>
            </div>
            <div id="cm-body" style="flex:1;overflow-y:auto">
                <div style="text-align:center;padding:20px;color:var(--text-dim)">Загрузка...</div>
            </div>
        </div>`;
        document.body.appendChild(dlg);
        dlg.addEventListener('click', e => { if (e.target === dlg) dlg.style.display = 'none'; });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && dlg.style.display === 'flex') { dlg.style.display = 'none'; e.stopPropagation(); }
        }, true);
    }
    dlg.style.display = 'flex';
    document.getElementById('cm-title').textContent = `${algo} / ${category}`;
    document.getElementById('cm-body').innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-dim)">Загрузка...</div>';

    try {
        const resp = await fetch(`/api/darwin/confusion/${encodeURIComponent(algo)}/${encodeURIComponent(category)}`);
        if (!resp.ok) {
            const err = await resp.json().catch(() => ({}));
            document.getElementById('cm-body').innerHTML = `<div style="color:#ef4444;padding:20px;text-align:center">Ошибка: ${err.error || resp.statusText}</div>`;
            return;
        }
        const d = await resp.json();
        _renderConfusionDrilldown(d);
    } catch(e) {
        document.getElementById('cm-body').innerHTML = `<div style="color:#ef4444;padding:20px;text-align:center">Ошибка: ${e.message}</div>`;
    }
}

function _renderConfusionDrilldown(d) {
    const m = d.metrics;
    const body = document.getElementById('cm-body');
    const fmtPct = v => v === null ? '—' : (v * 100).toFixed(1) + '%';

    // 1. 2x2 confusion matrix
    let html = '<div class="cm-grid" style="max-width:320px;margin-bottom:16px">';
    html += '<div class="cm-cell label"></div><div class="cm-cell label">Pred +</div><div class="cm-cell label">Pred −</div>';
    html += '<div class="cm-cell label">GT +</div>';
    html += `<div class="cm-cell tp">TP<br><b>${m.tp}</b></div>`;
    html += `<div class="cm-cell fn">FN<br><b>${m.fn}</b></div>`;
    html += '<div class="cm-cell label">GT −</div>';
    html += `<div class="cm-cell fp">FP<br><b>${m.fp}</b></div>`;
    html += `<div class="cm-cell tn">TN<br><b>${m.tn}</b></div>`;
    html += '</div>';

    // 2. Summary metrics
    const f1Color = m.f1 === null ? '#666' : m.f1 >= 0.8 ? '#22c55e' : m.f1 >= 0.6 ? '#eab308' : '#ef4444';
    html += '<div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;font-size:12px">';
    html += `<div><b style="color:#22c55e">${fmtPct(m.precision)}</b> Precision</div>`;
    html += `<div><b style="color:#3b82f6">${fmtPct(m.recall)}</b> Recall</div>`;
    html += `<div><b style="color:#a855f7">${fmtPct(m.specificity)}</b> Specificity</div>`;
    html += `<div><b style="color:${f1Color}">${fmtPct(m.f1)}</b> F1</div>`;
    html += `<div style="color:var(--text-dim)">${d.n_files} снимков &middot; ${m.n} зубов</div>`;
    html += '</div>';

    // 3. Tabs
    const fpCount = d.files.reduce((s, f) => s + f.errors.filter(e => e.classification === 'FP').length, 0);
    const fnCount = d.files.reduce((s, f) => s + f.errors.filter(e => e.classification === 'FN').length, 0);
    html += '<div class="cm-tabs">';
    html += `<button class="active" onclick="_cmFilterTab(this,'all')">Все ошибки (${fpCount + fnCount})</button>`;
    html += `<button onclick="_cmFilterTab(this,'FP')">FP — ложные + (${fpCount})</button>`;
    html += `<button onclick="_cmFilterTab(this,'FN')">FN — пропуски (${fnCount})</button>`;
    html += '</div>';

    // 4. File list
    html += '<div class="cm-file-list" id="cm-file-list">';
    html += d.files.length ? _renderCmFiles(d.files, 'all') : '<div style="text-align:center;padding:20px;color:#22c55e;font-weight:600">Нет ошибок — идеальный результат!</div>';
    html += '</div>';

    body.innerHTML = html;
    window._cmDrilldownFiles = d.files;
}

function _renderCmFiles(files, filter) {
    let html = '';
    for (const f of files) {
        const errors = filter === 'all' ? f.errors : f.errors.filter(e => e.classification === filter);
        if (!errors.length) continue;
        html += `<div class="cm-file-item" onclick="_cmGoToArena(${f.file_id})">`;
        html += `<div style="display:flex;justify-content:space-between;align-items:center">`;
        html += `<span style="font-weight:600;color:var(--text)">${f.patient_name}</span>`;
        html += `<span style="color:var(--text-dim);font-size:10px">file ${f.file_id} &middot; ${f.teeth_compared} зубов</span>`;
        html += '</div><div style="margin-top:3px">';
        for (const e of errors) {
            const cls = e.classification.toLowerCase();
            const esc = s => (s||'—').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
            const tip = e.classification === 'FP'
                ? `${e.fdi}: algo=${esc(e.pred_status)} GT=${esc(e.gt_status)}`
                : `${e.fdi}: GT=${esc(e.gt_status)} algo=${esc(e.pred_status)}`;
            html += `<span class="cm-tooth ${cls}" title="${tip}">${e.fdi} ${e.classification}</span>`;
        }
        html += '</div></div>';
    }
    return html || '<div style="text-align:center;padding:12px;color:var(--text-dim)">Нет ошибок данного типа</div>';
}

function _cmFilterTab(btn, filter) {
    btn.closest('.cm-tabs').querySelectorAll('button').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const list = document.getElementById('cm-file-list');
    if (list && window._cmDrilldownFiles) list.innerHTML = _renderCmFiles(window._cmDrilldownFiles, filter);
}

function _cmGoToArena(fileId) {
    const dlg = document.getElementById('confusion-drilldown-dlg');
    if (dlg) dlg.style.display = 'none';
    showView('arena');
    setTimeout(() => {
        const el = document.querySelector(`[data-file-id="${fileId}"]`) || document.getElementById(`arena-case-${fileId}`);
        if (el) { el.scrollIntoView({behavior:'smooth',block:'start'}); el.style.outline='2px solid #6366f1'; setTimeout(()=>el.style.outline='',4000); }
    }, 1500);
}
