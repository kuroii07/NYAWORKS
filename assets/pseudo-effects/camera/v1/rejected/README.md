# Rejected camera v1 fixtures

These are the exact camera presets deployed before the 2026-10-15 group-balance fix. They contain six group starts and seven group ends; definition index 28 is an orphan end used as a marker. They are retained solely as regression fixtures and must not be installed or applied in AE.

`catalog-v1.json` records the original identities, hashes and semantic parameter indices. The v2 schema keeps all fifteen user controls, ranges, labels and indices. Its marker labels the existing sixth group's end at index 27 instead of appending another terminator. This changes the structural schema and requires new v2 effect identities; existing AE instances are not migrated automatically.
