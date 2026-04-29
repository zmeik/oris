// implant-lab.js — Implant assessment, detection results, verification, dental formula
// Extracted from darwin_lab.html lines 4986–6916
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// IMPLANT ASSESSMENT LAB
// ═══════════════════════════════════════════════════════════════

let implantLabInitialized = false;
let currentImplMethod = 'all';
let implRefsData = null;

async function initImplantLab() {
    if (implantLabInitialized) return;
    implantLabInitialized = true;

    // Load test cases into selector
    try {
        const resp = await fetch('/api/darwin/test-cases');
        const cases = await resp.json();
        const sel = document.getElementById('impl-test-case');
        cases.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.file_id;
            opt.textContent = `${c.surname} ${c.first_name} (fid=${c.file_id})`;
            sel.appendChild(opt);
        });
    } catch(e) {
        console.error('Failed to load test cases:', e);
    }

    // Load scientific references
    try {
        const resp = await fetch('/api/implant-assessment/references');
        implRefsData = await resp.json();
        renderReferences('all');
    } catch(e) {
        console.error('Failed to load references:', e);
    }
}

function selectMethod(method) {
    currentImplMethod = method;
    document.querySelectorAll('.method-card').forEach(c => c.classList.remove('active'));
    document.getElementById(`mc-${method}`).classList.add('active');
    renderReferences(method);
    // Re-filter results if already loaded
    const main = document.getElementById('impl-results-main');
    if (main.querySelector('.impl-assess-card')) {
        // Highlight relevant method sections
        main.querySelectorAll('.method-detail').forEach(md => {
            md.style.display = (method === 'all' || md.dataset.method === method) ? '' : 'none';
        });
    }
}

function renderReferences(method) {
    const container = document.getElementById('refs-content');
    if (!implRefsData) { container.innerHTML = '...'; return; }

    const keys = method === 'all'
        ? ['mbl', 'gray_value', 'fractal', 'radiolucency', 'superstructure', 'bone_quality']
        : [method];

    let html = '';
    for (const key of keys) {
        const ref = implRefsData[key];
        if (!ref) continue;

        html += `<details class="ref-section">
            <summary><h4 style="display:inline">${ref.method_name_ru || ref.method_name}</h4></summary>
            <p style="font-size:11px;color:var(--text-dim);margin:6px 0;">${ref.description_ru || ref.description}</p>`;

        // Limitations
        if (ref.limitations) {
            html += `<ul class="lim-list">${ref.limitations.map(l => `<li>${l}</li>`).join('')}</ul>`;
        }

        // Misch mapping
        if (ref.misch_mapping) {
            html += `<div style="margin:8px 0;font-size:11px;">
                <strong>Классификация Misch D1-D4:</strong>
                <table class="results-table" style="margin:4px 0">
                ${Object.entries(ref.misch_mapping).map(([k,v]) =>
                    `<tr><td><strong>${k}</strong></td><td>${v.hu_range} HU</td><td>${v.description}</td></tr>`
                ).join('')}
                </table>
            </div>`;
        }

        // Romexis analog
        if (ref.romexis_analog) {
            html += `<div style="background:var(--bg);border-left:3px solid var(--blue);border-radius:0 6px 6px 0;padding:8px 12px;margin:8px 0;font-size:11px;">
                <strong>🖥 Planmeca Romexis:</strong> ${ref.romexis_analog}
            </div>`;
        }

        // Bone quality scale
        if (ref.scale) {
            html += `<div style="margin:8px 0;font-size:11px;">
                <strong>Шкала качества кости (Misch 2008):</strong>
                <div style="display:grid;gap:4px;margin-top:4px">
                ${Object.entries(ref.scale).map(([k,v]) =>
                    `<div class="grade-badge ${k}" style="justify-self:start">${v.icon} ${v.name_ru} — ${v.criteria}</div>`
                ).join('')}
                </div>
            </div>`;
        }

        // Superstructure stages
        if (ref.stages) {
            html += `<div style="margin:8px 0;font-size:11px;">
                <strong>Стадии надстройки (Kim 2021, 99.72% acc.):</strong>
                <div style="display:grid;gap:4px;margin-top:4px">
                ${Object.entries(ref.stages).map(([k,v]) =>
                    `<div class="super-badge ${k}" style="display:inline-block;margin:2px">${v.icon} ${v.name_ru}</div>
                     <span style="font-size:10px;color:var(--text-dim)">${v.radiographic}</span>`
                ).join('<br>')}
                </div>
            </div>`;
        }

        // Schwarz classification
        if (ref.schwarz_classification) {
            html += `<div style="margin:8px 0;font-size:11px;">
                <strong>Schwarz et al. 2007 — морфология дефектов:</strong>
                <table class="results-table" style="margin:4px 0">
                ${Object.entries(ref.schwarz_classification).map(([k,v]) =>
                    `<tr><td><strong>Class ${k}</strong></td><td>${v}</td></tr>`
                ).join('')}
                </table>
            </div>`;
        }

        // Defect shapes
        if (ref.defect_shapes) {
            html += `<div style="margin:8px 0;font-size:11px;">
                <strong>Формы дефектов (Zhang et al.):</strong>
                ${Object.entries(ref.defect_shapes).map(([k,v]) =>
                    `<span style="display:inline-block;margin:2px;padding:2px 6px;background:var(--bg);border-radius:4px;font-size:10px"><strong>${k}</strong>: ${v}</span>`
                ).join('')}
            </div>`;
        }

        // References
        if (ref.references) {
            html += `<details style="margin-top:8px">
                <summary style="font-size:11px;cursor:pointer;color:var(--text-dim);padding:4px 0">📚 Литература (${ref.references.length})</summary>`;
            ref.references.forEach(r => {
                html += `<div class="ref-item">
                    <div class="ref-authors">${r.authors}</div>
                    <div class="ref-title">${r.title}</div>
                    <div class="ref-journal">${r.journal} (${r.year})${r.volume ? ' ' + r.volume : ''}</div>
                    ${r.pmid ? `<div class="ref-pmid">PMID: ${r.pmid}</div>` : ''}
                    ${r.key_finding ? `<div class="ref-finding">→ ${r.key_finding}</div>` : ''}
                </div>`;
            });
            html += `</details>`;
        }

        html += `</details>`;
    }

    container.innerHTML = html;
}

function switchNotation(notation) {
    currentNotation = notation;
    // Update switcher buttons
    document.querySelectorAll('.notation-switcher button').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.notation === notation);
    });
    // Re-render results if data is cached
    if (lastAssessmentData) {
        renderImplantResults(lastAssessmentData);
    }
}

function getToothLabel(tp) {
    if (!tp) return '';
    if (currentNotation === 'universal') return `#${tp.universal}`;
    if (currentNotation === 'palmer') return tp.palmer_display || tp.palmer || '';
    return tp.fdi || '';
}

function getToothFullLabel(tp) {
    if (!tp) return '';
    const primary = getToothLabel(tp);
    const name = tp.tooth_name || '';
    const qName = tp.quadrant_name || '';
    return `${primary} — ${name}, ${qName}`;
}

function renderToothBadge(tp) {
    if (!tp || !tp.fdi) return '';
    const primary = getToothLabel(tp);
    const isFormula = tp.source && tp.source !== 'bbox_estimate';
    const cssClass = isFormula ? 'from-formula' : 'from-estimate';
    const srcLabel = isFormula ? '✓ формула' : '~ оценка';
    // Show alternative notations in small text
    let alt = '';
    if (currentNotation === 'fdi') {
        alt = `#${tp.universal} · ${tp.palmer_display || ''}`;
    } else if (currentNotation === 'universal') {
        alt = `FDI ${tp.fdi} · ${tp.palmer_display || ''}`;
    } else {
        alt = `FDI ${tp.fdi} · #${tp.universal}`;
    }
    const title = `${tp.tooth_name}, ${tp.quadrant_name}\nИсточник: ${tp.source || 'bbox'}${tp.formula_status ? '\nСтатус в формуле: ' + tp.formula_status : ''}`;
    return `<span class="tooth-pos ${cssClass}" title="${title}">
        🦷 <span class="tp-fdi">${primary}</span>
        <span class="tp-alt">(${alt})</span>
        <span class="tp-src">${srcLabel}</span>
    </span>`;
}

function renderImplantPassport(assessment, idx, data) {
    const tp = assessment.tooth_position;
    const fdi = tp?.fdi || `I${idx+1}`;
    const b = assessment.bbox || {};
    const bboxW = Math.round((b.x2||0) - (b.x1||0));
    const bboxH = Math.round((b.y2||0) - (b.y1||0));
    const aspect = bboxW > 0 ? (bboxH / bboxW).toFixed(2) : '—';

    // Find matching axis from angulation data
    const ang = data.angulation;
    let axisInfo = null;
    if (ang && ang.axes) {
        axisInfo = ang.axes.find(ax => ax.fdi === fdi);
    }
    const angle = axisInfo ? (axisInfo.corrected_angle || axisInfo.measured_angle || 0).toFixed(1) : '—';
    const region = axisInfo ? (axisInfo.region_ru || axisInfo.region || '') : '';

    // DB implant data (if available from patient)
    const dbImpl = data._db_implants ? data._db_implants.find(d =>
        d.tooth_number === fdi || d.tooth_number === fdi.replace('.','')
    ) : null;
    const dbSystem = dbImpl ? dbImpl.system : null;
    const dbDiam = dbImpl ? dbImpl.diameter : null;
    const dbLen = dbImpl ? dbImpl.length : null;

    // Matched library variant (from overlay)
    const overlay = (typeof libState !== 'undefined' && libState.overlays)
        ? libState.overlays.find(ov => ov.fdi === fdi) : null;
    const matchSystem = overlay?.system || dbSystem || '—';
    const matchDiam = overlay?.diameter || dbDiam || '—';
    const matchLen = overlay?.length || dbLen || '—';
    const matchScore = overlay?.matchScore ? (overlay.matchScore * 100).toFixed(0) + '%' : '—';

    // Mini SVG preview
    const svgUrl = matchSystem !== '—' && matchDiam !== '—'
        ? `/api/implant-library/${encodeURIComponent(matchSystem)}/svg?diameter=${matchDiam}&length=${matchLen}&w=40&h=90&mode=preview`
        : '';

    return `<details class="impl-passport" style="margin:0 0 8px;border:1px solid rgba(0,200,255,0.15);border-radius:6px;background:rgba(0,30,40,0.4);padding:0">
        <summary style="cursor:pointer;padding:6px 10px;font-size:11px;color:#00e5ff;display:flex;align-items:center;gap:6px;user-select:none">
            <span style="font-size:10px">🪪</span> Паспорт имплантата
            <span style="font-size:10px;color:rgba(255,255,255,0.4);margin-left:auto">
                ${matchSystem !== '—' ? matchSystem : ''} ${matchDiam !== '—' ? '⌀'+matchDiam+'×'+matchLen : ''}
            </span>
        </summary>
        <div style="padding:6px 10px 10px;display:flex;gap:12px;align-items:flex-start">
            ${svgUrl ? `<div style="flex:0 0 44px;background:rgba(0,0,0,0.3);border-radius:4px;padding:2px;border:1px solid rgba(0,200,255,0.1)">
                <img src="${svgUrl}" style="width:40px;height:90px" onerror="this.style.display='none'">
            </div>` : ''}
            <div style="flex:1;display:grid;grid-template-columns:1fr 1fr;gap:2px 16px;font-size:10px">
                <div style="color:rgba(255,255,255,0.4)">Позиция (FDI):</div>
                <div style="color:#fff;font-weight:600">${fdi} <span style="color:rgba(255,255,255,0.3)">${region}</span></div>
                <div style="color:rgba(255,255,255,0.4)">Система:</div>
                <div style="color:${dbSystem ? '#34d399' : '#f59e0b'}">${matchSystem} ${dbSystem ? '✓ БД' : '~ подбор'}</div>
                <div style="color:rgba(255,255,255,0.4)">Диаметр:</div>
                <div style="color:#fff">${matchDiam !== '—' ? matchDiam + ' мм' : '—'}</div>
                <div style="color:rgba(255,255,255,0.4)">Длина:</div>
                <div style="color:#fff">${matchLen !== '—' ? matchLen + ' мм' : '—'}</div>
                <div style="color:rgba(255,255,255,0.4)">Угол от верт.:</div>
                <div style="color:#fff">${angle}°</div>
                <div style="color:rgba(255,255,255,0.4)">Bbox (px):</div>
                <div style="color:rgba(255,255,255,0.5)">${bboxW}×${bboxH} (ratio ${aspect})</div>
                <div style="color:rgba(255,255,255,0.4)">Надстройка:</div>
                <div style="color:#fff">${assessment.superstructure_ru || assessment.superstructure || '—'}</div>
                <div style="color:rgba(255,255,255,0.4)">Совпадение:</div>
                <div style="color:${matchScore !== '—' ? '#34d399' : 'rgba(255,255,255,0.3)'}">${matchScore}</div>
            </div>
        </div>
    </details>`;
}

