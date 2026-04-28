# Быстрый старт — ORIS v0.1

> 🇷🇺 Русская версия · 🇬🇧 [English version](getting-started.md)

Этот туториал проведёт через установку ORIS, загрузку синтетического примера, валидацию, encode/decode tooth findings, расчёт inter-rater κ, и конверсию в FHIR / MIS / DICOM-SR.

## 1. Установка

### Вариант A: из клона (рекомендуется для разработки)

```bash
git clone https://github.com/zmeik/oris.git
cd oris
pip install -e ".[dev]"
```

Установит:
- `oris.parser` (публичный Python API)
- `oris.bridges` (конвертеры FHIR / DICOM-SR / MIS / MMOral)
- Dev-инструменты (pytest, black, ruff, mypy)

### Вариант B: только schema (без Python)

Если нужна только JSON Schema — скопируй `schema/oris-v0.1.json` и валидируй документы любым JSON Schema Draft 2020-12 валидатором (`ajv` для JS, `jsonschema` для Python).

### Вариант C: только reference application

```bash
git clone https://github.com/zmeik/oris.git
cd oris/reference-app
pip install -r requirements.txt
python3 mock_app.py
# открой http://localhost:5050
```

Ты попадёшь на статичную IJOS demo (исходник Figure 2). Интерактивный Arena UI — на `/darwin-lab`.

## 2. Hello, ORIS

```python
from oris.parser import parse_tooth_layers, encode_tooth_layers, derive_numbering

# Парсинг layered tooth status строки
layers = parse_tooth_layers("endo:mo+post+crowned")
print(layers)
# [Layer(status='endo', surfaces=('m', 'o')),
#  Layer(status='post', surfaces=()),
#  Layer(status='crowned', surfaces=())]

# Encode обратно в каноническую форму
print(encode_tooth_layers(layers))
# 'endo:mo+post+crowned'

# Resolve 6-символьного ORIS code
nums = derive_numbering("LLCPIN")
print(nums["fdi"])              # '3.1'
print(nums["anatomical_ru"])    # 'Нижний левый центральный постоянный резец'
print(nums["occupant_name"])    # 'Natural'
```

## 3. Загрузка и валидация синтетического примера

```python
import json
from oris.parser import validate_oris

doc = json.load(open("examples/synthetic_001.json"))
errors = validate_oris(doc)

if errors:
    for e in errors:
        print(e)
else:
    print("Document is valid!")
```

Ожидаемый вывод: `Document is valid!`.

## 4. Сборка ORIS-документа программно

```python
import json
from oris.parser import lookup_oris_from_fdi

# Минимальный документ
doc = {
    "oris_version": "0.1.0",
    "document_id": "TUTORIAL_001",
    "patient": {"anonymized_id": "P_TUTORIAL_001", "age_years": 35, "sex": "F"},
    "imaging": {
        "modality": "OPG",
        "device": "Tutorial Device",
        "acquisition_date": "2026-04-27T10:00:00Z",
        "image_quality_score": 4
    },
    "teeth": {}
}

# Добавить зуб: эндо + пост + коронка на FDI 1.6
oris_code = lookup_oris_from_fdi("1.6", occupant="N")  # "URMP1MN"
doc["teeth"][oris_code] = {
    "fdi": "1.6",
    "occupant": "N",
    "status_layers": "endo:mo+post+crowned"
}

# Добавить имплантат на FDI 4.5
implant_code = lookup_oris_from_fdi("4.5", occupant="F")  # "LRPP2PF"
doc["teeth"][implant_code] = {
    "fdi": "4.5",
    "occupant": "F",
    "status_layers": "impl_restored",
    "implant": {
        "system": "Tutorial Implant",
        "diameter_mm": 4.0,
        "length_mm": 10.0,
        "marginal_bone_level_mm": 1.0,
        "complications": []
    }
}

print(json.dumps(doc, indent=2, ensure_ascii=False))
```

## 5. Расчёт inter-rater κ

```python
import json
from oris.parser import compute_kappa

rater_a = json.load(open("rater_a.json"))   # разметка OPG file_id=1234 от рейтера A
rater_b = json.load(open("rater_b.json"))   # разметка того же OPG от рейтера B

kappa = compute_kappa(rater_a, rater_b)
print(f"Cohen's κ = {kappa:.3f}")
# Cohen's κ = 0.940
```

Доступные scope:
- `scope="primary_status"` (по умолчанию): primary статус каждого зуба
- `scope="occupant"`: только occupant character (N/F/T/B/...)
- `scope="exact"`: точное равенство `status_layers` строк

## 6. Конверсия в другие форматы

```python
import json
from oris.bridges import to_fhir, to_dicom_sr, to_mis_chart, to_mmoral_format

doc = json.load(open("examples/synthetic_001.json"))

# В FHIR R4 Bundle (DiagnosticReport + Observations)
fhir_bundle = to_fhir(doc)
json.dump(fhir_bundle, open("output_fhir.json", "w"), indent=2)

# В DICOM-SR XML stub
sr_xml = to_dicom_sr(doc)
open("output_sr.xml", "w").write(sr_xml)

# В flat МИС зубную карту
chart = to_mis_chart(doc)
print(chart["chart"]["1.6"])

# В MMOral-OPG-Bench 8-class labels
mmoral = to_mmoral_format(doc)
print(mmoral["labels"]["1.6"])
```

## 7. Запуск тестов

```bash
pytest tests/ -v
```

Тесты покрывают:
- Parser core (parse / encode / canonicalisation / contradictions)
- Numbering (FDI ↔ ORIS bijection, occupant lookup)
- Validation (schema + business rules)
- Kappa (perfect, partial, occupant scope)
- Bridges (FHIR / DICOM-SR / MIS / MMOral)
- Все synthetic-примеры валидируются без ошибок

## 8. Следующие шаги

- **Прочитать schema:** [`schema/oris-v0.1.json`](../schema/oris-v0.1.json)
- **Просмотреть occupants и statuses:** [`numbering/occupants.md`](../numbering/occupants.md), [`grammar/statuses.md`](../grammar/statuses.md)
- **Понять anatomy extension:** [`anatomy/landmarks.md`](../anatomy/landmarks.md), [`anatomy/tmj.md`](../anatomy/tmj.md), [`anatomy/airway.md`](../anatomy/airway.md)
- **Попробовать reference application:** [`reference-app/`](../reference-app/)
- **Contribute:** [`CONTRIBUTING.md`](../CONTRIBUTING.md)

Foundational paper, мотивирующий ORIS — *International Journal of Oral Science* submission (in review, 2026).
