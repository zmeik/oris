/* ============================================================
   oris-i18n.js — shared EN ↔ RU dictionary for the reference app
   ============================================================
   Single source of truth used by BOTH the /play page (darwin_lab
   shell + tooth picker + formula labels) and the /play/anatomy
   editor. The active language is persisted in localStorage as
   'oris-lang' and any subscriber registered via onLangChange()
   gets called whenever setLang() flips the value, so every panel
   re-renders in the new language without needing a page reload.

   Falls back through the chain: requested key in current lang →
   key in EN → the key string itself (so untranslated strings show
   as their raw key during development, not as `undefined`).
   ============================================================ */
(function (global) {
  'use strict';

  // Migration: an earlier prototype stored the choice as
  // 'oris-anatomy-lang'. Honour it on first load if the new key is
  // missing so a reviewer doesn't lose their previous selection.
  function _readSavedLang() {
    try {
      const v = localStorage.getItem('oris-lang')
              || localStorage.getItem('oris-anatomy-lang');
      if (v === 'en' || v === 'ru') return v;
    } catch (_) {}
    return 'ru';
  }

  let currentLang = _readSavedLang();
  const _subscribers = new Set();

  const I18N = {
    ru: {
      // ── Brand / topbar (shared between /play and /play/anatomy) ──
      brand:                'ORIS Reference UI',
      brandTagline:         'v0.1 · синтетические данные · приложение-компаньон к статье IJOS',
      themeToggleTitle:     'Светлая / тёмная тема (для скриншотов в статью используйте светлую)',
      navArena:             '🎯 Арена',
      // ── Anatomy editor topbar ──
      appViewer:            'Анатомия — просмотр',
      appEditor:            'Анатомия — правка',
      backToPlay:           '← /play',
      fileIdLabel:          'file_id',
      pageViewer:           '👁 Просмотр',
      pageEditor:           '✏ Правка',
      pageViewerTitle:      'Только просмотр — пан + zoom + подсветка (без правки)',
      pageEditorTitle:      'Включить drag-to-reshape, +Add, Save',
      polyline:             '⌒ Полилиния',
      bbox:                 '▭ Bbox',
      zoomLabel:            'zoom',
      fit:                  'В размер',
      fitTitle:             'Вписать снимок в окно (F)',
      reset:                'Сброс',
      resetTitle:           'Откатить все правки на этом файле',
      save:                 '✓ Сохранить',
      saveTitle:            'Сохранить правки (Ctrl+S)',
      snapBtn:              '🧲 Магнит',
      snapTitle:            'Притягивать точки к ближайшим вершинам (S)',
      addBtn:               '+ Доб.',
      addTitle:             'Добавить полигон или bbox в группу «{group}»',
      structHide:           'Скрыть с холста (H)',
      structShow:           'Показать на холсте (H)',
      structModeTitle:      'Переключить bbox / полилиния (B / P)',
      deleteCustomTitle:    'Удалить эту пользовательскую структуру',
      groupHideAll:         'Скрыть всю группу',
      groupShowAll:         'Показать всю группу',
      sbActive:             'активна',
      sbMode:               'режим',
      sbVertices:           'точек',
      sbSaved:              'сохранение',
      sbHintViewer:         'просмотр · drag = пан · scroll = zoom · клик слева — подсветить структуру',
      sbHintEditor:         'тащите точки · клик по сегменту = новая точка · правый клик = удалить · B / P режим · S магнит',
      drawingPolyline:      'Рисуем <b>{name}</b> · клик добавляет точку · двойной клик / Enter — завершить',
      drawingBbox:          'Рисуем <b>{name}</b> · клик + перетаскивание задают прямоугольник',
      commit:               'Завершить (Enter)',
      cancel:               'Отмена (Esc)',
      promptCustomName:     'Новая пользовательская структура в группе «{group}»\nИмя:',
      promptCustomNameDefault: 'Новая находка',
      promptKind:           'Режим? Введите "polyline" (по умолч.) или "bbox":',
      confirmDeleteCustom:  'Удалить структуру «{name}»? Действие можно откатить, пока не нажмёте Сохранить.',
      confirmReset:         'Сбросить все правки на этом файле? К истории добавится пустое сохранение.',
      saveNoEdits:          'нет правок',
      saveFailed:           'ошибка сохранения: ',
      saveOk:               '#{seq} · {n} структур',
      loadedSeq:            '#{seq} (загружено)',
      structuresCountSuffix:'pts',
      countDash:            '—',

      // ── /play sandbox bar ──
      sourceLabel:          'Источник:',
      sandboxDemoLabel:     'Синтетическая демо-песочница (3 анонимизированных кейса РУДН К08.1)',
      newSandbox:           '+ Новая песочница',
      newSandboxTitle:      'Создать новую песочницу для своих синтетических OPG',
      importOpg:            'Импорт OPG',
      sandboxDelete:        'Удалить',
      anatomyLabel:         '🦴 Анатомия',
      anatomyViewerBtn:     '👁 Просмотр',
      anatomyViewerTitle:   'Открыть анатомический viewer для текущего файла. Запускается в режиме "только смотреть"; ✏ Правка внутри страницы открывает drag-to-reshape.',
      orisLabel:            '🌐 ORIS',
      orisDownloadBtn:      '⬇ ORIS',
      orisDownloadTitle:    'Скачать каноничный ORIS v0.1 JSON (валидируется против schema/oris-v0.1.json)',
      bridgeFhirTitle:      'Экспорт в FHIR R4 Bundle (Patient + Observation для каждого зуба)',
      bridgeDicomTitle:     'Экспорт в DICOM-SR XML (шаблон TID 5300 — стоматологический осмотр)',
      bridgeMisTitle:       'Экспорт в плоский MIS chart JSON для российских стоматологических МИС',
      bridgeMmoralTitle:    'Экспорт в формат MMOral (8 классов) для кросс-сравнения с другими статьями',

      // ── Arena explainer steps ──
      arenaExplainerTitle:  '🎯 Arena — как это работает',
      arenaExplainerHint:   '▸ кликните, чтобы развернуть',
      arenaStep1Bold:       'Изучите снимок',
      arenaStep1Body:       'панорамный снимок (OPG) реального пациента К08.1, анонимизированный (обрезка 5% со всех сторон, удаление EXIF, водяной знак)',
      arenaStep2Bold:       'Заполните ground-truth строку',
      arenaStep2Body:       '(голубая) — кликните любую из 32 ячеек зуба, чтобы задать слоистый статус (например <code>endo:mo+post+crowned</code>). Откроется редактор слоёв с полной грамматикой 18 статусов × 5 поверхностей.',
      arenaStep3Bold:       'Сравните алгоритмы',
      arenaStep3Body:       'каждая строка ниже GT — это предсказание одного алгоритма. Красная рамка = расхождение с GT.',
      arenaStep4Bold:       'Голосуйте',
      arenaStep4Body:       '👍 многообещающий, 💀 безнадёжный. Агрегированная κ по 31 алгоритму — на вкладке Metrics.',

      // ── Tooth picker modal ──
      tpTitleStatus:        'Статус зуба',
      tpTitleLayered:       'Слои зуба',
      tpFdiLabel:           'FDI',
      tpUniversalLabel:     'Universal',
      tpPalmerLabel:        'Palmer',
      tpClose:              'Закрыть',
      tpOccupant:           'Что в позиции',
      tpStatus:             'Статус',
      tpSurfaces:           'Поверхности',
      tpAddLayer:           '+ Добавить слой',
      tpRemoveLayer:        'Удалить слой',
      tpClear:              'Очистить',
      tpPreview:            'Предпросмотр',
      tpSave:               'Сохранить',
      tpCancel:             'Отмена',

      // 18 statuses (paper §2.2 grammar)
      st_present:           'присутствует',
      st_missing:           'отсутствует',
      st_impacted:          'импактирован',
      st_root_only:         'только корень',
      st_caries:            'кариес',
      st_endo:              'эндодонтия',
      st_restored:          'пломба',
      st_crowned:           'коронка',
      st_post:              'штифт',
      st_implant:           'имплантат',
      st_impl_fixture:      'фикстура импл.',
      st_impl_healing:      'формирователь',
      st_impl_restored:     'имплантат с реставрацией',
      st_bridge:            'мост',
      st_bar:               'балка',
      st_cantilever:        'консоль моста',
      st_uncertain:         'не уверен',
      st_root:              'корень (резорбция)',

      // 5 surfaces
      sf_m:                 'медиальная',
      sf_d:                 'дистальная',
      sf_o:                 'окклюзионная',
      sf_v:                 'вестибулярная',
      sf_l:                 'язычная',

      // 13 occupants
      oc_N:                 'N — естественный зуб',
      oc_F:                 'F — фикстура (имплантат)',
      oc_A:                 'A — отсутствует',
      oc_R:                 'R — корневой остаток',
      oc_S:                 'S — сверхкомплектный',
      oc_U:                 'U — неизвестно',
      oc_B:                 'B — мостовой понтик',
      oc_C:                 'C — консольный понтик',
      oc_M:                 'M — мерилэнд-мост',
      oc_I:                 'I — инлей/онлей-ретейнер',
      oc_D:                 'D — зуб протеза',
      oc_H:                 'H — гибридный протез',
      oc_O:                 'O — опора overdenture',
      oc_T:                 'T — трансплантат',

      // ── Formula row labels & GT controls ──
      fmlGTRowLabel:        'Ground truth (вы)',
      fmlGTRowSub:          '0/32 размечено',
      fmlAIPrefill:         '🤖 AI prefill',
      fmlAIRetitle:         'Перезаполнить GT из AI (текущая разметка будет сброшена!)',
      fmlSaveTitle:         'Сохранить ground truth и пересчитать алгоритмы',
      fmlNotReadyTitle:     '{filled}/32 размечено — заполните все, чтобы сохранить',
      fmlTimeMachineTitle:  'Машина времени — откатиться к предыдущему снимку',
      fmlCropToggle:        'Показать / скрыть кропы зубов',
      fmlSaveBannerNoChanges:'Нет изменений',
      fmlSaveBannerPending: '{n} несохранено — автосохранение через ~1с',
      fmlSaveBannerSaving:  'Сохраняем {n} изм. в БД…',
      fmlSaveBannerSaved:   'Сохранено · {n} изм. в этой сессии',
      fmlSaveBannerSavedAll:'Всё в БД · {n} изм. сохранено в этой сессии',
      fmlSaveBannerFailed:  'Ошибка сохранения — нажмите для повтора',
      fmlSaveBannerLast:    'последнее: {fdi} → {val} в {time}',
      fmlSaveBannerSavedAt: 'сохранено {time} ({ago})',
      fmlMissingTeeth:      'нет:',
      fmlMarkedSub:         'Размечено {n}/32',
      fmlMarkedFull:        '✓ Полная разметка',
      fmlNotReadyShort:     'Отмечено {n}/32 зубов — отметьте все для сохранения',

      // ── Change-history strip ──
      chistTitle:           'История изменений',
      chistRecentMeta:      '{n} последних · file_id {id}',
      chistEmpty:           'Изменений пока нет',
      chistFetchFailed:     'Не удалось загрузить историю',
      chistAnatomyTpl:      'обновление анатомии: {value}',
      chistAnatomyMisc:     'анатомия: {value}',

      // ── Misc /play surfaces ──
      langToggleTitle:      'Переключить язык интерфейса',

      // ── Tooth picker modal — group headers + items + helper UI ──
      tpHeaderStatus:       'СТАТУС ЗУБА',
      tpHeaderPathology:    'ПАТОЛОГИЯ',
      tpHeaderTreatment:    'ЛЕЧЕНИЕ',
      tpHeaderImplant:      'ИМПЛАНТАТ',
      tpHeaderProsthesis:   'ПРОТЕЗ',
      tpHeaderPresets:      'ШАБЛОНЫ',
      tpHeaderLinks:        'СВЯЗИ',
      tpHeaderRoots:        'КОРНИ / ROOTS',
      tpItemPresent:        'Интактный',
      tpItemMissing:        'Отсутствует',
      tpItemImpacted:       'Ретинир.',
      tpItemCaries:         'Кариес',
      tpItemAttrition:      'Стираемость',
      tpItemRootRem:        'Корень',
      tpItemRestored:       'Пломба',
      tpItemEndo:           'Эндо',
      tpItemImplFixture:    'Фикстура',
      tpItemImplCover:      '+ Заглушка',
      tpItemImplHealing:    '+ Формирователь',
      tpItemImplAbutment:   '+ Абатмент',
      tpItemImplTempAbut:   '+ Врем. абатмент',
      tpItemImplProvisional:'+ Провиз. коронка',
      tpItemImplRestored:   '+ Коронка',
      tpItemPost:           'Штифт',
      tpItemCrowned:        'Коронка',
      tpItemBridge:         'Понтик (тело моста)',
      tpItemSmartBridge:    '🌉 Мост (drag→b)',
      tpItemSmartBar:       '═ Балка (drag→g)',
      tpItemCantilever:     'Консоль',
      tpItemUncertain:      'Не ясно',
      tpItemReset:          'Сброс',
      tpSettingsTitle:      'Настройка групп',
      tpEditPresetsTitle:   'Редактировать шаблоны',
      tpSurfacesTitle:      'Отметьте поражённые стенки:',
      tpSurfaceDone:        'Готово',
      tpBridgeAddLink:      '+ мост при назначении статуса',
      tpBridgeLinkOnly:     '🔗 Только связать',
      tpBridgeUnlink:       '✕ Разъединить',
      tpRootHintCanal:      'Клик на канал = цикл заполнения',
      tpRootHintApex:       'Клик на апекс = периапикальная находка (PAI, Ørstavik 1986)',
      tpRootPeriapNorm:     '● Норма',

      // ── Groups editor ──
      gedTitle:             '⚙ Настройка групп статусов',
      gedSystemLabel:       'СИСТЕМНЫЕ',
      gedDeleteEmpty:       'Удалить пустую группу',
      gedAddGroup:          '＋ Новая группа',
      gedReset:             '↺ Сброс по умолчанию',
      gedDone:              'Готово',
      gedNewGroupName:      'НОВАЯ ГРУППА',
    },

    en: {
      brand:                'ORIS Reference UI',
      brandTagline:         'v0.1 · synthetic data · paper-companion app for IJOS submission',
      themeToggleTitle:     'Toggle light / dark theme (use light for paper screenshots)',
      navArena:             '🎯 Arena',
      appViewer:            'Anatomy viewer',
      appEditor:            'Anatomy editor',
      backToPlay:           '← /play',
      fileIdLabel:          'file_id',
      pageViewer:           '👁 Viewer',
      pageEditor:           '✏ Edit',
      pageViewerTitle:      'Read-only — pan + zoom + highlight (no editing)',
      pageEditorTitle:      'Unlock drag-to-reshape, + Add, Save',
      polyline:             '⌒ Polyline',
      bbox:                 '▭ Bbox',
      zoomLabel:            'zoom',
      fit:                  'Fit',
      fitTitle:             'Fit image to viewport (F)',
      reset:                'Reset',
      resetTitle:           'Discard reviewer overrides on this file',
      save:                 '✓ Save',
      saveTitle:            'Save reviewer overrides (Ctrl+S)',
      snapBtn:              '🧲 Snap',
      snapTitle:            'Snap to nearby vertices (S)',
      addBtn:               '+ Add',
      addTitle:             'Add a new polygon or bbox into "{group}"',
      structHide:           'Hide from canvas (H)',
      structShow:           'Show on canvas (H)',
      structModeTitle:      'Toggle bbox / polyline (B / P)',
      deleteCustomTitle:    'Delete this custom structure',
      groupHideAll:         'Hide all in this group',
      groupShowAll:         'Show all in this group',
      sbActive:             'active',
      sbMode:               'mode',
      sbVertices:           'vertices',
      sbSaved:              'last save',
      sbHintViewer:         'view-only · drag = pan · scroll = zoom · click structure on the left to highlight',
      sbHintEditor:         'drag points · click segment to insert · right-click to delete · B / P mode · S snap',
      drawingPolyline:      'Drawing <b>{name}</b> · click to add points · double-click / Enter to commit',
      drawingBbox:          'Drawing <b>{name}</b> · click + drag a rectangle on the OPG',
      commit:               'Commit (Enter)',
      cancel:               'Cancel (Esc)',
      promptCustomName:     'New custom structure in "{group}"\nName:',
      promptCustomNameDefault: 'New finding',
      promptKind:           'Mode? Type "polyline" (default) or "bbox":',
      confirmDeleteCustom:  'Delete custom structure "{name}"? This is undoable until you press Save.',
      confirmReset:         'Discard all reviewer overrides on this file? This appends an empty save to the change history.',
      saveNoEdits:          'no edits',
      saveFailed:           'save failed: ',
      saveOk:               '#{seq} · {n} structures',
      loadedSeq:            '#{seq} (loaded)',
      structuresCountSuffix:'pts',
      countDash:            '—',

      sourceLabel:          'Source:',
      sandboxDemoLabel:     'Synthetic Demo Sandbox (3 anonymised RUDN K08.1 cases)',
      newSandbox:           '+ New sandbox',
      newSandboxTitle:      'Create a new sandbox to import your own synthetic OPG',
      importOpg:            'Import OPG',
      sandboxDelete:        'Delete',
      anatomyLabel:         '🦴 Anatomy',
      anatomyViewerBtn:     '👁 Viewer',
      anatomyViewerTitle:   'Open the anatomy viewer for the current file. Boots read-only (pan + zoom). Use the ✏ Edit toggle inside the page to enable drag-to-reshape.',
      orisLabel:            '🌐 ORIS',
      orisDownloadBtn:      '⬇ ORIS',
      orisDownloadTitle:    'Download canonical ORIS v0.1 JSON (validated against schema/oris-v0.1.json)',
      bridgeFhirTitle:      'Export as FHIR R4 Bundle (Patient + Observation per tooth)',
      bridgeDicomTitle:     'Export as DICOM-SR XML (TID 5300 dental survey template)',
      bridgeMisTitle:       'Export as flat MIS chart JSON for Russian dental information systems',
      bridgeMmoralTitle:    'Export as 8-class MMOral benchmark format for cross-paper comparison',

      arenaExplainerTitle:  '🎯 Arena — how it works',
      arenaExplainerHint:   '▸ click to expand',
      arenaStep1Bold:       'Examine the radiograph',
      arenaStep1Body:       'anonymised panoramic dental radiograph (OPG) of a real K08.1 patient (5% all-side cropped, EXIF-stripped, watermarked)',
      arenaStep2Bold:       'Fill the ground-truth row',
      arenaStep2Body:       '(blue) — click any of the 32 tooth cells to set its layered status (e.g. <code>endo:mo+post+crowned</code>). The layer editor opens with the full 18-status × 5-surface grammar.',
      arenaStep3Bold:       'Compare algorithms',
      arenaStep3Body:       'each row below the GT shows what one algorithm predicts. Red border = disagreement with GT.',
      arenaStep4Bold:       'Cast votes',
      arenaStep4Body:       '👍 promising, 💀 hopeless. Aggregated κ across the 31-algorithm population is in the Metrics tab.',

      tpTitleStatus:        'Tooth status',
      tpTitleLayered:       'Tooth layers',
      tpFdiLabel:           'FDI',
      tpUniversalLabel:     'Universal',
      tpPalmerLabel:        'Palmer',
      tpClose:              'Close',
      tpOccupant:           'Occupant',
      tpStatus:             'Status',
      tpSurfaces:           'Surfaces',
      tpAddLayer:           '+ Add layer',
      tpRemoveLayer:        'Remove layer',
      tpClear:              'Clear',
      tpPreview:            'Preview',
      tpSave:               'Save',
      tpCancel:             'Cancel',

      st_present:           'present',
      st_missing:           'missing',
      st_impacted:          'impacted',
      st_root_only:         'root only',
      st_caries:            'caries',
      st_endo:              'endodontically treated',
      st_restored:          'restored',
      st_crowned:           'crowned',
      st_post:              'post & core',
      st_implant:           'implant',
      st_impl_fixture:      'implant fixture',
      st_impl_healing:      'healing abutment',
      st_impl_restored:     'implant restored',
      st_bridge:            'bridge',
      st_bar:               'bar',
      st_cantilever:        'cantilever',
      st_uncertain:         'uncertain',
      st_root:              'root (resorption)',

      sf_m:                 'mesial',
      sf_d:                 'distal',
      sf_o:                 'occlusal',
      sf_v:                 'vestibular',
      sf_l:                 'lingual',

      oc_N:                 'N — Natural tooth',
      oc_F:                 'F — Fixture (implant)',
      oc_A:                 'A — Absent',
      oc_R:                 'R — Root remnant',
      oc_S:                 'S — Supernumerary',
      oc_U:                 'U — Unknown',
      oc_B:                 'B — Bridge pontic',
      oc_C:                 'C — Cantilever pontic',
      oc_M:                 'M — Maryland-bonded retainer',
      oc_I:                 'I — Inlay / onlay retainer',
      oc_D:                 'D — Denture tooth',
      oc_H:                 'H — Hybrid prosthesis',
      oc_O:                 'O — Overdenture support',
      oc_T:                 'T — Transplant',

      fmlGTRowLabel:        'Ground truth (you)',
      fmlGTRowSub:          '0/32 annotated',
      fmlAIPrefill:         '🤖 AI prefill',
      fmlAIRetitle:         'Re-prefill GT from AI (will reset current annotation!)',
      fmlSaveTitle:         'Save ground truth and recompute algorithms',
      fmlNotReadyTitle:     '{filled}/32 annotated — annotate all to save',
      fmlTimeMachineTitle:  'Time machine — roll back to a previous snapshot',
      fmlCropToggle:        'Show / hide tooth crops',
      fmlSaveBannerNoChanges:'No changes',
      fmlSaveBannerPending: '{n} unsaved — autosaving in ~1s',
      fmlSaveBannerSaving:  'Saving {n} change{plural:n} to database…',
      fmlSaveBannerSaved:   'Saved · {n} total this session',
      fmlSaveBannerSavedAll:'All in DB · {n} saved this session',
      fmlSaveBannerFailed:  'Save FAILED — click to retry',
      fmlSaveBannerLast:    'last: {fdi} → {val} at {time}',
      fmlSaveBannerSavedAt: 'saved {time} ({ago})',
      fmlMissingTeeth:      'missing:',
      fmlMarkedSub:         '{n}/32 annotated',
      fmlMarkedFull:        '✓ Fully annotated',
      fmlNotReadyShort:     '{n}/32 annotated — annotate all to save',

      chistTitle:           'Change history',
      chistRecentMeta:      '{n} recent · file_id {id}',
      chistEmpty:           'No edits yet',
      chistFetchFailed:     'history fetch failed',
      chistAnatomyTpl:      'anatomy template update: {value}',
      chistAnatomyMisc:     'anatomy: {value}',

      langToggleTitle:      'Switch UI language',

      // ── Tooth picker modal — group headers + items + helper UI ──
      tpHeaderStatus:       'TOOTH STATUS',
      tpHeaderPathology:    'PATHOLOGY',
      tpHeaderTreatment:    'TREATMENT',
      tpHeaderImplant:      'IMPLANT',
      tpHeaderProsthesis:   'PROSTHESIS',
      tpHeaderPresets:      'PRESETS',
      tpHeaderLinks:        'LINKS',
      tpHeaderRoots:        'ROOTS',
      tpItemPresent:        'Intact',
      tpItemMissing:        'Missing',
      tpItemImpacted:       'Impacted',
      tpItemCaries:         'Caries',
      tpItemAttrition:      'Attrition',
      tpItemRootRem:        'Root',
      tpItemRestored:       'Filling',
      tpItemEndo:           'Endo',
      tpItemImplFixture:    'Fixture',
      tpItemImplCover:      '+ Cover screw',
      tpItemImplHealing:    '+ Healing abut.',
      tpItemImplAbutment:   '+ Abutment',
      tpItemImplTempAbut:   '+ Temp. abut.',
      tpItemImplProvisional:'+ Provisional crown',
      tpItemImplRestored:   '+ Crown',
      tpItemPost:           'Post',
      tpItemCrowned:        'Crown',
      tpItemBridge:         'Pontic (bridge body)',
      tpItemSmartBridge:    '🌉 Bridge (drag→b)',
      tpItemSmartBar:       '═ Bar (drag→g)',
      tpItemCantilever:     'Cantilever',
      tpItemUncertain:      'Uncertain',
      tpItemReset:          'Reset',
      tpSettingsTitle:      'Group settings',
      tpEditPresetsTitle:   'Edit presets',
      tpSurfacesTitle:      'Mark affected surfaces:',
      tpSurfaceDone:        'Done',
      tpBridgeAddLink:      '+ bridge while assigning status',
      tpBridgeLinkOnly:     '🔗 Link only',
      tpBridgeUnlink:       '✕ Unlink',
      tpRootHintCanal:      'Click on canal = cycle fill state',
      tpRootHintApex:       'Click on apex = periapical finding (PAI, Ørstavik 1986)',
      tpRootPeriapNorm:     '● Normal',

      // ── Groups editor ──
      gedTitle:             '⚙ Status group settings',
      gedSystemLabel:       'SYSTEM',
      gedDeleteEmpty:       'Delete empty group',
      gedAddGroup:          '＋ New group',
      gedReset:             '↺ Reset to defaults',
      gedDone:              'Done',
      gedNewGroupName:      'NEW GROUP',
    },
  };

  function t(key, params) {
    let s = (I18N[currentLang] && I18N[currentLang][key]);
    if (s == null) s = (I18N.en && I18N.en[key]);
    if (s == null) return key;
    if (params) {
      for (const k of Object.keys(params)) {
        s = s.split('{' + k + '}').join(params[k]);
      }
    }
    return s;
  }

  // Display the localised name from a {ru, en} object (anatomy templates).
  // Tolerates plain strings (custom reviewer-typed labels) and missing values.
  function tName(n) {
    if (n == null) return '';
    if (typeof n === 'string') return n;
    return n[currentLang] || n.ru || n.en || '';
  }

  function getLang() { return currentLang; }

  function setLang(lang) {
    if (lang !== 'en' && lang !== 'ru') return;
    if (currentLang === lang) return;
    currentLang = lang;
    try { localStorage.setItem('oris-lang', lang); } catch (_) {}
    document.documentElement.lang = lang;
    for (const fn of _subscribers) {
      try { fn(lang); } catch (e) { console.warn('OrisI18n subscriber error', e); }
    }
  }

  function onLangChange(fn) {
    _subscribers.add(fn);
    return () => _subscribers.delete(fn);
  }

  // Wire up any standard `[data-lang-toggle] button[data-lang]` controls
  // to setLang automatically. Pages that include a button group like
  //   <div data-lang-toggle><button data-lang="ru">RU</button>
  //                         <button data-lang="en">EN</button></div>
  // get the active class kept in sync without having to write JS.
  function _wireToggleButtons() {
    document.querySelectorAll('[data-lang-toggle] button[data-lang]').forEach(btn => {
      btn.addEventListener('click', () => setLang(btn.dataset.lang));
    });
    function syncActive(lang) {
      document.querySelectorAll('[data-lang-toggle] button[data-lang]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.lang === lang);
      });
    }
    syncActive(currentLang);
    onLangChange(syncActive);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _wireToggleButtons);
  } else {
    _wireToggleButtons();
  }

  // Initial document.documentElement.lang
  document.documentElement.lang = currentLang;

  global.OrisI18n = { t, tName, getLang, setLang, onLangChange };
})(window);