function renderImplantResults(data) {
    const main = document.getElementById('impl-results-main');
    const fileId = data.file_id;
    const origUrl = `/api/files/${fileId}/preview`;
    const segUrl = `/api/panorama/${fileId}/segmentation-overlay.jpg`;

    let html = `
        <div class="opg-sticky" id="opg-sticky-panel">
        <div class="opg-toolbar">
            <button class="pin-btn" id="opg-pin-btn" onclick="toggleStickyOPG()" title="Закрепить/открепить снимки при скролле">📌</button>
            <button class="pin-btn" onclick="openOPGViewer()" title="Открыть панораму во весь экран с увеличением и прокруткой" style="font-size:14px">🔎</button>
            <span class="opg-tb-label" style="margin-left:4px">Левый:</span>
            <div class="opg-tb-group" id="opg-filter-left">
                <button class="active" onclick="switchOPGFilter('left','',this)">Оригинал</button>
                <button onclick="switchOPGFilter('left','clahe',this)">CLAHE</button>
                <button onclick="switchOPGFilter('left','contrast',this)">Контраст</button>
                <button onclick="switchOPGFilter('left','bone_window',this)">Кость</button>
                <button onclick="switchOPGFilter('left','inverted',this)">Инверсия</button>
            </div>
            <span style="color:var(--border);margin:0 4px">│</span>
            <span class="opg-tb-label">Правый:</span>
            <div class="opg-tb-group" id="opg-filter-right">
                <button class="active" onclick="switchOPGFilter('right','',this)">Сегментация</button>
                <button onclick="switchOPGFilter('right','clahe',this)">CLAHE</button>
                <button onclick="switchOPGFilter('right','contrast',this)">Контраст</button>
                <button onclick="switchOPGFilter('right','bone_window',this)">Кость</button>
            </div>
        </div>
        <div class="opg-twin">
            <div class="opg-col">
                <div class="opg-col-title" id="opg-left-title">📷 Оригинал</div>
                <div class="opg-wrapper">
                    <img id="opg-orig-img" src="${origUrl}" onclick="toggleZoom(this)" style="border-radius:8px;border:1px solid var(--border);width:100%;max-height:220px;object-fit:contain;background:#000;cursor:pointer">
                    <canvas id="opg-highlight-canvas"></canvas>
                </div>
            </div>
            <div class="opg-col">
                <div class="opg-col-title" id="opg-right-title">🔬 YOLO + Имплантаты</div>
                <div class="opg-wrapper">
                    <img id="opg-seg-img" src="${segUrl}" onclick="toggleZoom(this)" style="border-radius:8px;border:1px solid var(--border);width:100%;max-height:220px;object-fit:contain;background:#000;cursor:pointer">
                    <canvas id="opg-highlight-canvas2"></canvas>
                </div>
            </div>
        </div>
        </div>

        <div id="impl-dental-formula-area"></div>

        <div style="font-size:14px;font-weight:700;margin-bottom:4px">
            🦴 ${data.implant_count} имплантат${data.implant_count > 1 ? (data.implant_count < 5 ? 'а' : 'ов') : ''} обнаружено
            <span style="font-size:11px;font-weight:400;color:var(--text-dim);margin-left:8px">
                Классификация: ${currentNotation === 'fdi' ? 'FDI (ISO 3950)' : currentNotation === 'universal' ? 'Universal (ADA)' : 'Palmer (Zsigmondy-Palmer)'}
            </span>
            <span style="font-size:10px;color:var(--text-dim);margin-left:8px">· Кликните на карточку для подсветки на снимке</span>
        </div>
        ${data.dental_formula_source ? `<div style="font-size:11px;margin-bottom:12px;">
            <span style="padding:2px 8px;border-radius:4px;background:rgba(16,185,129,0.1);color:var(--green)">
                ✓ Позиции из зубной формулы: <strong>${data.dental_formula_source}</strong>
            </span>
            <span style="color:var(--text-dim);margin-left:6px">
                Имплантаты: ${(data.dental_formula_implants || []).join(', ')}
            </span>
        </div>` : `<div style="font-size:11px;margin-bottom:12px;">
            <span style="padding:2px 8px;border-radius:4px;background:rgba(234,179,8,0.08);color:var(--yellow)">
                ~ Позиции по bbox-оценке (нет зубной формулы)
            </span>
            <span style="color:var(--text-dim);margin-left:6px">
                Для точных позиций — сначала проанализируйте в Darwin Lab → Оценка
            </span>
        </div>`}`;

    data.assessments.forEach((a, idx) => {
        const composite = a.composite_score !== null ? a.composite_score.toFixed(0) : '—';
        const gradeInfo = getGradeInfo(a.overall_grade);
        const superInfo = getSuperInfo(a.superstructure);
        const tp = a.tooth_position;
        const b = a.bbox || {};

        // Build crop URL
        const cropUrl = `/api/implant-assessment/${fileId}/crop?x1=${b.x1||0}&y1=${b.y1||0}&x2=${b.x2||0}&y2=${b.y2||0}&margin=2.0`;

        // Composite interpretation
        const compNum = a.composite_score !== null ? a.composite_score : null;
        const compDescr = compNum === null ? '' :
            compNum >= 90 ? 'Отличное состояние кости' :
            compNum >= 75 ? 'Хорошее состояние, норма' :
            compNum >= 60 ? 'Удовлетворительно, наблюдение' :
            compNum >= 40 ? 'Умеренные изменения, контроль' :
            'Выраженные изменения, внимание';

        const confPct = (a.confidence * 100).toFixed(0);
        const confDescr = a.confidence >= 0.9 ? 'высокая' : a.confidence >= 0.7 ? 'средняя' : 'низкая';

        // Composite text verdict below score
        const compVerdict = compNum === null ? '' :
            `<div style="font-size:10px;margin-top:2px;color:var(--text-dim)">${compDescr}</div>`;

        html += `<div class="impl-assess-card impl-collapsed" data-idx="${idx}"
                      data-bx1="${b.x1||0}" data-by1="${b.y1||0}" data-bx2="${b.x2||0}" data-by2="${b.y2||0}"
                      onclick="highlightImplant(this, ${idx})">
            <h3>
                <span class="impl-toggle" title="Свернуть / развернуть">▼</span>
                ${renderToothBadge(tp)}
                <span class="grade-badge ${a.overall_grade}" title="Общая оценка кости по Misch (2008)">${gradeInfo.icon} ${a.overall_grade_ru || gradeInfo.label}</span>
                <span class="super-badge ${a.superstructure}" title="Надстройка: что видно над имплантатом\n⬡ = только тело (fixture)\n⬡↑ = формирователь десны\n⬡♛ = коронка установлена (Kim 2021)">${superInfo.icon} ${a.superstructure_ru}</span>
                <span style="margin-left:auto;display:flex;align-items:center;gap:10px">
                    <span style="font-size:12px;color:${gradeInfo.color};white-space:nowrap" title="Состояние кости — композитный балл 4 методов:\nMBL 30% + Плотность 25% + Трабекулы 20% + Прозрачность 25%\n\n90–100: отличное\n75–89: хорошее\n60–74: удовлетворительно\n40–59: умеренные изменения\n<40: выраженные изменения"><span style="font-size:9px;color:var(--text-dim)">кость </span><b>${composite}%</b></span>
                    <span style="font-size:11px;color:var(--text-dim);white-space:nowrap" title="Достоверность — насколько система уверена в результате\n(${confDescr})\nОсновано на кол-ве подтверждений из разных кропов/фильтров"><span style="font-size:9px">увер. </span>${confPct}%</span>
                    <span class="iv-actions" onclick="event.stopPropagation()">
                        <button class="iv-btn iv-confirm" title="Подтвердить" onclick="ivImplant(${idx},'confirmed')">&#10003;</button>
                        <button class="iv-btn iv-edit" title="Исправить" onclick="ivImplant(${idx},'corrected')">&#9998;</button>
                        <button class="iv-btn iv-uncertain" title="Неуверенно" onclick="ivImplant(${idx},'uncertain')">?</button>
                    </span>
                </span>
            </h3>
            <div class="impl-card-collapse">
            <div style="font-size:10px;color:var(--text-dim);margin:-4px 0 6px 0;padding-left:4px">${compDescr}</div>

            <div class="impl-card-body">
                <!-- Crop panel -->
                <div class="impl-crop-panel">
                    <img id="impl-crop-${idx}" src="${cropUrl}" onclick="event.stopPropagation();selectImplCard(${idx})" ondblclick="event.stopPropagation();toggleZoom(this)" title="Кроп имплантата из OPG с контекстом кости\nЗелёный — тело имплантата\nСиний — зона 1мм (критическая для MBL)\nФиолетовый — зона 2мм (оценка плотности)\n\nКлик = выбрать · Двойной клик = увеличить">
                    <div class="crop-filters">
                        <button class="active" onclick="event.stopPropagation();selectImplCard(${idx});switchCropFilter(${idx},'',this)" title="Исходный снимок без обработки">Оригинал</button>
                        <button onclick="event.stopPropagation();selectImplCard(${idx});switchCropFilter(${idx},'clahe',this)" title="Адаптивное выравнивание гистограммы\nЛучше видна трабекулярная структура кости">CLAHE</button>
                        <button onclick="event.stopPropagation();selectImplCard(${idx});switchCropFilter(${idx},'contrast',this)" title="Повышенный контраст ×1.8\nЛучше видны границы кость/имплант">Контраст</button>
                        <button onclick="event.stopPropagation();selectImplCard(${idx});switchCropFilter(${idx},'bone_window',this)" title="Костное окно (×2.5, -100)\nИмитация КТ-окна для кости\nЛучше видны рентгенопрозрачные зоны">Кость</button>
                    </div>
                    <div class="impl-crop-legend">
                        <span title="Контур тела имплантата (YOLO-детекция)"><span style="display:inline-block;width:10px;height:2px;background:#00dc64"></span> Имплантат</span>
                        <span title="Зона 1мм вокруг имплантата — критическая для оценки MBL и остеоинтеграции"><span style="display:inline-block;width:10px;height:2px;background:#64b4ff"></span> 1мм</span>
                        <span title="Зона 2мм — оценка плотности окружающей кости (Gray Value)"><span style="display:inline-block;width:10px;height:2px;background:#b482ff"></span> 2мм</span>
                    </div>
                </div>

                <!-- Assessment details -->
                <div class="impl-card-details">
                    <!-- Score bars with tooltips -->
                    <div style="margin:4px 0 12px">
                        ${renderScoreBar('📏 MBL ↓', a.component_scores?.mbl, '#10b981',
                            'Маргинальный уровень кости (30% общего балла)\nКлик → перейти к деталям', 'mbl')}
                        ${renderScoreBar('🔬 Плотность ↓', a.component_scores?.gray_value, '#3b82f6',
                            'Плотность кости по яркости пикселей (25% балла)\nКлик → перейти к деталям', 'gray_value')}
                        ${renderScoreBar('🌿 Трабекулы ↓', a.component_scores?.fractal, '#8b5cf6',
                            'Фрактальная размерность трабекул (20% балла)\nКлик → перейти к деталям', 'fractal')}
                        ${renderScoreBar('🔍 Прозрачность ↓', a.component_scores?.radiolucency, '#f59e0b',
                            'Рентгенопрозрачность вокруг имплантата (25% балла)\nКлик → перейти к деталям', 'radiolucency')}
                    </div>

                    ${renderImplantPassport(a, idx, data)}
                    ${wrapMethodVerify(idx, 'mbl', '📏 MBL', renderMBLDetail(a.mbl))}
                    ${wrapMethodVerify(idx, 'gray_value', '🔬 Плотность', renderGrayValueDetail(a.gray_value))}
                    ${wrapMethodVerify(idx, 'fractal', '🌿 Трабекулы', renderFractalDetail(a.fractal))}
                    ${wrapMethodVerify(idx, 'radiolucency', '🔍 Прозрачность', renderRadiolucencyDetail(a.radiolucency))}
                    ${renderAngulationPerImplant(idx, data.angulation)}
                </div>
            </div>
            </div><!-- /impl-card-collapse -->
        </div>`;
    });

    // Add angulation summary panel
    html += renderAngulationSummary(data.angulation);

    // Add verification panel placeholder after all implant cards
    html += `<div id="impl-verification-panel"></div>`;

    main.innerHTML = html;

    // Reset state
    activeImplIdx = -1;
    ivState = { implant: {}, method: {} };

    // Render dental formula widget
    renderImplDentalFormula(data);

    // Render verification panel
    renderVerificationPanel(data);

    // Setup canvas overlay after images load
    const origImg = document.getElementById('opg-orig-img');
    const segImg = document.getElementById('opg-seg-img');
    const canvasSetup = () => {
        setupHighlightCanvas();
        setupCanvasClickHandlers();
    };
    if (origImg) { origImg.onload = canvasSetup; if (origImg.complete) canvasSetup(); }
    if (segImg) { segImg.onload = canvasSetup; if (segImg.complete) canvasSetup(); }

    // Attach scroll listener on the scrollable parent for sticky redraw
    const scrollParent = main.closest('.evaluate-area') || main.parentElement;
    if (scrollParent && !scrollParent._implScrollBound) {
        scrollParent._implScrollBound = true;
        let st;
        scrollParent.addEventListener('scroll', () => {
            if (activeImplIdx < 0) return;
            clearTimeout(st);
            st = setTimeout(() => redrawHighlight(activeImplIdx), 30);
        });
    }
}

