# ORIS v0.1 — Web demo (test mode)

> 🇬🇧 **English** · 🇷🇺 [На русском (ниже)](#русская-версия)

A pure-JavaScript, browser-only test interface for the ORIS v0.1 schema. No backend, no telemetry, no data leaves your device.

## Running it

```bash
git clone https://github.com/zmeik/oris.git
cd oris/web-demo
python3 -m http.server 8080
# open http://localhost:8080 in your browser
```

Or open `index.html` directly via `file://` — most features work, but the "Load synthetic_001" button needs HTTP serving (CORS limitation on local files). The fallback mini-snapshot loads anyway.

## What you can do

- **Click** any of the 32 dental cells → cycle through the 18 layer statuses (empty → present → missing → implant → impl_fixture → impl_healing → impl_restored → post → crowned → restored → caries → endo → root → impacted → bridge → bar → cantilever → uncertain → empty)
- **Right-click (or long-press)** any cell with a coloured status → open the surface picker (m / d / o / v / l) and choose multiple surfaces; click Done to apply
- **Fill the anatomy panel** → mandibular canal, maxillary sinus, mental foramen, TMJ condyle morphology, joint-space osteoarthritis signs, airway / pharyngeal space, nasal septum
- **Watch the JSON output build live** as you click
- **Switch language** between English and Русский (top-right)
- **Copy JSON** to clipboard
- **Export JSON file** (downloaded to your machine)
- **Load synthetic_001** → fills the demo with a clinically plausible synthetic example
- **Clear all** → reset everything

## Privacy

This demo:

- Stores data **only in your browser's `localStorage`** (so the page survives a refresh)
- Sends **nothing** to any server
- Has **no analytics, no tracking pixels, no telemetry**
- Is delivered as static files; the `python3 -m http.server` serves them locally

For full data-protection details (152-FZ, GDPR, HIPAA), see [PRIVACY.md](../PRIVACY.md).

⚠️ **Use only synthetic data.** Do not enter real patient names, ages, dates, or identifiers.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Single-page demo, all UI markup |
| `styles.css` | Visual styling |
| `oris.js` | All interactivity — vanilla JavaScript, no framework |

## Browser support

Tested on:

- Chrome 120+
- Safari 17+
- Firefox 120+
- Edge 120+

Requires:

- ES2022 (modules optional, but `crypto.randomUUID` is used with a fallback)
- `localStorage` API (the demo gracefully degrades if disabled)
- `Clipboard API` for the Copy JSON button (gracefully alerts on failure)

## Limitations of the demo

The demo is a **schema test mode**, not a full clinical interface:

- Each cell holds a **single layer at a time** when cycled (the production Arena UI in the main project supports compound layers like `endo:mo+post+crowned` via a richer picker)
- The surface picker applies surfaces only to the **primary layer** of the cell
- The pathology array is **not editable in the demo** (it appears empty in the JSON output unless loaded from a synthetic example)
- The demo does not validate against the JSON Schema in real time — for validation, copy the JSON output and run `python -c "from oris.parser import validate_oris; ..."`

For full multi-layer / multi-finding annotation, use the production Darwin-Lab Arena UI.

---

# Русская версия

## Веб-демо (тестовый режим) — ORIS v0.1

Чистый JavaScript-интерфейс в браузере для тестирования схемы ORIS v0.1. Без сервера, без телеметрии, данные никуда не уходят.

## Запуск

```bash
git clone https://github.com/zmeik/oris.git
cd oris/web-demo
python3 -m http.server 8080
# открой http://localhost:8080 в браузере
```

Или открой `index.html` напрямую через `file://` — большинство функций работают, но кнопка «Загрузить synthetic_001» требует HTTP-сервинга из-за CORS-ограничений; fallback на mini-snapshot всё равно сработает.

## Что можно делать

- **Кликнуть** по любой из 32 клеток зубной формулы → цикл из 18 статусов (пустой → present → missing → implant → impl_fixture → … → uncertain → пустой)
- **Правый клик (или долгое нажатие)** по клетке с цветным статусом → открыть выбор поверхностей (m / d / o / v / l) и отметить несколько; «Готово» — применить
- **Заполнить anatomy panel** → нижнечелюстной канал, верхнечелюстная пазуха, ментальное отверстие, морфология мыщелка ВНЧС, признаки остеоартроза суставной щели, воздухоносные пути, носовая перегородка
- **Видеть JSON-output вживую** по мере кликов
- **Переключить язык** между English и Русский (верх справа)
- **Копировать JSON** в буфер обмена
- **Экспорт JSON-файла** (скачивается на твоё устройство)
- **Загрузить synthetic_001** → заполняет demo клинически правдоподобным синтетическим примером
- **Очистить всё** → reset

## Privacy

Demo:

- Хранит данные **только в `localStorage` браузера** (страница переживает refresh)
- **Ничего не отправляет** на сервер
- **Без analytics, без tracking pixels, без телеметрии**
- Поставляется статическими файлами; `python3 -m http.server` отдаёт их локально

Полные детали защиты данных (152-ФЗ, GDPR, HIPAA) — см. [PRIVACY.md](../PRIVACY.md).

⚠️ **Используй только синтетические данные.** Не вводи реальные ФИО пациентов, возрасты, даты, идентификаторы.

## Поддерживаемые браузеры

Chrome 120+, Safari 17+, Firefox 120+, Edge 120+.

## Ограничения demo

Demo — это **schema test mode**, не полный clinical interface:

- Каждая клетка хранит **один layer за раз** при цикле кликов (production Arena UI в основном проекте поддерживает compound layers вида `endo:mo+post+crowned` через богатый picker)
- Surface picker применяет поверхности только к **primary layer** клетки
- Массив pathology в demo **не редактируется** напрямую (появляется в JSON output только при load synthetic-примера)
- Demo не валидирует против JSON Schema в реальном времени — для валидации скопируй JSON output и запусти `python -c "from oris.parser import validate_oris; ..."`

Для полной multi-layer / multi-finding разметки используй production Darwin-Lab Arena UI.
