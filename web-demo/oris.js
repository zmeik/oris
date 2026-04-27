/* ORIS v0.1 — Web demo (test mode)
 * Pure vanilla JavaScript. No frameworks, no network, no telemetry.
 * Runs entirely in your browser. localStorage for in-session persistence only.
 */

'use strict';

// ============================================================================
// 1. Constants — mirror the canonical schema
// ============================================================================

const STATUSES = [
  '',          // empty / unannotated
  'present', 'missing', 'implant', 'impl_fixture', 'impl_healing', 'impl_restored',
  'post', 'crowned', 'restored', 'caries', 'endo', 'root', 'impacted',
  'bridge', 'bar', 'cantilever', 'uncertain'
];

const STATUS_ABBR = {
  '': '·', present: '·', missing: 'A',
  implant: 'I', impl_fixture: 'IF', impl_healing: 'IH', impl_restored: 'IK',
  post: 'P', crowned: 'K', restored: 'F', caries: 'C', endo: 'E',
  root: 'r', impacted: '⌂', bridge: 'B', bar: '—', cantilever: '↦', uncertain: '?'
};

const SURFACES = ['m', 'd', 'o', 'v', 'l'];

// 32 permanent teeth — mapping to ORIS 6-character position codes (no occupant suffix)
// Quadrants laid out left-to-right per visual convention:
//   Q1 (upper right): 1.8 → 1.1     | Q2 (upper left): 2.1 → 2.8
//   Q4 (lower right): 4.8 → 4.1     | Q3 (lower left): 3.1 → 3.8
const QUADRANTS = {
  1: [
    { fdi: '1.8', oris: 'URMP3M', label: '8' },
    { fdi: '1.7', oris: 'URMP2M', label: '7' },
    { fdi: '1.6', oris: 'URMP1M', label: '6' },
    { fdi: '1.5', oris: 'URPP2P', label: '5' },
    { fdi: '1.4', oris: 'URPP1P', label: '4' },
    { fdi: '1.3', oris: 'URXPC',  label: '3' },
    { fdi: '1.2', oris: 'URLPI',  label: '2' },
    { fdi: '1.1', oris: 'URCPI',  label: '1' },
  ],
  2: [
    { fdi: '2.1', oris: 'ULCPI',  label: '1' },
    { fdi: '2.2', oris: 'ULLPI',  label: '2' },
    { fdi: '2.3', oris: 'ULXPC',  label: '3' },
    { fdi: '2.4', oris: 'ULPP1P', label: '4' },
    { fdi: '2.5', oris: 'ULPP2P', label: '5' },
    { fdi: '2.6', oris: 'ULMP1M', label: '6' },
    { fdi: '2.7', oris: 'ULMP2M', label: '7' },
    { fdi: '2.8', oris: 'ULMP3M', label: '8' },
  ],
  3: [
    { fdi: '3.1', oris: 'LLCPI',  label: '1' },
    { fdi: '3.2', oris: 'LLLPI',  label: '2' },
    { fdi: '3.3', oris: 'LLXPC',  label: '3' },
    { fdi: '3.4', oris: 'LLPP1P', label: '4' },
    { fdi: '3.5', oris: 'LLPP2P', label: '5' },
    { fdi: '3.6', oris: 'LLMP1M', label: '6' },
    { fdi: '3.7', oris: 'LLMP2M', label: '7' },
    { fdi: '3.8', oris: 'LLMP3M', label: '8' },
  ],
  4: [
    { fdi: '4.8', oris: 'LRMP3M', label: '8' },
    { fdi: '4.7', oris: 'LRMP2M', label: '7' },
    { fdi: '4.6', oris: 'LRMP1M', label: '6' },
    { fdi: '4.5', oris: 'LRPP2P', label: '5' },
    { fdi: '4.4', oris: 'LRPP1P', label: '4' },
    { fdi: '4.3', oris: 'LRXPC',  label: '3' },
    { fdi: '4.2', oris: 'LRLPI',  label: '2' },
    { fdi: '4.1', oris: 'LRCPI',  label: '1' },
  ],
};

// ============================================================================
// 2. Localisation
// ============================================================================