// ═══════════════════════════════════════════════════════════════
// Dental Formula Widget for Implant Assessment
// ═══════════════════════════════════════════════════════════════

let implDentalFormula = {}; // FDI → condition code
let implImplantPositions = []; // array of {fdi, idx} for implants

function implDfCellClass(mark) {
    if (!mark) return '';
    const m = mark.toUpperCase();
    if (m === 'PT' || m === 'ПТ') return 'df-periodontitis';
    if (m === 'П') return 'df-filled';
    if (m === 'С' || m === 'C') return 'df-caries';
    if (m === 'О' || m === 'O') return 'df-absent';
    if (m === 'R') return 'df-root';
    if (m === 'К' || m === 'K') return 'df-crown';
    if (m === 'Р' || m === 'P') return 'df-pulpitis';
    if (m === 'А' || m === 'A') return 'df-perio';
    if (m === 'И') return 'df-artificial';
    if (/^I{1,3}$/.test(m)) return 'df-mobility';
    return 'df-filled';
}

const IMPL_DF_CONDITIONS = [
    {code:'⬡',label:'Имплантат'},
    {code:'О',label:'Отсутствует'},{code:'R',label:'Корень'},{code:'С',label:'Кариес'},
    {code:'Р',label:'Пульпит'},{code:'Pt',label:'Периодонтит'},{code:'П',label:'Пломба'},
    {code:'А',label:'Пародонтоз'},{code:'К',label:'Коронка'},{code:'И',label:'Иск. зуб'},
    {code:'I',label:'Подвижн. I'},{code:'II',label:'Подвижн. II'},{code:'III',label:'Подвижн. III'},
];

// Convert FDI with dot ("1.2") to integer string ("12")
function fdiDotToInt(fdiDot) {
    return String(fdiDot).replace('.', '');
}

// Map algorithm status to dental formula condition code
function statusToCondition(status) {
    if (!status) return '';
    const s = status.toLowerCase();
    if (s === 'implant' || s.includes('impl')) return 'impl';
    if (s === 'missing' || s === 'absent') return 'О';
    if (s === 'present' || s === 'intact' || s === 'healthy') return '';
    if (s === 'crown' || s.includes('crown')) return 'К';
    if (s === 'filling' || s.includes('fill')) return 'П';
    if (s === 'caries' || s.includes('cari')) return 'С';
    if (s === 'root' || s.includes('root')) return 'R';
    if (s === 'artificial') return 'И';
    return '';
}

function renderImplDentalFormula(data) {
    const area = document.getElementById('impl-dental-formula-area');
    if (!area) return;

    // Build implant positions map: FDI (int string) → assessment index
    implImplantPositions = [];
    const implFdiSet = new Set();
    data.assessments.forEach((a, idx) => {
        const fdi = a.tooth_position?.fdi;
        if (fdi) {
            const fdiInt = fdiDotToInt(fdi);
            implImplantPositions.push({fdi: fdiInt, idx});
            implFdiSet.add(fdiInt);
        }
    });

    // Load full dental formula from API data (algorithm experiments / patient DB)
    implDentalFormula = {};
    const rawFormula = data.dental_formula || {};
    for (const [fdiDot, status] of Object.entries(rawFormula)) {
        const fdiInt = fdiDotToInt(fdiDot);
        const cond = statusToCondition(status);
        if (cond) implDentalFormula[fdiInt] = cond;
    }
    // Ensure all detected implants are marked even if not in formula
    implFdiSet.forEach(fdi => {
        if (!implDentalFormula[fdi]) implDentalFormula[fdi] = 'impl';
    });

    const uR = [18,17,16,15,14,13,12,11], uL = [21,22,23,24,25,26,27,28];
    const lR = [48,47,46,45,44,43,42,41], lL = [31,32,33,34,35,36,37,38];

    function cell(fdi) {
        const fdiStr = String(fdi);
        const isImplDetected = implFdiSet.has(fdiStr);           // YOLO-детекция есть → кликабельный
        const mark = implDentalFormula[fdiStr] || '';
        const isImplAny = isImplDetected || mark === 'impl';     // имплант по формуле ИЛИ детекции
        const isActiveImpl = activeImplIdx >= 0 && implImplantPositions.find(p => p.fdi === fdiStr && p.idx === activeImplIdx);
        const implIdx = implImplantPositions.find(p => p.fdi === fdiStr);

        let cls = '';
        if (isImplAny) {
            cls = 'df-implant' + (isActiveImpl ? ' active-tooth' : '');
            if (!isImplDetected) cls += ' df-implant-nodet';  // формула знает, но YOLO не нашёл
        } else {
            cls = implDfCellClass(mark);
        }

        const condNames = {
            'О':'Отсутствует (AI)', 'С':'Кариес', 'П':'Пломба', 'К':'Коронка', 'Р':'Пульпит',
            'Pt':'Периодонтит', 'А':'Пародонтоз', 'И':'Иск. зуб', 'R':'Корень', 'impl':'Имплантат (AI)'
        };
        const num = fdi % 10;
        const markDisplay = isImplAny ? '⬡' : (mark && mark !== 'impl' ? mark : '');
        const ms = markDisplay ? `<span class="df-mark">${markDisplay}</span>` : '';

        // Подробный tooltip
        let titleText = `Зуб ${fdi}`;
        if (isImplDetected) {
            titleText += ' · ⬡ Имплантат (YOLO + AI)\n→ Клик = перейти к анализу';
        } else if (mark === 'impl') {
            titleText += ' · ⬡ Имплантат (по формуле, без YOLO-детекции)\n→ Клик = задать состояние';
        } else if (mark) {
            titleText += ` · ${condNames[mark] || mark}\n→ Клик = изменить`;
        } else {
            titleText += ' · Не размечен\n→ Клик = задать состояние';
        }

        const onclick = isImplDetected && implIdx
            ? `implDfClickImplant(${implIdx.idx})`
            : `implDfClickTooth(event,${fdi})`;

        return `<span class="df-cell ${cls}" data-tooth="${fdi}" title="${titleText}" onclick="${onclick}">${num}${ms}</span>`;
    }

    function row(right, left) {
        return right.map(cell).join('') + '<span class="df-mid">│</span>' + left.map(cell).join('');
    }

    const implDetectedCount = implFdiSet.size;
    const implFormulaCount = Object.values(implDentalFormula).filter(v => v === 'impl').length;
    const implTotalCount = new Set([...implFdiSet, ...Object.entries(implDentalFormula).filter(([k,v]) => v === 'impl').map(([k]) => k)]).size;
    const missingCount = Object.values(implDentalFormula).filter(v => v === 'О').length;
    const presentCount = 32 - missingCount - implTotalCount;
    const src = data.dental_formula_source || 'bbox-оценка';

    area.innerHTML = `<div class="df-widget" id="impl-df-widget">
        <div class="df-title">🦷 Зубная формула
            <span style="font-size:9px;color:var(--text-dim);margin-left:6px">из: ${src}</span>
        </div>
        <div class="df-grid">
            <div class="df-row">${row(uR, uL)}</div>
            <div class="df-sep"></div>
            <div class="df-row">${row(lR, lL)}</div>
        </div>
        <div class="df-legend" style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:8px">
            <span style="color:#10b981">⬡ Имплантат: ${implDetectedCount} (YOLO)${implTotalCount > implDetectedCount ? ` + ${implTotalCount - implDetectedCount} (формула)` : ''}</span>
            <span style="color:#888">О Отсутств.: ${missingCount}</span>
            <span style="color:var(--text-dim)">Не размечено: ${presentCount > 0 ? presentCount : 0}</span>
        </div>
        <div class="df-legend">Клик на <span style="color:#10b981">⬡</span> = перейти к анализу · Клик на пустой = разметить · Наведите для подсказки</div>
    </div>`;
}

function implDfClickImplant(idx) {
    // Click on implant tooth in formula → select that implant card + highlight on OPG
    const card = document.querySelector(`.impl-assess-card[data-idx="${idx}"]`);
    if (!card) return;

    // Deselect & collapse all
    document.querySelectorAll('.impl-assess-card').forEach(c => {
        c.classList.remove('active-impl');
        c.classList.add('impl-collapsed');
    });
    // Clear canvases
    ['opg-highlight-canvas', 'opg-highlight-canvas2'].forEach(canvasId => {
        const canvas = document.getElementById(canvasId);
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    });

    // Activate & expand
    card.classList.add('active-impl');
    card.classList.remove('impl-collapsed');
    activeImplIdx = idx;
    redrawHighlight(idx);

    // Update dental formula active state
    document.querySelectorAll('#impl-df-widget .df-cell').forEach(c => c.classList.remove('active-tooth'));
    const fdi = lastAssessmentData?.assessments?.[idx]?.tooth_position?.fdi;
    if (fdi) {
        const cell = document.querySelector(`#impl-df-widget .df-cell[data-tooth="${fdi}"]`);
        if (cell) cell.classList.add('active-tooth');
    }

    // Scroll card into view
    card.scrollIntoView({behavior: 'smooth', block: 'nearest'});
}

function implDfClickTooth(event, toothNum) {
    event.stopPropagation();
    implDfClosePopup();
    const cellEl = event.target.closest('.df-cell');
    if (!cellEl) return;
    const rect = cellEl.getBoundingClientRect();
    const curMark = implDentalFormula[String(toothNum)] || '';
    const popup = document.createElement('div');
    popup.className = 'df-popup';
    popup.id = 'impl-df-popup';
    const curMarkNorm = curMark === 'impl' ? '⬡' : curMark;
    popup.innerHTML = `<div class="df-popup-title">Зуб ${toothNum}</div>` +
        IMPL_DF_CONDITIONS.map(c => {
            const isActive = curMarkNorm === c.code;
            const implStyle = c.code === '⬡' ? 'background:rgba(16,185,129,0.2);color:#10b981;border-color:#10b981;font-weight:700;' : '';
            return `<button class="df-popup-btn ${isActive ? 'active' : ''}" style="${implStyle}" title="${c.label}" onclick="implDfSelect(${toothNum},'${c.code}')">${c.code}</button>`;
        }).join('') +
        `<button class="df-popup-btn df-btn-clear" onclick="implDfSelect(${toothNum},'')">✕ очистить</button>`;
    document.body.appendChild(popup);
    let left = rect.left + rect.width/2 - 70;
    let top = rect.bottom + 6;
    if (left < 4) left = 4;
    if (left + 150 > window.innerWidth) left = window.innerWidth - 154;
    if (top + 120 > window.innerHeight) top = rect.top - 120;
    popup.style.left = left + 'px';
    popup.style.top = top + 'px';
    setTimeout(() => document.addEventListener('click', implDfClosePopupClick), 0);
}

function implDfClosePopup() {
    document.getElementById('impl-df-popup')?.remove();
    document.removeEventListener('click', implDfClosePopupClick);
}
function implDfClosePopupClick(e) {
    if (!e.target.closest('#impl-df-popup')) implDfClosePopup();
}

