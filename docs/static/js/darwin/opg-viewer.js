// opg-viewer.js — OPG fullscreen viewer, distortion correction, angulation tool
// Extracted from darwin_lab.html lines 3544–4985
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Fullscreen OPG Viewer — zoom/pan/filter
// ═══════════════════════════════════════════════════════════════

let opgViewer = null; // {overlay, img, zoom, panX, panY, dragging, lastX, lastY, filter}
let currentFileId = null;  // Текущий file_id для overlay-state persistence

function openOPGViewer(startFilter) {
    if (opgViewer) return;
    if (!lastAssessmentData) return;

    const fileId = lastAssessmentData.file_id;
    currentFileId = fileId;  // Track for overlay-state persistence
    const filter = startFilter || '';
    const imgUrl = filter
        ? `/api/implant-assessment/${fileId}/filtered?filter=${filter}`
        : `/api/files/${fileId}/preview`;

    const segUrl = `/api/panorama/${fileId}/segmentation-overlay.jpg`;

    const overlay = document.createElement('div');
    overlay.className = 'opg-viewer-overlay';
    overlay.innerHTML = `
        <div class="opg-viewer-toolbar">
            <button onclick="closeOPGViewer()" title="Закрыть (Esc)" style="font-weight:700">✕</button>
            <div class="vt-sep"></div>
            <span class="vt-label">Снимок:</span>
            <button class="vs-btn active" onclick="opgViewerSource('orig',this)" title="Оригинальный снимок">📷 Оригинал</button>
            <button class="vs-btn" onclick="opgViewerSource('seg',this)" title="С разметкой YOLO (прямоугольники)">🔬 Разметка</button>
            <div class="vt-sep"></div>
            <span class="vt-label">Фильтр:</span>
            <button class="vf-btn ${!filter?'active':''}" onclick="opgViewerFilter('')">Без</button>
            <button class="vf-btn ${filter==='clahe'?'active':''}" onclick="opgViewerFilter('clahe')">CLAHE</button>
            <button class="vf-btn ${filter==='contrast'?'active':''}" onclick="opgViewerFilter('contrast')">Контраст</button>
            <button class="vf-btn ${filter==='bone_window'?'active':''}" onclick="opgViewerFilter('bone_window')">Кость</button>
            <button class="vf-btn ${filter==='inverted'?'active':''}" onclick="opgViewerFilter('inverted')">Инверсия</button>
            <div class="vt-sep"></div>
            <button onclick="opgViewerZoom(-0.25)" title="Уменьшить">−</button>
            <span class="vt-zoom" id="opg-viewer-zoom">100%</span>
            <button onclick="opgViewerZoom(+0.25)" title="Увеличить">+</button>
            <button onclick="opgViewerFit()" title="Вписать в экран">⬜</button>
            <button onclick="opgViewerZoom1()" title="100% натуральный размер">1:1</button>
            <div class="vt-sep"></div>
            <div class="vt-sep"></div>
            <button onclick="toggleDistPanel()" title="Панель коррекции дисторсии OPG">📐 Дисторсия</button>
            <button id="ang-mode-btn" onclick="toggleAngMode()" title="Измерение углов между имплантатами: кликните 2 точки на оси каждого имплантата">📏 Углы</button>
            <button id="lib-mode-btn" onclick="toggleLibPanel()" title="Библиотека имплантатов: наложение силуэтов на OPG">🦷 Библиотека</button>
            <button id="warp-mode-btn" onclick="toggleWarpPanel()" title="Локальная деформация: сжатие/расширение верха и низа имплантата для компенсации дисторсии">🔧 Warp</button>
            <span class="vt-label" style="margin-left:auto">Колесо — зум · Тяни — прокрутка · Esc — закрыть</span>
        </div>
        <div class="ang-panel" id="ang-panel">
            <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
                <div style="flex:1;min-width:350px">
                    <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);margin-bottom:6px">
                        📏 Измерение параллельности имплантатов
                        <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,0.4);margin-left:8px">IIRA — Inter-Implant Relative Angle</span>
                    </div>
                    <div class="ang-hint" id="ang-hint">Оси имплантатов загружены автоматически. Кликните 2 точки для добавления вручную.</div>
                    <div id="ang-axes" style="display:flex;gap:4px;flex-wrap:wrap;margin-top:6px"></div>
                    <div id="ang-pairs" style="margin-top:8px"></div>
                    <div style="margin-top:6px">
                        <button onclick="angClear()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:10px">✕ Очистить все</button>
                        <button onclick="angUndo()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);padding:3px 10px;border-radius:4px;cursor:pointer;font-size:10px;margin-left:4px">↩ Отменить</button>
                    </div>
                </div>
                <div style="flex:0 0 280px">
                    <div style="font-size:10px;color:rgba(255,255,255,0.5);line-height:1.5">
                        <b style="color:rgba(255,255,255,0.7)">Клинические пороги (Gulati 2015):</b><br>
                        <span style="color:#34d399">● 0–10°</span> параллельны<br>
                        <span style="color:#60a5fa">● 10–15°</span> допустимо (стандартный абатмент)<br>
                        <span style="color:#fbbf24">● 15–25°</span> угловой абатмент (15°/25°)<br>
                        <span style="color:#f87171">● &gt;25°</span> индивидуальный абатмент / риск<br><br>
                        <b style="color:rgba(255,255,255,0.7)">Коррекция дисторсии:</b><br>
                        Углы автоматически пересчитываются<br>
                        по Mv/Mh из панели дисторсии.
                    </div>
                    <div style="font-size:9px;color:rgba(255,255,255,0.2);margin-top:4px;font-style:italic">
                        Yeo 2002, Vazquez 2013, Gulati 2015. Погрешность ±5° (боковой), ±10° (передний).
                    </div>
                </div>
            </div>
        </div>
        <!-- Implant Library Panel -->
        <div class="lib-panel" id="lib-panel">
            <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
                <div style="flex:1;min-width:400px">
                    <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);margin-bottom:6px">
                        🦷 Библиотека имплантатов
                        <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,0.4);margin-left:8px">Наложение силуэтов на OPG</span>
                    </div>
                    <div class="lib-systems" id="lib-systems">
                        <span style="font-size:10px;color:rgba(255,255,255,0.4)">Загрузка...</span>
                    </div>
                    <div class="lib-variants" id="lib-variants"></div>
                    <div class="lib-controls" style="margin-top:8px">
                        <label>Прозрачность:</label>
                        <input type="range" min="0" max="100" value="60" id="lib-opacity" oninput="libUpdateOpacity()">
                        <span id="lib-opacity-val" style="font-size:10px;color:rgba(255,255,255,0.5);min-width:30px">60%</span>
                        <div class="vt-sep"></div>
                        <label>Авто-подбор:</label>
                        <button onclick="libAutoMatch()" style="background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);color:#34d399;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:10px">🔍 Подобрать</button>
                        <button onclick="libClearOverlays()" style="background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.3);color:#f87171;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:10px;margin-left:4px">✕ Убрать</button>
                    </div>
                </div>
                <div style="flex:0 0 100px" id="lib-preview-area">
                    <div class="lib-svg-wrap" id="lib-svg-preview" style="max-height:130px;display:flex;align-items:center;justify-content:center;overflow:hidden">
                        <span style="font-size:9px;color:rgba(255,255,255,0.3)">Выберите<br>систему</span>
                    </div>
                </div>
            </div>
        </div>
        <!-- Local Warp Panel -->
        <div class="warp-panel" id="warp-panel">
            <div style="display:flex;gap:20px;flex-wrap:wrap;align-items:flex-start">
                <div style="flex:1;min-width:320px">
                    <div style="font-size:13px;font-weight:600;color:#c4b5fd;margin-bottom:6px">
                        🔧 Локальная деформация имплантата
                        <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,0.4);margin-left:6px">Компенсация неравномерной дисторсии OPG</span>
                    </div>
                    <div class="warp-impl-select" id="warp-impl-select">
                        <span style="font-size:10px;color:rgba(255,255,255,0.4)">Сначала наложите силуэты (🦷 Библиотека → 🔍 Подобрать)</span>
                    </div>
                    <div id="warp-controls" style="display:none">
                        <div style="display:flex;gap:16px;flex-wrap:wrap">
                            <div style="flex:1;min-width:200px">
                                <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:4px">↔ Горизонтальная деформация</div>
                                <div class="warp-row">
                                    <label>▲ Верх (платф.):</label>
                                    <input type="range" min="50" max="200" value="100" id="warp-top-sx" oninput="warpSliderChanged()">
                                    <span class="warp-val" id="warp-top-sx-val">1.00×</span>
                                </div>
                                <div class="warp-row">
                                    <label>◆ Середина:</label>
                                    <input type="range" min="50" max="200" value="100" id="warp-mid-sx" oninput="warpSliderChanged()">
                                    <span class="warp-val" id="warp-mid-sx-val">1.00×</span>
                                </div>
                                <div class="warp-row">
                                    <label>▼ Низ (апекс):</label>
                                    <input type="range" min="50" max="200" value="100" id="warp-bot-sx" oninput="warpSliderChanged()">
                                    <span class="warp-val" id="warp-bot-sx-val">1.00×</span>
                                </div>
                            </div>
                            <div style="flex:1;min-width:200px">
                                <div style="font-size:10px;color:rgba(255,255,255,0.4);margin-bottom:4px">↕ Вертикальная деформация</div>
                                <div class="warp-row">
                                    <label>▲ Верх:</label>
                                    <input type="range" min="50" max="200" value="100" id="warp-top-sy" oninput="warpSliderChanged()">
                                    <span class="warp-val" id="warp-top-sy-val">1.00×</span>
                                </div>
                                <div class="warp-row">
                                    <label>◆ Середина:</label>
                                    <input type="range" min="50" max="200" value="100" id="warp-mid-sy" oninput="warpSliderChanged()">
                                    <span class="warp-val" id="warp-mid-sy-val">1.00×</span>
                                </div>
                                <div class="warp-row">
                                    <label>▼ Низ:</label>
                                    <input type="range" min="50" max="200" value="100" id="warp-bot-sy" oninput="warpSliderChanged()">
                                    <span class="warp-val" id="warp-bot-sy-val">1.00×</span>
                                </div>
                            </div>
                        </div>
                        <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap">
                            <button onclick="warpReset()" style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);color:rgba(255,255,255,0.6);padding:3px 10px;border-radius:4px;cursor:pointer;font-size:10px">↺ Сброс</button>
                            <button onclick="warpApplyToImage()" style="background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3);color:#a78bfa;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:10px" title="Применить деформацию к области снимка вокруг имплантата">⬇ Применить к снимку</button>
                            <button onclick="warpCopyAll()" style="background:rgba(167,139,250,0.15);border:1px solid rgba(167,139,250,0.3);color:#a78bfa;padding:3px 10px;border-radius:4px;cursor:pointer;font-size:10px" title="Скопировать эти параметры на все имплантаты в том же регионе">📋 Копировать на регион</button>
                            <span id="warp-info" style="font-size:10px;color:rgba(255,255,255,0.3);margin-left:auto"></span>
                        </div>
                    </div>
                </div>
                <div style="flex:0 0 240px">
                    <div style="font-size:10px;color:rgba(255,255,255,0.5);line-height:1.6">
                        <b style="color:#c4b5fd">Принцип:</b><br>
                        OPG-дисторсия неравномерна:<br>
                        верх имплантата может быть<br>
                        сжат иначе, чем низ (особенно<br>
                        во фронтальном отделе).<br><br>
                        <b style="color:#c4b5fd">Использование:</b><br>
                        1. Наложите силуэт (🦷)<br>
                        2. Сжимайте/расширяйте верх и<br>
                        низ пока силуэт не совпадёт<br>
                        3. Эталон: известные размеры<br>
                        имплантата из каталога<br><br>
                        <span style="color:rgba(255,255,255,0.3);font-size:9px">Тяните ручки (● фиолетовые) прямо на снимке</span>
                    </div>
                </div>
            </div>
        </div>
        <div class="dist-panel" id="dist-panel">
            <div style="display:flex;gap:16px;flex-wrap:wrap;align-items:flex-start">
                <div style="flex:1;min-width:520px">
                    <div style="font-size:13px;font-weight:600;color:rgba(255,255,255,0.85);margin-bottom:6px">
                        📐 Зонная коррекция панорамной дисторсии
                        <span style="font-size:10px;font-weight:400;color:rgba(255,255,255,0.4);margin-left:6px">5 зон × Mv/Mh (Devlin 1986, Samawi 1998)</span>
                    </div>
                    <!-- Zone map: visual representation of 5 zones -->
                    <div style="display:flex;align-items:stretch;gap:1px;margin-bottom:8px;height:32px;border-radius:6px;overflow:hidden;border:1px solid rgba(255,255,255,0.1)">
                        <div id="dz-btn-0" onclick="distSelectZone(0)" style="flex:2.5;background:rgba(96,165,250,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;color:#60a5fa;transition:0.15s" title="Правые моляры/ветвь">🦷R моляры</div>
                        <div id="dz-btn-1" onclick="distSelectZone(1)" style="flex:1.2;background:rgba(52,211,153,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;color:#34d399;transition:0.15s" title="Правые премоляры (переходная зона)">R премол.</div>
                        <div id="dz-btn-2" onclick="distSelectZone(2)" style="flex:2.5;background:rgba(251,191,36,0.2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;color:#fbbf24;transition:0.15s;border:1px solid rgba(251,191,36,0.3)" title="Передний отдел (максимальная дисторсия)">⚠ Передний</div>
                        <div id="dz-btn-3" onclick="distSelectZone(3)" style="flex:1.2;background:rgba(52,211,153,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;color:#34d399;transition:0.15s" title="Левые премоляры (переходная зона)">L премол.</div>
                        <div id="dz-btn-4" onclick="distSelectZone(4)" style="flex:2.5;background:rgba(96,165,250,0.15);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:9px;color:#60a5fa;transition:0.15s" title="Левые моляры/ветвь">🦷L моляры</div>
                    </div>
                    <!-- Per-zone controls -->
                    <div id="dist-zone-controls">
                        <div class="dist-row">
                            <label id="dz-label" style="min-width:120px;font-weight:600;color:#fbbf24">⚠ Передний:</label>
                            <span style="font-size:10px;color:rgba(255,255,255,0.4);margin-right:8px">Mv</span>
                            <input type="range" min="80" max="160" value="120" id="dz-mv" oninput="distZoneChanged()" style="max-width:120px">
                            <span class="dist-val" id="dz-mv-val">1.20×</span>
                            <span style="font-size:10px;color:rgba(255,255,255,0.4);margin-left:8px">Mh</span>
                            <input type="range" min="60" max="160" value="90" id="dz-mh" oninput="distZoneChanged()" style="max-width:120px">
                            <span class="dist-val" id="dz-mh-val">0.90×</span>
                        </div>
                    </div>
                    <div class="dist-row">
                        <label>Сетка:</label>
                        <input type="range" min="0" max="100" value="40" id="dist-grid-opacity" oninput="applyDistortion()">
                        <span class="dist-val" id="dist-grid-val">40%</span>
                        <label style="display:inline-flex;align-items:center;gap:4px;margin-left:12px;cursor:pointer">
                            <input type="checkbox" id="dist-warp-img" onchange="applyDistortion()"> <span style="font-size:10px;color:rgba(255,255,255,0.5)">Warp снимок</span>
                        </label>
                        <span style="font-size:10px;color:rgba(255,255,255,0.3);margin-left:8px">Интерполяция: полиномиальная</span>
                    </div>
                    <div class="dist-presets" style="margin-top:4px">
                        <span style="font-size:10px;color:rgba(255,255,255,0.4);margin-right:4px">Пресеты:</span>
                        <button onclick="distPresetProfile('standard')" title="Стандартный профиль: задний 1.27/1.20, передний 1.20/0.90 (Devlin 1986)">📊 Стандарт</button>
                        <button onclick="distPresetProfile('forward')" title="Пациент вперёд: передние зубы расширены (Mh↑ в переднем)">👤→ Вперёд</button>
                        <button onclick="distPresetProfile('backward')" title="Пациент назад: передние зубы сжаты (Mh↓ в переднем)">←👤 Назад</button>
                        <button onclick="distPresetProfile('flat')" title="Равномерная коррекция 1.25 везде">⬜ Равномерная</button>
                        <button onclick="distPresetProfile('none')" title="Без коррекции (все зоны = 1.00)">✕ Сброс</button>
                    </div>
                </div>
                <details style="flex:0 0 280px;font-size:11px;color:rgba(255,255,255,0.5)">
                    <summary style="cursor:pointer;font-size:10px;color:rgba(255,255,255,0.4)">ℹ Справка</summary>
                    <div class="dist-info" style="margin-top:4px">
                        <b>Зонная коррекция:</b> Дисторсия OPG неравномерна.<br>
                        Фокальный слой: 6-8 мм (передний) vs 15-20 мм (задний).<br>
                        Mh: 0.80-1.00 (передний) ↔ 1.20-1.30 (задний).<br>
                        <b>Позиционирование:</b> Вперёд → расширены, Назад → сжаты, Ротация → L≠R<br>
                        <b>Коррекция:</b> Каждая зона — свои Mv/Mh. Интерполяция между зонами.
                    </div>
                    <div class="dist-disclaimer">⚠ Devlin 1986, Samawi 1998, McDavid 1981. OPG — скрининг.</div>
                </details>
            </div>
        </div>
        <div class="opg-viewer-canvas" id="opg-viewer-canvas">
            <img id="opg-viewer-img" src="${imgUrl}">
            <canvas id="dist-warp-canvas" style="position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;display:none"></canvas>
            <canvas id="dist-grid-canvas" class="dist-grid"></canvas>
            <canvas id="ang-canvas" class="ang-canvas"></canvas>
            <canvas id="lib-overlay-canvas" class="lib-overlay-canvas"></canvas>
        </div>
    `;
    document.body.appendChild(overlay);

    const canvas = overlay.querySelector('#opg-viewer-canvas');
    const img = overlay.querySelector('#opg-viewer-img');

    opgViewer = {overlay, img, canvas, zoom:1, panX:0, panY:0, dragging:false, lastX:0, lastY:0, filter, source:'orig', segUrl};

    // Fit on load, then auto-populate angulation axes from backend data
    img.onload = () => {
        opgViewerFit();
        autoLoadAngulationAxes();
        // Load saved overlay state if any
        _overlayLoad(fileId);
    };

    // Mouse wheel zoom
    canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.15 : 0.15;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        // Zoom toward cursor
        const oldZoom = opgViewer.zoom;
        const newZoom = Math.max(0.1, Math.min(10, oldZoom + delta));
        const scale = newZoom / oldZoom;
        opgViewer.panX = mx - (mx - opgViewer.panX) * scale;
        opgViewer.panY = my - (my - opgViewer.panY) * scale;
        opgViewer.zoom = newZoom;
        opgViewerApply();
    }, {passive:false});

    // Pan
    canvas.addEventListener('mousedown', (e) => {
        opgViewer.dragging = true;
        opgViewer._dragMoved = false;
        opgViewer._dragStartX = e.clientX;
        opgViewer._dragStartY = e.clientY;
        opgViewer.lastX = e.clientX;
        opgViewer.lastY = e.clientY;
        canvas.classList.add('dragging');
    });
    window.addEventListener('mousemove', opgViewerMouseMove);
    window.addEventListener('mouseup', opgViewerMouseUp);

    // Touch support
    let lastTouchDist = 0;
    canvas.addEventListener('touchstart', (e) => {
        if (e.touches.length === 1) {
            opgViewer.dragging = true;
            opgViewer.lastX = e.touches[0].clientX;
            opgViewer.lastY = e.touches[0].clientY;
        } else if (e.touches.length === 2) {
            lastTouchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
        }
    }, {passive:false});
    canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 1 && opgViewer.dragging) {
            opgViewer.panX += e.touches[0].clientX - opgViewer.lastX;
            opgViewer.panY += e.touches[0].clientY - opgViewer.lastY;
            opgViewer.lastX = e.touches[0].clientX;
            opgViewer.lastY = e.touches[0].clientY;
            opgViewerApply();
        } else if (e.touches.length === 2) {
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY
            );
            if (lastTouchDist > 0) {
                opgViewer.zoom *= dist / lastTouchDist;
                opgViewer.zoom = Math.max(0.1, Math.min(10, opgViewer.zoom));
                opgViewerApply();
            }
            lastTouchDist = dist;
        }
    }, {passive:false});
    canvas.addEventListener('touchend', () => { opgViewer.dragging = false; lastTouchDist = 0; });
}