const I18N = {
  en: {
    subtitle: 'Open Radiographic Imaging Schema · Test Mode',
    lang_label: 'Language:',
    privacy_banner: 'This demo runs entirely in your browser. Use only synthetic data — no real patient information. See',
    privacy_link: 'PRIVACY.md',
    meta_title: 'Patient & Imaging Metadata (synthetic)',
    meta_pid: 'Anonymized ID',
    meta_age: 'Age (years)',
    meta_sex: 'Sex',
    meta_date: 'Acquisition date',
    meta_quality: 'Image quality (1-5)',
    formula_title: 'Dental Formula',
    formula_hint: 'Click any cell to cycle through statuses. Right-click (or long-press) to choose surfaces. Click again to advance.',
    upper_lower: 'Upper ▲ / ▼ Lower',
    legend_title: 'Legend:',
    legend_present: 'present', legend_restored: 'restored', legend_crowned: 'crowned',
    legend_endo: 'endo', legend_caries: 'caries', legend_implant: 'implant',
    legend_missing: 'missing', legend_impacted: 'impacted', legend_uncertain: 'uncertain',
    anatomy_title: 'Anatomical Landmarks · TMJ · Airway',
    anatomy_canal: 'Mandibular canal',
    anatomy_visibility_r: 'Visibility right', anatomy_visibility_l: 'Visibility left',
    anatomy_course_r: 'Course right', anatomy_course_l: 'Course left',
    anatomy_sinus: 'Maxillary sinus',
    anatomy_sinus_status_r: 'Status right', anatomy_sinus_status_l: 'Status left',
    anatomy_pneuma_r: 'Pneumatization right', anatomy_pneuma_l: 'Pneumatization left',
    anatomy_mental: 'Mental foramen',
    anatomy_mental_loc_r: 'Location right', anatomy_mental_loc_l: 'Location left',
    anatomy_tmj: 'TMJ — condyle morphology + joint space',
    anatomy_condyle_r: 'Condyle right morphology', anatomy_condyle_l: 'Condyle left morphology',
    anatomy_oa: 'Osteoarthritis signs', anatomy_disc: 'Disc displacement',
    anatomy_airway: 'Airway / pharyngeal space',
    anatomy_airway_class: 'Pharyngeal airway space', anatomy_septum: 'Nasal septum',
    output_title: 'ORIS Document (live JSON)',
    output_hint: 'Updates as you click. Validate with the Python parser or directly against schema/oris-v0.1.json.',
    btn_copy: 'Copy JSON', btn_export: 'Export JSON file',
    btn_load_001: 'Load synthetic_001', btn_clear: 'Clear all',
    surface_modal_title: 'Choose surfaces',
    surface_modal_hint: 'Mark all that apply for this layer.',
    surface_m: 'mesial', surface_d: 'distal', surface_o: 'occlusal',
    surface_v: 'vestibular', surface_l: 'lingual',
    btn_surface_clear: 'No surfaces', btn_surface_done: 'Done', btn_surface_cancel: 'Cancel',
    footer_text: 'ORIS v0.1 · MIT licence · No PII · No telemetry · Runs entirely in your browser. Source:',
  },
  ru: {
    subtitle: 'Open Radiographic Imaging Schema · Тестовый режим',
    lang_label: 'Язык:',
    privacy_banner: 'Демо работает полностью в вашем браузере. Используйте только синтетические данные — никаких реальных пациентов. См.',
    privacy_link: 'PRIVACY.md',
    meta_title: 'Метаданные пациента и снимка (синтетические)',
    meta_pid: 'Анонимный ID',
    meta_age: 'Возраст (лет)',
    meta_sex: 'Пол',
    meta_date: 'Дата снимка',
    meta_quality: 'Качество (1-5)',
    formula_title: 'Зубная формула',
    formula_hint: 'Клик по клетке — циклически меняет статус. Правый клик (или долгое нажатие) — выбор поверхностей. Клик ещё раз — следующий статус.',
    upper_lower: 'Верхняя ▲ / ▼ Нижняя',
    legend_title: 'Легенда:',
    legend_present: 'интактный', legend_restored: 'пломба', legend_crowned: 'коронка',
    legend_endo: 'эндо', legend_caries: 'кариес', legend_implant: 'имплант',
    legend_missing: 'отсутствует', legend_impacted: 'ретенированный', legend_uncertain: 'неопредел.',
    anatomy_title: 'Анатомические ориентиры · ВНЧС · Воздухоносные пути',
    anatomy_canal: 'Нижнечелюстной канал',
    anatomy_visibility_r: 'Видимость справа', anatomy_visibility_l: 'Видимость слева',
    anatomy_course_r: 'Ход справа', anatomy_course_l: 'Ход слева',
    anatomy_sinus: 'Верхнечелюстная пазуха',
    anatomy_sinus_status_r: 'Статус справа', anatomy_sinus_status_l: 'Статус слева',
    anatomy_pneuma_r: 'Пневматизация справа', anatomy_pneuma_l: 'Пневматизация слева',
    anatomy_mental: 'Ментальное отверстие',
    anatomy_mental_loc_r: 'Локализация справа', anatomy_mental_loc_l: 'Локализация слева',
    anatomy_tmj: 'ВНЧС — морфология мыщелка + суставная щель',
    anatomy_condyle_r: 'Морфология мыщелка справа', anatomy_condyle_l: 'Морфология мыщелка слева',
    anatomy_oa: 'Признаки остеоартроза', anatomy_disc: 'Смещение диска',
    anatomy_airway: 'Воздухоносные пути / глоточное пространство',
    anatomy_airway_class: 'Глоточное воздушное пространство', anatomy_septum: 'Носовая перегородка',
    output_title: 'ORIS-документ (live JSON)',
    output_hint: 'Обновляется при каждом клике. Валидируется Python-парсером или напрямую против schema/oris-v0.1.json.',
    btn_copy: 'Копировать JSON', btn_export: 'Экспорт JSON-файла',
    btn_load_001: 'Загрузить synthetic_001', btn_clear: 'Очистить всё',
    surface_modal_title: 'Выбор поверхностей',
    surface_modal_hint: 'Отметь применимые для этого слоя.',
    surface_m: 'мезиальная', surface_d: 'дистальная', surface_o: 'окклюзионная',
    surface_v: 'вестибулярная', surface_l: 'лингвальная',
    btn_surface_clear: 'Без поверхностей', btn_surface_done: 'Готово', btn_surface_cancel: 'Отмена',
    footer_text: 'ORIS v0.1 · MIT-лицензия · Без PII · Без телеметрии · Работает полностью в браузере. Источник:',
  }
};