function implDfSelect(toothNum, condition) {
    implDfClosePopup();
    // Map ⬡ to internal 'impl' code
    const internalCode = condition === '⬡' ? 'impl' : condition;
    if (internalCode) implDentalFormula[String(toothNum)] = internalCode;
    else delete implDentalFormula[String(toothNum)];

    // Save to patient dental formula via API
    if (lastAssessmentData?.patient_id) {
        const fdiDot = String(toothNum).length >= 2
            ? toothNum.toString().charAt(0) + '.' + toothNum.toString().slice(1)
            : String(toothNum);
        const saveFormula = {};
        for (const [k, v] of Object.entries(implDentalFormula)) {
            const kDot = k.length >= 2 ? k.charAt(0) + '.' + k.slice(1) : k;
            saveFormula[kDot] = v === 'impl' ? 'implant' : v;
        }
        fetch(`/api/patient/${lastAssessmentData.patient_id}/dental-formula`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({formula: saveFormula, source: 'manual'})
        }).then(r => r.json()).then(d => {
            if (d.ok) console.log('Dental formula saved');
        }).catch(e => console.error('Save error:', e));
    }

    // Re-render
    if (lastAssessmentData) renderImplDentalFormula(lastAssessmentData);

    // If user added implant, show reanalyze hint
    if (internalCode === 'impl') {
        showImplToast(`⬡ Зуб ${toothNum} отмечен как имплантат. Формула сохранена.`, 'green');
    }
}

// ═══════════════════════════════════════════════════════════════
// Toast notifications
// ═══════════════════════════════════════════════════════════════

function showImplToast(msg, color) {
    const toast = document.createElement('div');
    toast.style.cssText = `position:fixed;bottom:24px;left:50%;transform:translateX(-50%);
        background:var(--surface2);border:1px solid var(--${color || 'blue'});color:var(--text);
        padding:10px 20px;border-radius:8px;font-size:13px;z-index:9999;
        box-shadow:0 4px 12px rgba(0,0,0,0.3);max-width:400px;text-align:center;
        animation:fadeIn 0.2s`;
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; }, 2500);
    setTimeout(() => toast.remove(), 3000);
}

// ═══════════════════════════════════════════════════════════════
// Verification Workflow — inline, как в verify_patient.html
// Каждая строка: [контент] [✓ ✎ ?]  — прочитал, нажал, готово
// ═══════════════════════════════════════════════════════════════

let ivState = { implant: {}, method: {} };  // idx → status, 'idx_method' → status

// Wrap each method detail with inline ✓ ✎ ? buttons (like field-actions)
function wrapMethodVerify(implIdx, methodId, methodLabel, innerHtml) {
    if (!innerHtml) return '';
    const key = `${implIdx}_${methodId}`;
    return `<div class="method-verify-wrap" data-iv-method="${key}">
        ${innerHtml}
        <div class="iv-actions" style="position:absolute;top:6px;right:4px" onclick="event.stopPropagation()">
            <button class="iv-btn iv-confirm" title="Подтвердить ${methodLabel}" onclick="ivMethod('${key}','confirmed')">&#10003;</button>
            <button class="iv-btn iv-edit" title="Исправить ${methodLabel}" onclick="ivMethod('${key}','corrected')">&#9998;</button>
            <button class="iv-btn iv-uncertain" title="Неуверенно в ${methodLabel}" onclick="ivMethod('${key}','uncertain')">?</button>
        </div>
    </div>`;
}

// ── Per-implant verify: click ✓ on card → solid green, auto-save ──
function ivImplant(idx, status) {
    if (ivState.implant[idx] === status) delete ivState.implant[idx];
    else ivState.implant[idx] = status;
    ivApplyCard(idx);
    ivUpdateSummary();
    ivAutoSave();
}

// ── Per-method verify: click ✓ on method → green left border, auto-save ──
function ivMethod(key, status) {
    if (ivState.method[key] === status) delete ivState.method[key];
    else ivState.method[key] = status;
    ivApplyMethod(key);
    ivAutoSave();
}

function ivApplyCard(idx) {
    const card = document.querySelector(`.impl-assess-card[data-idx="${idx}"]`);
    if (!card) return;
    const st = ivState.implant[idx] || '';
    card.classList.remove('iv-st-confirmed', 'iv-st-corrected', 'iv-st-uncertain');
    if (st) card.classList.add(`iv-st-${st}`);
    // Toggle button states
    card.querySelectorAll('h3 .iv-actions .iv-btn').forEach(btn => btn.classList.remove('iv-on'));
    if (st) {
        const sel = st === 'confirmed' ? '.iv-confirm' : st === 'corrected' ? '.iv-edit' : '.iv-uncertain';
        const btn = card.querySelector(`h3 .iv-actions ${sel}`);
        if (btn) btn.classList.add('iv-on');
    }
}

function ivApplyMethod(key) {
    const wrap = document.querySelector(`.method-verify-wrap[data-iv-method="${key}"]`);
    if (!wrap) return;
    const st = ivState.method[key] || '';
    wrap.classList.remove('iv-st-confirmed', 'iv-st-corrected', 'iv-st-uncertain');
    if (st) wrap.classList.add(`iv-st-${st}`);
    wrap.querySelectorAll('.iv-actions .iv-btn').forEach(btn => btn.classList.remove('iv-on'));
    if (st) {
        const sel = st === 'confirmed' ? '.iv-confirm' : st === 'corrected' ? '.iv-edit' : '.iv-uncertain';
        const btn = wrap.querySelector(`.iv-actions ${sel}`);
        if (btn) btn.classList.add('iv-on');
    }
}

function ivUpdateSummary() {
    const strip = document.getElementById('iv-summary-strip');
    if (!strip) return;
    const total = lastAssessmentData?.assessments?.length || 0;
    const counts = {confirmed:0, corrected:0, uncertain:0};
    Object.values(ivState.implant).forEach(st => { if (counts[st] !== undefined) counts[st]++; });
    const done = counts.confirmed + counts.corrected + counts.uncertain;
    const allDone = done === total && total > 0;

    strip.classList.toggle('iv-done', allDone);
    strip.innerHTML = `
        <span style="font-weight:600">📋 ${done}/${total}</span>
        ${counts.confirmed ? `<span style="color:#22c55e">✓ ${counts.confirmed}</span>` : ''}
        ${counts.corrected ? `<span style="color:#3b82f6">✎ ${counts.corrected}</span>` : ''}
        ${counts.uncertain ? `<span style="color:#f59e0b">? ${counts.uncertain}</span>` : ''}
        ${allDone
            ? `<span style="margin-left:auto;color:var(--green);font-weight:600">✓ Все проверены</span>`
            : `<span style="margin-left:auto;color:var(--text-dim)">Нажимайте ✓ ✎ ? на каждой карточке</span>`}
    `;
}

// Render minimal summary strip (no big panel — everything inline)
function renderVerificationPanel(data) {
    const panel = document.getElementById('impl-verification-panel');
    if (!panel) return;

    const status = data.review_status || 'pending';

    // Restore state from saved review_status
    if (status === 'confirmed' && Object.keys(ivState.implant).length === 0) {
        data.assessments.forEach((a, idx) => { ivState.implant[idx] = 'confirmed'; });
    }

    // Parse saved per-implant states from notes
    const notes = data.reviewer_notes || '';
    const implMatch = notes.match(/Импл:\s*([^|]+)/);
    if (implMatch && Object.keys(ivState.implant).length === 0) {
        implMatch[1].split(',').forEach(pair => {
            const [fdi, st] = pair.trim().split(':');
            if (fdi && st) {
                const idx = data.assessments.findIndex(a => a.tooth_position?.fdi === fdi);
                if (idx >= 0) ivState.implant[idx] = st;
            }
        });
    }

    panel.innerHTML = `<div class="iv-summary" id="iv-summary-strip"></div>`;

    // Apply all saved states to cards
    data.assessments.forEach((a, idx) => ivApplyCard(idx));
    // Apply method states
    Object.keys(ivState.method).forEach(key => ivApplyMethod(key));
    ivUpdateSummary();
}

// Auto-save on every click — instant, no "save" button needed
let ivSaveTimer = null;
function ivAutoSave() {
    clearTimeout(ivSaveTimer);
    ivSaveTimer = setTimeout(() => ivDoSave(), 800);  // debounce 800ms
}

async function ivDoSave() {
    const analysisId = lastAssessmentData?.analysis_id;
    if (!analysisId) return;

    // Build notes from state
    const implDetails = [];
    for (const [idx, st] of Object.entries(ivState.implant)) {
        const fdi = lastAssessmentData?.assessments?.[idx]?.tooth_position?.fdi || idx;
        implDetails.push(`${fdi}:${st}`);
    }
    const methodDetails = [];
    for (const [key, st] of Object.entries(ivState.method)) {
        methodDetails.push(`${key}:${st}`);
    }

    const fullNotes = [
        implDetails.length ? `Импл: ${implDetails.join(', ')}` : '',
        methodDetails.length ? `Методы: ${methodDetails.join(', ')}` : ''
    ].filter(Boolean).join(' | ');

    // Determine overall status from implant states
    const total = lastAssessmentData?.assessments?.length || 0;
    const counts = {confirmed:0, corrected:0, uncertain:0};
    Object.values(ivState.implant).forEach(st => { if (counts[st] !== undefined) counts[st]++; });
    const done = counts.confirmed + counts.corrected + counts.uncertain;

    let overallStatus = 'pending';
    if (done === total && total > 0) {
        if (counts.uncertain > 0) overallStatus = 'corrected';
        else if (counts.corrected > 0) overallStatus = 'corrected';
        else overallStatus = 'confirmed';
    }

    try {
        await fetch(`/api/panorama-analysis/${analysisId}/review`, {
            method: 'PUT',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({review_status: overallStatus, reviewer_notes: fullNotes})
        });
        lastAssessmentData.review_status = overallStatus;
        lastAssessmentData.reviewer_notes = fullNotes;
    } catch(e) {
        console.error('ivAutoSave error:', e);
    }
}

// ═══════════════════════════════════════════════════════════════
// Canvas Click Handler — click on OPG to select implant
// ═══════════════════════════════════════════════════════════════

function setupCanvasClickHandlers() {
    ['opg-highlight-canvas', 'opg-highlight-canvas2'].forEach(canvasId => {
        const canvas = document.getElementById(canvasId);
        if (!canvas || canvas._clickBound) return;
        canvas._clickBound = true;
        canvas.addEventListener('click', (e) => onCanvasClick(e, canvasId));
    });
}

function onCanvasClick(e, canvasId) {
    const canvas = document.getElementById(canvasId);
    const imgId = canvasId === 'opg-highlight-canvas' ? 'opg-orig-img' : 'opg-seg-img';
    const img = document.getElementById(imgId);
    if (!canvas || !img || !lastAssessmentData) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Convert click position to natural image coordinates
    const natW = img.naturalWidth || 3000;
    const natH = img.naturalHeight || 1500;
    const dispW = rect.width;
    const dispH = rect.height;
    const scaleX = dispW / natW;
    const scaleY = dispH / natH;
    const scale = Math.min(scaleX, scaleY);
    const offX = (dispW - natW * scale) / 2;
    const offY = (dispH - natH * scale) / 2;

    const natClickX = (clickX - offX) / scale;
    const natClickY = (clickY - offY) / scale;

    // Find closest implant bbox to click point
    let bestIdx = -1;
    let bestDist = Infinity;

    lastAssessmentData.assessments.forEach((a, idx) => {
        const b = a.bbox;
        if (!b) return;
        // Check if click is within expanded bbox (1.5x margin)
        const bw = b.x2 - b.x1;
        const bh = b.y2 - b.y1;
        const ex1 = b.x1 - bw * 0.5;
        const ey1 = b.y1 - bh * 0.3;
        const ex2 = b.x2 + bw * 0.5;
        const ey2 = b.y2 + bh * 0.3;

        if (natClickX >= ex1 && natClickX <= ex2 && natClickY >= ey1 && natClickY <= ey2) {
            const cx = (b.x1 + b.x2) / 2;
            const cy = (b.y1 + b.y2) / 2;
            const dist = Math.hypot(natClickX - cx, natClickY - cy);
            if (dist < bestDist) {
                bestDist = dist;
                bestIdx = idx;
            }
        }
    });

    if (bestIdx >= 0) {
        // Select & expand this implant, collapse others
        const card = document.querySelector(`.impl-assess-card[data-idx="${bestIdx}"]`);
        if (card) {
            document.querySelectorAll('.impl-assess-card').forEach(c => {
                c.classList.remove('active-impl');
                c.classList.add('impl-collapsed');
            });
            ['opg-highlight-canvas', 'opg-highlight-canvas2'].forEach(cid => {
                const c = document.getElementById(cid);
                if (c) c.getContext('2d').clearRect(0, 0, c.width, c.height);
            });
            card.classList.add('active-impl');
            card.classList.remove('impl-collapsed');
            activeImplIdx = bestIdx;
            redrawHighlight(bestIdx);
            syncDentalFormulaHighlight(bestIdx);
            card.scrollIntoView({behavior: 'smooth', block: 'nearest'});
        }
    } else {
        // No implant near click — pass through to image zoom
        if (img) toggleZoom(img);
    }
}

