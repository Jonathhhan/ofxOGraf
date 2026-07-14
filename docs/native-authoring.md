# Native openFrameworks authoring

This document defines the authoring and delivery contract for graphics created directly in C++ with `SceneBuilder` or `CodeTemplate`.

Direct authoring does not make the OGraf manifest or operator controls C++-specific. A neutral `TemplateDefinition` is generated from the same C++ declaration used by native preview and the WebAssembly build. That definition is the metadata source for every target.

```text
C++ template declaration
        |
        +-- native preview + optional ofxImGui controls
        +-- Emscripten/WebAssembly renderer
        +-- TemplateDefinition JSON
                |
                +-- OGraf manifest data schema
                +-- HTML Essential Controls
                +-- declared asset inventory
                +-- package validation
```

The canonical descriptor fixture is `examples/native-authoring/lower-third.template.json`.

## Choose an authoring model

### SceneBuilder

Use `SceneBuilder` when the graphic can be expressed with the portable scene renderer. The initial API covers text and shape layers, transforms, stable control bindings, assets, actions, provenance, and extension payloads. Masks, precompositions, and additional effects extend the same neutral model incrementally. C++ constructs a Broadcast Scene document instead of drawing directly.

This is the more portable option. Native and WASM use the same scene evaluation path, so deterministic seeking and pixel comparison are easier. It is also appropriate when a template might later be generated from After Effects or another design tool.

```cpp
ofxOGraf::SceneBuilder scene("scene:lower-third");
scene.fontAsset("font:inter-bold", "fonts/Inter-Bold.ttf", "Inter", "Bold");
auto main = scene.composition("composition:main", "Lower third", 1920, 1080, 5.0, {50, 1});
auto headline = main.textLayer("layer:headline", "Headline", "News");
headline.position({240, 740, 0});
headline.font("Inter", 54).fontAsset("font:inter-bold");
scene.control("control:headline", "Headline", "string", "News")
     .bind(headline.textPropertyId());
graphic.loadJson(scene.build());
```

### CodeTemplate

Use `CodeTemplate` when the graphic needs custom openFrameworks drawing, simulation, shaders, or an addon that cannot be represented by a Broadcast Scene. The template class is compiled into both the native application and the Emscripten module.

Conceptually:

```cpp
class LowerThird final : public ofxOGraf::CodeTemplate {
public:
    ofxOGraf::TemplateDefinition definition() const override;
    bool onLoad(const ofxOGraf::RenderContext& context,
                const ofJson& initialData, std::string& error) override;
    void onUpdate(const ofxOGraf::FrameContext& frame) override;
    void onDraw(const ofxOGraf::FrameContext& frame) override;
    void onDataChanged(const ofJson& data, const ofJson& patch,
                       const ofxOGraf::FrameContext& frame) override;
};

std::unique_ptr<ofxOGraf::CodeTemplate> createNativeLowerThird();
```

Direct drawing trades automatic portability for flexibility. Every dependency, shader, filesystem operation, and platform API used by a `CodeTemplate` must also work with the selected openFrameworks Emscripten platform.

Both models should implement the same load, play, update, stop, seek, draw, and dispose behavior. An operator should not need to know which backend produced the graphic.

## TemplateDefinition

`TemplateDefinition` is metadata, not a render scene. Its base contract (`ofxograf-code-template`, version 1) serializes the template id and name, composition, deterministic random seed, controls, asset URIs, and timeline actions. Delivery-specific fields stay in its open `metadata` object so the renderer-neutral C++ host is not coupled to OGraf packaging.

For delivery, `metadata` declares:

- semantic release version and the stable factory name;
- native, WASM, and OGraf targets;
- alpha and realtime/non-realtime support;
- step count, pixel aspect, and renderer capabilities.

The descriptor validator normalizes this delivery envelope before generating an OGraf manifest. The canonical fixture shows the exact serialized shape.

Keep `definition()` and the template factory free of window, GL, audio, network, and filesystem initialization. A descriptor-export executable must be able to construct the template and serialize its definition without creating an openFrameworks window. The native and WASM builds should expose a hash of the serialized definition so packaging can reject stale or mismatched artifacts.

