// tree-view.js — Init, D3 tree, sidebar, detail, tooltips, view navigation
// Extracted from darwin_lab.html lines 1865–2542
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// DATA & STATE
// ═══════════════════════════════════════════════════════════════
let allNodes = [];
let selectedId = null;
let currentLayout = 'horizontal';
let currentNotation = 'fdi';    // 'fdi' | 'universal' | 'palmer'
let lastAssessmentData = null;  // cached for re-render on notation switch

// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
async function init() {
    const resp = await fetch('/api/darwin/tree');
    const data = await resp.json();
    allNodes = data.nodes;
    renderSidebar();
    renderTree();
    document.getElementById('tree-info').textContent =
        `${allNodes.length} алгоритмов · Gen 0–${Math.max(...allNodes.map(n=>n.generation||0))} · ${allNodes.filter(n=>n.is_alive).length} живых`;
}

// ═══════════════════════════════════════════════════════════════
// SIDEBAR
// ═══════════════════════════════════════════════════════════════
function renderSidebar() {
    const list = document.getElementById('algo-list');
    list.innerHTML = allNodes.map(n => `
        <div class="algo-card ${selectedId === n.id ? 'selected' : ''} ${!n.is_alive ? 'dead' : ''}"
             onclick="selectNode(${n.id})"
             onmouseenter="showNodeTooltip(${n.id}, event)"
             onmouseleave="hideNodeTooltip()">
            <div class="name">
                ${n.is_champion ? '⭐' : !n.is_alive ? '☠️' : verdictIcon(n.verdict)}
                ${n.codename || n.name}
            </div>
            <div class="codename">Gen ${n.generation||0}/${n.branch||'?'} · ${n.images} img · ${n.mutation_type||'seed'}</div>
            <div class="metrics">
                <span class="badge ${n.verdict || ''}">${verdictLabel(n.verdict)}</span>
                <span>conf ${(n.confidence||0).toFixed(2)}</span>
                ${n.score_human != null ? `<span style="color:${n.score_human>=0.6?'var(--green)':n.score_human>=0.4?'var(--yellow)':'var(--red)'}">${(n.score_human*100).toFixed(0)}%</span>` : ''}
            </div>
        </div>
    `).join('');
}

function verdictIcon(v) {
    if (v === 'success') return '🟢';
    if (v === 'partial_success') return '🟡';
    if (v === 'failure') return '⚪';
    return '⚫';
}
function verdictLabel(v) {
    const map = {success:'УСПЕХ', partial_success:'ЧАСТИЧНО', failure:'ПРОВАЛ', inconclusive:'?'};
    return map[v] || v || '—';
}