let opgStickyEnabled = false;
let activeImplIdx = -1; // track which implant is highlighted

function toggleStickyOPG() {
    opgStickyEnabled = !opgStickyEnabled;
    const panel = document.getElementById('opg-sticky-panel');
    const btn = document.getElementById('opg-pin-btn');
    if (panel) panel.classList.toggle('pinned', opgStickyEnabled);
    if (btn) btn.classList.toggle('active', opgStickyEnabled);
    // Re-sync canvases after layout change
    setTimeout(() => {
        setupHighlightCanvas();
        if (activeImplIdx >= 0) redrawHighlight(activeImplIdx);
    }, 100);
}

function switchOPGFilter(side, filter, btnEl) {
    const fileId = lastAssessmentData?.file_id;
    if (!fileId) return;

    // Update active button
    const groupId = side === 'left' ? 'opg-filter-left' : 'opg-filter-right';
    const group = document.getElementById(groupId);
    if (group) group.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const imgId = side === 'left' ? 'opg-orig-img' : 'opg-seg-img';
    const titleId = side === 'left' ? 'opg-left-title' : 'opg-right-title';
    const img = document.getElementById(imgId);
    const titleEl = document.getElementById(titleId);

    if (!img) return;

    const filterNames = {'': '📷 Оригинал', 'clahe': '🔬 CLAHE', 'contrast': '🎛️ Контраст', 'bone_window': '🦴 Кость', 'inverted': '🔄 Инверсия'};

    if (side === 'left') {
        // Left image: use filtered full OPG endpoint or original
        if (!filter) {
            img.src = `/api/files/${fileId}/preview`;
        } else {
            img.src = `/api/implant-assessment/${fileId}/filtered?filter=${filter}`;
        }
        if (titleEl) titleEl.textContent = filterNames[filter] || '📷 Оригинал';
    } else {
        // Right image: segmentation overlay doesn't have filter — switch to filtered OPG
        if (!filter) {
            img.src = `/api/panorama/${fileId}/segmentation-overlay.jpg`;
            if (titleEl) titleEl.textContent = '🔬 YOLO + Имплантаты';
        } else {
            img.src = `/api/implant-assessment/${fileId}/filtered?filter=${filter}`;
            if (titleEl) titleEl.textContent = filterNames[filter] || '📷 Оригинал';
        }
    }

    // Re-setup canvas after image loads
    img.onload = () => {
        setupHighlightCanvas();
        if (activeImplIdx >= 0) redrawHighlight(activeImplIdx);
    };
}

function setupHighlightCanvas() {
    ['opg-highlight-canvas', 'opg-highlight-canvas2'].forEach(canvasId => {
        const canvas = document.getElementById(canvasId);
        const imgId = canvasId === 'opg-highlight-canvas' ? 'opg-orig-img' : 'opg-seg-img';
        const img = document.getElementById(imgId);
        if (!canvas || !img) return;
        // Use getBoundingClientRect for accurate size even in sticky mode
        const rect = img.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
        canvas.style.borderRadius = '8px';
    });
}

function drawHighlightOnCanvas(canvasId, bx1, by1, bx2, by2, idx) {
    const canvas = document.getElementById(canvasId);
    const imgId = canvasId === 'opg-highlight-canvas' ? 'opg-orig-img' : 'opg-seg-img';
    const img = document.getElementById(imgId);
    if (!canvas || !img) return;

    // Sync canvas size using getBoundingClientRect
    const rect = img.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    const ctx = canvas.getContext('2d');

    const natW = img.naturalWidth || 3000;
    const natH = img.naturalHeight || 1500;
    const dispW = rect.width;
    const dispH = rect.height;

    const scaleX = dispW / natW;
    const scaleY = dispH / natH;
    const scale = Math.min(scaleX, scaleY);

    const offX = (dispW - natW * scale) / 2;
    const offY = (dispH - natH * scale) / 2;

    const dx1 = offX + bx1 * scale;
    const dy1 = offY + by1 * scale;
    const dx2 = offX + bx2 * scale;
    const dy2 = offY + by2 * scale;
    const dw = dx2 - dx1;
    const dh = dy2 - dy1;

    // Dim everything except the implant area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.clearRect(dx1 - dw * 0.5, dy1 - dh * 0.3, dw * 2, dh * 1.6);

    // Draw highlight rectangle
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 3]);
    ctx.strokeRect(dx1, dy1, dw, dh);
    ctx.setLineDash([]);

    // Draw crosshair lines
    const cx = dx1 + dw / 2;
    const cy = dy1 + dh / 2;
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx, 0);
    ctx.lineTo(cx, canvas.height);
    ctx.moveTo(0, cy);
    ctx.lineTo(canvas.width, cy);
    ctx.stroke();

    // Label
    const tp = lastAssessmentData?.assessments?.[idx]?.tooth_position;
    const label = tp ? getToothLabel(tp) : `#${idx + 1}`;
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = '#10b981';
    ctx.fillText(`🦷 ${label}`, dx1, dy1 - 5);

    // ── Draw angulation axis lines for ALL implants ──
    drawAngulationAxes(ctx, canvasId, offX, offY, scale, idx);
}

function drawAngulationAxes(ctx, canvasId, offX, offY, scale, activeIdx) {
    const ang = lastAssessmentData?.angulation;
    if (!ang || !ang.axes || ang.axes.length < 1) return;

    const AXIS_COLORS = ['#f87171','#60a5fa','#34d399','#fbbf24','#c084fc','#fb923c','#22d3ee','#e879f9','#a3e635','#f472b6'];

    ang.axes.forEach((axis, i) => {
        const line = axis.axis_line;
        if (!line) return;

        const sx1 = offX + line.top.x * scale;
        const sy1 = offY + line.top.y * scale;
        const sx2 = offX + line.bottom.x * scale;
        const sy2 = offY + line.bottom.y * scale;

        const color = AXIS_COLORS[i % AXIS_COLORS.length];
        const isActive = i === activeIdx;

        // Line
        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = isActive ? 3 : 1.5;
        ctx.globalAlpha = isActive ? 1 : 0.6;
        ctx.setLineDash([]);
        ctx.moveTo(sx1, sy1);
        ctx.lineTo(sx2, sy2);
        ctx.stroke();

        // Extend (dashed)
        const dx = sx2 - sx1, dy = sy2 - sy1;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
            const ext = 20;
            ctx.beginPath();
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1;
            ctx.strokeStyle = color + '88';
            ctx.moveTo(sx1 - dx/len*ext, sy1 - dy/len*ext);
            ctx.lineTo(sx1, sy1);
            ctx.moveTo(sx2, sy2);
            ctx.lineTo(sx2 + dx/len*ext, sy2 + dy/len*ext);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Endpoint dots
        [{ x: sx1, y: sy1 }, { x: sx2, y: sy2 }].forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, isActive ? 4 : 2.5, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        });

        // Angle label at midpoint
        const mx = (sx1 + sx2) / 2;
        const my = (sy1 + sy2) / 2;
        const angleText = `${axis.corrected_angle.toFixed(1)}°`;
        ctx.font = isActive ? 'bold 11px system-ui' : '9px system-ui';
        ctx.fillStyle = color;
        ctx.globalAlpha = isActive ? 1 : 0.7;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 2;
        ctx.strokeText(angleText, mx + 6, my);
        ctx.fillText(angleText, mx + 6, my);

        ctx.globalAlpha = 1;
    });

    // Draw pairwise angle arcs between neighboring implants
    if (ang.pairs) {
        ang.pairs.forEach(pair => {
            if (pair.implant_a.index !== activeIdx && pair.implant_b.index !== activeIdx) return;
            const a1 = ang.axes[pair.implant_a.index];
            const a2 = ang.axes[pair.implant_b.index];
            if (!a1?.axis_line || !a2?.axis_line) return;

            const mid1x = offX + (a1.axis_line.top.x + a1.axis_line.bottom.x) / 2 * scale;
            const mid1y = offY + (a1.axis_line.top.y + a1.axis_line.bottom.y) / 2 * scale;
            const mid2x = offX + (a2.axis_line.top.x + a2.axis_line.bottom.x) / 2 * scale;
            const mid2y = offY + (a2.axis_line.top.y + a2.axis_line.bottom.y) / 2 * scale;

            const cls = pair.classification;
            const arcX = (mid1x + mid2x) / 2;
            const arcY = Math.min(mid1y, mid2y) - 12;

            ctx.font = 'bold 12px system-ui';
            ctx.fillStyle = cls.color;
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 3;
            const txt = `${pair.relative_angle}° ${cls.icon}`;
            ctx.strokeText(txt, arcX - 15, arcY);
            ctx.fillText(txt, arcX - 15, arcY);

            // Connecting line between midpoints
            ctx.beginPath();
            ctx.strokeStyle = cls.color + '44';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.moveTo(mid1x, mid1y);
            ctx.lineTo(mid2x, mid2y);
            ctx.stroke();
            ctx.setLineDash([]);
        });
    }
}

function redrawHighlight(idx) {
    if (idx < 0) return;
    const card = document.querySelector(`.impl-assess-card[data-idx="${idx}"]`);
    if (!card) return;
    const bx1 = parseFloat(card.dataset.bx1);
    const by1 = parseFloat(card.dataset.by1);
    const bx2 = parseFloat(card.dataset.bx2);
    const by2 = parseFloat(card.dataset.by2);
    ['opg-highlight-canvas', 'opg-highlight-canvas2'].forEach(cid => drawHighlightOnCanvas(cid, bx1, by1, bx2, by2, idx));
}

function syncDentalFormulaHighlight(idx) {
    document.querySelectorAll('#impl-df-widget .df-cell').forEach(c => c.classList.remove('active-tooth'));
    if (idx >= 0) {
        const fdi = lastAssessmentData?.assessments?.[idx]?.tooth_position?.fdi;
        if (fdi) {
            const cell = document.querySelector(`#impl-df-widget .df-cell[data-tooth="${fdi}"]`);
            if (cell) cell.classList.add('active-tooth');
        }
    }
}

function highlightImplant(cardEl, idx) {
    // If cardEl is not the card itself, find the closest card
    if (!cardEl.classList.contains('impl-assess-card')) {
        cardEl = cardEl.closest('.impl-assess-card');
        if (!cardEl) return;
        idx = parseInt(cardEl.dataset.idx);
    }

    const wasActive = cardEl.classList.contains('active-impl');
    const wasCollapsed = cardEl.classList.contains('impl-collapsed');

    // Remove active from all cards, collapse all
    document.querySelectorAll('.impl-assess-card').forEach(c => {
        c.classList.remove('active-impl');
        c.classList.add('impl-collapsed');
    });

    // Clear canvases
    ['opg-highlight-canvas', 'opg-highlight-canvas2'].forEach(canvasId => {
        const canvas = document.getElementById(canvasId);
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    });

    // If same card was active AND expanded — collapse & deactivate
    if (wasActive && !wasCollapsed) {
        activeImplIdx = -1;
        syncDentalFormulaHighlight(-1);
        return;
    }

    // Activate & expand this card
    cardEl.classList.add('active-impl');
    cardEl.classList.remove('impl-collapsed');
    activeImplIdx = idx;
    redrawHighlight(idx);
    syncDentalFormulaHighlight(idx);
}

// Select implant card without toggle-off (used by crop panel clicks)
function selectImplCard(idx) {
    if (activeImplIdx === idx) return; // already selected
    const card = document.querySelector(`.impl-assess-card[data-idx="${idx}"]`);
    if (!card) return;
    document.querySelectorAll('.impl-assess-card').forEach(c => {
        c.classList.remove('active-impl');
        c.classList.add('impl-collapsed');
    });
    card.classList.add('active-impl');
    card.classList.remove('impl-collapsed');
    activeImplIdx = idx;
    redrawHighlight(idx);
    syncDentalFormulaHighlight(idx);
}

// Re-draw highlight on window resize
window.addEventListener('resize', () => {
    setupHighlightCanvas();
    if (activeImplIdx >= 0) redrawHighlight(activeImplIdx);
});

function clearMethodHighlights(card) {
    card.querySelectorAll('.method-detail').forEach(d => d.classList.remove('method-active'));
    card.querySelectorAll('.score-bar').forEach(b => b.classList.remove('method-active'));
}

