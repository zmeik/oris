# ORIS v0.1 — Открытая радиологическая схема изображений

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![JSON Schema Draft 2020-12](https://img.shields.io/badge/JSON%20Schema-Draft%202020--12-blue.svg)](https://json-schema.org/draft/2020-12/release-notes.html)
[![Python 3.10+](https://img.shields.io/badge/python-3.10+-blue.svg)](https://www.python.org/)
[![Status: v0.1 — Public Draft](https://img.shields.io/badge/status-v0.1%20публичный%20draft-orange.svg)]()

> 🇷🇺 **На русском** · [🇬🇧 English (README.md)](README.md)

Структурированный цифровой формат для раздела **«imaging findings»** заключения по дентальной панорамной рентгенограмме (OPG). Открытая схема, MIT-лицензия, machine-readable, ориентированная на дентальное сообщество — дентально-панорамный аналог OSIPI LL-XML lexicon для perfusion MRI ([Dickie et al., *Magn Reson Med* 2023](https://doi.org/10.1002/mrm.29840)).

Аббревиатура ORIS = **O**pen **R**adiographic **I**maging **S**chema; одновременно — латинское *oris* (родительный падеж от *os*) — *«полости рта»*.

---

## Что делает ORIS

ORIS предоставляет **структурированный цифровой формат** для того, что радиологи описывают в разделе *imaging findings* OPG-заключения. В одной схеме покрывается:

- **32 постоянных + 20 молочных зубов** с универсальным 6-символьным кодом, 13 типами Occupants, 18 layered статусами и 5 surface-кодами
- **Анатомические landmarks** — нижнечелюстной канал, ментальное отверстие, ветвь и тело челюсти, венечный отросток, верхнечелюстная пазуха, носовая полость, резцовый канал, hyoid, скуловая дуга, проекция шейного отдела позвоночника
- **TMJ findings** — морфология мыщелка, articular eminence, joint space, патология
- **Airway/Sinus block** — pharyngeal airway, septal deviation, pneumatization, sinus pathology
- **Provenance trail** — поле `source` (manual / ai_prefill), `sequence_num`, `session_id` для воспроизводимого audit

ORIS **не делает диагноз**. Он структурирует *описательную часть* заключения (Step 5 в 8-step ADA/AAOMR diagnostic workflow). Диагноз остаётся задачей клинициста и integrates anamnesis + intra-oral examination + radiographic interpretation согласно ALARA-принципу.

## Попробовать — интерактивный reference application

Один paper-quality reference application лежит в [`reference-app/`](reference-app/). Работает на Flask + SQLite + Pillow на синтетических данных и нужен чтобы *покликать* и почувствовать почему слоистая, машино-читаемая схема отличается от любой существующей dental-formula UI.

```bash
git clone https://github.com/zmeik/oris.git
cd oris/reference-app
pip install -r requirements.txt
python3 mock_app.py
# затем открой http://localhost:5050  →  редиректит на /play (песочница)
```

Корень редиректит на **`/play`** — интерактивная ORIS-песочница. Это и есть демо для рецензентов; всё остальное — supporting material:

| Маршрут | Что это | Когда использовать |
|---|---|---|
| **[`/play`](http://localhost:5050/play)** | Полный интерактивный Arena: 32-клеточная зубная формула × 3 анонимизированных кейса (A/B/C, multi-tooth + 7 имплантов + мосты); tooth-picker модалка с 18 слоистыми статусами + 5 поверхностями + 13 occupants; AI prefill; машина времени GT; CLAHE / Контраст / Кость / Инверт фильтры; FDI / Universal / Palmer переключатель; YOLO bbox оверлей; двуязычный EN ↔ RU свитч покрывает все надписи, включая 32 SVG-аббревиатуры на ячейках зубов и текстовую формулу под рентгеном | **Главное демо для рецензента.** Это то, о чём статья. |
| **[`/play/anatomy/<file_id>`](http://localhost:5050/play/anatomy/1001)** | Отдельный анатомический viewer/editor: 23 структуры × 6 групп (Нижняя челюсть, Верхняя челюсть, Полости и пазухи, Суставы и дуги, Патология, Имплантаты), dual-mode разметка (полилиния + bbox), drag-to-reshape, магнит, видимость структур и групп per-toggle, добавление пользовательских структур в Патологию / Импланты, EN+RU дисклеймер (152-ФЗ / GDPR / HIPAA Safe-Harbor). Загружается в read-only Просмотр; один клик включает Правку | Кнопка **🦴 Анатомия · 👁 Просмотр** в топбаре `/play` |
| **[`/demo`](http://localhost:5050/demo)** | Статичная IJOS-quality demo (vanilla HTML/CSS/JS, без API-вызовов, весь SVG генерится процедурно) | Воспроизводимые скриншоты для **Figure 2** в статье |
| `/darwin-lab` | То же что `/play` (легаси-алиас) | Backwards compatibility |

См. [`reference-app/README.md`](reference-app/README.md) для роут-карты, что замокано vs. реально, и как подсунуть свои OPG (под privacy gate, описанным там же).

⚠️ **Только синтетические данные.** Три предзагруженных кейса (`file_id` 1001/1002/1003) уже внутри приложения; загрузка реальных OPG пациентов закрыта privacy-модалкой документированной в [PRIVACY.md](PRIVACY.md) (Федеральный закон РФ № 152-ФЗ, GDPR, HIPAA-equivalent practices).

## Чем слоистая схема лучше любой существующей dental-formula UI

Интерактивная песочница `/play` — это не статичный скриншот, а единственное место где пункты ниже становятся осязаемыми за пять кликов. Перечисляем явно, потому что из JSON или EBNF этого не видно:

1. **Слоистый статус, а не циклическое одно-значение.** Закрытые платформы (Diagnocat, Pearl, Overjet, Planmeca Romexis, Carestream AI Insights, Vatech) выдают один статус на зуб. Реальность стоматологической радиологии — multi-finding зубы: *"эндодонтически леченый медио-окклюзионно, со штифтом и коронкой"* — это четыре факта в одной ячейке. Открой `/play`, кликни любой зуб, собери `endo:mo+post+crowned` слой за слоем, смотри как ORIS JSON перерисовывается. Ни одна другая dental-formula UI этого не позволяет в одной редактируемой ячейке.
2. **13 occupants, а не 4–6.** Большинство charting-инструментов схлопывают "что занимает позицию" в ≤ 6 категорий (зуб / имплант / отсутствует / понтик / неизвестно). ORIS кодирует 13 occupants по ACP GPT-9 (2017) и Garrofé-Mejillón 2023 — включая консольный понтик, Maryland-bonded retainer и Inlay-bonded retainer которые диагностически *и* радиографически отличаются от обычного мостового понтика.
3. **`v` для вестибулярной, а не `b` для буккальной.** Вестибулярная универсальна для всех 32 зубов; буккальная применима только к жевательным. Кликни surface picker на переднем зубе в `/play` — получишь `v`, не `b`. White & Pharoah Гл. 4. Закрытые платформы молча наследуют buccal-only конвенцию из заднего charting'а и ломаются на передних зубах.
4. **Машина времени, а не destructive overwrite.** Каждое сохранение в `/play` создаёт новый `sequence_num` снимок в `gt_change_history` с `source` тегом (`manual` / `ai_prefill` / `ai_prefill_then_manual`). Нажми 🕐 на любой GT-строке чтобы прокрутить к любому предыдущему состоянию. Траектория AI-prefill → экспертная коррекция парсится как training feedback по построению.
5. **Анатомия — часть схемы, а не приписка.** Кликни **🦴 Анатомия · 👁 Просмотр** в топбаре. Получаешь отдельную полностраничную правку анатомии — 23 структуры (нижнечелюстной канал, подбородочные отверстия, верхнечелюстные пазухи, скуловые дуги, подъязычная кость, твёрдое нёбо, носовые полости, окклюзионные и базальные линии, альвеолярный гребень, и т.д.) — каждая редактируется как полилиния ИЛИ bbox, с магнитом, видимостью структуры и группы, и пользовательскими добавлениями для Патологии / Имплантатов. Большинство стоматологических инструментов либо опускают анатомию, либо ссылают её в свободный комментарий.
6. **Двуязычный UI вплоть до каждой SVG-аббревиатуры.** Свитч EN ↔ RU справа сверху флипает ~120 ключей синхронно: топбар, sandbox bar, tooth picker (заголовки групп + 18 статусов + 5 поверхностей + 13 occupants), названия строк формулы, GT save banner ("Сохраняем N изм…" / "Saving N changes…"), change-history strip, имена анатомических структур из `data/anatomy_templates.json` ({ru,en} bilingual), И 1–4-символьные иконки статусов нарисованные на каждой ячейке зуба (исследовательский dental abbreviation dictionary: К ↔ C, П ↔ F, С ↔ Ca, Э ↔ E, Ш ↔ P, И ↔ I, ИК ↔ IC, ЭПК ↔ EFC, ПСК ↔ FCaC и т.д., композиты автоматически собираются из per-status кодов). Ни одна закрытая платформа этого не предлагает.
7. **Один клик на bridge в FHIR / DICOM-SR / MIS / MMOral.** Пять кнопок экспорта в топбаре `/play` запускают `bridges/*.py` живьём на ground truth который только что отредактировал. MMOral mapping в частности позволяет твоему ORIS-документу скармливать [MMOral-OPG-Bench](https://arxiv.org/abs/2509.09254) (Hao et al., NeurIPS 2025, 8 типов находок × 32 зуба × 8 500 панорам) без переписывания схемы под каждый бенчмарк.
8. **Открытая MIT лицензия и полная формальная грамматика.** Полный EBNF слоистого статуса в [`grammar/ebnf.txt`](grammar/ebnf.txt); парсер канонически round-trip'ит каждый пример из [`examples/`](examples/) и покрыт 255 pytest unit тестами. Каждый закрытый конкурент шипит недокументированный внутренний формат который нельзя ни процитировать, ни проаудировать, ни версионировать.

Если после пяти минут в `/play` что-то из этого не выглядит отличающимся от твоей текущей dental-UI — открой [GitHub issue](https://github.com/zmeik/oris/issues), такой gap это именно тот feedback который v0.2 ждёт.

## Быстрый старт — Python parser

```bash
pip install -e .
```

```python
from oris.parser import parse_tooth_layers, encode_tooth_layers, derive_numbering, validate_oris

# Парсинг layered tooth status
layers = parse_tooth_layers("endo:mo+post+crowned")
# [Layer(status='endo', surfaces=['m','o']),
#  Layer(status='post', surfaces=[]),
#  Layer(status='crowned', surfaces=[])]

# Encoding обратно в каноническую строку
encoded = encode_tooth_layers(layers)  # "endo:mo+post+crowned"

# Resolve 6-символьного кода на все системы numbering
nums = derive_numbering("LLCPIN")
# {'fdi': '3.1', 'universal': '24', 'palmer': '⌐1',
#  'anatomical': 'Lower Left Central Permanent Incisor', 'occupant': 'Natural'}

# Валидация ORIS-документа
import json
doc = json.load(open("examples/synthetic_001.json"))
errors = validate_oris(doc)
assert errors == []
```

## Структура репозитория

```
oris/
├── README.md, README.ru.md ........ англ. + рус. документация
├── LICENSE ........................ MIT
├── PRIVACY.md ..................... statement по защите данных (152-ФЗ, GDPR)
├── CONTRIBUTING.md, CODE_OF_CONDUCT.md, CHANGELOG.md
├── docs/
│   ├── architecture.md ............ как ORIS встраивается в radiology workflow
│   ├── getting-started.md ......... end-to-end tutorial
│   ├── version-roadmap.md ......... v0.1 → v0.2 → v1.0 plan
│   └── glossary.md ................ терминология
├── schema/
│   ├── oris-v0.1.json ............. JSON Schema Draft 2020-12 (master)
│   ├── oris-anatomy-v0.1.json ..... extension schemas (anatomy/TMJ/airway)
│   └── README.md
├── numbering/
│   ├── permanent-teeth.csv ........ 32 entries: ORIS, FDI, Universal, Palmer, anatomical (EN+RU), layperson
│   ├── primary-teeth.csv .......... 20 entries
│   └── occupants.md ............... 13 типов occupants — определения + литература
├── grammar/
│   ├── statuses.md ................ 18 layer statuses
│   ├── surfaces.md ................ 5 поверхностей (m/d/o/v/l) + литература
│   ├── ebnf.txt ................... формальная EBNF
│   └── README.md
├── anatomy/
│   ├── landmarks.md ............... mandibular canal, foramina, sinus и др.
│   ├── tmj.md ..................... condyle, articular eminence, joint space
│   ├── airway.md .................. pharyngeal airway, sinus pneumatization
│   └── ontology.md ................ полная иерархия
├── parser/ ........................ Python implementation
├── bridges/ ....................... FHIR Dental, DICOM-SR, MIS, MMOral converters
├── examples/ ...................... 3 синтетических ORIS-документа
├── tests/ ......................... pytest unit tests
└── reference-app/ ................. Flask + SQLite reference application
                                     — статичная IJOS demo (исходник Fig 2) + интерактивная Arena
                                     — bridges, image upload, time-machine GT history
```

## Схема за 60 секунд

**Зубная позиция** кодируется 6-символьным ключом + layered формула статусов:

```
LLCPIN  →  status: "endo:mo+post+crowned"
║║║║║║
║║║║║╚═ Occupant   N=естественный / F=имплантат / T=трансплант / B=мостовидный pontic
║║║║║                D=искусственный зуб протеза / H=гибридный протез
║║║║║                O=overdenture support / A=отсутствует / R=корневой остаток
║║║║║                S=сверхкомплектный / U=неизвестно
║║║║║                C=cantilever pontic / M=Maryland-bonded / I=inlay-bonded
║║║║╚══ Class      I=резец / C=клык / P=премоляр / M=моляр
║║║╚═══ Dentition  P=постоянный / D=молочный (deciduous)
║║╚════ Position   C=центральный / L=латеральный / X=N/A / 1, 2, 3
║╚═════ Side       L=левый / R=правый
╚══════ Jaw        U=верхний (Upper) / L=нижний (Lower)
```

Layered формула — `status1:surfaces1+status2+status3`, где каждый layer описывает один радиологический признак, а `:surfaces` (любое подмножество `m`, `d`, `o`, `v`, `l`) опционально ограничивает его конкретными поверхностями зуба.

Полный ORIS-документ также содержит блоки `anatomical_landmarks`, `tmj_findings`, `airway_assessment`, `pathology[]`, `confidence{}` и `ground_truth_meta{}`. Формальное определение в [`schema/oris-v0.1.json`](schema/oris-v0.1.json), готовые примеры — в [`examples/`](examples/).

## Versioning

| Версия | Статус | Scope |
|--------|--------|-------|
| **v0.1** | ✅ текущий релиз | Core schema, panoramic 2D, 13 occupants, 3 extension блока, single-source AI workflow |
| v0.2 | план (Q3 2026) | Multi-centre validation, second-rater κ, paediatric extensions, cryptographic provenance signing |
| v0.3 | план (Q1 2027) | CBCT 3D extension, sinus / TMJ volumetric findings |
| v0.4 | план (Q3 2027) | Peri-radicular extension (CBCT periapical, root resorption) |
| v1.0 | aspiration (Q1 2028) | Community endorsement (AAOMR / IADMFR), production-ready |

Подробнее — [docs/version-roadmap.md](docs/version-roadmap.md).

## Совместимость с существующими стандартами

| Стандарт | Соотношение |
|----------|-------------|
| **HL7 FHIR Dental** | ORIS bridges *в* FHIR через `parser.bridges.to_fhir()` — emits `DiagnosticReport` + `Observation` resources |
| **DICOM Structured Reporting** | `parser.bridges.to_dicom_sr()` emits SR с RadLex Dental Subset codes |
| **SNODENT / ICDAS / ICD-10** | Recommended mapping на стадии *diagnosis* (после ORIS imaging-finding output) |
| **ISO 3950 (FDI)** | Автоматически через 52-entry mapping table в `numbering/` |
| **OSIPI LL-XML (MRI)** | Direct архитектурный прецедент — community-endorsed открытый lexicon для конкретной imaging modality |

## Цитирование ORIS

Если вы используете ORIS в исследованиях, пожалуйста, цитируйте foundation paper:

> Manukov SG. ORIS v0.1 — Open Radiographic Imaging Schema: A Structured Digital Format for Imaging Findings in Dental Panoramic Reports. *Manuscript submitted to International Journal of Oral Science.* 2026.

## Лицензия

[MIT License](LICENSE) — свободная для коммерческого, академического и клинического использования с указанием авторства.

## Защита данных и compliance

Этот репозиторий содержит **только синтетические данные**. Никаких реальных идентификаторов пациентов, никаких реальных OPG-снимков, никакой PHI (Protected Health Information).

- 🇷🇺 Соответствие **Федеральному закону № 152-ФЗ** «О персональных данных» (Российская Федерация)
- 🇪🇺 Соответствие **GDPR** (Регламент (ЕС) 2016/679)
- 🇺🇸 Отсутствует PHI согласно определениям **HIPAA**

Прочитайте [PRIVACY.md](PRIVACY.md) перед deployment ORIS в клинических условиях.

## Контакты

**Серго Мануков** (Sergo G. Manukov) &middot; [Google Scholar](https://scholar.google.com/citations?user=3Xfn4PoAAAAJ&hl=en) &middot; [ORCID 0000-0002-7659-2677](https://orcid.org/0000-0002-7659-2677)

Аффилиации:

- **РУДН** (Российский университет дружбы народов), Москва, Российская Федерация &mdash; аспирант (основная аффилиация, защита диссертации сентябрь 2026)
- **New Vision University**, Тбилиси, Грузия &mdash; visiting researcher

E-mail: <smanukov@newvision.ge> &middot; Issues и обсуждение: [GitHub Issues](https://github.com/zmeik/oris/issues) этого репозитория.

## Благодарности

- Проект Darwin-Lab Arena в КДЦ РУДН — production codebase, информировавший v0.1
- New Vision University (Тбилиси) — поддержка visiting researcher во время разработки схемы и reference application
- Авторы OSIPI LL-XML lexicon — за архитектурный прецедент
- ACP — за GPT-9 (2017) и GPT-10 (2023) prosthodontic terminology

---

*ORIS v0.1 — публичный draft, апрель 2026.*