// ═══════════════════════════════════════════════════════════════
// D3 TREE
// ═══════════════════════════════════════════════════════════════
function renderTree() {
    const svg = d3.select('#tree-svg');
    svg.selectAll('*').remove();

    const container = document.getElementById('tree-area');
    const W = container.clientWidth;
    const H = container.clientHeight;

    // Build hierarchy — if no parent, all are children of virtual root
    const root = { id: 'root', name: 'Pipeline', codename: 'Origin', children: [] };
    const byId = {};
    allNodes.forEach(n => { byId[n.id] = {...n, children: []}; });

    allNodes.forEach(n => {
        if (n.parent_id && byId[n.parent_id]) {
            byId[n.parent_id].children.push(byId[n.id]);
        } else {
            root.children.push(byId[n.id]);
        }
    });

    const hierarchy = d3.hierarchy(root);
    const margin = {top:60, right:40, bottom:60, left:100};

    let treeLayout;
    if (currentLayout === 'radial') {
        treeLayout = d3.tree().size([2 * Math.PI, Math.min(W,H)/2 - 80]);
    } else if (currentLayout === 'vertical') {
        treeLayout = d3.tree().size([W - margin.left - margin.right, H - margin.top - margin.bottom]);
    } else {
        treeLayout = d3.tree().size([H - margin.top - margin.bottom, W - margin.left - margin.right - 160]);
    }

    treeLayout(hierarchy);

    const g = svg.append('g');

    if (currentLayout === 'radial') {
        g.attr('transform', `translate(${W/2},${H/2})`);

        // Links
        g.selectAll('.link')
            .data(hierarchy.links().filter(d => d.source.data.id !== 'root'))
            .join('path')
            .attr('class', d => `link ${d.target.data.is_champion ? 'champion-path' : ''} ${!d.target.data.is_alive ? 'dead-branch' : ''}`)
            .attr('d', d3.linkRadial().angle(d => d.x).radius(d => d.y));

        // Nodes
        const node = g.selectAll('.node')
            .data(hierarchy.descendants().filter(d => d.data.id !== 'root'))
            .join('g')
            .attr('class', 'node')
            .attr('transform', d => `rotate(${d.x * 180/Math.PI - 90}) translate(${d.y},0)`)
            .on('click', (e,d) => selectNode(d.data.id));

        node.append('circle')
            .attr('r', d => nodeRadius(d.data))
            .attr('fill', d => nodeColor(d.data))
            .attr('stroke', d => d.data.is_champion ? 'var(--gold)' : 'var(--border)')
            .attr('stroke-width', d => d.data.is_champion ? 3 : 1);

        node.append('text')
            .attr('dy', '0.31em')
            .attr('x', d => d.x < Math.PI ? 20 : -20)
            .attr('text-anchor', d => d.x < Math.PI ? 'start' : 'end')
            .attr('transform', d => d.x >= Math.PI ? 'rotate(180)' : null)
            .text(d => d.data.codename || d.data.name);

    } else {
        const isVert = currentLayout === 'vertical';
        g.attr('transform', `translate(${margin.left},${margin.top})`);

        // Links
        g.selectAll('.link')
            .data(hierarchy.links().filter(d => d.source.data.id !== 'root'))
            .join('path')
            .attr('class', d => `link ${d.target.data.is_champion ? 'champion-path' : ''} ${!d.target.data.is_alive ? 'dead-branch' : ''}`)
            .attr('d', d => {
                if (isVert) {
                    return `M${d.source.x},${d.source.y} C${d.source.x},${(d.source.y+d.target.y)/2} ${d.target.x},${(d.source.y+d.target.y)/2} ${d.target.x},${d.target.y}`;
                }
                return `M${d.source.y},${d.source.x} C${(d.source.y+d.target.y)/2},${d.source.x} ${(d.source.y+d.target.y)/2},${d.target.x} ${d.target.y},${d.target.x}`;
            });

        // Nodes
        const node = g.selectAll('.node')
            .data(hierarchy.descendants().filter(d => d.data.id !== 'root'))
            .join('g')
            .attr('class', 'node')
            .attr('transform', d => isVert ? `translate(${d.x},${d.y})` : `translate(${d.y},${d.x})`)
            .style('cursor', 'pointer')
            .on('click', (e,d) => selectNode(d.data.id));

        node.append('circle')
            .attr('r', d => nodeRadius(d.data))
            .attr('fill', d => nodeColor(d.data))
            .attr('stroke', d => d.data.is_champion ? 'var(--gold)' : 'rgba(255,255,255,0.15)')
            .attr('stroke-width', d => d.data.is_champion ? 3 : 1.5);

        // Labels
        node.append('text')
            .attr('dy', -16)
            .attr('text-anchor', 'middle')
            .style('font-weight', d => d.data.is_champion ? '700' : '400')
            .text(d => d.data.codename || d.data.name);

        node.append('text')
            .attr('class', 'codename-label')
            .attr('dy', isVert ? 28 : 22)
            .attr('text-anchor', 'middle')
            .text(d => `conf ${(d.data.confidence||0).toFixed(2)} · ${d.data.images}img`);

        // Verdict emoji inside circle
        node.append('text')
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .text(d => {
                if (d.data.is_champion) return '★';
                if (d.data.verdict === 'success') return '✓';
                if (d.data.verdict === 'failure') return '✗';
                return '~';
            });
    }

    // Zoom
    const zoom = d3.zoom().scaleExtent([0.3, 3]).on('zoom', e => g.attr('transform', e.transform));
    svg.call(zoom);
    if (currentLayout !== 'radial') {
        svg.call(zoom.transform, d3.zoomIdentity.translate(margin.left, margin.top));
    } else {
        svg.call(zoom.transform, d3.zoomIdentity.translate(W/2, H/2));
    }
}