function scrollToMethod(barEl, methodId) {
    const card = barEl.closest('.impl-assess-card');
    if (!card) return;
    clearMethodHighlights(card);
    // Highlight score bar
    barEl.closest('.score-bar').classList.add('method-active');
    // Highlight and scroll to detail
    const detail = card.querySelector(`.method-detail[data-method="${methodId}"]`);
    if (detail) {
        detail.classList.add('method-active');
        detail.scrollIntoView({behavior: 'smooth', block: 'nearest'});
    }
    // Auto-clear after 4s
    setTimeout(() => clearMethodHighlights(card), 4000);
}

function highlightMethod(detailEl, methodId) {
    const card = detailEl.closest('.impl-assess-card');
    if (!card) return;
    clearMethodHighlights(card);
    // Highlight the detail
    detailEl.classList.add('method-active');
    // Find and highlight corresponding score bar
    const methodLabels = {'mbl': 'MBL', 'gray_value': 'Плотность', 'fractal': 'Трабекулы', 'radiolucency': 'Прозрачность'};
    const bars = card.querySelectorAll('.score-bar');
    bars.forEach(bar => {
        const label = bar.querySelector('.bar-label');
        if (label && label.textContent.includes(methodLabels[methodId] || '')) {
            bar.classList.add('method-active');
            bar.scrollIntoView({behavior: 'smooth', block: 'nearest'});
        }
    });
    setTimeout(() => clearMethodHighlights(card), 4000);
}

function switchCropFilter(idx, filter, btnEl) {
    const card = btnEl.closest('.impl-assess-card');
    const a = lastAssessmentData?.assessments?.[idx];
    if (!a || !a.bbox) return;
    const b = a.bbox;
    const fileId = lastAssessmentData.file_id;
    const filterParam = filter ? `&filter=${filter}` : '';
    const url = `/api/implant-assessment/${fileId}/crop?x1=${b.x1||0}&y1=${b.y1||0}&x2=${b.x2||0}&y2=${b.y2||0}&margin=2.0${filterParam}`;

    const img = document.getElementById(`impl-crop-${idx}`);
    if (img) img.src = url;

    // Update active button
    card.querySelectorAll('.crop-filters button').forEach(b => b.classList.remove('active'));
    btnEl.classList.add('active');
}

async function loadBatchProgress() {
    try {
        const resp = await fetch('/api/implant-assessment/batch-status');
        const d = await resp.json();
        const bar = document.getElementById('batch-progress-bar');
        if (d.assessed > 0) {
            bar.style.display = '';
            document.getElementById('bp-progress').textContent =
                `${d.assessed}/${d.total_with_implants} панорам (${d.percent}%) · ${d.total_assessment_rows} оценок · ${d.matched_to_card} привязано`;
            document.getElementById('bp-bar').style.width = d.percent + '%';
            document.getElementById('bp-k081').textContent =
                `К08.1: ${d.k081.assessed}/${d.k081.total}`;
        } else {
            bar.style.display = 'none';
        }
    } catch(e) { /* ignore */ }
}

async function loadImplantAssessment() {
    const fileId = document.getElementById('impl-test-case').value;
    if (!fileId) return;

    const status = document.getElementById('impl-status');
    status.textContent = '⏳ Анализирую 4 методами...';

    const main = document.getElementById('impl-results-main');
    main.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-dim)">⏳ Загрузка и анализ...</div>';

    try {
        const resp = await fetch(`/api/implant-assessment/${fileId}`);
        const data = await resp.json();

        if (data.error) {
            main.innerHTML = `<div style="color:var(--red);padding:20px">${data.error}</div>`;
            status.textContent = '';
            return;
        }

        if (data.implant_count === 0) {
            main.innerHTML = `<div style="color:var(--yellow);padding:20px;text-align:center">
                <div style="font-size:32px;margin-bottom:8px">🔍</div>
                Имплантаты не обнаружены YOLO-сегментацией на этом снимке
            </div>`;
            status.textContent = 'Имплантаты не найдены';
            return;
        }

        // Cache data for notation switching
        lastAssessmentData = data;
        renderImplantResults(data);

        const sourceLabel = data.source === 'database'
            ? '📊 Из БД' : '⚡ Вычислено на лету';
        const batchInfo = data.batch_id ? ` (${data.batch_id})` : '';
        status.innerHTML = `✓ ${data.implant_count} имплантатов проанализировано 4 методами &nbsp; <span style="background:${data.source === 'database' ? 'rgba(59,130,246,0.15);color:#60a5fa' : 'rgba(251,191,36,0.15);color:#fbbf24'};padding:2px 8px;border-radius:8px;font-size:11px">${sourceLabel}${batchInfo}</span>`;
        status.style.color = 'var(--green)';

    } catch(e) {
        main.innerHTML = `<div style="color:var(--red);padding:20px">Ошибка: ${e.message}</div>`;
        status.textContent = 'Ошибка';
        status.style.color = 'var(--red)';
    }
}

function renderScoreBar(label, score, color, tooltip, methodId) {
    const val = score !== undefined && score !== null ? score.toFixed(0) : '—';
    const w = score !== undefined && score !== null ? score : 0;
    const verdict = w >= 90 ? '✓ отлично' : w >= 75 ? '✓ норма' : w >= 60 ? '~ удовл.' : w >= 40 ? '⚠ внимание' : '⚠ патология';
    const verdictColor = w >= 75 ? 'var(--green)' : w >= 60 ? 'var(--yellow)' : 'var(--red)';
    const clickAction = methodId ? `onclick="event.stopPropagation();scrollToMethod(this,'${methodId}')"` : '';
    return `<div class="score-bar" title="${(tooltip || '').replace(/"/g, '&quot;')}">
        <div class="bar-label" ${clickAction}>${label}</div>
        <div class="bar"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div>
        <span style="font-size:12px;font-weight:700;min-width:30px;text-align:right">${val}</span>
        <span style="font-size:9px;min-width:55px;color:${verdictColor}">${score != null ? verdict : ''}</span>
    </div>`;
}

function renderMBLDetail(mbl) {
    if (!mbl || mbl.error) return '';
    const gradeInfo = getGradeInfo(mbl.quality_grade);
    const avgColor = mbl.avg_mm > 2.0 ? 'var(--red)' : mbl.avg_mm > 1.5 ? 'var(--yellow)' : 'var(--green)';
    const avgVerdict = mbl.avg_mm <= 1.0 ? 'Идеальный уровень' :
        mbl.avg_mm <= 1.5 ? 'В пределах нормы 1-го года' :
        mbl.avg_mm <= 2.0 ? 'Начальная убыль кости' :
        mbl.avg_mm <= 3.0 ? 'Умеренная убыль — контроль' : 'Значительная убыль — вмешательство';
    const threadsM = mbl.threads_exposed_mesial ?? 0;
    const threadsD = mbl.threads_exposed_distal ?? 0;
    const threadsVerdict = (threadsM + threadsD) === 0 ? '✓ Все витки покрыты костью' :
        (threadsM + threadsD) <= 2 ? '⚠ Начало обнажения резьбы' : '⚠ Обнажение резьбы — признак убыли';

    return `<div class="method-detail" data-method="mbl" onclick="highlightMethod(this,'mbl')">
        <h4>📏 MBL — Маргинальный уровень кости <span class="grade-badge ${mbl.quality_grade}" style="font-size:10px">${gradeInfo.icon} ${gradeInfo.label}</span></h4>
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">
            Расстояние от платформы имплантата до края кости (мм). Чем меньше — тем лучше.
        </div>
        <div class="md-grid">
            <div class="md-metric" title="Среднее MBL = (mesial + distal) / 2\nНорма: ≤1.5мм первый год\nДалее: ≤0.2мм/год (Albrektsson 1986)">
                <div class="val" style="color:${avgColor}">${mbl.avg_mm ?? '—'}</div>
                <div class="lbl">Среднее, мм</div>
                <div style="font-size:8px;color:${avgColor}">${avgVerdict}</div>
            </div>
            <div class="md-metric" title="Убыль кости с медиальной (ближней к центру) стороны">
                <div class="val">${mbl.mesial_mm ?? '—'}</div><div class="lbl">Медиальная, мм</div>
            </div>
            <div class="md-metric" title="Убыль кости с дистальной (дальней от центра) стороны">
                <div class="val">${mbl.distal_mm ?? '—'}</div><div class="lbl">Дистальная, мм</div>
            </div>
            <div class="md-metric" title="Кол-во обнажённых витков резьбы имплантата\nМедиальная / Дистальная стороны\n0/0 = кость полностью покрывает имплантат (идеально)">
                <div class="val">${threadsM}/${threadsD}</div>
                <div class="lbl">Витки M/D</div>
                <div style="font-size:8px;color:var(--text-dim)">${threadsVerdict}</div>
            </div>
        </div>
        <details style="margin-top:6px;border-top:1px solid var(--border);padding-top:4px">
            <summary style="font-size:10px;cursor:pointer;color:var(--blue)">📖 Что такое MBL? (Клик для справки)</summary>
            <div class="method-explainer">
                <strong>MBL (Marginal Bone Level)</strong> — расстояние от верхнего края платформы имплантата до первой точки контакта с костью.<br><br>
                <strong>Зачем:</strong> Это «золотой стандарт» оценки состояния кости вокруг имплантата. Если кость «уходит» вниз — обнажается резьба, начинается периимплантит.<br><br>
                <strong>Шкала:</strong><br>
                <span class="norm">● ≤1.0мм — идеально, полная остеоинтеграция</span><br>
                <span class="norm">● 1.0–1.5мм — норма для 1-го года после установки</span><br>
                <span class="warn">● 1.5–2.0мм — начальная убыль, требуется мониторинг</span><br>
                <span class="bad">● >2.0мм — патологическая убыль, необходимо вмешательство</span><br><br>
                <strong>Как считается балл (0–100):</strong> 100 при MBL=0мм, линейно снижается. Вес в композите: <strong>30%</strong>.<br><br>
                <strong>Ограничения OPG:</strong> Точность ICC = 0.66 (умеренная). OPG даёт 2D-проекцию — настоящий MBL виден только на КЛКТ.
                Калибровка: ${mbl.calibration_px_per_mm ?? '—'} px/мм (расчётная, по длине имплантата ~10мм).
            </div>
        </details>
    </div>`;
}