function opgViewerMouseMove(e) {
    if (!opgViewer?.dragging) return;
    const dx = e.clientX - (opgViewer._dragStartX||0);
    const dy = e.clientY - (opgViewer._dragStartY||0);
    if (Math.hypot(dx, dy) > 4) opgViewer._dragMoved = true;
    opgViewer.panX += e.clientX - opgViewer.lastX;
    opgViewer.panY += e.clientY - opgViewer.lastY;
    opgViewer.lastX = e.clientX;
    opgViewer.lastY = e.clientY;
    opgViewerApply();
}

function opgViewerMouseUp() {
    if (!opgViewer) return;
    opgViewer.dragging = false;
    opgViewer.canvas?.classList.remove('dragging');
}

function opgViewerApply() {
    if (!opgViewer) return;
    const {img, zoom, panX, panY} = opgViewer;
    // Zone-based distortion: image stays 1:1, grid overlay shows zone corrections
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;
    // Redraw zone grid and warp if distortion panel is open
    const distPanel = document.getElementById('dist-panel');
    if (distPanel && distPanel.classList.contains('open')) {
        const gridOpacity = parseInt(document.getElementById('dist-grid-opacity')?.value || 40) / 100;
        drawDistGrid(gridOpacity);
        drawDistWarpImage();
    }
    const zoomEl = document.getElementById('opg-viewer-zoom');
    if (zoomEl) zoomEl.textContent = `${Math.round(zoom * 100)}%`;
    // Redraw angulation lines on pan/zoom
    if (angState.active && angState.axes.length > 0 || angState.currentPt) angRedraw();
    // Redraw implant library overlays
    if (libState.overlays.length > 0) libRedrawOverlays();
}