function nodeRadius(d) {
    const base = 14;
    const conf = d.confidence || 0;
    return base * (0.5 + conf * 0.7);
}

function nodeColor(d) {
    if (d.is_champion) return 'var(--gold)';
    if (!d.is_alive) return 'var(--gray)';
    if (d.verdict === 'success') return 'var(--green)';
    if (d.verdict === 'partial_success') return 'var(--yellow)';
    if (d.verdict === 'failure') return 'var(--red)';
    return 'var(--blue)';
}

function setLayout(layout) {
    currentLayout = layout;
    document.querySelectorAll('.tree-controls button').forEach(b => b.classList.remove('active'));
    event.target.classList.add('active');
    renderTree();
}

// ═══════════════════════════════════════════════════════════════
// DETAIL PANEL
// ═══════════════════════════════════════════════════════════════
async function selectNode(id) {
    if (id === 'root') return;
    selectedId = id;
    renderSidebar();

    const panel = document.getElementById('detail-panel');
    panel.innerHTML = '<div class="empty"><div>Загрузка...</div></div>';

    const resp = await fetch(`/api/darwin/experiment/${id}`);
    const d = await resp.json();
    renderDetail(d);
}

function renderDetail(d) {
    const panel = document.getElementById('detail-panel');

    panel.innerHTML = `
    <div class="exp-card">
        <!-- HEADER -->
        <div class="exp-header">
            <div class="title">${d.codename ? d.codename + ' — ' : ''}${d.algorithm_name}</div>
            <div class="subtitle">${d.experiment_id} · v${d.algorithm_version} · Gen ${d.generation||0} / Branch ${d.branch||'A'} · ${d.images_used} images</div>
            <div class="verdict-row">
                <span class="badge ${d.verdict || ''}">${verdictLabel(d.verdict)}</span>
                ${d.is_champion ? '<span class="badge champion">★ ЧЕМПИОН</span>' : ''}
                ${d.is_alive ? '' : '<span class="badge" style="background:rgba(75,85,99,0.3);color:var(--gray)">ВЫМЕР</span>'}
                <span style="font-size:11px;color:var(--text-dim);margin-left:auto">${d.mutation_type || 'seed'}</span>
            </div>
            <div class="metrics-row">
                <div class="metric-box"><div class="value">${(d.confidence||0).toFixed(2)}</div><div class="label">Confidence</div></div>
                <div class="metric-box"><div class="value">${d.teeth_found||0}</div><div class="label">Зубов</div></div>
                <div class="metric-box"><div class="value">${d.implant_count||0}</div><div class="label">Имплантатов</div></div>
            </div>
            <div class="metrics-row" style="margin-top:6px">
                <div class="metric-box"><div class="value">${d.restoration_count||0}</div><div class="label">Реставрации</div></div>
                <div class="metric-box"><div class="value">${d.pathology_count||0}</div><div class="label">Патологии</div></div>
                <div class="metric-box"><div class="value">${d.duration_ms ? (d.duration_ms/1000).toFixed(0)+'с' : '—'}</div><div class="label">Время</div></div>
            </div>
        </div>

        <!-- TL;DR -->
        ${d.tldr ? `<div class="tldr-box">${d.tldr}</div>` : ''}

        <!-- Tags -->
        ${d.tags && d.tags.length ? `<div class="tag-list">${d.tags.map(t=>`<span class="tag">${t}</span>`).join('')}</div>` : ''}

        <!-- SECTIONS -->
        ${renderSection('🔬', 'Контекст исследования', `
            ${d.problem_statement ? `<div class="label">Проблема</div><p>${d.problem_statement}</p>` : ''}
            ${d.prior_art ? `<div class="label">Предыдущие работы</div><p>${d.prior_art}</p>` : ''}
            ${d.risk_assessment ? `<div class="label">Оценка рисков</div><p>${d.risk_assessment}</p>` : ''}
        `, false)}

        ${renderSection('🎯', 'Гипотеза', `
            ${d.hypothesis ? `<div class="hypothesis-box">${d.hypothesis}
                ${d.hypothesis_outcome ? `<span class="hypothesis-outcome ${d.hypothesis_outcome}">${hypothesisLabel(d.hypothesis_outcome)}</span>` : ''}
            </div>` : ''}
            ${d.rationale ? `<div class="label">Обоснование</div><p>${d.rationale}</p>` : ''}
        `, true)}

        ${renderSection('🧬', 'ДНК алгоритма', `
            ${d.diff_from_parent ? `<div class="label">Diff от родителя</div><div class="diff-box">${formatDiff(d.diff_from_parent)}</div>` : ''}
            ${d.prompt_summary ? `<div class="label">Промпт</div><p>${d.prompt_summary}</p>` : ''}
            ${d.crop_regions ? `<div class="label">Кропы</div><p>${Array.isArray(d.crop_regions) ? d.crop_regions.join(', ') : d.crop_regions}</p>` : ''}
            ${d.filters_used ? `<div class="label">Фильтры</div><p>${Array.isArray(d.filters_used) ? d.filters_used.join(', ') : d.filters_used}</p>` : ''}
            ${d.algorithm_config ? `<div class="label">Конфигурация</div><pre style="font-size:11px;color:var(--text-dim);overflow-x:auto;background:var(--bg);padding:8px;border-radius:4px">${JSON.stringify(d.algorithm_config, null, 2)}</pre>` : ''}
        `, false)}

        ${renderSection('📋', 'Протокол тестирования', `
            ${d.test_case_label ? `<div class="label">Тест-кейс</div><p>${d.test_case_label}</p>` : ''}
            ${d.test_set_description ? `<div class="label">Описание тест-сета</div><p>${d.test_set_description}</p>` : ''}
            ${d.ground_truth_source ? `<div class="label">Ground Truth</div><p>${d.ground_truth_source}</p>` : ''}
        `, false)}

        ${renderSection('📈', 'Результаты', `
            <table class="results-table">
                <tr><th>Метрика</th><th>Значение</th></tr>
                <tr><td>Confidence</td><td>${(d.confidence||0).toFixed(2)}</td></tr>
                <tr><td>Зубов найдено</td><td>${d.teeth_found||0}</td></tr>
                <tr><td>Зубов не найдено</td><td>${d.teeth_missing_count||0}</td></tr>
                <tr><td>Имплантатов</td><td>${d.implant_count||0}</td></tr>
                <tr><td>Реставраций</td><td>${d.restoration_count||0}</td></tr>
                <tr><td>Патологий</td><td>${d.pathology_count||0}</td></tr>
                <tr><td>Токенов</td><td>${d.tokens_used ? d.tokens_used.toLocaleString() : '—'}</td></tr>
                <tr><td>Время</td><td>${d.duration_ms ? (d.duration_ms/1000).toFixed(1)+'с' : '—'}</td></tr>
                <tr><td>Изображений</td><td>${d.images_used||0}</td></tr>
            </table>
        `, true)}

        ${renderSection('⚖️', 'Вердикт и уроки', `
            ${d.verdict_rationale ? `<div class="label">Обоснование вердикта</div><p>${d.verdict_rationale}</p>` : ''}
            ${d.key_findings && d.key_findings.length ? `
                <div class="label">Ключевые открытия</div>
                <ul>${d.key_findings.map(f => `<li class="finding">${f}</li>`).join('')}</ul>
            ` : ''}
            ${d.failure_modes && d.failure_modes.length ? `
                <div class="label">Режимы отказа</div>
                <ul>${d.failure_modes.map(f => `<li class="failure">${f}</li>`).join('')}</ul>
            ` : ''}
            ${d.lessons_learned && d.lessons_learned.length ? `
                <div class="label">Уроки</div>
                <ul>${d.lessons_learned.map(f => `<li class="lesson">${f}</li>`).join('')}</ul>
            ` : ''}
            ${d.recommended_mutations ? `
                <div class="label">Рекомендуемые мутации</div>
                <ul>${(typeof d.recommended_mutations === 'string' ? JSON.parse(d.recommended_mutations) : d.recommended_mutations).map(m => `<li class="mutation">${m.name} (${m.type}, приоритет: ${m.priority})</li>`).join('')}</ul>
            ` : ''}
        `, true)}

        ${renderSection('💰', 'Ресурсы', `
            <table class="results-table">
                <tr><td>API токены</td><td>${d.tokens_used ? d.tokens_used.toLocaleString() : '—'}</td></tr>
                <tr><td>Время</td><td>${d.duration_ms ? (d.duration_ms/1000).toFixed(1)+'с' : '—'}</td></tr>
                <tr><td>Изображений</td><td>${d.images_used||0}</td></tr>
                <tr><td>Эффективность</td><td>${d.duration_ms && d.images_used ? (d.duration_ms/1000/d.images_used).toFixed(1)+'с/img' : '—'}</td></tr>
            </table>
        `, false)}
    </div>`;

    // Setup collapsible sections
    panel.querySelectorAll('.section-header').forEach(h => {
        h.addEventListener('click', () => {
            h.classList.toggle('open');
            h.nextElementSibling.classList.toggle('open');
        });
    });

    // Load visual preview (crops + formula + voting)
    loadExperimentPreview(d.id, d.codename);
}

