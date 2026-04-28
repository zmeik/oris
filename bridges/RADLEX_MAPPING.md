# ORIS → RadLex Dental Subset mapping

> Used by [`bridges/dicom_sr.py`](dicom_sr.py) to attach RadLex RID
> codes to every ORIS finding it emits in the DICOM-SR XML stream.
> Source: RSNA RadLex 4.1 (2024) — <https://radlex.org/>.

---

## Tooth-level statuses (12 of 18 mapped)

| ORIS status | RadLex RID | RadLex label |
|---|---|---|
| `present`        | RID5807   | tooth |
| `missing`        | RID40562  | absence of tooth |
| `impacted`       | RID5759   | impacted tooth |
| `root`           | RID5836   | tooth root |
| `caries`         | RID5780   | dental caries |
| `attrition`      | RID5772   | tooth attrition |
| `endo`           | RID11907  | endodontically treated tooth |
| `post`           | RID11908  | endodontic post |
| `crowned`        | RID5774   | dental crown |
| `restored`       | RID5773   | dental restoration |
| `implant`        | RID3897   | dental implant |
| `impl_fixture`   | RID3897   | dental implant |
| `impl_restored`  | RID3897   | dental implant |
| `bridge`         | RID5775   | fixed dental prosthesis (bridge) |

Statuses without a published RadLex RID (`impl_healing`, `bar`,
`cantilever`, `uncertain`) emit the local ORIS coding scheme as
fallback so downstream consumers can still resolve them
deterministically.

## Anatomical landmarks (9 of 9 mapped)

| ORIS landmark block | RadLex RID | RadLex label |
|---|---|---|
| `mandibular_canal`   | RID27117 | mandibular canal |
| `mental_foramen`     | RID40452 | mental foramen |
| `ramus`              | RID40459 | ramus of mandible |
| `coronoid_process`   | RID40453 | coronoid process of mandible |
| `maxillary_sinus`    | RID28667 | maxillary sinus |
| `nasal_cavity`       | RID28673 | nasal cavity |
| `incisive_canal`     | RID40461 | incisive canal |
| `hyoid_bone`         | RID28688 | hyoid bone |
| `zygomatic_arch`     | RID28746 | zygomatic arch |

The right / left side suffixes are normalised away before mapping
(both `mandibular_canal_right` and `mandibular_canal_left` map to
RID27117), with the side carried as a separate XML attribute on the
container.

## TMJ findings

| ORIS field             | RadLex RID | RadLex label |
|---|---|---|
| `tmj_*_condyle`         | RID40495 | head of mandible |
| `tmj_*` (joint as a whole) | RID28727 | temporomandibular joint |
| `articular_eminence`    | RID28729 | articular eminence |

## Output example

For `tooth.UR1PMN.status_layers = "endo:mo+post+crowned"` the bridge
emits:

```xml
<Container conceptName="Tooth 1.6" oris_code="UR1PMN">
  <Text conceptName="Status Layers">endo:mo+post+crowned</Text>
  <Code conceptName="Occupant" value="N"
        codingScheme="https://github.com/zmeik/oris/numbering/occupants"/>
  <Code conceptName="Layer" value="endo"
        codingScheme="https://github.com/zmeik/oris/grammar/statuses"
        radlex_rid="RID11907" radlex_label="endodontically treated tooth"
        surfaces="mo"/>
  <Code conceptName="Layer" value="post"
        codingScheme="https://github.com/zmeik/oris/grammar/statuses"
        radlex_rid="RID11908" radlex_label="endodontic post"/>
  <Code conceptName="Layer" value="crowned"
        codingScheme="https://github.com/zmeik/oris/grammar/statuses"
        radlex_rid="RID5774" radlex_label="dental crown"/>
</Container>
```

A receiving system that understands RadLex can act on `radlex_rid`
directly; one that does not falls back to the local ORIS coding
scheme.

---

## How to extend

When a new layer status is added to `grammar/statuses.md`:

1. Look up RadLex via <https://radlex.org/>; record the RID.
2. Add a row to `ORIS_STATUS_TO_RADLEX` in `bridges/dicom_sr.py`.
3. Add the row to the table above.
4. Add a regression test in `tests/test_bridges.py`.