function renderGrayValueDetail(gv) {
    if (!gv) return '';
    const z = gv.zones || {};
    const t = gv.thirds || {};
    const densEst = gv.density_estimate || '';
    const densDescr = densEst.includes('D1') ? 'D1 — очень плотная (кортикальная)' :
        densEst.includes('D2') ? 'D2 — плотная губчатая + кортикальная' :
        densEst.includes('D3') ? 'D3 — рыхлая губчатая, тонкая кортикальная' :
        densEst.includes('D4') ? 'D4 — очень рыхлая (мягкая кость)' : densEst;

    const s1 = z.shell_1mm?.mean ?? 0;
    const s2 = z.shell_2mm?.mean ?? 0;
    const ratio = gv.ratio_shell1_vs_shell2;
    const ratioVerdict = ratio > 1.1 ? '✓ Плотнее у имплантата (остеоинтеграция)' :
        ratio > 0.9 ? '~ Равномерная плотность' : '⚠ Разрежение у имплантата';

    function zoneCell(data, label, descr) {
        const mean = data?.mean ?? 0;
        const bg = `rgba(${255-mean},${255-mean},${255-mean},0.3)`;
        return `<div class="zone" style="background:${bg}" title="${descr}\nЯркость: ${mean}/255\nЧем светлее (больше) = плотнее кость">
            <div class="z-val">${mean}</div>
            <div class="z-lbl">${label}</div>
        </div>`;
    }

    return `<div class="method-detail" data-method="gray_value" onclick="highlightMethod(this,'gray_value')">
        <h4>🔬 Плотность кости (Gray Value) <span style="font-size:10px;color:var(--text-dim)">${densDescr}</span></h4>
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">
            Яркость пикселей вокруг имплантата (0=чёрный, 255=белый). Аналог HU на КТ для 2D.
            Светлее = плотнее кость = лучше остеоинтеграция.
        </div>
        <div class="md-grid">
            <div class="md-metric" title="Средняя яркость самого имплантата (металл).\nОбычно 200–255. Служит точкой отсчёта.">
                <div class="val">${z.implant_body?.mean ?? '—'}</div><div class="lbl">Тело имплантата</div>
                <div style="font-size:8px;color:var(--text-dim)">эталон (металл)</div>
            </div>
            <div class="md-metric" title="Средняя яркость в зоне 1мм вокруг имплантата.\nЭто критическая зона остеоинтеграции.\nЧем ближе к яркости кортикальной кости — тем лучше.">
                <div class="val" style="color:var(--green)">${s1}</div><div class="lbl">Зона 1мм</div>
                <div style="font-size:8px;color:var(--text-dim)">контактная кость</div>
            </div>
            <div class="md-metric" title="Средняя яркость в зоне 2мм.\nОтражает общую плотность окружающей кости.">
                <div class="val">${s2}</div><div class="lbl">Зона 2мм</div>
                <div style="font-size:8px;color:var(--text-dim)">окружающая кость</div>
            </div>
            <div class="md-metric" title="Отношение плотности 1мм / 2мм.\n>1.1 = кость плотнее у имплантата (хорошо, остеоинтеграция)\n0.9–1.1 = равномерно\n<0.9 = разрежение у имплантата (плохо)">
                <div class="val">${ratio ?? '—'}</div><div class="lbl">Ratio 1/2мм</div>
                <div style="font-size:8px;color:${ratio > 0.9 ? 'var(--green)' : 'var(--red)'}">${ratioVerdict}</div>
            </div>
        </div>
        <div style="font-size:11px;font-weight:600;margin:8px 0 4px" title="Имплантат делится на 3 части по высоте:\nCoronal = шейка (у десны)\nMiddle = тело\nApical = верхушка (в кости)">Зоны по третям имплантата:</div>
        <div class="zone-heatmap">
            ${zoneCell(t.coronal, 'Шейка', 'Шейка (coronal) — зона у десневого края.\nЗдесь начинается убыль кости при периимплантите.')}
            ${zoneCell(t.middle, 'Тело', 'Тело (middle) — средняя часть имплантата.\nОсновная зона контакта с костью.')}
            ${zoneCell(t.apical, 'Верхушка', 'Верхушка (apical) — нижняя часть.\nБлизость к нижнечелюстному каналу или пазухе.')}
        </div>
        <details style="margin-top:6px;border-top:1px solid var(--border);padding-top:4px">
            <summary style="font-size:10px;cursor:pointer;color:var(--blue)">📖 Что такое Gray Value? (Клик для справки)</summary>
            <div class="method-explainer">
                <strong>Gray Value Analysis</strong> — оценка плотности кости по яркости пикселей на рентгеновском снимке.<br><br>
                <strong>Зачем:</strong> Плотность кости вокруг имплантата определяет качество остеоинтеграции. Плотная кость (светлая) = надёжная фиксация. Рыхлая (тёмная) = риск расшатывания.<br><br>
                <strong>Что измеряем:</strong><br>
                ● <strong>Тело имплантата</strong> — яркость металла (эталон, обычно 200+)<br>
                ● <strong>Зона 1мм</strong> — кость непосредственно у имплантата (зона остеоинтеграции)<br>
                ● <strong>Зона 2мм</strong> — окружающая кость (общий фон)<br>
                ● <strong>Ratio 1мм/2мм</strong> — если >1.1, кость плотнее у имплантата (хорошо!)<br><br>
                <strong>Классификация Misch (2008):</strong><br>
                <span class="norm">● D1 — очень плотная кортикальная (дуб)</span><br>
                ● D2 — плотная губчатая + кортикальная (норма)<br>
                <span class="warn">● D3 — рыхлая губчатая, тонкая кортикальная</span><br>
                <span class="bad">● D4 — очень рыхлая (пенопласт) — наихудший прогноз</span><br><br>
                <strong>Как считается балл (0–100):</strong> Нормализация яркости зоны 1мм к диапазону D1–D4. Вес: <strong>25%</strong>.<br><br>
                <strong>Ограничения:</strong> На OPG значения относительные (не Hounsfield Units). Точные HU можно получить только на КЛКТ (Planmeca Romexis, 3D).
            </div>
        </details>
    </div>`;
}

function renderFractalDetail(fd) {
    if (!fd) return '';
    const interpretation = fd.interpretation_ru || fd.interpretation || '';
    const fdVal = fd.fd_avg;
    const fdColor = (fdVal >= 1.2 && fdVal <= 1.4) ? 'var(--green)' :
                    (fdVal >= 1.0) ? 'var(--yellow)' : 'var(--red)';
    const fdVerdict = fdVal >= 1.3 ? '✓ Здоровая трабекулярная структура' :
        fdVal >= 1.2 ? '✓ Нижняя граница нормы' :
        fdVal >= 1.1 ? '⚠ Начало разрежения' :
        fdVal >= 1.0 ? '⚠ Значительное разрежение' : '⚠ Выраженный остеопороз';

    const fdM = fd.fd_mesial?.toFixed(3);
    const fdD = fd.fd_distal?.toFixed(3);
    const asymmetry = fdM && fdD ? Math.abs(fd.fd_mesial - fd.fd_distal) : 0;
    const asymVerdict = asymmetry < 0.05 ? '✓ Симметричная структура' :
        asymmetry < 0.1 ? '~ Небольшая асимметрия' : '⚠ Выраженная асимметрия — возможная локальная патология';

    return `<div class="method-detail" data-method="fractal" onclick="highlightMethod(this,'fractal')">
        <h4>🌿 Фрактальная размерность трабекул <span style="font-size:10px;color:var(--text-dim)">${interpretation}</span></h4>
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">
            Оценивает сложность костного рисунка (рисунок трабекул). Здоровая кость имеет сложную,
            разветвлённую структуру (FD ≈ 1.3). При остеопорозе/резорбции рисунок упрощается (FD ↓).
        </div>
        <div class="md-grid">
            <div class="md-metric" title="Средняя фрактальная размерность\nМетод box-counting (Mandelbrot 1982)\n\n1.3–1.4 = здоровая плотная кость\n1.2–1.3 = нижняя граница нормы\n1.0–1.2 = разрежение\n<1.0 = выраженный остеопороз">
                <div class="val" style="color:${fdColor};font-size:24px">${fdVal?.toFixed(3) ?? '—'}</div>
                <div class="lbl">FD среднее</div>
                <div style="font-size:8px;color:${fdColor}">${fdVerdict}</div>
            </div>
            <div class="md-metric" title="FD с медиальной стороны (к центру зубного ряда)">
                <div class="val">${fdM ?? '—'}</div><div class="lbl">FD медиальная</div>
            </div>
            <div class="md-metric" title="FD с дистальной стороны (от центра зубного ряда)">
                <div class="val">${fdD ?? '—'}</div><div class="lbl">FD дистальная</div>
            </div>
            <div class="md-metric" title="Размер области анализа (Region of Interest) в мм">
                <div class="val">${fd.roi_size_mm ?? '—'}</div><div class="lbl">Зона анализа, мм</div>
            </div>
        </div>
        ${asymmetry > 0.01 ? `<div style="font-size:10px;margin-top:4px;color:${asymmetry > 0.1 ? 'var(--yellow)' : 'var(--text-dim)'}">
            Асимметрия M/D: ${asymmetry.toFixed(3)} — ${asymVerdict}
        </div>` : ''}
        <details style="margin-top:6px;border-top:1px solid var(--border);padding-top:4px">
            <summary style="font-size:10px;cursor:pointer;color:var(--blue)">📖 Что такое фрактальная размерность? (Клик для справки)</summary>
            <div class="method-explainer">
                <strong>Fractal Dimension (FD)</strong> — числовая мера сложности костного рисунка (трабекулярного паттерна).<br><br>
                <strong>Зачем:</strong> Здоровая кость имеет сложную, разветвлённую сеть трабекул (балок). При остеопорозе, резорбции или потере остеоинтеграции эта сеть упрощается — трабекулы истончаются и исчезают. FD количественно оценивает эту сложность.<br><br>
                <strong>Как измеряется:</strong> Метод box-counting (Mandelbrot, 1982) — изображение кости покрывается сеткой квадратов разного размера. Чем больше мелких квадратов нужно — тем сложнее структура, тем выше FD.<br><br>
                <strong>Шкала FD:</strong><br>
                <span class="norm">● 1.3–1.4 — здоровая плотная кость с развитой трабекулярной сетью</span><br>
                <span class="norm">● 1.2–1.3 — нижняя граница нормы</span><br>
                <span class="warn">● 1.1–1.2 — начало разрежения трабекул</span><br>
                <span class="bad">● <1.1 — выраженный остеопороз / резорбция</span><br><br>
                <strong>Асимметрия M/D:</strong> Если FD сильно различается с медиальной и дистальной сторон — возможна локальная патология (одностороннее разрушение кости).<br><br>
                <strong>Как считается балл (0–100):</strong> FD нормализуется к диапазону 0.8–1.5. Вес: <strong>20%</strong>.<br><br>
                <strong>Источник:</strong> Goodarzi Pour et al. (2014) — снижение FD на 0.1–0.2 ассоциировано с потерей остеоинтеграции.
            </div>
        </details>
    </div>`;
}

function renderRadiolucencyDetail(rl) {
    if (!rl) return '';
    const hasRL = rl.has_radiolucency;
    const zones = rl.affected_zones || [];

    // Zone descriptions
    const zoneDescriptions = {
        'mesial_coronal': 'Мед. шейка — ближе к десне, медиальная сторона',
        'mesial_middle': 'Мед. тело — средняя часть, медиальная сторона',
        'mesial_apical': 'Мед. верхушка — нижняя часть, медиальная сторона',
        'distal_coronal': 'Дист. шейка — ближе к десне, дистальная сторона',
        'distal_middle': 'Дист. тело — средняя часть, дистальная сторона',
        'distal_apical': 'Дист. верхушка — нижняя часть, дистальная сторона',
        'apical': 'Апикальная — вокруг верхушки имплантата',
    };
    const zoneLabelsRu = {
        'mesial_coronal': 'мед. шейка', 'mesial_middle': 'мед. тело', 'mesial_apical': 'мед. верхушка',
        'distal_coronal': 'дист. шейка', 'distal_middle': 'дист. тело', 'distal_apical': 'дист. верхушка',
        'apical': 'апикальная',
    };

    const allZones = ['mesial_coronal', 'mesial_middle', 'mesial_apical',
                      'distal_coronal', 'distal_middle', 'distal_apical', 'apical'];
    const zoneGrid = allZones.map(z => {
        const affected = zones.includes(z);
        const bg = affected ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.1)';
        const icon = affected ? '⚠' : '✓';
        const statusText = affected ? 'тёмная зона' : 'чисто';
        return `<span style="display:inline-block;padding:3px 8px;margin:2px;border-radius:4px;background:${bg};font-size:10px" title="${zoneDescriptions[z]}">${icon} ${zoneLabelsRu[z]} <span style="font-size:8px;opacity:0.7">${statusText}</span></span>`;
    }).join('');

    const mainResult = hasRL
        ? `⚠ Обнаружены тёмные зоны вокруг имплантата — возможная резорбция кости или инфекция`
        : `✓ Рентгенопрозрачности нет — в норме вокруг интегрированного имплантата не должно быть тёмных зон`;

    return `<div class="method-detail" data-method="radiolucency" onclick="highlightMethod(this,'radiolucency')">
        <h4>🔍 Рентгенопрозрачность (Radiolucency)
            <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${hasRL ? 'rgba(239,68,68,0.15)' : 'rgba(16,185,129,0.15)'};color:${hasRL ? 'var(--red)' : 'var(--green)'}">
                ${hasRL ? '⚠ ' + (rl.severity_ru || 'Обнаружена') : '✓ Чисто'}
            </span>
        </h4>
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:8px">
            Поиск тёмных зон вокруг имплантата. Тёмное = менее плотное = возможная патология.
            В норме кость вокруг остеоинтегрированного имплантата <strong>равномерно светлая</strong> (без тёмных ореолов).
        </div>
        <div style="font-size:11px;margin:4px 0 8px;color:${hasRL ? 'var(--red)' : 'var(--green)'}">
            ${mainResult}
        </div>
        <div style="margin:6px 0">
            <div style="font-size:11px;margin-bottom:4px"><strong>Карта зон</strong> <span style="font-size:9px;color:var(--text-dim)">(7 областей вокруг имплантата)</span>:</div>
            ${zoneGrid}
        </div>
        ${hasRL && rl.defect_shape ? `<div style="font-size:11px;margin-top:6px">
            <strong>Форма дефекта:</strong> ${rl.defect_shape_ru || rl.defect_shape}
            (Schwarz ${rl.defect_shape === 'circumferential' ? 'Class Ie — круговой дефект' :
                       rl.defect_shape === 'saucer' ? 'Class Ic/Id — блюдцевидный' :
                       rl.defect_shape === 'wedge' ? 'Class Ib — клиновидный' : ''})
        </div>` : ''}
        ${rl.apical_lesion ? `<div style="color:var(--red);font-size:12px;margin:6px 0">
            💀 Апикальное поражение — тёмная зона у верхушки имплантата (ratio ${rl.apical_ratio}).
            Может указывать на ретроградный периимплантит или инфицирование.
        </div>` : ''}
        <details style="margin-top:6px;border-top:1px solid var(--border);padding-top:4px">
            <summary style="font-size:10px;cursor:pointer;color:var(--blue)">📖 Что такое рентгенопрозрачность? (Клик для справки)</summary>
            <div class="method-explainer">
                <strong>Peri-implant Radiolucency</strong> — наличие тёмных (рентгенопрозрачных) зон вокруг имплантата.<br><br>
                <strong>Зачем:</strong> Успешный имплантат окружён плотной костью — на снимке вокруг него <strong>светло и равномерно</strong>. Тёмная зона (ореол) вокруг имплантата = <strong>кость отсутствует или разрушена</strong>. Это один из главных рентгенологических признаков отторжения (неуспеха) имплантата.<br><br>
                <strong>Что значит результат:</strong><br>
                <span class="norm">● <strong>«Чисто» / Нет рентгенопрозрачности</strong> — ЭТО ХОРОШО! Кость плотно прилегает к имплантату. Остеоинтеграция в норме.</span><br>
                <span class="bad">● <strong>«Обнаружена»</strong> — ВНИМАНИЕ. Тёмные зоны найдены. Возможные причины: периимплантит, отсутствие остеоинтеграции, инфекция, перегрузка.</span><br><br>
                <strong>7 зон анализа:</strong> Имплантат делится на 3 уровня (шейка, тело, верхушка) × 2 стороны (медиальная, дистальная) + апикальная зона. Каждая проверяется на наличие тёмных пикселей.<br><br>
                <strong>Классификация Schwarz (2007):</strong><br>
                ● Class Ia — вестибулярная дегисценция<br>
                ● Class Ib — клиновидный дефект<br>
                ● Class Ic/Id — блюдцевидный дефект<br>
                ● Class Ie — круговой дефект (наихудший прогноз)<br><br>
                <strong>Как считается балл (0–100):</strong> 100 = чисто (нет тёмных зон). Каждая поражённая зона снижает балл. Апикальное поражение = критическое снижение. Вес: <strong>25%</strong>.<br><br>
                <strong>Точность:</strong> PPV = 83% для несостоявшихся имплантатов (Schwarz 2007).<br>
                <strong>Ограничение OPG:</strong> Видны только медиальная и дистальная стороны. Буккальный и лингвальный дефекты невидимы — нужна КЛКТ.
            </div>
        </details>
    </div>`;
}