// ═══════════════════════════════════════════════════════════════
// VISUAL PREVIEW — crops, dental formula, expert voting
// ═══════════════════════════════════════════════════════════════
const _previewCache = {};

async function loadExperimentPreview(expId, codename) {
    const panel = document.getElementById('detail-panel');
    const card = panel.querySelector('.exp-card');
    if (!card) return;

    // Load preview data
    let pv;
    if (_previewCache[expId]) {
        pv = _previewCache[expId];
    } else {
        try {
            const resp = await fetch(`/api/darwin/experiment/${expId}/preview`);
            pv = await resp.json();
            _previewCache[expId] = pv;
        } catch(e) { return; }
    }

    // Insert after header (.exp-header), before sections
    const header = card.querySelector('.exp-header');
    if (!header) return;

    // Remove previous preview if exists
    card.querySelectorAll('.visual-preview').forEach(el => el.remove());

    const previewDiv = document.createElement('div');
    previewDiv.className = 'visual-preview';

    // ── Score bar ──
    const score = pv.score;
    const scoreColor = score >= 0.7 ? 'var(--green)' : score >= 0.4 ? 'var(--yellow)' : 'var(--red)';
    const scoreHtml = score != null ? `
        <div class="score-display">
            <span style="font-size:11px;color:var(--text-dim)">Score</span>
            <div class="score-bar"><div class="score-fill" style="width:${(score*100).toFixed(0)}%;background:${scoreColor}"></div></div>
            <div class="score-value" style="color:${scoreColor}">${(score*100).toFixed(0)}%</div>
        </div>` : '';

    // ── Expert voting ──
    const aliveClass = pv.is_alive ? '' : 'style="opacity:0.5"';
    const votingHtml = `
        <div class="vote-bar">
            <button class="vote-btn boost" onclick="expertVote('${pv.codename}','boost')" title="Добавить +10% к score">
                <span class="vote-icon">👍</span>
                <span class="vote-label">Promising</span>
            </button>
            <button class="vote-btn champion" onclick="expertVote('${pv.codename}','champion')" title="Назначить чемпионом поколения">
                <span class="vote-icon">⭐</span>
                <span class="vote-label">Чемпион</span>
            </button>
            ${pv.is_alive ? `
            <button class="vote-btn kill" onclick="expertVote('${pv.codename}','kill')" title="Убить — не перспективен">
                <span class="vote-icon">💀</span>
                <span class="vote-label">Убить</span>
            </button>` : `
            <button class="vote-btn revive" onclick="expertVote('${pv.codename}','revive')" title="Воскресить — дать второй шанс">
                <span class="vote-icon">🔄</span>
                <span class="vote-label">Воскресить</span>
            </button>`}
        </div>`;

    // ── Crop preview ──
    let cropsHtml = '';
    if (pv.crop_urls && pv.crop_urls.length) {
        cropsHtml = `
        <div class="crop-preview">
            <h4>📷 Что видит алгоритм (${pv.crop_urls.length} кропов)</h4>
            <div class="crop-grid">
                ${pv.crop_urls.map(c => `
                    <div class="crop-card" onclick="window.open('${c.url}','_blank')">
                        <img src="${c.url}" alt="${c.name}" loading="lazy">
                        <div class="crop-label">${c.crop === 'full' ? 'ПОЛНЫЙ' : c.crop} · ${c.filter}</div>
                    </div>
                `).join('')}
            </div>
        </div>`;
    }

    // ── Dental formula ──
    let formulaHtml = '';
    if (pv.dental_formula && Object.keys(pv.dental_formula).length) {
        formulaHtml = `
        <div class="detail-formula">
            <h4>🦷 Зубная формула</h4>
            ${renderMiniFormula(pv.dental_formula)}
            <div class="formula-legend">
                <div class="fl-item"><div class="fl-dot" style="background:var(--green)"></div>Имплантат</div>
                <div class="fl-item"><div class="fl-dot" style="background:var(--surface2)"></div>Натуральный</div>
                <div class="fl-item"><div class="fl-dot" style="background:rgba(75,85,99,0.3)"></div>Отсутствует</div>
                <div class="fl-item"><div class="fl-dot" style="background:rgba(245,158,11,0.3)"></div>Коронка</div>
                <div class="fl-item"><div class="fl-dot" style="background:rgba(59,130,246,0.3)"></div>Пломба</div>
                <div class="fl-item"><div class="fl-dot" style="background:rgba(239,68,68,0.3)"></div>Корень</div>
            </div>
        </div>`;
    }

    // ── Findings summary ──
    let findingsHtml = '';
    if (pv.findings && pv.findings.length) {
        findingsHtml = `
        <div style="margin:8px 0;padding:8px 10px;background:var(--bg);border-radius:6px;font-size:11px;color:var(--text-dim)">
            ${pv.findings.slice(0,3).map(f => `<div style="margin-bottom:3px">• ${f}</div>`).join('')}
            ${pv.findings.length > 3 ? `<div style="color:var(--text-dim);font-style:italic">...ещё ${pv.findings.length-3}</div>` : ''}
        </div>`;
    }

    previewDiv.innerHTML = scoreHtml + votingHtml + cropsHtml + formulaHtml + findingsHtml;
    header.after(previewDiv);
}

