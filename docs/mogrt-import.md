# Importing an After Effects MOGRT

`import_mogrt_to_broadcast_scene.jsx` is an AE-assisted import path for
After Effects-authored Motion Graphics Templates. It deliberately lets After
Effects open and extract the template project; ofxOGraf does not reverse-engineer
Adobe project internals.

## Requirements

- After Effects 24 or later.
- The original MOGRT was authored in After Effects.
- Permission to extract and inspect the template project and its assets.

Premiere-authored MOGRTs are not supported by this importer. They do not provide
the same After Effects composition model and need a separate, more limited path.

## Import workflow

1. In After Effects run `after-effects/import_mogrt_to_broadcast_scene.jsx` with **File ? Scripts ? Run Script File**.
2. Choose the `.mogrt`. If AE requests an extraction location, choose a staging folder you can retain.
3. Choose the root composition in the importer dialog. The wrapper passes that exact composition to `export_broadcast_scene_v2.jsx`.
4. Choose where to save the resulting `.scene.json`.
5. Copy the extracted assets required by the JSON into the native `bin/data/` folder or OGraf package.
6. Read `report.unsupported` and `report.warnings`. Run `bake_unsupported_layers.jsx` when a layer needs the deterministic alpha-PNG fallback.

The wrapper uses the same exporter as a normal `.aep` workflow, so Essential Graphics controls are emitted into the neutral `controls` array and all standard renderer limitations still apply.

## Validation

Render the exported scene at selected timestamps in both AE and ofxOGraf. The native example can capture a transparent frame:

```powershell
example-basic\bin\example-basic.exe --frame C:\tmp\frame.png --time 0.5
```

Compare it with a project-specific golden frame before using it on air.