// ═══════════════════════════════════════════════════════════════
// Angulation Rendering
// ═══════════════════════════════════════════════════════════════

function renderAngulationPerImplant(idx, angulation) {
    if (!angulation || !angulation.axes || !angulation.axes[idx]) return '';
    const axis = angulation.axes[idx];
    const angle = axis.corrected_angle;
    const measured = axis.measured_angle;
    const region = axis.region_ru;
    const dist = axis.distortion;

    // Find pairs involving this implant
    const pairs = (angulation.pairs || []).filter(p => p.implant_a.index === idx || p.implant_b.index === idx);

    const angleColor = Math.abs(angle) <= 5 ? '#34d399' : Math.abs(angle) <= 10 ? '#60a5fa' : Math.abs(angle) <= 15 ? '#fbbf24' : '#f87171';

    let pairsHtml = '';
    if (pairs.length > 0) {
        pairsHtml = `<div style="margin-top:6px">
            <div style="font-size:10px;color:var(--text-dim);margin-bottom:3px"><strong>Попарные углы (IIRA):</strong></div>
            ${pairs.map(p => {
                const otherIdx = p.implant_a.index === idx ? p.implant_b.index : p.implant_a.index;
                const otherFdi = p.implant_a.index === idx ? p.implant_b.fdi : p.implant_a.fdi;
                const cls = p.classification;
                return `<span style="display:inline-flex;align-items:center;gap:4px;padding:3px 8px;margin:2px;border-radius:5px;font-size:11px;
                    background:${cls.color}22;border:1px solid ${cls.color}44;color:${cls.color}">
                    ↔ ${otherFdi || ('I'+(otherIdx+1))}: <b>${p.relative_angle}°</b> ${cls.icon} ${cls.label}
                    <span style="font-size:8px;opacity:0.6">${p.accuracy_note}</span>
                </span>`;
            }).join('')}
        </div>`;
    }

    return `<div class="method-detail" data-method="angulation" onclick="highlightMethod(this,'angulation')">
        <h4>📐 Ангуляция (Angulation)
            <span style="font-size:11px;padding:2px 8px;border-radius:4px;background:${angleColor}22;color:${angleColor}">
                ${angle.toFixed(1)}° от вертикали
            </span>
        </h4>
        <div style="font-size:10px;color:var(--text-dim);margin-bottom:6px">
            Наклон длинной оси имплантата от вертикали. Автоматический расчёт по bounding box детекции.
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:11px">
            <div>
                <span style="color:var(--text-dim)">Измеренный:</span> <b>${measured.toFixed(1)}°</b>
            </div>
            <div>
                <span style="color:var(--text-dim)">Скорректированный:</span> <b style="color:${angleColor}">${angle.toFixed(1)}°</b>
            </div>
            <div>
                <span style="color:var(--text-dim)">Регион:</span> ${region}
            </div>
            <div>
                <span style="color:var(--text-dim)">Дисторсия:</span> Mv=${dist.mv} Mh=${dist.mh}
            </div>
        </div>
        ${pairsHtml}
        <details style="margin-top:6px;border-top:1px solid var(--border);padding-top:4px">
            <summary style="font-size:10px;cursor:pointer;color:var(--blue)">📖 Как измеряется ангуляция? (Клик для справки)</summary>
            <div class="method-explainer">
                <strong>Implant Angulation</strong> — угол наклона длинной оси имплантата относительно вертикали.<br><br>
                <strong>Зачем:</strong> Параллельность имплантатов влияет на распределение жевательной нагрузки, тип абатмента и долгосрочный прогноз протеза. Непараллельные имплантаты создают нефизиологические нагрузки на кость.<br><br>
                <strong>Метод IIRA:</strong> Inter-Implant Relative Angle — попарное сравнение углов соседних имплантатов. В пределах одного региона OPG (моляры, премоляры, передний отдел) региональная дисторсия одинакова для обоих имплантатов и взаимно сокращается, что даёт погрешность всего <strong>±1-2°</strong>.<br><br>
                <strong>Клинические пороги (Gulati 2015):</strong><br>
                <span style="color:#34d399">● 0–10°</span> — параллельны (стандартные абатменты)<br>
                <span style="color:#60a5fa">● 10–15°</span> — допустимо (стандартный угловой абатмент)<br>
                <span style="color:#fbbf24">● 15–25°</span> — угловой абатмент 15°/25° необходим<br>
                <span style="color:#f87171">● &gt;25°</span> — индивидуальный абатмент, биомеханический риск<br><br>
                <strong>Коррекция дисторсии:</strong> θ_true = arctan(tan(θ_measured) × Mv/Mh). Коэффициенты по Devlin 1986, Samawi 1998.<br>
                <strong>Точность OPG:</strong> r=0.88-0.94 (боковой), r=0.72-0.85 (передний) vs CBCT.<br>
                <strong>Золотой стандарт:</strong> CBCT (погрешность &lt;0.5°).
            </div>
        </details>
    </div>`;
}

function renderAngulationSummary(angulation) {
    if (!angulation || !angulation.summary || !angulation.pairs || angulation.pairs.length === 0) {
        if (angulation?.summary?.n_implants === 1) {
            const ax = angulation.axes[0];
            return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin:12px 0">
                <div style="font-size:14px;font-weight:600;margin-bottom:6px">📐 Ангуляция</div>
                <div style="font-size:12px;color:var(--text-dim)">
                    Один имплантат — попарный анализ параллельности невозможен.<br>
                    Наклон: <b>${ax.corrected_angle.toFixed(1)}°</b> от вертикали (${ax.region_ru}, Mv=${ax.distortion.mv} Mh=${ax.distortion.mh})
                </div>
            </div>`;
        }
        return '';
    }

    const s = angulation.summary;
    const overallColor = s.overall_class === 'parallel' ? '#34d399' : s.overall_class === 'acceptable' ? '#60a5fa' : s.overall_class === 'angled' ? '#fbbf24' : '#f87171';
    const avgColor = s.avg_class === 'parallel' ? '#34d399' : s.avg_class === 'acceptable' ? '#60a5fa' : s.avg_class === 'angled' ? '#fbbf24' : '#f87171';

    let pairsHtml = angulation.pairs.map(p => {
        const cls = p.classification;
        const aFdi = p.implant_a.fdi || ('I'+(p.implant_a.index+1));
        const bFdi = p.implant_b.fdi || ('I'+(p.implant_b.index+1));
        return `<span style="display:inline-flex;align-items:center;gap:4px;padding:4px 10px;margin:2px;border-radius:6px;font-size:12px;font-weight:600;
            background:${cls.color}22;border:1px solid ${cls.color}44;color:${cls.color}">
            ${aFdi} ↔ ${bFdi}: <b>${p.relative_angle}°</b>
            <span style="font-size:10px;font-weight:400">${cls.icon} ${cls.label}</span>
            ${p.same_region ? '<span style="font-size:8px;opacity:0.5">одн.регион</span>' : ''}
        </span>`;
    }).join('');

    return `<div style="background:var(--surface);border:1px solid var(--border);border-radius:10px;padding:14px 18px;margin:12px 0">
        <div style="font-size:14px;font-weight:600;margin-bottom:8px">
            📐 Параллельность имплантатов
            <span style="font-size:12px;font-weight:400;color:var(--text-dim);margin-left:8px">IIRA — Inter-Implant Relative Angle</span>
        </div>
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:10px">
            <div style="text-align:center">
                <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase">Среднее</div>
                <div style="font-size:20px;font-weight:700;color:${avgColor}">${s.avg_angle}°</div>
                <div style="font-size:10px;color:${avgColor}">${s.avg_label}</div>
            </div>
            <div style="text-align:center">
                <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase">Максимум</div>
                <div style="font-size:20px;font-weight:700;color:${overallColor}">${s.max_angle}°</div>
                <div style="font-size:10px;color:${overallColor}">${s.overall_label}</div>
            </div>
            <div style="text-align:center">
                <div style="font-size:9px;color:var(--text-dim);text-transform:uppercase">Пар</div>
                <div style="font-size:20px;font-weight:700">${s.n_pairs}</div>
                <div style="font-size:10px;color:var(--text-dim)">${s.n_implants} импл.</div>
            </div>
            <div style="display:flex;flex-direction:column;gap:2px;justify-content:center;font-size:11px">
                ${s.parallel_pairs > 0 ? `<span style="color:#34d399">✓ ${s.parallel_pairs} параллельных</span>` : ''}
                ${s.acceptable_pairs > 0 ? `<span style="color:#60a5fa">~ ${s.acceptable_pairs} допустимых</span>` : ''}
                ${s.angled_pairs > 0 ? `<span style="color:#fbbf24">⚠ ${s.angled_pairs} угловых</span>` : ''}
                ${s.risky_pairs > 0 ? `<span style="color:#f87171">✕ ${s.risky_pairs} рисковых</span>` : ''}
            </div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:2px">${pairsHtml}</div>
        <div style="font-size:9px;color:var(--text-dim);margin-top:8px;font-style:italic">
            ${angulation.disclaimer}
        </div>
    </div>`;
}

function getGradeInfo(grade) {
    const map = {
        bone_intact:    {icon:'🟢', label:'Кость в норме', color:'var(--green)'},
        bone_remodel:   {icon:'🟡', label:'Ремоделирование', color:'var(--yellow)'},
        bone_loss_mild: {icon:'🟠', label:'Лёгкая убыль кости', color:'#f97316'},
        bone_loss_mod:  {icon:'🔴', label:'Умеренная убыль', color:'var(--red)'},
        bone_loss_sev:  {icon:'⚫', label:'Тяжёлая убыль', color:'#888'},
        bone_lesion:    {icon:'💀', label:'Апикальное поражение', color:'#a855f7'},
    };
    return map[grade] || {icon:'❓', label:grade, color:'var(--text-dim)'};
}

function getSuperInfo(sup) {
    const map = {
        impl_fixture:  {icon:'⬡', label:'Только тело (fixture)'},
        impl_healing:  {icon:'⬡↑', label:'Формирователь десны'},
        impl_restored: {icon:'⬡♛', label:'С коронкой'},
    };
    return map[sup] || {icon:'⬡', label:sup};
}