function renderMiniFormula(formula) {
    // FDI layout: upper row (1.8→1.1 | 2.1→2.8), lower row (4.8→4.1 | 3.1→3.8)
    const upperRight = ['1.8','1.7','1.6','1.5','1.4','1.3','1.2','1.1'];
    const upperLeft = ['2.1','2.2','2.3','2.4','2.5','2.6','2.7','2.8'];
    const lowerRight = ['4.8','4.7','4.6','4.5','4.4','4.3','4.2','4.1'];
    const lowerLeft = ['3.1','3.2','3.3','3.4','3.5','3.6','3.7','3.8'];

    const upper = [...upperRight, ...upperLeft];
    const lower = [...lowerRight, ...lowerLeft];

    function cellHtml(fdi) {
        const status = formula[fdi] || '';
        const cls = status || 'empty';
        const short = fdi.replace(/\./,'');
        return `<div class="fc mf-cell ${cls}" title="${fdi}: ${status || '?'}"><span class="fc-num">${short}</span>${statusIcon(status)}</div>`;
    }

    return `<div class="formula-grid">${upper.map(cellHtml).join('')}<div class="fc-sep"></div>${lower.map(cellHtml).join('')}</div>`;
}

function statusIcon(s) {
    // Единая конвенция — см. arenaStatusIcon
    return arenaStatusIcon(s);
}