function opgViewerFit() {
    if (!opgViewer) return;
    const {img, canvas} = opgViewer;
    const cw = canvas.clientWidth;
    const ch = canvas.clientHeight;
    const iw = img.naturalWidth || img.width || cw;
    const ih = img.naturalHeight || img.height || ch;
    opgViewer.zoom = Math.min(cw / iw, ch / ih, 1);
    opgViewer.panX = (cw - iw * opgViewer.zoom) / 2;
    opgViewer.panY = (ch - ih * opgViewer.zoom) / 2;
    opgViewerApply();
}

function opgViewerZoom1() {
    if (!opgViewer) return;
    const {canvas} = opgViewer;
    opgViewer.zoom = 1;
    opgViewer.panX = canvas.clientWidth / 2 - (opgViewer.img.naturalWidth || 1000) / 2;
    opgViewer.panY = canvas.clientHeight / 2 - (opgViewer.img.naturalHeight || 500) / 2;
    opgViewerApply();
}

function opgViewerZoom(delta) {
    if (!opgViewer) return;
    const {canvas} = opgViewer;
    const cx = canvas.clientWidth / 2;
    const cy = canvas.clientHeight / 2;
    const oldZoom = opgViewer.zoom;
    const newZoom = Math.max(0.1, Math.min(10, oldZoom + delta));
    const scale = newZoom / oldZoom;
    opgViewer.panX = cx - (cx - opgViewer.panX) * scale;
    opgViewer.panY = cy - (cy - opgViewer.panY) * scale;
    opgViewer.zoom = newZoom;
    opgViewerApply();
}

function opgViewerBuildUrl() {
    if (!opgViewer || !lastAssessmentData) return '';
    const fileId = lastAssessmentData.file_id;
    if (opgViewer.source === 'seg') {
        // Segmentation overlay — no filters apply (it's a pre-rendered image)
        return opgViewer.segUrl;
    }
    return opgViewer.filter
        ? `/api/implant-assessment/${fileId}/filtered?filter=${opgViewer.filter}`
        : `/api/files/${fileId}/preview`;
}

