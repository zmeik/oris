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

## Быстрый старт — reference application

Один paper-quality reference application лежит в [`reference-app/`](reference-app/). Работает на Flask + SQLite + Pillow на синтетических данных и служит исходником для **Figure 2 статьи ORIS**.

```bash
git clone https://github.com/zmeik/oris.git
cd oris/reference-app
pip install -r requirements.txt
python3 mock_app.py
# затем открой http://localhost:5050
```

Что вы получаете:

- **`/`** и **`/demo`** — статичная IJOS-quality demo (исходник Figure 2). Полностью self-contained vanilla HTML/CSS/JS, без API-вызовов, EN/RU и light/dark тема. Идеальный первый клик для рецензента журнала.
- **`/darwin-lab`** — интерактивный Arena UI на SQLite + Pillow image upload + bridges (FHIR R4, DICOM-SR, MIS, MMOral). Три анонимизированных синтетических OPG авто-загружаются при первом запуске. Включает layer editor, time-machine ground-truth history, anatomy/TMJ/airway панели, экспорт через bridges.

См. [`reference-app/README.md`](reference-app/README.md) для роут-карты, что замокано vs. реально, и как подсунуть свои OPG (под privacy gate, описанным там же).

⚠️ **Только синтетические данные.** Не загружайте реальные OPG пациентов. См. [PRIVACY.md](PRIVACY.md) для compliance (Федеральный закон РФ № 152-ФЗ, GDPR, HIPAA-equivalent practices).

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

- **Автор:** Серго Мануков (Sergo G. Manukov), [ORCID 0000-0002-7659-2677](https://orcid.org/0000-0002-7659-2677)
- **Аффилиация:** РУДН (Российский университет дружбы народов), Москва
- **E-mail:** см. ORCID profile
- **Issues / обсуждение:** GitHub Issues этого репозитория

## Благодарности

- Проект Darwin-Lab Arena в КДЦ РУДН — production codebase, информировавший v0.1
- Авторы OSIPI LL-XML lexicon — за архитектурный прецедент
- ACP — за GPT-9 (2017) и GPT-10 (2023) prosthodontic terminology

---

*ORIS v0.1 — публичный draft, апрель 2026.*