async function expertVote(codename, action) {
    const comment = action === 'kill' ? prompt('Причина убийства (необязательно):','') : '';
    try {
        const resp = await fetch('/api/darwin/vote', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({codename, action, comment: comment || ''})
        });
        const result = await resp.json();
        if (result.status === 'ok') {
            // Show feedback
            const msg = action === 'boost' ? `👍 ${codename} получил +10% score → ${((result.new_score||0)*100).toFixed(0)}%`
                      : action === 'kill' ? `💀 ${codename} убит`
                      : action === 'champion' ? `⭐ ${codename} назначен чемпионом!`
                      : `🔄 ${codename} воскрешён!`;
            showToast(msg);
            // Refresh data
            const treeResp = await fetch('/api/darwin/tree');
            const treeData = await treeResp.json();
            allNodes = treeData.nodes;
            renderSidebar();
            renderTree();
            // Reload current detail
            if (selectedId) selectNode(selectedId);
        } else {
            showToast('❌ Ошибка: ' + (result.error || 'unknown'));
        }
    } catch(e) {
        showToast('❌ Сеть: ' + e.message);
    }
}

function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:99999;' +
        'background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 20px;' +
        'font-size:14px;box-shadow:0 8px 30px rgba(0,0,0,0.5);animation:fadeInUp 0.3s ease;';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2000);
    setTimeout(() => toast.remove(), 2500);
}