let currentLang = 'en';

function applyLanguage(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  const dict = I18N[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (dict[key]) el.textContent = dict[key];
  });
  document.querySelectorAll('.lang-btn').forEach(btn => btn.classList.remove('active'));
  document.getElementById('lang-' + lang).classList.add('active');
}

// ============================================================================
// 3. State
// ============================================================================

// state.teeth[ orisCode (5 chars) ] = { occupant, layers: [{status, surfaces}] }
// Key is the 5-character position code; we synthesise the 6-character key
// for serialisation (occupant suffix).
const state = {
  teeth: {},
  anatomy: {},
  meta: {
    pid: 'P_DEMO_SYNTHETIC',
    age: 40,
    sex: '',
    date: '2026-01-15T10:00',
    quality: 4,
  }
};

// Initialise all 32 permanent positions with empty findings.
function initialiseState() {
  for (const q of [1, 2, 3, 4]) {
    for (const tooth of QUADRANTS[q]) {
      state.teeth[tooth.oris] = {
        fdi: tooth.fdi,
        occupant: 'N',  // default
        layers: []      // empty status_layers
      };
    }
  }
}

// ============================================================================
// 4. Layer encoding / decoding
// ============================================================================

function encodeLayers(layers) {
  if (!layers || layers.length === 0) return '';
  return layers.map(L => {
    if (L.surfaces && L.surfaces.length > 0) {
      // Canonical surface order
      const ordered = SURFACES.filter(s => L.surfaces.includes(s)).join('');
      return `${L.status}:${ordered}`;
    }
    return L.status;
  }).join('+');
}

function primaryStatus(layers) {
  if (!layers || layers.length === 0) return '';
  const set = new Set(layers.map(L => L.status));
  const priority = [
    'caries', 'endo', 'crowned', 'restored',
    'impl_restored', 'impl_fixture', 'impl_healing', 'implant',
    'missing', 'impacted', 'root', 'present', 'uncertain',
    'bridge', 'bar', 'cantilever', 'post'
  ];
  for (const s of priority) if (set.has(s)) return s;
  return '';
}