function opgViewerSource(source, btnEl) {
    if (!opgViewer) return;
    opgViewer.source = source;
    opgViewer.img.src = opgViewerBuildUrl();
    opgViewer.img.onload = () => opgViewerFit();
    // Update source buttons
    opgViewer.overlay.querySelectorAll('.vs-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    // Disable/enable filter buttons when in seg mode
    opgViewer.overlay.querySelectorAll('.vf-btn').forEach(b => {
        b.style.opacity = source === 'seg' ? '0.3' : '1';
        b.style.pointerEvents = source === 'seg' ? 'none' : 'auto';
    });
}

function opgViewerFilter(filter) {
    if (!opgViewer || !lastAssessmentData) return;
    opgViewer.filter = filter;
    if (opgViewer.source === 'seg') opgViewer.source = 'orig'; // switch back to orig if picking a filter
    opgViewer.img.src = opgViewerBuildUrl();
    opgViewer.img.onload = () => opgViewerFit();
    // Update filter buttons
    opgViewer.overlay.querySelectorAll('.vf-btn').forEach(b => b.classList.remove('active'));
    const labels = {'':'Без','clahe':'CLAHE','contrast':'Контраст','bone_window':'Кость','inverted':'Инверсия'};
    opgViewer.overlay.querySelectorAll('.vf-btn').forEach(b => {
        if (b.textContent === labels[filter]) b.classList.add('active');
    });
    // Update source buttons back to orig
    opgViewer.overlay.querySelectorAll('.vs-btn').forEach(b => b.classList.remove('active'));
    const origBtn = opgViewer.overlay.querySelector('.vs-btn');
    if (origBtn) origBtn.classList.add('active');
    opgViewer.overlay.querySelectorAll('.vf-btn').forEach(b => {
        b.style.opacity = '1';
        b.style.pointerEvents = 'auto';
    });
}

function closeOPGViewer() {
    if (!opgViewer) return;
    window.removeEventListener('mousemove', opgViewerMouseMove);
    window.removeEventListener('mouseup', opgViewerMouseUp);
    if (opgViewer._angClick) {
        opgViewer.canvas.removeEventListener('click', opgViewer._angClick);
    }
    opgViewer.overlay.remove();
    opgViewer = null;
    angState = {active:false, axes:[], currentPt:null};
}

// ═══════════════════════════════════════════════════════════════
// Distortion Correction Panel
// ═══════════════════════════════════════════════════════════════

function toggleDistPanel() {
    const panel = document.getElementById('dist-panel');
    if (!panel) return;
    panel.classList.toggle('open');
    if (panel.classList.contains('open')) applyDistortion();
}

// ═══════════════════════════════════════════════════════════════
// ZONE-BASED DISTORTION — 5 zones with independent Mv/Mh
// ═══════════════════════════════════════════════════════════════
//
// 5-zone model (Devlin 1986, Samawi & Metallidis 1998, McDavid 1981):
//   Zone 0: Right molar/ramus   (0.00–0.22 of image width)
//   Zone 1: Right premolar       (0.22–0.37)
//   Zone 2: Anterior             (0.37–0.63)  ← most distortion, focal trough 6-8mm
//   Zone 3: Left premolar        (0.63–0.78)
//   Zone 4: Left molar/ramus    (0.78–1.00)
//
// Between zones: polynomial interpolation for smooth transition.
// Image is rendered via canvas pixel-by-pixel warp (not CSS transform).

const distZones = [
    { name: 'R моляры',   mv: 1.27, mh: 1.20, x0: 0.00, x1: 0.22, color: 'rgba(96,165,250,0.3)' },
    { name: 'R премол.',  mv: 1.24, mh: 1.15, x0: 0.22, x1: 0.37, color: 'rgba(52,211,153,0.3)' },
    { name: 'Передний',   mv: 1.20, mh: 0.90, x0: 0.37, x1: 0.63, color: 'rgba(251,191,36,0.3)' },
    { name: 'L премол.',  mv: 1.24, mh: 1.15, x0: 0.63, x1: 0.78, color: 'rgba(52,211,153,0.3)' },
    { name: 'L моляры',   mv: 1.27, mh: 1.20, x0: 0.78, x1: 1.00, color: 'rgba(96,165,250,0.3)' },
];
let distSelectedZone = 2; // default: anterior

function distSelectZone(idx) {
    distSelectedZone = idx;
    // Highlight zone button
    for (let i = 0; i < 5; i++) {
        const btn = document.getElementById('dz-btn-' + i);
        if (btn) btn.style.outline = i === idx ? '2px solid #fff' : 'none';
    }
    // Update sliders
    const z = distZones[idx];
    const mvEl = document.getElementById('dz-mv');
    const mhEl = document.getElementById('dz-mh');
    if (mvEl) mvEl.value = Math.round(z.mv * 100);
    if (mhEl) mhEl.value = Math.round(z.mh * 100);
    const label = document.getElementById('dz-label');
    if (label) {
        label.textContent = z.name + ':';
        label.style.color = ['#60a5fa','#34d399','#fbbf24','#34d399','#60a5fa'][idx];
    }
    distZoneChanged(true); // update display only
}

function distZoneChanged(displayOnly) {
    const idx = distSelectedZone;
    const mvEl = document.getElementById('dz-mv');
    const mhEl = document.getElementById('dz-mh');
    if (mvEl) {
        distZones[idx].mv = parseInt(mvEl.value) / 100;
        const valEl = document.getElementById('dz-mv-val');
        if (valEl) valEl.textContent = distZones[idx].mv.toFixed(2) + '×';
    }
    if (mhEl) {
        distZones[idx].mh = parseInt(mhEl.value) / 100;
        const valEl = document.getElementById('dz-mh-val');
        if (valEl) valEl.textContent = distZones[idx].mh.toFixed(2) + '×';
    }
    if (!displayOnly) applyDistortion();
}

function distPresetProfile(name) {
    const profiles = {
        standard: [{mv:1.27,mh:1.20},{mv:1.24,mh:1.15},{mv:1.20,mh:0.90},{mv:1.24,mh:1.15},{mv:1.27,mh:1.20}],
        forward:  [{mv:1.27,mh:1.20},{mv:1.24,mh:1.15},{mv:1.20,mh:1.10},{mv:1.24,mh:1.15},{mv:1.27,mh:1.20}],
        backward: [{mv:1.27,mh:1.20},{mv:1.24,mh:1.10},{mv:1.20,mh:0.75},{mv:1.24,mh:1.10},{mv:1.27,mh:1.20}],
        flat:     [{mv:1.25,mh:1.25},{mv:1.25,mh:1.25},{mv:1.25,mh:1.25},{mv:1.25,mh:1.25},{mv:1.25,mh:1.25}],
        none:     [{mv:1.00,mh:1.00},{mv:1.00,mh:1.00},{mv:1.00,mh:1.00},{mv:1.00,mh:1.00},{mv:1.00,mh:1.00}],
    };
    const p = profiles[name];
    if (!p) return;
    for (let i = 0; i < 5; i++) {
        distZones[i].mv = p[i].mv;
        distZones[i].mh = p[i].mh;
    }
    document.querySelectorAll('.dist-presets button').forEach(b => b.classList.remove('active'));
    event?.target?.closest('button')?.classList.add('active');
    distSelectZone(distSelectedZone);
    applyDistortion();
}

// Get interpolated Mv/Mh at a given relative X position (0..1)
function distGetMagAt(relX) {
    // Find which zone and interpolate
    // Zone centers for interpolation
    const centers = distZones.map(z => (z.x0 + z.x1) / 2);
    const mvs = distZones.map(z => z.mv);
    const mhs = distZones.map(z => z.mh);

    // Clamp and interpolate between nearest zone centers
    if (relX <= centers[0]) return {mv: mvs[0], mh: mhs[0]};
    if (relX >= centers[4]) return {mv: mvs[4], mh: mhs[4]};

    for (let i = 0; i < 4; i++) {
        if (relX >= centers[i] && relX <= centers[i+1]) {
            const t = (relX - centers[i]) / (centers[i+1] - centers[i]);
            // Smooth interpolation (smoothstep)
            const s = t * t * (3 - 2 * t);
            return {
                mv: mvs[i] * (1 - s) + mvs[i+1] * s,
                mh: mhs[i] * (1 - s) + mhs[i+1] * s,
            };
        }
    }
    return {mv: 1.25, mh: 1.20}; // fallback
}

function applyDistortion() {
    if (!opgViewer) return;
    const gridOpacity = parseInt(document.getElementById('dist-grid-opacity')?.value || 40) / 100;
    const gridVal = document.getElementById('dist-grid-val');
    if (gridVal) gridVal.textContent = Math.round(gridOpacity * 100) + '%';

    // Zone-based: NO CSS transform on image — draw warped grid on canvas only
    // The image stays at 1:1 scale; the grid shows what real-world proportions look like
    const {img, zoom, panX, panY} = opgViewer;
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${zoom})`;

    drawDistGrid(gridOpacity);
    drawDistWarpImage();

    // Recalculate angulation if active
    if (angState.active && angState.axes.length > 0) {
        angUpdateUI();
        angRedraw();
    }
}

function drawDistGrid(opacity) {
    const gridCanvas = document.getElementById('dist-grid-canvas');
    if (!gridCanvas || !opgViewer) return;

    const container = opgViewer.canvas;
    gridCanvas.width = container.clientWidth;
    gridCanvas.height = container.clientHeight;

    const ctx = gridCanvas.getContext('2d');
    ctx.clearRect(0, 0, gridCanvas.width, gridCanvas.height);

    if (opacity < 0.01) return;

    const imgEl = opgViewer.img;
    const imgW = imgEl.naturalWidth || 1000;
    const imgH = imgEl.naturalHeight || 500;
    const zoom = opgViewer.zoom;
    const ox = opgViewer.panX;
    const oy = opgViewer.panY;
    const displayW = imgW * zoom;
    const displayH = imgH * zoom;

    // ── Draw zone backgrounds ──
    for (const z of distZones) {
        const zx0 = ox + z.x0 * displayW;
        const zx1 = ox + z.x1 * displayW;
        ctx.fillStyle = z.color.replace(/[\d.]+\)$/, (opacity * 0.3).toFixed(2) + ')');
        ctx.fillRect(zx0, Math.max(0, oy), zx1 - zx0, Math.min(displayH, gridCanvas.height - oy));
    }

    // ── Draw distortion-warped grid ──
    // Grid in real-world coordinates: evenly spaced in mm, but displayed with zone-varying spacing
    const baseSpacingMM = 5; // 5mm real-world grid
    const basePxPerMM = zoom * 3; // approximate: 3 pixels/mm at zoom=1
    const baseSpacing = baseSpacingMM * basePxPerMM;

    if (baseSpacing < 3) return;

    // Horizontal lines: uniform (Mv varies slowly, draw as straight lines with zone-tinted)
    ctx.lineWidth = 0.5;
    for (let y = oy; y < Math.min(oy + displayH, gridCanvas.height); y += baseSpacing) {
        if (y < 0) continue;
        ctx.strokeStyle = `rgba(100, 180, 255, ${opacity * 0.3})`;
        ctx.beginPath();
        ctx.moveTo(Math.max(0, ox), y);
        ctx.lineTo(Math.min(gridCanvas.width, ox + displayW), y);
        ctx.stroke();
    }

    // Vertical lines: WARPED by zone Mh — lines are closer together in anterior (Mh<1)
    // We iterate in real-world (corrected) coordinates and map to screen
    const nVertLines = Math.ceil(imgW / (baseSpacingMM * 3)); // number of lines across image
    for (let i = 0; i <= nVertLines; i++) {
        const realX = i / nVertLines; // 0..1 relative position
        const {mh} = distGetMagAt(realX);
        // In the image, this position is: accumulated warped position
        // Simple approach: the screen position is shifted based on local Mh
        // Screen x = ox + realX * displayW, but the grid line spacing reflects 1/Mh
        const screenX = ox + realX * displayW;
        if (screenX < 0 || screenX > gridCanvas.width) continue;

        // Color intensity shows distortion magnitude
        const distMag = Math.abs(mh - 1.0);
        const r = mh < 1.0 ? 255 : 100;
        const g = mh < 1.0 ? 150 : 180;
        const b = 255;
        ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${opacity * (0.2 + distMag * 0.6)})`;
        ctx.lineWidth = 0.5 + distMag * 1.5;
        ctx.beginPath();
        ctx.moveTo(screenX, Math.max(0, oy));
        ctx.lineTo(screenX, Math.min(gridCanvas.height, oy + displayH));
        ctx.stroke();
    }

    // ── Draw zone boundaries ──
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 1;
    for (const z of distZones) {
        if (z.x0 > 0) {
            const bx = ox + z.x0 * displayW;
            ctx.strokeStyle = `rgba(255, 255, 255, ${opacity * 0.3})`;
            ctx.beginPath();
            ctx.moveTo(bx, Math.max(0, oy));
            ctx.lineTo(bx, Math.min(gridCanvas.height, oy + displayH));
            ctx.stroke();
        }
    }
    ctx.setLineDash([]);

    // ── Zone labels at bottom ──
    ctx.font = '10px monospace';
    const labelY = Math.min(gridCanvas.height - 8, oy + displayH - 8);
    for (let i = 0; i < distZones.length; i++) {
        const z = distZones[i];
        const cx = ox + (z.x0 + z.x1) / 2 * displayW;
        ctx.fillStyle = `rgba(255, 255, 255, ${opacity * 0.5})`;
        ctx.textAlign = 'center';
        ctx.fillText(`Mv${z.mv.toFixed(2)} Mh${z.mh.toFixed(2)}`, cx, labelY);
    }
    ctx.textAlign = 'left';

    // ── Distortion profile curve at top ──
    const curveY0 = Math.max(5, oy + 10);
    const curveH = 30;
    ctx.strokeStyle = `rgba(251, 191, 36, ${opacity * 0.7})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let px = Math.max(0, ox); px < Math.min(gridCanvas.width, ox + displayW); px += 2) {
        const relX = (px - ox) / displayW;
        const {mh} = distGetMagAt(relX);
        // Map Mh to Y: 0.70→top, 1.40→bottom
        const my = curveY0 + (1 - (mh - 0.70) / 0.70) * curveH;
        if (px === Math.max(0, ox)) ctx.moveTo(px, my);
        else ctx.lineTo(px, my);
    }
    ctx.stroke();
    // Label
    ctx.fillStyle = `rgba(251, 191, 36, ${opacity * 0.5})`;
    ctx.font = '9px sans-serif';
    ctx.fillText('Mh', Math.max(2, ox - 12), curveY0 + curveH / 2 + 3);
}

// ═══════════════════════════════════════════════════════════════
// Per-zone image warp (canvas column-by-column rendering)
// ═══════════════════════════════════════════════════════════════

function drawDistWarpImage() {
    const warpCanvas = document.getElementById('dist-warp-canvas');
    const warpCheck = document.getElementById('dist-warp-img');
    if (!warpCanvas || !opgViewer) return;

    const enabled = warpCheck?.checked;
    warpCanvas.style.display = enabled ? 'block' : 'none';
    // Show/hide original image inversely
    opgViewer.img.style.opacity = enabled ? '0' : '1';
    if (!enabled) return;

    const container = opgViewer.canvas;
    const cw = container.clientWidth;
    const ch = container.clientHeight;
    warpCanvas.width = cw;
    warpCanvas.height = ch;
    const ctx = warpCanvas.getContext('2d');
    ctx.clearRect(0, 0, cw, ch);

    const imgEl = opgViewer.img;
    if (!imgEl.naturalWidth) return;
    const natW = imgEl.naturalWidth;
    const natH = imgEl.naturalHeight;
    const zoom = opgViewer.zoom;
    const ox = opgViewer.panX;
    const oy = opgViewer.panY;
    const displayW = natW * zoom;
    const displayH = natH * zoom;

    // Strategy: draw image in vertical strips (columns).
    // Each strip at relX gets its Mh from the zone model.
    // The strip is drawn with width scaled by 1/Mh (corrected width).
    // We accumulate the corrected X position left→right.
    // To keep the image centered, we first compute total corrected width,
    // then offset so the center aligns.

    const N_STRIPS = 200; // number of vertical strips
    const stripSrcW = natW / N_STRIPS;

    // First pass: compute total corrected width and per-strip info
    const strips = [];
    let totalCorrW = 0;
    for (let i = 0; i < N_STRIPS; i++) {
        const relX = (i + 0.5) / N_STRIPS;
        const {mh, mv} = distGetMagAt(relX);
        // Corrected width: real_width = measured_width / Mh
        // So on screen, strip should be narrower by 1/Mh
        const corrW = (displayW / N_STRIPS) / mh;
        // Corrected height: real_height = measured_height / Mv
        const corrH = displayH / mv;
        strips.push({relX, mh, mv, corrW, corrH, srcX: i * stripSrcW, srcW: stripSrcW});
        totalCorrW += corrW;
    }

    // Offset so center of corrected image aligns with center of original
    const centerOrigX = ox + displayW / 2;
    let drawX = centerOrigX - totalCorrW / 2;

    // Draw each strip
    for (let i = 0; i < N_STRIPS; i++) {
        const s = strips[i];
        // Vertical centering per strip (Mv correction)
        const corrH = s.corrH;
        const stripY = oy + (displayH - corrH) / 2;

        // Clip to visible area
        if (drawX + s.corrW < 0 || drawX > cw) {
            drawX += s.corrW;
            continue;
        }

        ctx.drawImage(
            imgEl,
            s.srcX, 0, s.srcW, natH,  // source rect
            drawX, stripY, s.corrW, corrH  // dest rect
        );
        drawX += s.corrW;
    }
}

// ═══════════════════════════════════════════════════════════════
// Angulation Measurement Tool (IIRA)
// ═══════════════════════════════════════════════════════════════

const ANG_COLORS = ['#f87171','#60a5fa','#34d399','#fbbf24','#c084fc','#fb923c','#22d3ee','#e879f9','#a3e635','#f472b6'];
let angState = { active:false, axes:[], currentPt:null }; // axes: [{p1:{x,y}, p2:{x,y}, color, label}]

function toggleAngMode() {
    angState.active = !angState.active;
    const btn = document.getElementById('ang-mode-btn');
    const panel = document.getElementById('ang-panel');
    const canvas = opgViewer?.canvas;
    if (btn) btn.classList.toggle('active', angState.active);
    if (panel) panel.classList.toggle('open', angState.active);
    if (canvas) canvas.classList.toggle('ang-mode', angState.active);
    if (angState.active) {
        // Install click handler on canvas
        opgViewer._angClick = angCanvasClick;
        opgViewer.canvas.addEventListener('click', opgViewer._angClick);
        angRedraw();
    } else if (opgViewer?._angClick) {
        opgViewer.canvas.removeEventListener('click', opgViewer._angClick);
        delete opgViewer._angClick;
    }
}

function angCanvasClick(e) {
    if (!opgViewer || !angState.active) return;
    // Don't register clicks while dragging
    if (opgViewer._dragMoved) return;

    const rect = opgViewer.canvas.getBoundingClientRect();
    // Convert screen coords to image coords (accounting for pan/zoom/distortion)
    const mv = getDistMv(), mh = getDistMh();
    const corrX = 1 / mh, corrY = 1 / mv;
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    // Image coords: screenPt = pan + imgPt * zoom * corr
    const imgX = (screenX - opgViewer.panX) / (opgViewer.zoom * corrX);
    const imgY = (screenY - opgViewer.panY) / (opgViewer.zoom * corrY);

    if (!angState.currentPt) {
        // First point of new axis
        angState.currentPt = {x: imgX, y: imgY};
        updateAngHint('Теперь кликните вторую точку (платформа имплантата) для завершения оси.');
        angRedraw();
    } else {
        // Second point — complete axis
        const idx = angState.axes.length;
        const color = ANG_COLORS[idx % ANG_COLORS.length];
        const label = `I${idx + 1}`;
        angState.axes.push({
            p1: angState.currentPt,
            p2: {x: imgX, y: imgY},
            color, label
        });
        angState.currentPt = null;
        updateAngHint(`Ось ${label} добавлена. Кликните на следующий имплантат или посмотрите результаты.`);
        angUpdateUI();
        angRedraw();
    }
}

function getDistMv(relX) {
    const panel = document.getElementById('dist-panel');
    if (!panel?.classList.contains('open')) return 1;
    if (relX !== undefined) {
        return distGetMagAt(relX).mv;
    }
    // Fallback: use selected zone
    return distZones[distSelectedZone]?.mv || 1;
}

function getDistMh(relX) {
    const panel = document.getElementById('dist-panel');
    if (!panel?.classList.contains('open')) return 1;
    if (relX !== undefined) {
        return distGetMagAt(relX).mh;
    }
    return distZones[distSelectedZone]?.mh || 1;
}

function angAxisAngle(axis) {
    // If backend already provided corrected_angle, use it directly
    if (axis.corrected_angle !== undefined && axis.corrected_angle !== null) {
        return axis.corrected_angle;
    }
    // Angle of axis relative to vertical (Y-axis), in degrees
    // Positive = tilted right, negative = tilted left
    // On screen: Y grows downward, so p2.y > p1.y for top→bottom axis
    const dx = axis.p2.x - axis.p1.x;
    const dy = axis.p2.y - axis.p1.y;
    // atan2(dx, dy) gives angle from downward vertical — this is what we need
    // because implant axis points downward on OPG
    const thetaMeasured = Math.atan2(dx, dy);
    // Compute axis midpoint relative X for zone-based distortion lookup
    const midImgX = (axis.p1.x + axis.p2.x) / 2;
    const imgW = opgViewer?.img?.naturalWidth || 1;
    const relX = Math.max(0, Math.min(1, midImgX / imgW));
    // Apply distortion correction: θ_true = arctan(tan(θ_measured) × Mv/Mh)
    const mv = getDistMv(relX), mh = getDistMh(relX);
    if (Math.abs(mv - mh) > 0.001) {
        const corrected = Math.atan(Math.tan(thetaMeasured) * mv / mh);
        return corrected * 180 / Math.PI;
    }
    return thetaMeasured * 180 / Math.PI;
}

function angPairAngle(a1, a2) {
    // Relative angle between two axes (always positive)
    const angle1 = angAxisAngle(a1);
    const angle2 = angAxisAngle(a2);
    return Math.abs(angle1 - angle2);
}

function angClassify(degrees) {
    if (degrees <= 10) return {cls:'parallel', label:'параллельны', icon:'✓'};
    if (degrees <= 15) return {cls:'acceptable', label:'допустимо', icon:'~'};
    if (degrees <= 25) return {cls:'angled', label:'угловой абатм.', icon:'⚠'};
    return {cls:'risky', label:'риск', icon:'✕'};
}

function angUpdateUI() {
    // Axes tags
    const axesEl = document.getElementById('ang-axes');
    if (axesEl) {
        axesEl.innerHTML = angState.axes.map((a, i) => {
            const ang = angAxisAngle(a).toFixed(1);
            return `<span class="ang-axis-tag" style="background:${a.color}22;border-color:${a.color}55;color:${a.color}">
                ${a.label} (${ang}°)
                <span class="ang-del" onclick="angRemove(${i})" title="Удалить ось">✕</span>
            </span>`;
        }).join('');
    }

    // Pairwise angles
    const pairsEl = document.getElementById('ang-pairs');
    if (pairsEl) {
        if (angState.axes.length < 2) {
            pairsEl.innerHTML = '<span class="ang-hint">Добавьте минимум 2 оси для расчёта углов</span>';
            return;
        }
        let html = '<div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:4px"><b>Попарные углы (IIRA):</b></div>';
        const pairs = [];
        for (let i = 0; i < angState.axes.length; i++) {
            for (let j = i + 1; j < angState.axes.length; j++) {
                const deg = angPairAngle(angState.axes[i], angState.axes[j]);
                const cls = angClassify(deg);
                pairs.push({i, j, deg, cls});
            }
        }
        html += pairs.map(p => {
            const a1 = angState.axes[p.i], a2 = angState.axes[p.j];
            return `<span class="ang-pair-result ${p.cls.cls}">
                <span style="color:${a1.color}">●</span>${a1.label}
                ↔
                <span style="color:${a2.color}">●</span>${a2.label}:
                <b>${p.deg.toFixed(1)}°</b>
                <span style="font-size:10px;font-weight:400">${p.cls.icon} ${p.cls.label}</span>
            </span>`;
        }).join('');

        // Summary
        const avgDeg = pairs.reduce((s,p) => s + p.deg, 0) / pairs.length;
        const maxDeg = Math.max(...pairs.map(p => p.deg));
        const avgCls = angClassify(avgDeg);
        html += `<div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,0.5)">
            Среднее: <b style="color:${avgCls.cls==='parallel'?'#34d399':avgCls.cls==='acceptable'?'#60a5fa':avgCls.cls==='angled'?'#fbbf24':'#f87171'}">${avgDeg.toFixed(1)}°</b> ${avgCls.icon} ${avgCls.label}
            · Макс: ${maxDeg.toFixed(1)}°
            · Дисторсия: ${getDistMv()!==1||getDistMh()!==1 ? 'скорр. Mv='+getDistMv().toFixed(2)+' Mh='+getDistMh().toFixed(2) : 'не применена'}
        </div>`;
        pairsEl.innerHTML = html;
    }
}

function angRedraw() {
    const angCanvas = document.getElementById('ang-canvas');
    if (!angCanvas || !opgViewer) return;

    const container = opgViewer.canvas;
    angCanvas.width = container.clientWidth;
    angCanvas.height = container.clientHeight;
    const ctx = angCanvas.getContext('2d');
    ctx.clearRect(0, 0, angCanvas.width, angCanvas.height);

    const mv = getDistMv(), mh = getDistMh();
    const corrX = 1 / mh, corrY = 1 / mv;

    // Helper: image coords → screen coords
    function toScreen(pt) {
        return {
            x: opgViewer.panX + pt.x * opgViewer.zoom * corrX,
            y: opgViewer.panY + pt.y * opgViewer.zoom * corrY
        };
    }

    // Draw completed axes
    angState.axes.forEach((axis, i) => {
        const s1 = toScreen(axis.p1);
        const s2 = toScreen(axis.p2);

        // Line
        ctx.beginPath();
        ctx.strokeStyle = axis.color;
        ctx.lineWidth = 2.5;
        ctx.setLineDash([]);
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();

        // Extend line (dashed) for visual clarity
        const dx = s2.x - s1.x, dy = s2.y - s1.y;
        const len = Math.hypot(dx, dy);
        if (len > 0) {
            const ext = 40; // extend px
            ctx.beginPath();
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = axis.color + '66';
            ctx.lineWidth = 1;
            ctx.moveTo(s1.x - dx/len*ext, s1.y - dy/len*ext);
            ctx.lineTo(s1.x, s1.y);
            ctx.moveTo(s2.x, s2.y);
            ctx.lineTo(s2.x + dx/len*ext, s2.y + dy/len*ext);
            ctx.stroke();
            ctx.setLineDash([]);
        }

        // Endpoint dots
        [s1, s2].forEach(pt => {
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
            ctx.fillStyle = axis.color;
            ctx.fill();
            ctx.beginPath();
            ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.stroke();
        });

        // Label
        const midX = (s1.x + s2.x) / 2;
        const midY = (s1.y + s2.y) / 2;
        ctx.font = 'bold 12px system-ui';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 3;
        ctx.strokeText(axis.label, midX + 8, midY - 6);
        ctx.fillText(axis.label, midX + 8, midY - 6);

        // Angle from vertical
        const ang = angAxisAngle(axis).toFixed(1);
        ctx.font = '10px monospace';
        ctx.fillStyle = axis.color;
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;
        ctx.strokeText(`${ang}°`, midX + 8, midY + 8);
        ctx.fillText(`${ang}°`, midX + 8, midY + 8);
    });

    // Draw angle arcs between neighboring pairs
    for (let i = 0; i < angState.axes.length - 1; i++) {
        const a1 = angState.axes[i], a2 = angState.axes[i + 1];
        const deg = angPairAngle(a1, a2);
        const cls = angClassify(deg);

        // Draw small arc at midpoint between the two axes' midpoints
        const mid1 = toScreen({x:(a1.p1.x+a1.p2.x)/2, y:(a1.p1.y+a1.p2.y)/2});
        const mid2 = toScreen({x:(a2.p1.x+a2.p2.x)/2, y:(a2.p1.y+a2.p2.y)/2});
        const arcX = (mid1.x + mid2.x) / 2;
        const arcY = (mid1.y + mid2.y) / 2;

        // Angle label between axes
        const color = cls.cls==='parallel'?'#34d399':cls.cls==='acceptable'?'#60a5fa':cls.cls==='angled'?'#fbbf24':'#f87171';
        ctx.font = 'bold 13px system-ui';
        ctx.fillStyle = color;
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 3;
        const txt = `${deg.toFixed(1)}°`;
        ctx.strokeText(txt, arcX - 15, arcY);
        ctx.fillText(txt, arcX - 15, arcY);
    }

    // Draw current point (waiting for second click)
    if (angState.currentPt) {
        const sp = toScreen(angState.currentPt);
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
        ctx.fillStyle = ANG_COLORS[angState.axes.length % ANG_COLORS.length];
        ctx.fill();
        ctx.beginPath();
        ctx.arc(sp.x, sp.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.setLineDash([3, 3]);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

function angRemove(idx) {
    angState.axes.splice(idx, 1);
    // Re-label
    angState.axes.forEach((a, i) => {
        a.label = `I${i + 1}`;
        a.color = ANG_COLORS[i % ANG_COLORS.length];
    });
    angUpdateUI();
    angRedraw();
}

function angClear() {
    angState.axes = [];
    angState.currentPt = null;
    updateAngHint('Кликните 2 точки вдоль длинной оси имплантата (апекс → платформа). Затем следующий имплантат.');
    angUpdateUI();
    angRedraw();
}

function angUndo() {
    if (angState.currentPt) {
        angState.currentPt = null;
        updateAngHint('Первая точка отменена. Кликните на апекс имплантата.');
    } else if (angState.axes.length > 0) {
        angState.axes.pop();
        angState.axes.forEach((a, i) => {
            a.label = `I${i + 1}`;
            a.color = ANG_COLORS[i % ANG_COLORS.length];
        });
        updateAngHint('Последняя ось удалена.');
    }
    angUpdateUI();
    angRedraw();
}

function updateAngHint(text) {
    const el = document.getElementById('ang-hint');
    if (el) el.textContent = text;
}

function autoLoadAngulationAxes() {
    // Auto-populate axes from backend angulation data
    const ang = lastAssessmentData?.angulation;
    if (!ang || !ang.axes || ang.axes.length === 0) return;

    // Render image to offscreen canvas for pixel analysis
    const imgEl = opgViewer?.img;
    let pixelCtx = null;
    if (imgEl && imgEl.naturalWidth) {
        const offscreen = document.createElement('canvas');
        offscreen.width = imgEl.naturalWidth;
        offscreen.height = imgEl.naturalHeight;
        const ctx2 = offscreen.getContext('2d');
        ctx2.drawImage(imgEl, 0, 0);
        pixelCtx = ctx2;
    }

    angState.axes = [];
    ang.axes.forEach((axis, i) => {
        const line = axis.axis_line;
        const bbox = axis.bbox;
        if (!line) return;

        let p1, p2, fullLen;

        if (bbox && pixelCtx) {
            // ═══ Pixel-based true central axis v2 (gradient + RANSAC) ═══
            // Uses Sobel-like gradient to find implant edges (robust to brightness variation)
            // RANSAC line fitting for outlier resilience
            const imgW = pixelCtx.canvas.width;
            const imgH = pixelCtx.canvas.height;
            const bx1 = Math.max(0, Math.floor(bbox.x1));
            const bx2 = Math.min(imgW - 1, Math.ceil(bbox.x2));
            const by1 = Math.max(0, Math.floor(bbox.y1));
            const by2 = Math.min(imgH - 1, Math.ceil(bbox.y2));
            const bw = bx2 - bx1;
            const bh = by2 - by1;

            // Sample 20 horizontal lines within fixture body (skip crown 20% and apex 15%)
            const N_SAMPLES = 20;
            const midpoints = []; // {y, mx, w}
            const T_START = 0.20, T_END = 0.85; // skip more at top (crown/abutment)

            // Helper: Gaussian smooth a 1D array (kernel size 5)
            function gaussSmooth(arr) {
                const kernel = [0.06, 0.24, 0.40, 0.24, 0.06];
                const out = new Array(arr.length);
                for (let i = 0; i < arr.length; i++) {
                    let sum = 0, wt = 0;
                    for (let k = -2; k <= 2; k++) {
                        const j = i + k;
                        if (j >= 0 && j < arr.length) {
                            sum += arr[j] * kernel[k + 2];
                            wt += kernel[k + 2];
                        }
                    }
                    out[i] = sum / wt;
                }
                return out;
            }

            for (let si = 0; si < N_SAMPLES; si++) {
                const t = T_START + (si + 0.5) / N_SAMPLES * (T_END - T_START);
                const scanY = Math.round(by1 + t * bh);
                if (scanY < 0 || scanY >= imgH) continue;

                // Read pixel row across bbox width (+ small margin)
                const margin = Math.round(bw * 0.15);
                const sx1 = Math.max(0, bx1 - margin);
                const sx2 = Math.min(imgW - 1, bx2 + margin);
                const rowW = sx2 - sx1 + 1;
                const rowData = pixelCtx.getImageData(sx1, scanY, rowW, 1).data;

                // Compute brightness profile → Gaussian smooth → horizontal gradient
                const rawBright = [];
                for (let px = 0; px < rowW; px++) {
                    const idx = px * 4;
                    rawBright.push((rowData[idx] + rowData[idx+1] + rowData[idx+2]) / 3);
                }
                const brightness = gaussSmooth(rawBright);
                // Gradient: dB/dx (positive = getting brighter rightward = left edge)
                const gradient = new Array(rowW).fill(0);
                for (let px = 1; px < rowW - 1; px++) {
                    gradient[px] = brightness[px + 1] - brightness[px - 1]; // central difference
                }

                // Scan from bbox center outward using gradient peaks
                const bboxCenterPx = Math.round((bbox.center_x || (bbox.x1 + bbox.x2) / 2) - sx1);
                const maxScanDist = Math.round(bw * 0.45); // tighter: 45% of bbox width

                // Find LEFT edge: strongest positive gradient (dark→bright transition)
                // scanning leftward from center
                let leftEdge = -1, bestLeftGrad = 0;
                const leftLimit = Math.max(2, bboxCenterPx - maxScanDist);
                for (let px = bboxCenterPx - 2; px >= leftLimit; px--) {
                    if (gradient[px] > bestLeftGrad) {
                        bestLeftGrad = gradient[px];
                        leftEdge = px;
                    }
                }

                // Find RIGHT edge: strongest negative gradient (bright→dark transition)
                // scanning rightward from center
                let rightEdge = -1, bestRightGrad = 0;
                const rightLimit = Math.min(rowW - 2, bboxCenterPx + maxScanDist);
                for (let px = bboxCenterPx + 2; px <= rightLimit; px++) {
                    if (-gradient[px] > bestRightGrad) {
                        bestRightGrad = -gradient[px];
                        rightEdge = px;
                    }
                }

                // Validate: both edges found, minimum gradient strength, reasonable width
                const minGradStrength = 3; // minimum brightness change per 2px
                if (leftEdge >= 0 && rightEdge >= 0 &&
                    bestLeftGrad >= minGradStrength && bestRightGrad >= minGradStrength &&
                    rightEdge > leftEdge + 3) {
                    const edgeWidth = rightEdge - leftEdge;
                    // Reject if width is unreasonably large (>80% of bbox) or tiny (<10%)
                    if (edgeWidth < bw * 0.8 && edgeWidth > bw * 0.1) {
                        const mx = sx1 + (leftEdge + rightEdge) / 2;
                        midpoints.push({y: scanY, mx, w: edgeWidth});
                    }
                }
            }

            if (midpoints.length >= 4) {
                // ── Outlier rejection: width-based ──
                const widths = midpoints.map(m => m.w).sort((a,b) => a - b);
                const medianW = widths[Math.floor(widths.length / 2)];
                let filtered = midpoints.filter(m => m.w <= medianW * 1.6 && m.w >= medianW * 0.5);
                if (filtered.length < 4) filtered = midpoints;

                // ── RANSAC line fitting: x = a*y + b ──
                // Much more robust than least squares for noisy data
                const RANSAC_ITERS = 80;
                const RANSAC_THRESH = Math.max(2, bw * 0.04); // inlier threshold: 4% of bbox width
                let bestInliers = [], bestA = 0, bestB = 0;

                for (let iter = 0; iter < RANSAC_ITERS; iter++) {
                    // Pick 2 random distinct points
                    const i1 = Math.floor(Math.random() * filtered.length);
                    let i2 = Math.floor(Math.random() * (filtered.length - 1));
                    if (i2 >= i1) i2++;
                    const p_a = filtered[i1], p_b = filtered[i2];
                    if (Math.abs(p_a.y - p_b.y) < 3) continue; // need vertical separation

                    // Fit line x = a*y + b through these 2 points
                    const ra = (p_a.mx - p_b.mx) / (p_a.y - p_b.y);
                    const rb = p_a.mx - ra * p_a.y;

                    // Count inliers
                    const inliers = [];
                    for (const mp of filtered) {
                        const predictedX = ra * mp.y + rb;
                        if (Math.abs(mp.mx - predictedX) <= RANSAC_THRESH) {
                            inliers.push(mp);
                        }
                    }

                    if (inliers.length > bestInliers.length) {
                        bestInliers = inliers;
                        bestA = ra;
                        bestB = rb;
                    }
                }

                // Refit line on all inliers using least squares
                const pts = bestInliers.length >= 3 ? bestInliers : filtered;
                const n = pts.length;
                let sumY = 0, sumX = 0, sumYY = 0, sumYX = 0;
                for (const mp of pts) {
                    sumY += mp.y;
                    sumX += mp.mx;
                    sumYY += mp.y * mp.y;
                    sumYX += mp.y * mp.mx;
                }
                const denom = n * sumYY - sumY * sumY;
                const a = denom !== 0 ? (n * sumYX - sumY * sumX) / denom : 0;
                const b2 = (sumX - a * sumY) / n;

                // Axis endpoints at bbox top and bottom
                const topY = by1;
                const botY = by2;
                p1 = {x: a * topY + b2, y: topY};  // platform
                p2 = {x: a * botY + b2, y: botY};  // apex
                fullLen = Math.sqrt((p2.x-p1.x)**2 + (p2.y-p1.y)**2);

                // Debug log for troubleshooting
                const angle = Math.atan2(p2.x - p1.x, p2.y - p1.y) * 180 / Math.PI;
                console.log(`Axis ${axis.fdi}: ${pts.length}/${midpoints.length} pts, angle=${angle.toFixed(1)}°, RANSAC inliers=${bestInliers.length}`);
            }
        }

        // Fallback: use detected axis direction + bbox center
        if (!p1 || !p2) {
            const dx = line.bottom.x - line.top.x;
            const dy = line.bottom.y - line.top.y;
            const detectedLen = Math.sqrt(dx * dx + dy * dy) || 1;
            const ux = dx / detectedLen;
            const uy = dy / detectedLen;
            const cx = bbox ? (bbox.x1 + bbox.x2) / 2 : (line.top.x + line.bottom.x) / 2;
            const cy = bbox ? (bbox.y1 + bbox.y2) / 2 : (line.top.y + line.bottom.y) / 2;
            fullLen = bbox ? bbox.height : detectedLen;
            const halfLen = fullLen / 2;
            p1 = {x: cx - ux * halfLen, y: cy - uy * halfLen};
            p2 = {x: cx + ux * halfLen, y: cy + uy * halfLen};
        }

        angState.axes.push({
            p1, p2,
            color: ANG_COLORS[i % ANG_COLORS.length],
            label: axis.fdi || `I${i + 1}`,
            fdi: axis.fdi,
            // Don't pass corrected_angle — let angAxisAngle() compute from pixel-detected p1/p2
            region: axis.region_ru,
            bboxHeight: fullLen,
        });
    });

    // Auto-activate angulation mode and show results
    if (angState.axes.length >= 2) {
        angState.active = true;
        const btn = document.getElementById('ang-mode-btn');
        const panel = document.getElementById('ang-panel');
        if (btn) btn.classList.add('active');
        if (panel) panel.classList.add('open');
        opgViewer?.canvas?.classList.add('ang-mode');
        if (opgViewer?._angClick) opgViewer.canvas.removeEventListener('click', opgViewer._angClick);
        opgViewer._angClick = angCanvasClick;
        opgViewer?.canvas?.addEventListener('click', opgViewer._angClick);
        angUpdateUI();
        angRedraw();

        updateAngHint(`Загружено ${angState.axes.length} осей из автоматического анализа. Кликните для добавления новых.`);
    }
}

async function saveFormulaEval(fileId) {
    const statusEl = document.getElementById(`eval-status-${fileId}`);
    const gt = gtFormulas[fileId];

    if (!gt || Object.keys(gt).length < 32) {
        statusEl.innerHTML = '<span style="color:var(--red)">Заполните все 32 зуба в GT формуле</span>';
        return;
    }

    statusEl.textContent = 'Сохраняю...';

    try {
        const resp = await fetch('/api/darwin/evaluate-formula', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({file_id: fileId, ground_truth_formula: gt})
        });
        const data = await resp.json();

        if (data.error) {
            statusEl.innerHTML = `<span style="color:var(--red)">${data.error}</span>`;
            return;
        }

        // Update algo formula cards with match/mismatch highlighting
        const caseEl = document.getElementById(`eval-case-${fileId}`);
        data.results.forEach(r => {
            // Find the algo card and re-render its formula with comparison
            const cards = caseEl.querySelectorAll('.algo-formula-card');
            cards.forEach(card => {
                const h4 = card.querySelector('h4 span');
                if (h4 && h4.textContent.startsWith(r.algorithm)) {
                    // Update accuracy
                    const accSpan = card.querySelector('.accuracy');
                    const pct = (r.accuracy * 100).toFixed(0);
                    accSpan.textContent = `${pct}% (${r.correct}/${r.total})`;
                    accSpan.className = `accuracy ${r.accuracy >= 0.9 ? 'exact' : r.accuracy >= 0.7 ? 'close' : 'miss'}`;
                }
            });
        });

        const best = data.results.reduce((a,b) => (a.accuracy||0) > (b.accuracy||0) ? a : b);
        statusEl.innerHTML = `<span style="color:var(--green)">✓ Сохранено! Лучший: ${best.algorithm} (${(best.accuracy*100).toFixed(0)}%, ${best.correct}/${best.total})</span>`;
    } catch (e) {
        statusEl.innerHTML = `<span style="color:var(--red)">Ошибка: ${e.message}</span>`;
    }
}