// ═══════════════════════════════════════════════════════════════
// HOVER TOOLTIP on sidebar cards
// ═══════════════════════════════════════════════════════════════
let _tooltipTimer = null;
const tooltip = document.getElementById('node-tooltip');

function showNodeTooltip(nodeId, event) {
    clearTimeout(_tooltipTimer);
    _tooltipTimer = setTimeout(async () => {
        let pv = _previewCache[nodeId];
        if (!pv) {
            try {
                const resp = await fetch(`/api/darwin/experiment/${nodeId}/preview`);
                pv = await resp.json();
                _previewCache[nodeId] = pv;
            } catch(e) { return; }
        }

        // Position tooltip
        const x = Math.min(event.clientX + 16, window.innerWidth - 380);
        const y = Math.min(event.clientY - 20, window.innerHeight - 300);
        tooltip.style.left = x + 'px';
        tooltip.style.top = y + 'px';

        // Build content
        const cropsImg = (pv.crop_urls || []).slice(0,4).map(c =>
            `<img src="${c.url}" alt="${c.name}" loading="lazy">`
        ).join('');

        const miniFormula = pv.dental_formula && Object.keys(pv.dental_formula).length
            ? renderMiniFormula(pv.dental_formula) : '';

        const scoreBar = pv.score != null
            ? `<div class="score-display" style="margin:6px 0;padding:4px 8px">
                <span style="font-size:10px;color:var(--text-dim)">Score</span>
                <div class="score-bar"><div class="score-fill" style="width:${(pv.score*100)}%;background:${pv.score>=0.7?'var(--green)':pv.score>=0.4?'var(--yellow)':'var(--red)'}"></div></div>
                <div style="font-size:12px;font-weight:700">${(pv.score*100).toFixed(0)}%</div>
               </div>` : '';

        tooltip.innerHTML = `
            <div class="tt-header">
                <span class="tt-name">${pv.is_champion ? '⭐ ' : ''}${pv.codename}</span>
                <span class="badge ${pv.verdict || ''}" style="font-size:9px">${verdictLabel(pv.verdict)}</span>
                ${!pv.is_alive ? '<span style="font-size:9px;color:var(--gray)">☠️ МЁРТВ</span>' : ''}
            </div>
            <div class="tt-meta">Gen ${pv.generation} / ${pv.branch} · ${(pv.crop_urls||[]).length} кропов · ${pv.test_case || ''}</div>
            <div class="tt-metrics">
                <span class="tm">conf ${(pv.confidence||0).toFixed(2)}</span>
                <span class="tm">🦷 ${pv.teeth_found||0}</span>
                <span class="tm">⬡ ${pv.implant_count||0}</span>
            </div>
            ${scoreBar}
            ${cropsImg ? `<div class="tt-crops">${cropsImg}</div>` : ''}
            ${miniFormula ? `<div class="tt-formula">${miniFormula}</div>` : ''}
        `;
        tooltip.classList.add('visible');
    }, 400);
}

