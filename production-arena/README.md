# `production-arena/` — full-fidelity Arena demo with mock backend

> 🇬🇧 **English** · 🇷🇺 [На русском (ниже)](#русская-версия)

This directory contains a **full clone** of the production Darwin-Lab Arena UI from the X-RayAnalizer project (RUDN), with a minimal mock Flask backend so that anyone can run the real interface against synthetic data — **no PostgreSQL, no real radiographs, no PII**.

## What's in here

| Path | Description |
|------|-------------|
| `templates/darwin_lab.html` | Production HTML shell (403 lines) — copied verbatim, only the "RUDN" UI label genericised to "Synthetic Demo Sandbox" |
| `static/css/darwin_lab.css` | Production stylesheet (104 KB) — verbatim |
| `static/js/darwin/*.js` | All **14 JavaScript modules** (~960 KB) — verbatim, only one localStorage key reference and one dropdown label changed |
| `static/images/synthetic_opg_001.png` | Synthetic placeholder OPG image (2880×1450, watermarked "SYNTHETIC OPG — ORIS DEMO ONLY") |
| `mock_app.py` | Single-file Flask backend (~600 lines) implementing 30+ mock API endpoints with in-memory storage |
| `requirements.txt` | Flask, Pillow |

## How to run

From the repo root:

```bash
cd production-arena
pip install -r requirements.txt
python3 mock_app.py
# then open: http://localhost:5050/darwin-lab
```

You will see:

```
======================================================================
ORIS Production-Arena Demo (mock backend)
======================================================================
Loading synthetic data:
  ✓ Loaded synthetic_001.json → file_id=10001, 32 teeth
  ✓ Loaded synthetic_002.json → file_id=10002, 32 teeth
  ✓ Loaded synthetic_003_pediatric.json → file_id=10003, 44 teeth

  → 3 synthetic test cases loaded.

⚡ Open in browser: http://localhost:5050/darwin-lab
```

The 3 synthetic ORIS examples from `../examples/` are loaded as 3 sandbox files (`file_id=10001`, `10002`, `10003`).

## What works in this mock environment

- ✅ Full UI rendering (all 14 JS modules + 104 KB CSS load successfully)
- ✅ Sandbox selector → 1 sandbox ("Synthetic Demo Sandbox")
- ✅ Test case list → 3 synthetic cases
- ✅ Click on a case → arena loads with OPG placeholder + dental formula
- ✅ Click any tooth cell → status cycles through the 18-status `ARENA_STATUS_CYCLE`
- ✅ Right-click cell → surface picker (m/d/o/v/l)
- ✅ Save GT → in-memory storage with `gt_change_history` events
- ✅ View save history (sequence numbers, source, change types)
- ✅ Algorithm comparison panel (3 synthetic algorithms per case: alpha-baseline, beta-aggressive, gamma-champion)
- ✅ D3 algorithm-evolution tree view
- ✅ Anatomy / TMJ / airway annotation panels
- ✅ Implant assessment panel (empty data, but UI renders)

## What is intentionally disabled

These features depend on real production data and are disabled in the mock:

- ❌ Folder / image import into sandboxes (`/api/darwin/sandbox/.../import-*`) — returns 403
- ❌ Sandbox creation / deletion — returns 403
- ❌ Batch GT prepopulation — returns 403
- ❌ MMOral-OPG-Bench results panel — returns empty
- ❌ Real YOLO / SemiT-SAM AI inference — synthetic bboxes only
- ❌ McNemar / confusion matrix statistics — returns zero matrices
- ❌ Real implant library SVG silhouettes — returns synthetic placeholder SVG

These are decorative or research-pipeline features; the core schema-editing workflow works fully.

## Privacy

This mock environment runs **entirely on localhost** (`127.0.0.1:5050`) with **only synthetic data** loaded from `../examples/`:

- No PII, no real patient identifiers, no real OPG images
- No telemetry, no analytics, no external network calls (the only external resource is `d3js.org` for the D3 library, which can be replaced with a local copy if your network policy requires)
- All state is in-memory; nothing is written to disk
- Stop the server (`Ctrl-C`) → all state is gone

If you choose to type real patient information into the UI (which we **strongly discourage** — the whole point of this demo is testing the schema), that data:

1. Stays in your Python process memory only
2. Is your responsibility under your jurisdiction's law (152-FZ, GDPR, HIPAA, etc.)
3. Is lost when you stop the server

See [../PRIVACY.md](../PRIVACY.md) for the full data-protection statement.

## Differences from the real production system

The real X-RayAnalizer at the RUDN Diagnostic Centre runs against:

| Component | Real production | This mock |
|-----------|----------------|-----------|
| Backend storage | PostgreSQL (`panorama_analysis` + `gt_change_history` + ~30 other tables) | In-memory Python dicts |
| OPG images | Real radiographs of consenting patients (under data-use agreement) | Single synthetic placeholder PNG |
| AI inference | YOLOv8 + SemiT-SAM real models on real images | 3 synthetic algorithms with hardcoded "predictions" |
| Patient cards | OCR-extracted from real PDF dental cards | None — `prefill-from-card` returns empty |
| Algorithm tree | Real evolutionary population from `algorithm_experiments` table | 3 synthetic nodes |
| Implant library | Real DURAVIT / LIKO-M / Straumann / etc. silhouettes | Single SVG placeholder per system |
| Authentication | Currently `debug=True` (planned: Flask-Login + WebAuthn) | None — localhost only |

The UI code (HTML/CSS/JS) is **identical** to production — bytes match, with the two genericisations noted in `CHANGELOG.md`.

## Modifying for your own data

If you want to load your own synthetic ORIS documents into the demo:

1. Add new JSON files to `../examples/` matching the schema in `../schema/oris-v0.1.json`
2. Confirm they validate: `python3 -c "from jsonschema import Draft202012Validator; ..."`
3. Restart `mock_app.py` — they auto-load as additional `file_id`s

If you want a more realistic placeholder image, replace `static/images/synthetic_opg_001.png` with any synthetic dental radiograph that complies with [PRIVACY.md](../PRIVACY.md). All file_ids share the same image in this demo.

## Provenance and licence

- The HTML/CSS/JS in this directory is taken from the X-RayAnalizer project at the RUDN Diagnostic Centre, under the same MIT licence as the rest of this repository.
- The original production system is the work of Sergo G. Manukov and contributors as of April 2026.
- The mock backend (`mock_app.py`) and synthetic OPG image are new for this open-source release.

---

# Русская версия

# `production-arena/` — полный демо-клон Arena с mock-бэкендом

Эта директория содержит **полный клон** production-интерфейса Darwin-Lab Arena из проекта X-RayAnalizer (РУДН), плюс минимальный mock-бэкенд на Flask, чтобы любой мог запустить реальный интерфейс на синтетических данных — **без PostgreSQL, без реальных снимков, без PII**.

## Что внутри

| Путь | Описание |
|------|----------|
| `templates/darwin_lab.html` | Production HTML shell (403 строк) — скопировано verbatim, изменён только UI-label "РУДН" → "Synthetic Demo Sandbox" |
| `static/css/darwin_lab.css` | Production stylesheet (104 КБ) — verbatim |
| `static/js/darwin/*.js` | Все **14 JavaScript-модулей** (~960 КБ) — verbatim, изменён только один localStorage-ключ и один dropdown-label |
| `static/images/synthetic_opg_001.png` | Синтетический placeholder OPG-снимок (2880×1450, watermark "SYNTHETIC OPG — ORIS DEMO ONLY") |
| `mock_app.py` | Однофайловый Flask-бэкенд (~600 строк) с 30+ mock API-endpoints и in-memory storage |
| `requirements.txt` | Flask, Pillow |

## Как запустить

Из корня репо:

```bash
cd production-arena
pip install -r requirements.txt
python3 mock_app.py
# затем открой: http://localhost:5050/darwin-lab
```

Загрузятся 3 синтетических ORIS-примера из `../examples/` как 3 файла в sandbox (`file_id=10001`, `10002`, `10003`).

## Что работает в mock-среде

- ✅ Полный рендеринг UI (все 14 JS-модулей + 104 КБ CSS загружаются успешно)
- ✅ Sandbox selector → 1 sandbox ("Synthetic Demo Sandbox")
- ✅ Список test cases → 3 синтетических кейса
- ✅ Клик по кейсу → arena грузится с OPG-placeholder + зубной формулой
- ✅ Клик по клетке зуба → статус циклически меняется через 18-status `ARENA_STATUS_CYCLE`
- ✅ Правый клик → surface picker (m/d/o/v/l)
- ✅ Сохранение GT → in-memory storage с `gt_change_history` events
- ✅ Просмотр истории сохранений
- ✅ Algorithm comparison panel (3 синтетических алгоритма: alpha-baseline, beta-aggressive, gamma-champion)
- ✅ D3 algorithm-evolution tree
- ✅ Anatomy / TMJ / airway панели
- ✅ Implant assessment панель (пустые данные, но UI рендерится)

## Что отключено намеренно

- ❌ Folder/image import → 403
- ❌ Sandbox создание/удаление → 403
- ❌ Batch GT prepopulation → 403
- ❌ MMOral-OPG-Bench results панель → пусто
- ❌ Реальный YOLO / SemiT-SAM AI inference — только синтетические bboxes
- ❌ McNemar / confusion matrix → нулевые матрицы
- ❌ Реальные implant library SVG silhouettes → placeholder

Это decorative / research-pipeline фичи; core schema-editing workflow работает полностью.

## Privacy

Mock-среда работает **полностью на localhost** (`127.0.0.1:5050`) только с **синтетическими данными** из `../examples/`:

- Нет PII, нет реальных идентификаторов пациентов, нет реальных OPG
- Нет telemetry, нет analytics, нет external network calls (единственный external resource — `d3js.org` для D3, можно заменить локальной копией при необходимости)
- Всё state in-memory; ничего не пишется на диск
- Stop server (`Ctrl-C`) → всё state потеряно

См. [../PRIVACY.md](../PRIVACY.md) для полного data-protection statement.

## Отличия от реальной production-системы

Реальный X-RayAnalizer в КДЦ РУДН работает на:

| Компонент | Реальный production | Этот mock |
|-----------|--------------------|-----------|
| Storage backend | PostgreSQL (~30 таблиц) | In-memory Python dicts |
| OPG images | Реальные снимки пациентов с информированного согласия | 1 synthetic placeholder PNG |
| AI inference | YOLOv8 + SemiT-SAM | 3 synthetic algorithms с hardcoded "предсказаниями" |
| Patient cards | OCR из реальных PDF-карт | Нет |
| Algorithm tree | Реальная evolutionary population | 3 synthetic nodes |
| Implant library | Реальные DURAVIT / LIKO-M / Straumann silhouettes | 1 SVG placeholder |
| Authentication | `debug=True` (план: Flask-Login + WebAuthn) | Нет — только localhost |

UI-код (HTML/CSS/JS) **идентичен** production — байты совпадают, кроме двух genericisation, отмеченных в `CHANGELOG.md`.

## Provenance и лицензия

- HTML/CSS/JS в этой директории взяты из проекта X-RayAnalizer в КДЦ РУДН под той же MIT лицензией, что и весь репозиторий
- Original production system — работа Серго Манукова и contributors на апрель 2026
- Mock-бэкенд (`mock_app.py`) и synthetic OPG image — новые для этого open-source release