function aggregatedSurfaces(layers) {
  const set = new Set();
  (layers || []).forEach(L => (L.surfaces || []).forEach(s => set.add(s)));
  return SURFACES.filter(s => set.has(s));
}

// ============================================================================
// 5. Render: dental formula
// ============================================================================

function renderQuadrant(quadrantNum) {
  const container = document.querySelector(`.quadrant.q${quadrantNum}`);
  container.innerHTML = '';
  for (const tooth of QUADRANTS[quadrantNum]) {
    const cell = document.createElement('div');
    cell.className = 'tooth-cell';
    cell.dataset.oris = tooth.oris;
    cell.dataset.fdi = tooth.fdi;
    cell.tabIndex = 0;

    const fdiNum = document.createElement('span');
    fdiNum.className = 'fdi-num';
    fdiNum.textContent = tooth.fdi;
    cell.appendChild(fdiNum);

    const labelOnly = document.createElement('span');
    labelOnly.className = 'tooth-label';
    labelOnly.textContent = tooth.label;
    labelOnly.style.display = 'none'; // FDI shown instead in this layout
    cell.appendChild(labelOnly);

    const statusAbbr = document.createElement('span');
    statusAbbr.className = 'status-abbr';
    cell.appendChild(statusAbbr);

    const surfacesTag = document.createElement('span');
    surfacesTag.className = 'surfaces-tag';
    cell.appendChild(surfacesTag);

    cell.addEventListener('click', () => onCellClick(tooth.oris));
    cell.addEventListener('contextmenu', (e) => { e.preventDefault(); onCellRightClick(tooth.oris); });

    container.appendChild(cell);
  }
}

function refreshCell(orisCode) {
  const cell = document.querySelector(`.tooth-cell[data-oris="${orisCode}"]`);
  if (!cell) return;
  const tooth = state.teeth[orisCode];
  const primary = primaryStatus(tooth.layers);
  // Clear all status classes
  cell.className = 'tooth-cell s-' + (primary || 'empty');
  cell.querySelector('.status-abbr').textContent = STATUS_ABBR[primary] || '·';
  const surfaces = aggregatedSurfaces(tooth.layers);
  cell.querySelector('.surfaces-tag').textContent = surfaces.join('') || '';
}

function refreshAllCells() {
  Object.keys(state.teeth).forEach(refreshCell);
}

// ============================================================================
// 6. Cell interactions
// ============================================================================

function onCellClick(orisCode) {
  // Cycle through statuses: empty → present → missing → ... → empty again
  const tooth = state.teeth[orisCode];
  const currentPrimary = primaryStatus(tooth.layers);
  const idx = STATUSES.indexOf(currentPrimary);
  const next = STATUSES[(idx + 1) % STATUSES.length];

  // Replace the layered set with the next single status (simplification for demo;
  // production Arena UI supports adding layers via picker UI)
  if (next === '') {
    tooth.layers = [];
  } else {
    tooth.layers = [{ status: next, surfaces: [] }];
  }

  // Adjust occupant for special cases
  if (next === 'missing' || next === 'root') tooth.occupant = next === 'missing' ? 'A' : 'R';
  else if (next === 'implant' || next === 'impl_fixture' || next === 'impl_healing' || next === 'impl_restored') tooth.occupant = 'F';
  else if (next === 'bridge') tooth.occupant = 'B';
  else if (next === 'cantilever') tooth.occupant = 'C';
  else if (next === 'impacted' || next === 'present' || next === 'crowned' || next === 'restored' || next === 'caries' || next === 'endo' || next === 'post') tooth.occupant = 'N';
  else if (next === 'uncertain') tooth.occupant = 'U';

  refreshCell(orisCode);
  refreshOutput();
}

function onCellRightClick(orisCode) {
  const tooth = state.teeth[orisCode];
  const primary = primaryStatus(tooth.layers);
  if (!primary || primary === 'missing' || primary === 'present') return;
  openSurfaceModal(orisCode, primary);
}

// ============================================================================
// 7. Surface modal
// ============================================================================

let modalContext = null;

function openSurfaceModal(orisCode, status) {
  const modal = document.getElementById('surface-modal');
  modalContext = { orisCode, status, selected: new Set() };
  // Pre-select existing surfaces
  const tooth = state.teeth[orisCode];
  const existing = tooth.layers.find(L => L.status === status);
  if (existing) existing.surfaces.forEach(s => modalContext.selected.add(s));
  document.querySelectorAll('.surface-btn').forEach(btn => {
    if (modalContext.selected.has(btn.dataset.surface)) btn.classList.add('selected');
    else btn.classList.remove('selected');
  });
  modal.classList.remove('hidden');
}

