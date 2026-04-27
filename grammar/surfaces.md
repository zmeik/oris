# 5 surface codes

| Code | Name | Description |
|------|------|-------------|
| `m` | Mesial | Surface facing toward the dental midline |
| `d` | Distal | Surface facing away from the dental midline |
| `o` | Occlusal | Biting / chewing surface (or incisal edge for anterior teeth) |
| `v` | Vestibular | Surface facing the lips / cheek (= "facial" / "labial" / "buccal") |
| `l` | Lingual | Surface facing the tongue (= "palatal" for upper teeth) |

## Why `v` (vestibular) and not `b` (buccal)?

ORIS uses `v` for **vestibular** rather than `b` for **buccal** because:

1. **Vestibular is universal across all teeth.** "Buccal" applies only to posterior teeth (premolars, molars). For anterior teeth (incisors, canines), the equivalent surface is usually called "labial" or "facial". Using one code for the same anatomic surface across all teeth simplifies the grammar.
2. **Vestibular is unambiguous.** "Buccal" can be confused with "labial" in software that bridges to multilingual environments.
3. **"Vestibular" is the term used in White & Pharoah (8th ed., 2019, Ch. 4) for the unifying anatomic surface description.**

## Combinations

Surface codes attach to a single layer via `:`. Multiple surfaces concatenate without separators:

| Surface combination | Meaning | Typical clinical context |
|---------------------|---------|--------------------------|
| `:m` | mesial only | proximal caries, mesial filling |
| `:d` | distal only | proximal caries, distal filling |
| `:o` | occlusal only | pit/fissure caries, occlusal filling |
| `:mo` | mesial + occlusal | MO filling |
| `:do` | distal + occlusal | DO filling |
| `:mod` | mesial + occlusal + distal | MOD filling (large class II restoration) |
| `:v` | vestibular only | class V cervical lesion / restoration |
| `:l` | lingual / palatal only | class V lingual lesion |
| `:vl` | vestibular + lingual | wraparound restoration |

## Order

The parser canonicalises surfaces to the order **m, d, o, v, l**. Source strings with surfaces in any order parse successfully; the encoder produces canonical order.

```python
>>> from oris.parser import parse_tooth_layers, encode_tooth_layers
>>> layers = parse_tooth_layers("restored:dom")
>>> encode_tooth_layers(layers)
'restored:mdo'
```

## Surface coverage on different tooth types

| Tooth type | Available surfaces |
|------------|--------------------|
| Incisors (1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 4.1, 4.2 etc.) | m, d, **incisal edge** (encoded as `o`), v, l |
| Canines (1.3, 2.3, 3.3, 4.3) | m, d, **incisal edge** (`o`), v, l |
| Premolars (1.4, 1.5, 2.4, 2.5, 3.4, 3.5, 4.4, 4.5) | m, d, o, v, l |
| Molars (1.6–1.8, 2.6–2.8, 3.6–3.8, 4.6–4.8) | m, d, o, v, l |

## Reference

- White SC, Pharoah MJ. *Oral Radiology: Principles and Interpretation*. 8th ed. St. Louis: Elsevier; 2019. Ch. 4 (Projection Geometry and Image Sharpness) — Section on tooth surface terminology.
- ICDAS Foundation. *International Caries Detection and Assessment System Codes*. 2019 update — uses surface terminology consistently with ORIS.
