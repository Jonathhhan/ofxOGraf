# ofxOGraf

`ofxOGraf` is a tool-neutral openFrameworks authoring and runtime addon for portable broadcast graphics. Templates can be created directly with `SceneBuilder` or `CodeTemplate`; After Effects is an optional importer.

```text
After Effects composition
        ↓ export_broadcast_scene_v2.jsx
Broadcast Scene JSON
        ↓ ofxOGraf
openFrameworks (native or Emscripten/WebAssembly)
        ↓ OfBroadcastGraphic.js
EBU OGraf v1 renderer
```

The existing AE path is not a binary `.mogrt` converter: it imports AE's scriptable scene model. Native scenes use the neutral Broadcast Scene 0.3 model, while unsupported source-specific features remain extensions or deterministic baked-frame fallbacks.

## What is included

- `after-effects/export_broadcast_scene_v2.jsx`: recursive exporter for compositions, fonts, images, controls, sampled expressions, masks, mattes, effects, 3D transforms, and shape operators. The original MVP exporter remains available as `export_selected_comp.jsx`.
- `after-effects/bake_unsupported_layers.jsx`: alpha-PNG fallback renderer for AE-only layers and effects.
- `src/ofxOGrafAuthoring.*` and `schema/broadcast-scene-0.3.schema.json`: typed, tool-neutral C++ scene authoring with stable IDs, controls, assets, provenance, validation, and deterministic JSON.
- `src/ofxOGrafCodeTemplate.*`: procedural OF template contract with typed descriptors, explicit time, deterministic random streams, and a lifecycle host.
- `scripts/validate-template-definition.mjs`: native/WASM/OGraf descriptor and declared-asset validator.
- `docs/native-authoring.md`: direct openFrameworks authoring, delivery, and deterministic-runtime guide.
- `schema/broadcast-scene-0.2.schema.json`: expanded neutral interchange format; the original 0.1 schema remains for compatibility.
- `src/`: openFrameworks addon with deterministic timeline evaluation, asset caching, recursive scene rendering, renderer-extension hooks, AE-style 2D/3D transforms, a neutral controls API, and an optional ofxImGui adapter.
- `example-basic/`: dependency-free native/Emscripten example and embind lifecycle bridge.
- `example-imgui/`: native inspector example that opts into ofxImGui through its own `addons.make`.
- `ograf/EssentialControls.js`: reusable HTML control panel generated from the same neutral `scene.controls` model.
- `ograf/`: OGraf v1 Web Component, manifest, real-time lifecycle, deterministic seeking, and scheduled non-real-time actions.
- `examples/lower-third.scene.json` and `examples/feature-showcase.scene.json`: hand-authored baseline and expanded-feature scenes.

## Renderer scope

Implemented:

- absolute-time linear, hold, and influence-based Bezier interpolation;
- recursive parenting and precomposition timing;
- 2D and 3D layer transforms, opacity, and time stretch;
- cached TrueType fonts, UTF-8 text, tracking, leading, justification, fills, outlines, and bitmap fallback;
- shape rectangles, ellipses, cubic paths, fills, strokes, linear gradients, trim paths, repeaters, and approximate merge winding;
- masks and alpha track mattes through the stencil buffer;
- effect-derived Fill/Tint overrides plus effect and layer extension registries;
- sampled expression values and baked alpha-PNG fallback sequences;
- Essential Graphics controller discovery and neutral control storage;
- partial JSON data updates;
- OGraf load, dispose, play, update, stop, custom-action error response, `goToTime`, and `setActionsSchedule`.

Fidelity boundaries:

- openFrameworks/FreeType metrics are not byte-identical to AE's shaping engine; use a text-layer extension or bake when exact shaping is required;
- merge paths use winding approximation, and track mattes currently implement alpha semantics;
- cameras, lights, arbitrary AE effects, live expression execution, and third-party plugins require an extension or baked fallback.

See `docs/renderer-support.md` for the feature matrix and fallback strategy.

## Export from After Effects

1. Open an AE project and make the desired composition active.
2. Run `after-effects/export_broadcast_scene_v2.jsx` using **File → Scripts → Run Script File**.
3. Save the resulting `.scene.json`.
4. Review `report.unsupported` and `report.warnings` in the output. Run `bake_unsupported_layers.jsx` in AE when the report calls for a baked fallback.
5. Copy the scene and exported assets to `example-basic/bin/data/` for native testing or `ograf/` for packaging.

## Native openFrameworks build

Use openFrameworks Project Generator on `example-basic`, then build it normally for your platform. It constructs and renders a neutral lower third directly in C++ with `SceneBuilder`. For procedural drawing, implement `CodeTemplate` and host it with `CodeTemplateHost`. The optional `example-imgui` inspector remains independent of the core addon. See `docs/native-authoring.md` and `docs/essential-controls.md`.

## Emscripten build

Install the current openFrameworks Emscripten platform/toolchain, generate the Emscripten project, and build `example-basic`. Its `config.make` enables embind, ES-module output, memory growth, and WebGL 2. Copy/rename the generated artifacts into:

```text
ograf/dist/ofxOGraf.js
ograf/dist/ofxOGraf.wasm
ograf/dist/ofxOGraf.data   # when emitted
```

Emscripten's emitted module name must remain `createOfxOGrafModule`, as configured in `example-basic/config.make`.

## OGraf package

Package the contents of `ograf/`, including the generated `dist` artifacts and every scene asset. Serve the directory over HTTP for local preview; ES modules and WASM generally do not work reliably from `file://`.

Create a server-ready ZIP after the Emscripten artifacts exist:

```powershell
scripts\package-ograf.ps1
```

The packager validates the manifest and referenced runtime files and places the manifest at the archive root. For integration steps and the renderer conventions discovered in SuperFlyTV's implementation, see `docs/testing-with-ograf-server.md`.

The manifest declares both real-time and non-real-time support. In non-real-time mode, `setActionsSchedule()` stores the action timeline and `goToTime()` rebuilds scheduled state when seeking backward before positioning the WASM timeline at the requested millisecond.

## Validation

With Node.js available:

```powershell
node scripts/validate.mjs
node tests/feature-contract.mjs
node tests/controls-contract.mjs
node tests/authoring-contract.mjs
node tests/code-template-contract.mjs
node scripts/validate-template-definition.mjs
node --check ograf/OfBroadcastGraphic.js
node --check ograf/EssentialControls.js
```

The committed `ograf/dist/.gitkeep` is intentional; generated WASM artifacts are ignored.

## Production hardening

Before on-air use, add AE-vs-runtime golden-frame tests for the exact templates, fonts, effects, and GPU drivers in the deployment environment. Register project-specific text/effect handlers for anything that must remain editable and bake the rest.

## Standards basis

The package targets the stable EBU OGraf Graphics specification v1. Its manifest uses the normative v1 schema and its custom element implements the required default export and lifecycle methods. The separate OGraf Server/Control API is intentionally outside this addon so draft API changes cannot leak into the scene runtime.