function closeSurfaceModal() {
  document.getElementById('surface-modal').classList.add('hidden');
  modalContext = null;
}

function setupSurfaceModal() {
  document.querySelectorAll('.surface-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!modalContext) return;
      const s = btn.dataset.surface;
      if (modalContext.selected.has(s)) modalContext.selected.delete(s);
      else modalContext.selected.add(s);
      btn.classList.toggle('selected');
    });
  });
  document.getElementById('btn-surface-clear').addEventListener('click', () => {
    if (!modalContext) return;
    modalContext.selected.clear();
    document.querySelectorAll('.surface-btn').forEach(b => b.classList.remove('selected'));
  });
  document.getElementById('btn-surface-done').addEventListener('click', () => {
    if (!modalContext) return;
    const tooth = state.teeth[modalContext.orisCode];
    const layer = tooth.layers.find(L => L.status === modalContext.status);
    if (layer) {
      layer.surfaces = SURFACES.filter(s => modalContext.selected.has(s));
    }
    refreshCell(modalContext.orisCode);
    refreshOutput();
    closeSurfaceModal();
  });
  document.getElementById('btn-surface-cancel').addEventListener('click', closeSurfaceModal);
  document.getElementById('surface-modal').addEventListener('click', (e) => {
    if (e.target.id === 'surface-modal') closeSurfaceModal();
  });
}

// ============================================================================
// 8. Anatomy panel
// ============================================================================

function setupAnatomyHandlers() {
  document.querySelectorAll('[data-anatomy-key]').forEach(el => {
    el.addEventListener('change', () => {
      const key = el.dataset.anatomyKey;
      const value = el.value;
      setAnatomyValue(key, value);
      refreshOutput();
    });
  });
}

function setAnatomyValue(dottedKey, value) {
  const parts = dottedKey.split('.');
  let cursor = state.anatomy;
  for (let i = 0; i < parts.length - 1; i++) {
    cursor[parts[i]] = cursor[parts[i]] || {};
    cursor = cursor[parts[i]];
  }
  if (value === '') {
    delete cursor[parts[parts.length - 1]];
  } else {
    cursor[parts[parts.length - 1]] = value;
  }
}

// ============================================================================
// 9. Metadata handlers
// ============================================================================

function setupMetaHandlers() {
  ['pid', 'age', 'sex', 'date', 'quality'].forEach(field => {
    const el = document.getElementById('meta-' + field);
    el.addEventListener('change', () => {
      state.meta[field] = el.value;
      refreshOutput();
    });
  });
}

// ============================================================================
// 10. Build the ORIS document
// ============================================================================

function buildOrisDocument() {
  const teeth = {};
  for (const [pos, tooth] of Object.entries(state.teeth)) {
    const orisCode = pos + tooth.occupant;
    const layersStr = encodeLayers(tooth.layers);
    teeth[orisCode] = {
      fdi: tooth.fdi,
      occupant: tooth.occupant,
      status_layers: layersStr,
    };
    const surfaces = aggregatedSurfaces(tooth.layers);
    if (surfaces.length > 0) teeth[orisCode].surfaces = surfaces;
  }

  const doc = {
    "$schema": "https://github.com/zmeik/oris/schema/oris-v0.1.json",
    oris_version: "0.1.0",
    document_id: `WEB_DEMO_${Date.now()}`,
    patient: {
      anonymized_id: state.meta.pid || "P_DEMO_SYNTHETIC",
      age_years: state.meta.age ? parseInt(state.meta.age, 10) : null,
      sex: state.meta.sex || null,
    },
    imaging: {
      modality: "OPG",
      device: "Synthetic Web-Demo Device",
      acquisition_date: state.meta.date ? new Date(state.meta.date).toISOString() : new Date().toISOString(),
      image_quality_score: state.meta.quality ? parseInt(state.meta.quality, 10) : null,
    },
    teeth: teeth,
    ground_truth_meta: {
      source: "manual",
      session_id: getSessionId(),
      sequence_num: 1,
      last_modified: new Date().toISOString(),
    },
    notes: "Generated by ORIS web-demo (test mode). Synthetic data only.",
  };

  // Anatomy block — split into proper schema sections
  if (state.anatomy.mandibular_canal || state.anatomy.maxillary_sinus || state.anatomy.mental_foramen ||
      (state.anatomy.anatomical_landmarks && state.anatomy.anatomical_landmarks.nasal_cavity)) {
    doc.anatomical_landmarks = {};
    if (state.anatomy.mandibular_canal) doc.anatomical_landmarks.mandibular_canal = state.anatomy.mandibular_canal;
    if (state.anatomy.maxillary_sinus) doc.anatomical_landmarks.maxillary_sinus = state.anatomy.maxillary_sinus;
    if (state.anatomy.mental_foramen) doc.anatomical_landmarks.mental_foramen = state.anatomy.mental_foramen;
    if (state.anatomy.anatomical_landmarks && state.anatomy.anatomical_landmarks.nasal_cavity) {
      doc.anatomical_landmarks.nasal_cavity = state.anatomy.anatomical_landmarks.nasal_cavity;
    }
  }

  if (state.anatomy.tmj_findings) {
    doc.tmj_findings = state.anatomy.tmj_findings;
  }

  if (state.anatomy.airway_assessment) {
    doc.airway_assessment = state.anatomy.airway_assessment;
  }

  return doc;
}

