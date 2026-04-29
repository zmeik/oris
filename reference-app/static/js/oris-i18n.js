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
      arenaExplainerTitle:  '🎯 Арена — как это работает',
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

      // ── Top breadcrumb (above topbar) ──
      bcSchema:             'Открытая схема рентгеновских данных',
      bcRefUI:              'Reference UI',
      bcSynthetic:          'СИНТЕТИКА · NO PII',
      bcSyntheticTitle:     'Все кейсы анонимизированы, EXIF удалён, добавлен водяной знак — синтетические данные. PII отсутствует.',
      bcDemoView:           '← Демо',
      bcDemoViewTitle:      'Статичный демо-просмотр (без бэкенда, источник скриншотов для статьи)',
      bcGitHub:             'GitHub',
      bcPrivacy:            'Политика приватности',

      // ── OPG filter toolbar ──
      filterOriginal:       'Оригинал',
      filterClahe:          'CLAHE',
      filterContrast:       'Контраст',
      filterBone:           'Кость',
      filterInvert:         'Инверт.',
      filterObjectsTitle:   'Показать объекты на снимке (ВЫКЛ / Кропы / Все)',
      filterObjectsOff:     '🦷 Объекты',
      filterObjectsCrops:   '🦷 Объекты: кропы',
      filterObjectsAll:     '🦷 Объекты: все',
      filterFdiTitle:       'Сетка FDI из 32 позиций (ВЫКЛ / Только занятые / Все 32)',
      filterFdi:            '🔲 FDI',
      filterSegments:       'Сегменты',
      filterExpert:         '✎ Эксперт',
      filterExpertTitle:    'Показать экспертные правки bbox на панораме',

      // ── Card-hint banner (orange) ──
      cardHintBold:         '📋 Из карты пациента',
      cardHintLoading:      'загрузка…',
      cardHintChecking:     '⏳ Проверка карты пациента…',
      cardHintNoCard:       '📋 Карта не найдена',
      cardHintNoImplants:   '📋 В карте нет задокументированных имплантатов',
      cardHintNImplants:    '{n} имплантатов в карте пациента',
      cardHintError:        '📋 Ошибка загрузки подсказки',

      // ── Group + case meta ──
      groupBadge:           '{n} снимков',
      cardOpenInTab:        'Открыть карту пациента в новой вкладке',
      cardLink:             '📋 Карта →',
      copyGtTitle:          'Скопировать ground truth с другого снимка этого пациента',
      copyGtBtn:            '📋 Копировать GT из…',
      snapshotIndex:        'Снимок {n}',

      // ── Tooth cell tooltip status abbreviations ──
      stAbbr_endo:          'эндо',
      stAbbr_post:          'штифт',
      stAbbr_crowned:       'коронка',
      stAbbr_restored:      'пломба',
      stAbbr_caries:        'кариес',
      stAbbr_present:       'интакт',
      stAbbr_missing:       'отс.',
      stAbbr_implant:       'имплантат',
      stAbbr_impl_fixture:  'имплантат',
      stAbbr_impl_restored: 'имп+кор',
      stAbbr_impl_cover:    'имп+заг',
      stAbbr_impl_healing:  'имп+форм',
      stAbbr_attrition:     'стираем.',
      stAbbr_root:          'корень',
      stAbbr_bridge:        'мост',
      stAbbr_impacted:      'ретин.',

      // ── Carousel card + annotation buttons ──
      carouselNoDet:        '{fdi} — нет детекции\nКлик: нарисовать кроп вручную',
      carouselDrawCrown:    'Нарисовать коронку',
      carouselDrawFraming:  'Нарисовать каркас коронки',
      carouselDrawVeneer:   'Нарисовать винир',
      carouselNavPrev:      '← Предыдущий кроп',
      carouselNavNext:      '→ Следующий кроп',

      // ── Algo row hint ──
      clickAlgoToSeeDetails:'Кликните по названию алгоритма, чтобы увидеть детали',
      clickToothToSeeDetails:'Кликните по ячейке зуба, чтобы увидеть детали',

      // ─────────────────────────────────────────────────────────
      // Dental status abbreviations — single / 2-char codes painted
      // on the tooth cells of the dental formula, in the per-cell
      // .cell-abbr SVG label, and in the formula legend dots.
      // RU side preserves the canonical Russian dental school
      // shorthand (К/П/С/Э/Ш/И/Кн/Ст/Rt) used in the source data.
      // EN side follows established dental-software charting
      // conventions (Dentrix, Open Dental, Curve, ANSI/ADA D-codes
      // shorthand) where: C=Crown, F=Filling, Ca=Caries, E=Endo,
      // P=Post-and-core, I=Implant, M=Missing, Br=Bridge pontic,
      // Ba=Bar, Cn=Cantilever, W=Wear, R=Root remnant, Im=Impacted.
      // Combos (e.g. ИК→IC, ЭПК→EFC, ПСК→FCaC) compose by
      // concatenating per-layer codes via layersAbbreviation().
      // ─────────────────────────────────────────────────────────
      iconAbbr_present:        '·',
      iconAbbr_missing:        'О',
      iconAbbr_implant:        'И',
      iconAbbr_impl_fixture:   'И',
      iconAbbr_impl_cover:     'ИЗ',
      iconAbbr_impl_healing:   'ИФ',
      iconAbbr_impl_abutment:  'И',
      iconAbbr_impl_temp_abut: 'И',
      iconAbbr_impl_provisional:'И',
      iconAbbr_impl_restored:  'ИК',
      iconAbbr_crowned:        'К',
      iconAbbr_restored:       'П',
      iconAbbr_caries:         'С',
      iconAbbr_endo:           'Э',
      iconAbbr_post:           'Ш',
      iconAbbr_attrition:      'Ст',
      iconAbbr_root:           'R',
      iconAbbr_impacted:       'Rt',
      iconAbbr_bridge:         'М',
      iconAbbr_bridge_pontic:  'М',
      iconAbbr_bar:            'Б',
      iconAbbr_cantilever:     'Кн',
      iconAbbr_uncertain:      '?',
      iconAbbr_natural:        '·',
      iconAbbr_crown:          'К',
      iconAbbr_filling:        'П',
      // Legend column 2: short Russian/English label after the dot.
      legAbbr_present:         'Инт.',
      legAbbr_missing:         'Нет',
      legAbbr_impl_fixture:    'Фикс.',
      legAbbr_impl_cover:      '+ Загл.',
      legAbbr_impl_healing:    '+ Форм.',
      legAbbr_impl_restored:   '+ Кор.',
      legAbbr_crowned:         'Кор.',
      legAbbr_restored:        'Пл.',
      legAbbr_caries:          'Кар.',
      legAbbr_endo:            'Эн.',
      legAbbr_root:            'Кор.',
      legAbbr_bridge:          'Мост',
      legAbbr_cantilever:      'Конс.',
      legAbbr_error:           'Ошибка',
      // ── Longer status names used by the text-formula tooltip + the
      //    short legend strip directly under the OPG (per-tooth long
      //    description "1.6: имп+кор" / "1.6: imp+crown"). Distinct
      //    from iconAbbr (1-3 chars) and STATUS_TOOLTIPS (full sentence
      //    explanations). ──
      longName_present:        'интакт',
      longName_missing:        'отс.',
      longName_impacted:       'ретенц.',
      longName_caries:         'кариес',
      longName_attrition:      'стираем.',
      longName_root:           'корень',
      longName_restored:       'пломба',
      longName_endo:           'эндо',
      longName_post:           'штифт',
      longName_crowned:        'коронка',
      longName_implant:        'имплантат',
      longName_impl_fixture:   'имплантат',
      longName_impl_cover:     'имп+заг',
      longName_impl_healing:   'имп+форм',
      longName_impl_abutment:  'имп+абат',
      longName_impl_temp_abut: 'имп+вр.абат',
      longName_impl_provisional:'имп+врем',
      longName_impl_restored:  'имп+кор',
      longName_bridge:         'мост',
      longName_bar:            'балка',
      longName_cantilever:     'консоль',
      longName_uncertain:      'не ясно',

      // ── Tooth picker title + status descriptions (full sentence
      // shown as button tooltip and in the rich tooltip layer list) ──
      pickerTitleTooth:     'Зуб {fdi}',
      pickerAddLayer:       '＋слой',
      pickerAddLayerTitle:  'Добавить слой (Э+Ш+К)',
      pickerStatusNotSet:   'Статус: не задан',
      pickerStatusLine:     'Статус: {tip}',
      pickerSurfacesLine:   'Поверхности: {list}',
      pickerLayersHeader:   'Слои:',
      pickerBridgeLinkedTo: 'Мост: связан с {list}',
      pickerNotesLine:      'Заметки: {note}',
      tipStatus_present:    'Интактный зуб без патологии и лечения [1]',
      tipStatus_missing:    'Зуб отсутствует (удалён / не прорезался) [0]',
      tipStatus_impacted:   'Ретинированный зуб (не прорезавшийся, виден в кости) [8]',
      tipStatus_caries:     'Кариес — выберите поражённые поверхности (M/O/D/B/L) [2]',
      tipStatus_attrition:  'Стираемость (TWI 0-4) — клик циклирует степень [6]',
      tipStatus_root:       'Только корень без коронковой части [5]',
      tipStatus_restored:   'Пломба — выберите восстановленные поверхности [3]',
      tipStatus_endo:       'Эндодонтическое лечение — затем настройте каналы внизу [4]',
      tipStatus_impl_fixture:    'Имплантат-фикстура (только тело в кости) [q]',
      tipStatus_impl_cover:      'Имплантат + заглушка (cover screw) [w]',
      tipStatus_impl_healing:    'Имплантат + формирователь десны [e]',
      tipStatus_impl_abutment:   'Имплантат + абатмент (без коронки) [t]',
      tipStatus_impl_temp_abut:  'Имплантат + временный абатмент',
      tipStatus_impl_provisional:'Имплантат + провизорная коронка',
      tipStatus_impl_restored:   'Имплантат с постоянной коронкой [y]',
      tipStatus_post:       'Штифт / культевая вкладка в корневом канале [r]',
      tipStatus_crowned:    'Искусственная коронка (керамика/металл) [6]',
      tipStatus_bridge:     'Понтик — тело мостовидного протеза (нет корня) [7]',
      tipStatus__smart_bridge:'🌉 Мост: выделите зубы drag-select, нажмите [b]. Крайние → опоры, средние пустые → понтики, пустые на краю → консоли',
      tipStatus__smart_bar: '═ Балка: выделите зубы drag-select, нажмите [g]. Имплантаты → опоры, промежутки → балка, края → консоли',
      tipStatus_bar:        'Сегмент балки (между имплантатами, без собственной опоры)',
      tipStatus_cantilever: 'Консоль — часть протеза, нависающая за последнюю опору [u]',
      tipStatus_uncertain:  'Не ясно — не удаётся определить статус на снимке [9]',
      tipStatus__empty:     'Сброс — очистить статус зуба [Backspace]',

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

      // ── Top breadcrumb ──
      bcSchema:             'Open Radiographic Imaging Schema',
      bcRefUI:              'Reference UI',
      bcSynthetic:          'SYNTHETIC · NO PII',
      bcSyntheticTitle:     'All cases are anonymised, EXIF-stripped, watermarked synthetic data. No PII.',
      bcDemoView:           '← Demo view',
      bcDemoViewTitle:      'Static demo view (no backend, paper-quality screenshot source)',
      bcGitHub:             'GitHub',
      bcPrivacy:            'Privacy',

      // ── OPG filter toolbar ──
      filterOriginal:       'Original',
      filterClahe:          'CLAHE',
      filterContrast:       'Contrast',
      filterBone:           'Bone',
      filterInvert:         'Invert',
      filterObjectsTitle:   'Toggle object overlays on the panorama (OFF / Crops / All)',
      filterObjectsOff:     '🦷 Objects',
      filterObjectsCrops:   '🦷 Objects: crops',
      filterObjectsAll:     '🦷 Objects: all',
      filterFdiTitle:       'Show FDI grid of 32 positions (OFF / Occupied only / All 32)',
      filterFdi:            '🔲 FDI',
      filterSegments:       'Segments',
      filterExpert:         '✎ Expert',
      filterExpertTitle:    'Show expert bbox edits on the panorama',

      // ── Card-hint banner ──
      cardHintBold:         '📋 From patient card',
      cardHintLoading:      'loading…',
      cardHintChecking:     '⏳ Checking patient card…',
      cardHintNoCard:       '📋 No patient card found',
      cardHintNoImplants:   '📋 No implants documented in the card',
      cardHintNImplants:    '{n} implants in patient card',
      cardHintError:        '📋 Failed to load card hint',

      // ── Group + case meta ──
      groupBadge:           '{n} cases',
      cardOpenInTab:        'Open patient card in new tab',
      cardLink:             '📋 Card →',
      copyGtTitle:          'Copy ground truth from another image of this patient',
      copyGtBtn:            '📋 Copy GT from…',
      snapshotIndex:        'Image {n}',

      // ── Tooth cell tooltip status abbreviations ──
      stAbbr_endo:          'endo',
      stAbbr_post:          'post',
      stAbbr_crowned:       'crown',
      stAbbr_restored:      'fill',
      stAbbr_caries:        'caries',
      stAbbr_present:       'intact',
      stAbbr_missing:       'miss.',
      stAbbr_implant:       'implant',
      stAbbr_impl_fixture:  'implant',
      stAbbr_impl_restored: 'imp+cr',
      stAbbr_impl_cover:    'imp+cov',
      stAbbr_impl_healing:  'imp+heal',
      stAbbr_attrition:     'wear',
      stAbbr_root:          'root',
      stAbbr_bridge:        'bridge',
      stAbbr_impacted:      'imp.',

      // ── Carousel card + annotation buttons ──
      carouselNoDet:        '{fdi} — no detection\nClick: draw crop manually',
      carouselDrawCrown:    'Draw crown',
      carouselDrawFraming:  'Draw crown framework',
      carouselDrawVeneer:   'Draw veneer',
      carouselNavPrev:      '← Previous crop',
      carouselNavNext:      '→ Next crop',

      // ── Algo row hint ──
      clickAlgoToSeeDetails:'Click an algorithm name to see details',
      clickToothToSeeDetails:'Click a tooth cell to see details',

      // ─────────────────────────────────────────────────────────
      // Dental status abbreviations — paired EN translations of the
      // RU shorthand. Convention chosen for unambiguous chartability
      // even when several layers stack on a single cell:
      //   present     · (universal intact dot)
      //   missing     M  (M for "missing" — universal in EN charting)
      //   implant     I  (I = implant; +stage suffix for compounds)
      //   impl_cover  ICs  ( I + Cs cover screw )
      //   impl_healing IH  ( I + H healing abutment )
      //   impl_abutment IA ( I + A abutment )
      //   impl_temp_abut IT ( I + T temporary )
      //   impl_provisional IP ( I + P provisional crown )
      //   impl_restored IC ( I + C crown — most common implant outcome )
      //   crowned    C  (C = Crown; same convention as Dentrix /
      //                   Open Dental / Curve charting)
      //   restored   F  (F = Filling)
      //   caries     Ca (Ca, not C, to avoid clash with Crown)
      //   endo       E  (E = endodontic treatment, RCT)
      //   post       P  (P = post-and-core; pontic uses Br instead)
      //   attrition  W  (W = wear)
      //   root       R  (R = root remnant — universal)
      //   impacted   Im (Im = impacted; "Rt" RU does not translate cleanly)
      //   bridge     Br (Br = bridge body / pontic)
      //   bar        Ba (Ba = bar — between implants)
      //   cantilever Cn (Cn = cantilever)
      //   uncertain  ?  (universal)
      // Layered combos auto-derive by concatenation:
      //   ИК → IC, ИЗ → ICs, ИФ → IH, ЭПК → EFC, ПСК → FCaC,
      //   ПСЭ → FCaE, ПШЭ → FPE, ЭКШ → ECP.
      // ─────────────────────────────────────────────────────────
      iconAbbr_present:        '·',
      iconAbbr_missing:        'M',
      iconAbbr_implant:        'I',
      iconAbbr_impl_fixture:   'I',
      iconAbbr_impl_cover:     'ICs',
      iconAbbr_impl_healing:   'IH',
      iconAbbr_impl_abutment:  'IA',
      iconAbbr_impl_temp_abut: 'IT',
      iconAbbr_impl_provisional:'IP',
      iconAbbr_impl_restored:  'IC',
      iconAbbr_crowned:        'C',
      iconAbbr_restored:       'F',
      iconAbbr_caries:         'Ca',
      iconAbbr_endo:           'E',
      iconAbbr_post:           'P',
      iconAbbr_attrition:      'W',
      iconAbbr_root:           'R',
      iconAbbr_impacted:       'Im',
      iconAbbr_bridge:         'Br',
      iconAbbr_bridge_pontic:  'Br',
      iconAbbr_bar:            'Ba',
      iconAbbr_cantilever:     'Cn',
      iconAbbr_uncertain:      '?',
      iconAbbr_natural:        '·',
      iconAbbr_crown:          'C',
      iconAbbr_filling:        'F',
      // Legend column 2: short EN label after the dot.
      legAbbr_present:         'Intact',
      legAbbr_missing:         'Missing',
      legAbbr_impl_fixture:    'Fixture',
      legAbbr_impl_cover:      '+ Cover',
      legAbbr_impl_healing:    '+ Healing',
      legAbbr_impl_restored:   '+ Crown',
      legAbbr_crowned:         'Crown',
      legAbbr_restored:        'Filling',
      legAbbr_caries:          'Caries',
      legAbbr_endo:            'Endo',
      legAbbr_root:            'Root',
      legAbbr_bridge:          'Bridge',
      legAbbr_cantilever:      'Cantil.',
      legAbbr_error:           'Mismatch',
      // EN long-form names for the per-tooth bottom legend ("1.6:
      // imp+crown" etc.) and the text-formula cell tooltips.
      longName_present:        'intact',
      longName_missing:        'missing',
      longName_impacted:       'impacted',
      longName_caries:         'caries',
      longName_attrition:      'wear',
      longName_root:           'root remnant',
      longName_restored:       'filling',
      longName_endo:           'endo',
      longName_post:           'post',
      longName_crowned:        'crown',
      longName_implant:        'implant',
      longName_impl_fixture:   'implant',
      longName_impl_cover:     'imp+cover',
      longName_impl_healing:   'imp+healing',
      longName_impl_abutment:  'imp+abut.',
      longName_impl_temp_abut: 'imp+temp.abut.',
      longName_impl_provisional:'imp+provis.',
      longName_impl_restored:  'imp+crown',
      longName_bridge:         'bridge',
      longName_bar:            'bar',
      longName_cantilever:     'cantilever',
      longName_uncertain:      'uncertain',

      pickerTitleTooth:     'Tooth {fdi}',
      pickerAddLayer:       '+ layer',
      pickerAddLayerTitle:  'Add a layer (e.g. endo + post + crown)',
      pickerStatusNotSet:   'Status: not set',
      pickerStatusLine:     'Status: {tip}',
      pickerSurfacesLine:   'Surfaces: {list}',
      pickerLayersHeader:   'Layers:',
      pickerBridgeLinkedTo: 'Bridge: linked to {list}',
      pickerNotesLine:      'Notes: {note}',
      tipStatus_present:    'Intact tooth — no pathology, no treatment [1]',
      tipStatus_missing:    'Tooth missing (extracted / unerupted) [0]',
      tipStatus_impacted:   'Impacted tooth (unerupted, visible in bone) [8]',
      tipStatus_caries:     'Caries — pick affected surfaces (M/O/D/B/L) [2]',
      tipStatus_attrition:  'Attrition (TWI 0-4) — click cycles severity [6]',
      tipStatus_root:       'Root remnant only — no coronal part [5]',
      tipStatus_restored:   'Filling — pick restored surfaces [3]',
      tipStatus_endo:       'Endodontic treatment — then configure canals below [4]',
      tipStatus_impl_fixture:    'Implant fixture (body in bone only) [q]',
      tipStatus_impl_cover:      'Implant + cover screw [w]',
      tipStatus_impl_healing:    'Implant + healing abutment [e]',
      tipStatus_impl_abutment:   'Implant + abutment (no crown) [t]',
      tipStatus_impl_temp_abut:  'Implant + temporary abutment',
      tipStatus_impl_provisional:'Implant + provisional crown',
      tipStatus_impl_restored:   'Implant with permanent crown [y]',
      tipStatus_post:       'Post / core build-up in the canal [r]',
      tipStatus_crowned:    'Artificial crown (ceramic / metal) [6]',
      tipStatus_bridge:     'Pontic — bridge body (no root) [7]',
      tipStatus__smart_bridge:'🌉 Bridge: drag-select teeth, press [b]. Edges → abutments, empty middle → pontics, empty edges → cantilevers',
      tipStatus__smart_bar: '═ Bar: drag-select teeth, press [g]. Implants → abutments, gaps → bar, edges → cantilevers',
      tipStatus_bar:        'Bar segment (between implants, no own support)',
      tipStatus_cantilever: 'Cantilever — prosthesis part overhanging the last abutment [u]',
      tipStatus_uncertain:  'Uncertain — status not determinable on the radiograph [9]',
      tipStatus__empty:     'Clear — reset tooth status [Backspace]',

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