function hideNodeTooltip() {
    clearTimeout(_tooltipTimer);
    tooltip.classList.remove('visible');
}

function renderSection(icon, title, content, defaultOpen) {
    if (!content.trim()) return '';
    return `
        <div class="section">
            <div class="section-header ${defaultOpen ? 'open' : ''}">
                <span class="icon">${icon}</span> ${title}
                <span class="arrow">▶</span>
            </div>
            <div class="section-body ${defaultOpen ? 'open' : ''}">${content}</div>
        </div>`;
}

function hypothesisLabel(o) {
    const map = {confirmed:'ПОДТВЕРЖДЕНА', refuted:'ОПРОВЕРГНУТА', partially_confirmed:'ЧАСТИЧНО', inconclusive:'НЕОПРЕДЕЛЁННО'};
    return map[o] || o;
}

function formatDiff(text) {
    return text.replace(/^(N\/A.*)$/gm, '<span class="unchanged">$1</span>')
               .replace(/^(\+.*)$/gm, '<span class="added">$1</span>')
               .replace(/^(-.*)$/gm, '<span class="removed">$1</span>')
               .replace(/^(=.*)$/gm, '<span class="unchanged">$1</span>')
               .replace(/\n/g, '<br>');
}

// ═══════════════════════════════════════════════════════════════
// EVALUATE VIEW
// ═══════════════════════════════════════════════════════════════

function showView(view) {
    const treeArea = document.getElementById('tree-area');
    const detailPanel = document.getElementById('detail-panel');
    const evalArea = document.getElementById('evaluate-area');
    const metricsArea = document.getElementById('metrics-area');
    const implantLab = document.getElementById('implant-lab');
    const arenaArea = document.getElementById('arena-area');
    const sidebar = document.getElementById('sidebar');

    document.querySelectorAll('.topbar .nav a').forEach(a => a.classList.remove('active'));

    // Hide all views
    treeArea.style.display = 'none';
    detailPanel.style.display = 'none';
    sidebar.style.display = 'none';
    evalArea.classList.remove('active');
    evalArea.style.gridColumn = '';
    if (metricsArea) {
        metricsArea.classList.remove('active');
        metricsArea.style.display = 'none';
        metricsArea.style.gridColumn = '';
    }
    implantLab.classList.remove('active');
    arenaArea.classList.remove('active');

    if (view === 'evaluate') {
        evalArea.classList.add('active');
        evalArea.style.gridColumn = '1 / -1';
        document.getElementById('nav-evaluate').classList.add('active');
        loadTestCases();
    } else if (view === 'metrics') {
        metricsArea.classList.add('active');
        metricsArea.style.display = '';
        metricsArea.style.gridColumn = '1 / -1';
        document.getElementById('nav-metrics').classList.add('active');
        loadMetrics();
    } else if (view === 'implant-lab') {
        implantLab.classList.add('active');
        document.getElementById('nav-implant').classList.add('active');
        initImplantLab();
        loadBatchProgress();
    } else if (view === 'arena') {
        arenaArea.classList.add('active');
        document.getElementById('nav-arena').classList.add('active');
        loadArena();
    } else {
        treeArea.style.display = '';
        detailPanel.style.display = '';
        sidebar.style.display = '';
        document.querySelector('.topbar .nav a[href="/darwin-lab"]').classList.add('active');
    }
}