One compiled code template per OGraf ZIP is the initial boundary. A bundle containing several template factories makes manifest identity, asset ownership, dead-code elimination, and custom-element registration unnecessarily ambiguous.

## Controls are declared once

The C++ definition is the source for control ids, types, defaults, ranges, steps, option values, labels, and UI hints. Runtime bindings connect those stable ids to template state; bindings are not serialized into JSON.

```text
C++ TemplateDefinition
        +-- native ControlRegistry / optional ofxImGui
        +-- WASM ControlRegistry
        +-- EssentialControls.js descriptor
        +-- graphic.ograf.json data schema
```

All updates are validated by the C++ registry even if an HTML controller has already validated them. JavaScript is an operator interface, not the authority for renderer state. Renaming a C++ variable must not rename its public control id. A deliberate public rename needs an explicit migration alias and a major-version review.

The serialized control types are `boolean`, `integer`, `number`, `string`, `color`, `vector2`, `vector3`, and `json`. A non-empty option list turns a compatible scalar control into an enum in generated operator schemas. Defaults are mandatory because optional or duplicated defaults allow the native application, WASM module, and manifest to drift.

## Assets and data paths

Declare every runtime file. A direct `ofLoadImage("some/path.png")` whose path is not in the definition cannot be packaged reliably.

```cpp
definition.addAsset(ofxOGraf::FontAssetDescriptor{"inter-bold", "fonts/Inter-Bold.ttf"});
definition.addAsset(ofxOGraf::ImageAssetDescriptor{"brand-mark", "images/brand-mark.png"});
definition.addAsset(ofxOGraf::ShaderAssetDescriptor{"lower-third-vert", "shaders/lower-third.vert"});
definition.addAsset(ofxOGraf::ShaderAssetDescriptor{"lower-third-frag", "shaders/lower-third.frag"});
```

Asset paths use `/`, are relative to a selected data root, and may not contain URL syntax, traversal, absolute paths, or platform-reserved names. The packager should copy only declared assets and mount the same logical paths under Emscripten's virtual data directory before template setup. Do not package `originalFile` paths from an authoring workstation.

Sequences must declare every frame as an asset (or use a future explicit sequence descriptor). A runtime-generated filename pattern cannot tell the packager which frames exist. Shader assets declare every native/WebGL variant separately. Fonts should be bundled rather than resolved from the operating system; confirm that their licenses permit redistribution.

## Native preview and live reload

The consuming openFrameworks application continues to own `setup()`, `update()`, and `draw()`. The addon supplies a host/adapter; it must not create a hidden application lifecycle. `ofxImGui` remains optional and is activated by the example application's `addons.make`, not by a core addon dependency.

Use `RenderSurface` when the template resolution must stay independent of the
editor window. It owns a fixed RGBA FBO, exposes its texture and FBO for output
integration, and draws premultiplied alpha correctly:

```cpp
ofxOGraf::Graphic graphic;
ofxOGraf::RenderSurface preview;

void ofApp::setup() {
    graphic.setup();
    graphic.loadJson(scene.build());
    preview.allocate(graphic.getScene());
}

void ofApp::draw() {
    preview.render(graphic);
    ofClear(24, 24, 24, 255);
    preview.drawFit(0, 0, ofGetWidth(), ofGetHeight(), true);
}
```

The final `true` enables the checkerboard for native preview only. Delivery code
can consume `preview.texture()` or `preview.fbo()` without drawing that grid.

### Deterministic RGBA frame export

`example-basic` can emit one transparent frame without advancing real time:

```powershell
example-basic\bin\example-basic.exe `
  --frame tests\out\lower-third-0.5.png `
  --time 0.5
```

Compare that frame to the committed golden image with a small GPU tolerance:

```powershell
node scripts\verify-golden-frame.mjs tests\out\lower-third-0.5.png tests\golden\lower-third-0.5.png --tolerance 2 --max-different 2500 --require-alpha
```

Asset and descriptor changes can reload in place. Portable C++ hot swapping is not an initial requirement: a code change should trigger an incremental rebuild and relaunch of the native preview.