let _sessionId = null;
function getSessionId() {
  if (_sessionId) return _sessionId;
  _sessionId = (crypto.randomUUID && crypto.randomUUID()) || ('xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  }));
  return _sessionId;
}

// ============================================================================
// 11. Output panel
// ============================================================================

function refreshOutput() {
  const doc = buildOrisDocument();
  document.getElementById('json-output').textContent = JSON.stringify(doc, null, 2);
  // Save to localStorage for cross-reload persistence
  try {
    localStorage.setItem('oris_demo_state', JSON.stringify(state));
  } catch (e) {
    // localStorage may be disabled — ignore silently
  }
}

function setupOutputActions() {
  document.getElementById('btn-copy').addEventListener('click', async () => {
    const txt = document.getElementById('json-output').textContent;
    try { await navigator.clipboard.writeText(txt); alert('Copied!'); }
    catch (e) { alert('Copy failed: ' + e.message); }
  });
  document.getElementById('btn-export').addEventListener('click', () => {
    const txt = document.getElementById('json-output').textContent;
    const blob = new Blob([txt], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `oris_demo_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });
  document.getElementById('btn-load-001').addEventListener('click', loadSyntheticExample);
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (!confirm('Clear all entries?')) return;
    state.teeth = {};
    state.anatomy = {};
    initialiseState();
    refreshAllCells();
    document.querySelectorAll('[data-anatomy-key]').forEach(el => { el.value = ''; });
    refreshOutput();
  });
}

async function loadSyntheticExample() {
  // Try to fetch the synthetic_001.json from the repo (works if served via http://);
  // fall back to a hard-coded mini snapshot if fetch fails (e.g. file:// open).
  try {
    const res = await fetch('../examples/synthetic_001.json');
    if (!res.ok) throw new Error('fetch failed');
    const doc = await res.json();
    importDocument(doc);
  } catch (e) {
    // Fallback hard-coded mini snapshot
    const mini = {
      patient: { anonymized_id: 'P_0001_SYNTHETIC', age_years: 45, sex: 'M' },
      imaging: { acquisition_date: '2026-01-15T10:30:00Z', image_quality_score: 4 },
      teeth: {
        URMP1M: { fdi: '1.6', occupant: 'N', status_layers: 'endo:mo+post+crowned' },
        URPP2P: { fdi: '1.5', occupant: 'N', status_layers: 'restored:o' },
        ULMP1M: { fdi: '2.6', occupant: 'N', status_layers: 'crowned' },
        LRPP2P: { fdi: '4.5', occupant: 'F', status_layers: 'impl_restored' },
        URMP3M: { fdi: '1.8', occupant: 'A', status_layers: 'missing' },
        ULMP3M: { fdi: '2.8', occupant: 'A', status_layers: 'missing' },
        LLMP1M: { fdi: '3.6', occupant: 'A', status_layers: 'missing' },
        LRMP1M: { fdi: '4.6', occupant: 'A', status_layers: 'missing' },
        LLMP3M: { fdi: '3.8', occupant: 'N', status_layers: 'impacted' },
        LRMP3M: { fdi: '4.8', occupant: 'N', status_layers: 'impacted' },
      }
    };
    importDocument(mini);
  }
}

function importDocument(doc) {
  // Reset
  initialiseState();

  if (doc.patient) {
    if (doc.patient.anonymized_id) { state.meta.pid = doc.patient.anonymized_id; document.getElementById('meta-pid').value = state.meta.pid; }
    if (doc.patient.age_years != null) { state.meta.age = doc.patient.age_years; document.getElementById('meta-age').value = state.meta.age; }
    if (doc.patient.sex != null) { state.meta.sex = doc.patient.sex; document.getElementById('meta-sex').value = state.meta.sex; }
  }
  if (doc.imaging && doc.imaging.image_quality_score != null) {
    state.meta.quality = doc.imaging.image_quality_score;
    document.getElementById('meta-quality').value = state.meta.quality;
  }

  // Teeth
  for (const [orisCode, tooth] of Object.entries(doc.teeth || {})) {
    const pos = orisCode.slice(0, 5);
    if (!state.teeth[pos]) continue;
    state.teeth[pos].occupant = tooth.occupant || 'N';
    state.teeth[pos].layers = parseLayers(tooth.status_layers || '');
  }

  refreshAllCells();
  refreshOutput();
}

function parseLayers(raw) {
  if (!raw) return [];
  return raw.split('+').map(token => {
    const idx = token.indexOf(':');
    if (idx === -1) return { status: token, surfaces: [] };
    return {
      status: token.slice(0, idx),
      surfaces: token.slice(idx + 1).split('')
    };
  });
}

// ============================================================================
// 12. Bootstrap
// ============================================================================

function init() {
  initialiseState();
  for (const q of [1, 2, 3, 4]) renderQuadrant(q);
  refreshAllCells();
  setupSurfaceModal();
  setupAnatomyHandlers();
  setupMetaHandlers();
  setupOutputActions();

  document.getElementById('lang-en').addEventListener('click', () => applyLanguage('en'));
  document.getElementById('lang-ru').addEventListener('click', () => applyLanguage('ru'));

  // Auto-detect language preference
  const saved = (() => { try { return localStorage.getItem('oris_demo_lang'); } catch { return null; } })();
  const browser = (navigator.language || 'en').toLowerCase();
  applyLanguage(saved || (browser.startsWith('ru') ? 'ru' : 'en'));
  document.getElementById('lang-en').addEventListener('click', () => { try { localStorage.setItem('oris_demo_lang', 'en'); } catch {} });
  document.getElementById('lang-ru').addEventListener('click', () => { try { localStorage.setItem('oris_demo_lang', 'ru'); } catch {} });

  refreshOutput();
}

// Restore from localStorage if available
function tryRestore() {
  try {
    const saved = localStorage.getItem('oris_demo_state');
    if (!saved) return false;
    const parsed = JSON.parse(saved);
    if (parsed.teeth) {
      for (const [pos, tooth] of Object.entries(parsed.teeth)) {
        if (state.teeth[pos]) {
          state.teeth[pos].occupant = tooth.occupant || 'N';
          state.teeth[pos].layers = tooth.layers || [];
        }
      }
    }
    if (parsed.anatomy) state.anatomy = parsed.anatomy;
    if (parsed.meta) state.meta = parsed.meta;
    return true;
  } catch { return false; }
}

document.addEventListener('DOMContentLoaded', () => {
  init();
  tryRestore();
  refreshAllCells();
  // Restore meta inputs
  ['pid', 'age', 'sex', 'date', 'quality'].forEach(field => {
    const el = document.getElementById('meta-' + field);
    if (el && state.meta[field] !== undefined && state.meta[field] !== null) el.value = state.meta[field];
  });
  // Restore anatomy inputs
  document.querySelectorAll('[data-anatomy-key]').forEach(el => {
    const parts = el.dataset.anatomyKey.split('.');
    let cursor = state.anatomy;
    for (const p of parts) {
      if (cursor && typeof cursor === 'object' && p in cursor) cursor = cursor[p];
      else { cursor = null; break; }
    }
    if (typeof cursor === 'string') el.value = cursor;
  });
  refreshOutput();
});
