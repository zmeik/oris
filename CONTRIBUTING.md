# Contributing to ORIS

> 🇬🇧 English / 🇷🇺 Русская версия в конце документа.

Thank you for your interest in contributing to ORIS! This document describes how to contribute responsibly.

## What kinds of contributions are welcome

- **Bug reports** — open a GitHub Issue with a minimal reproducible example
- **Schema clarifications** — typos, ambiguous definitions, missing edge cases
- **New numbering / mapping entries** — additional verified mappings (e.g., to a national dental coding system)
- **Bridge implementations** — converters to other standards (Open mHealth, Apple HealthKit Dental, etc.)
- **Web-demo improvements** — better UX, accessibility, additional language translations
- **Documentation** — clearer tutorials, more examples, translations
- **Tests** — additional unit / integration tests

## What is NOT welcome

- **Real patient data of any form** — see [PRIVACY.md](PRIVACY.md). Pull requests containing or appearing to contain real patient data will be closed without merge.
- **Unverified citations** — every literature reference you add must be verifiable via PubMed, DOI, or official institutional source. Hallucinated or fabricated citations will be rejected.
- **Western-only ontology bias** — when proposing extensions, consider international applicability (FDI, ISO 3950, ICD-10 international, GPT-10 international).
- **Diagnostic claims** — ORIS structures imaging findings, not diagnoses. Pull requests that try to make ORIS a diagnostic standard will be redirected.

## Synthetic data policy for example contributions

If you contribute a new example ORIS document to `examples/`, it **must**:

- Use a `patient.anonymized_id` of the form `P_NNNN_SYNTHETIC` (or contributor-prefixed: `P_NNNN_<your-handle>`)
- Use placeholder demographics (`age_years`: any value 0–120; `sex`: `M`, `F`, or `null`)
- Use placeholder acquisition dates (any ISO-8601 datetime)
- Be a clinically plausible combination of findings that exercises the schema, **not derived from a real patient**
- Include a comment in the JSON document's `notes` field stating: `"Synthetic example contributed by <your-handle> on <date>; not derived from any real patient."`

When you open the pull request, please affirm in the PR description:

> I confirm that this contribution contains no real patient data, no real patient images, no real identifiers, and no information derived from any specific real person, in compliance with [PRIVACY.md](PRIVACY.md), the Russian Federal Law 152-FZ, GDPR, and HIPAA.

PRs without this affirmation will not be reviewed.

## Code style

- **Python:** PEP 8, formatted with `black`, type-hinted with `mypy --strict`-clean signatures where reasonable
- **JavaScript:** Prettier defaults, ES2022, no framework dependencies in `web-demo/` (vanilla JS only)
- **Markdown:** GitHub-flavoured, English headings, with `.ru.md` parallel files for translated documents
- **JSON / JSON Schema:** 2-space indent, sorted keys where the spec requires, unsorted otherwise

## Tests

Run the test suite with:

```bash
pip install -e .[dev]
pytest tests/ -v
```

A pull request must keep all tests passing. Add tests for new behaviour.

## Commit messages

Use [Conventional Commits](https://www.conventionalcommits.org/) where reasonable:

- `feat:` new schema field, parser function, or bridge
- `fix:` bug fix
- `docs:` documentation only
- `test:` test additions or corrections
- `refactor:` code reorganisation without behaviour change
- `chore:` repository housekeeping (CI, dependencies)
- `privacy:` changes affecting PRIVACY.md or compliance posture

Example: `feat(parser): handle empty status in encode_tooth_layers`

## Review process

1. Open a GitHub Issue first for non-trivial changes — discuss the approach before writing code
2. Fork the repository and create a feature branch from `main`
3. Open a pull request with a description that:
   - Links the related Issue
   - Summarises the change in 1–3 sentences
   - Notes any backward-incompatible aspects
   - Includes the synthetic-data affirmation if you added examples
4. The maintainer will review within 14 days. Expect feedback rounds.
5. Once accepted, the maintainer merges with a squash-and-rebase or rebase-and-merge depending on history hygiene.

## Code of Conduct

All contributors must follow [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md). The short form: be professional, be specific, be kind.

## License of contributions

By submitting a pull request, you agree that your contribution is licensed under the same MIT licence as the rest of the repository (see [LICENSE](LICENSE)).

---

# 🇷🇺 Вклад в ORIS

Спасибо за интерес к ORIS! Этот документ описывает, как contribut'ить ответственно.

## Какие contributions приветствуются

- **Bug-репорты** — открой GitHub Issue с минимальным воспроизводимым примером
- **Уточнения схемы** — опечатки, неоднозначные определения, missing edge cases
- **Новые numbering / mapping entries** — дополнительные верифицированные маппинги (например, на национальную dental coding system)
- **Bridge implementations** — конвертеры в другие стандарты
- **Улучшения web-demo** — лучший UX, accessibility, дополнительные языковые переводы
- **Документация** — более ясные tutorials, больше примеров, переводы
- **Тесты** — дополнительные unit / integration tests

## Что НЕ приветствуется

- **Реальные данные пациентов в любой форме** — см. [PRIVACY.md](PRIVACY.md). PR, содержащие или похожие на real patient data, будут закрыты без merge.
- **Неверифицированные цитирования** — каждый literature reference должен быть verifiable через PubMed, DOI, или официальный институциональный источник. Hallucinated / fabricated citations rejected.
- **Western-only ontology bias** — при extensions учитывай international applicability.
- **Диагностические claims** — ORIS структурирует imaging findings, не diagnoses. PR, пытающиеся сделать ORIS диагностическим стандартом, redirected.

## Synthetic-data policy для example-contributions

Если ты contribut'ишь новый ORIS-document в `examples/`, он **обязан**:

- Использовать `patient.anonymized_id` формата `P_NNNN_SYNTHETIC` (или с префиксом contributor'а)
- Использовать placeholder demographics
- Использовать placeholder acquisition dates
- Быть клинически правдоподобной комбинацией findings, **не derived из реального пациента**
- Включать в `notes` поле: `"Synthetic example contributed by <your-handle> on <date>; not derived from any real patient."`

В PR description подтверди:

> Я подтверждаю, что этот contribution не содержит реальных данных пациентов, реальных снимков, реальных идентификаторов и информации, derived из конкретной реальной персоны, в соответствии с [PRIVACY.md](PRIVACY.md), Федеральным законом РФ № 152-ФЗ, GDPR и HIPAA.

PR без такого подтверждения reviewed не будут.

## Code style + Tests + Commits + Review process

См. английскую версию выше — стандарты те же.

## Code of Conduct

Все contributors следуют [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md): профессионально, конкретно, доброжелательно.

## Лицензирование contributions

Submit'я PR, ты соглашаешься, что твой contribution лицензируется под той же MIT лицензией, что и репозиторий ([LICENSE](LICENSE)).