For browser preview, use a development server that watches descriptor, asset, JS, and WASM outputs. After a successful C++ rebuild it should dispose the old module and load the new build in a fresh iframe. The iframe avoids stale custom-element registrations, WebGL contexts, event handlers, and WASM memory. Preserve control values only when the id and type are compatible, and keep the last successful iframe visible when compilation fails.

The live-reload server is development tooling. It should bind to loopback by default and must not be copied into a production graphic package.

## Deterministic native/WASM behavior

Code templates need stricter rules than ordinary interactive OF applications:

- Use the timestamp and delta supplied in `FrameContext`; do not drive program animation with wall-clock calls such as `ofGetElapsedTimef()`.
- Seed pseudo-random behavior from declared state and reset it on load or backward seek.
- Render at the declared pixel dimensions. Browser device pixel ratio must not change composition coordinates.
- Bundle fonts and assets; do not depend on system font discovery or the current working directory.
- Use WebGL 2-compatible graphics paths and provide explicit GLSL variants where native GL syntax differs.
- Define alpha, blend mode, color space, texture orientation, and clear behavior explicitly.
- Do not depend on unordered iteration when it can affect drawing order or generated values.
- Stop realtime advancement before a non-realtime seek and render the requested timestamp exactly once.
- Avoid native-only threads, sockets, cameras, video decoders, plugins, or addons unless a WASM implementation or declared fallback exists.
- Treat operator data as untrusted. Validate types, bounds, depth, and size before applying a patch.

Equivalence tests should compare lifecycle state and control data exactly. Native FBO and browser-canvas frames may use a documented perceptual tolerance for GPU rasterization and font differences, but repeated renders on each target must be deterministic.

## Validate a definition

The validator is dependency-free and can be called directly:

```powershell
node scripts/validate-template-definition.mjs examples/native-authoring/lower-third.template.json
```

With no file argument it validates the canonical fixture. To verify that every declared file exists beneath a staging data root:

```powershell
node scripts/validate-template-definition.mjs `
  --check-assets `
  --asset-root build/stage/data `
  build/stage/template-definition.json
```

Use `--json` for machine-readable errors, the normalized neutral definition, and the resolved asset inventory. `--strict` also treats future validator warnings as failures.

The validator checks stable and unique ids, typed control defaults, numeric bounds, enum values, standard actions, render metadata, target/capability compatibility, portable asset paths, case-insensitive destination collisions, file/directory collisions, forbidden object keys, and optional on-disk readability.

It can also be imported without spawning a process:

```js
import {
    validateTemplateDefinition,
    validateTemplateDefinitionFile
} from "./validate-template-definition.mjs";
```

## Packaging and OGraf delivery

The intended release pipeline is:

```text
CodeTemplate::definition()
    -> native descriptor export
    -> descriptor validation
    -> native preview tests
    -> Emscripten release build
    -> native/WASM descriptor-hash comparison
    -> declared-asset staging and filesystem mounting
    -> OGraf manifest generation
    -> browser/reference-server smoke test
    -> allowlisted, versioned ZIP
```

The manifest data schema, defaults, action durations, step count, and render requirements should be generated from the validated definition. They should never be maintained as a second hand-written control model.

Packaging scripts should invoke the validator before copying files and again against the completed staging directory with `--check-assets`. The JSON result exposes `normalized` for manifest/control generation and resolved assets for an allowlist; the packager should still independently verify that generated JS, WASM, optional Emscripten data, manifest, and definition hashes are present.

Do not put reference-server upload/control code in the addon runtime. The Graphics interface is the portable boundary; draft server automation belongs in a separate development adapter.

## Addon-style boundaries

- `src/` remains the dependency-free runtime and authoring API.
- A consuming app owns the OF lifecycle and selects its optional addons.
- `ofxImGui` is an optional native inspector, not a renderer dependency.
- Examples show complete application integration without hiding generated project files in the core.
- Descriptor export, live reload, server adapters, and ZIP creation live under development tooling rather than `src/`.
- Deployed packages need no Node.js runtime; Node is used only for validation and packaging.
- The same public lifecycle and neutral controls model cover SceneBuilder, CodeTemplate, native, WASM, and OGraf targets.
