# ofxOGraf Scene Renderer support

## Terminology

The **ofxOGraf Scene Renderer** is the internal C++ engine that evaluates Broadcast Scene data and draws it natively or through WebAssembly/WebGL. The **OGraf Host** is the external browser-based system that loads the packaged Web Component and invokes its OGraf lifecycle. This document describes the Scene Renderer unless it explicitly names an OGraf Host.

## Scene versions

The loader supports authored Broadcast Scene 0.1.x, 0.2.x, and 0.3.x documents. Version 0.1 is upgraded, 0.2 is the current runtime representation, and neutral 0.3 documents are compiled to that runtime representation. Missing, malformed, and forward versions fail before rendering.

| Authored schema | Runtime status |
|---|---|
| 0.1.x | Deprecated; explicitly upgraded |
| 0.2.x | Loaded directly |
| 0.3.x | Neutral model compiled with stable IDs |

See [scene-compatibility.md](scene-compatibility.md) for the compatibility and migration contract.

## Scene Renderer conformance

`tests/conformance/frames.json` is the shared, versioned inventory of reference scenes, capture
times, target runtimes, feature labels, dimensions, and pixel tolerances. The native golden-frame
contract consumes every fixture declaring the `native` target. The WASM conformance page consumes
the same scene fixtures declaring the `wasm` target, exports its rendered RGBA buffer, compares it
with the native golden using the fixture's tolerance, and verifies identical hashes after backward
seeking, scene reload, and repeated play/stop cycles.

The pixel comparison establishes tolerant native/WASM visual conformance for shared fixtures. The
hash checks separately prove repeatability inside WASM; they do not replace the cross-runtime pixel
comparison. Tolerances remain fixture-specific because GPU rasterization and font antialiasing can
differ without changing layout or visible content.


The 0.2 pipeline uses three fidelity modes:

1. **Native reconstruction** for portable scene features.
2. **Registered extensions** for effects or custom layer types with an openFrameworks implementation.
3. **Baked PNG sequences** for AE-only render behavior and arbitrary third-party plugins.

This separation is intentional: a third-party After Effects binary cannot execute in a browser/WebAssembly runtime, but its rendered pixels can still be reproduced deterministically.

## Native reconstruction

| Area | Implementation |
|---|---|
| Text | Packaged font resolution, `ofTrueTypeFont` metrics and outlines, UTF-8 iteration, tracking, leading, justification, fill and stroke |
| Shapes | Rectangle, ellipse and cubic paths; fill/stroke opacity and width |
| Gradients | Linear and radial gradients tessellated into vertex-colored meshes; normalized stops plus preserved AE raw gradient data |
| Trim Paths | Start/end/offset evaluation on path outlines |
| Repeaters | Copies, offset, position, scale and rotation |
| Merge Paths | Non-zero, negative, intersection and odd winding approximations |
| Hierarchy | Recursive parent transforms with cycle protection |
| Precompositions | Recursive exported composition graph with local time/stretch mapping |
| 3D | Anchor, 3D position/scale/orientation and X/Y/Z rotations |
| Masks | Shape masks with add/subtract and first-mask inversion through the stencil buffer |
| Track mattes | Binary alpha-coverage/inverted matte stencil compositing |
| Expressions | Source is preserved and evaluated AE values are sampled per frame by the v2 exporter |
| Essential Graphics | Controller names/ids plus best-effort type/default matching and Essential Properties are exported into the neutral `controls` model |
| Images/solids | Packaged image asset lookup and solid rendering |

## Extension API

Register a custom layer backend or effect implementation before loading/playing:

```cpp
graphic.extensions().registerLayerRenderer(
    "particle-system",
    [](const ofxOGraf::Layer& layer, double time, const ofJson& data) {
        // Draw and return true when handled.
        return true;
    }
);

graphic.extensions().registerEffectRenderer(
    "com.vendor.effect-id",
    [](const ofJson& effect, double time) {
        // Apply the custom implementation and return true when handled.
        return true;
    }
);
```

The built-in effect state recognizes color-producing Fill/Tint-style effects. Other effects remain preserved in the scene and are offered to registered handlers.

## Baked fallback

Run `after-effects/bake_unsupported_layers.jsx` to render layers requiring AE or plugin execution into alpha PNG sequences. The v2 exporter already emits a deterministic fallback path for every such layer:

```json
{
  "fallback": {
    "enabled": false,
    "filePattern": "baked/my-comp/my-layer_####.png",
    "frameRate": 50,
    "startFrame": 0,
    "reasons": ["effects-or-plugins"]
  }
}
```

After copying the rendered sequence into the package, set `enabled` to `true`. The Scene Renderer selects its frame from absolute scene time, so seeking and non-real-time OGraf rendering remain deterministic.

## Fidelity boundaries

- `ofTrueTypeFont` uses FreeType outlines and metrics, but exact AE paragraph shaping may still differ for complex scripts, variable fonts or AE-specific text engines. A HarfBuzz backend can be registered as a custom text-layer renderer when exact shaping is required.
- `Renderer::diagnostics()` exposes stable, once-per-scene text diagnostic codes: `text.font-unavailable`, `text.shaping-unsupported`, and `text.overflow`. Authors can opt into deterministic overflow checks with positive `boxWidth` and/or `boxHeight` values on the evaluated text document. These checks report measured and available pixel bounds; they do not silently resize or truncate text.
- Scene preflight detects bidirectional Arabic/Hebrew text, Indic and Southeast Asian complex scripts, combining marks, and emoji sequences. Native, WASM, and OGraf canvas targets require either a provider advertising `text.complex-shaping` or an enabled baked fallback. This conservative classification prevents unsupported shaping from being reported as merely tolerant.
- Register an executable complex-text provider with `graphic.extensions().registerTextLayoutProvider(id, version, handler)`. Registration atomically advertises `text.complex-shaping`; the handler receives the evaluated text document and resolved live text before the built-in font path. Return `false` to use the existing tolerant renderer as fallback.
- HarfBuzz 14.3.0 source is pinned under `libs/harfbuzz/` from the official release archive. `source.json` records the upstream URL and verified SHA-256; `COPYING` is preserved byte-for-byte. Native and Emscripten addon builds use the same upstream `harfbuzz.cc` simplified-build entry point. `HarfBuzzShaper::shapeFontFile()` handles one explicitly segmented direction/script/language run and returns stable glyph IDs, UTF-8 clusters, offsets, and advances. It deliberately does not guess BiDi runs, wrap paragraphs, or draw glyphs.
- `HarfBuzzShaper::makeTextLayoutHandler(fontResolver)` adds outline rendering through `hb_font_draw_glyph_or_fail()` and `ofPath`. Register it with `registerTextLayoutProvider()` before loading a scene. Text documents must provide `direction`, ISO 15924 `script`, and BCP 47 `language`; unresolved fonts, missing glyphs, multiline input, or missing segment metadata return `false` and preserve the built-in fallback path. The basic example registers `dev.ofxograf.harfbuzz@14.3.0` and includes an Arabic RTL runtime fixture.
- Merge Paths uses tessellator winding modes and is not a byte-for-byte clone of every AE boolean edge case.
- The built-in track matte is alpha/stencil based; luma mattes should use an extension or bake fallback.
- 3D transforms are supported, but AE cameras, lights, Cinema 4D and plugin renderers require a dedicated extension or bake fallback.
- Arbitrary expressions are not interpreted in C++; their AE-evaluated samples are authoritative.
- Arbitrary effects and third-party plugins are extension/bake features, because their proprietary runtime is unavailable in WebAssembly.
