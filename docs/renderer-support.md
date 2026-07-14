# Expanded renderer support

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

After copying the rendered sequence into the package, set `enabled` to `true`. The renderer selects its frame from absolute scene time, so seeking and non-real-time OGraf rendering remain deterministic.

## Fidelity boundaries

- `ofTrueTypeFont` uses FreeType outlines and metrics, but exact AE paragraph shaping may still differ for complex scripts, variable fonts or AE-specific text engines. A HarfBuzz backend can be registered as a custom text-layer renderer when exact shaping is required.
- Merge Paths uses tessellator winding modes and is not a byte-for-byte clone of every AE boolean edge case.
- The built-in track matte is alpha/stencil based; luma mattes should use an extension or bake fallback.
- 3D transforms are supported, but AE cameras, lights, Cinema 4D and plugin renderers require a dedicated extension or bake fallback.
- Arbitrary expressions are not interpreted in C++; their AE-evaluated samples are authoritative.
- Arbitrary effects and third-party plugins are extension/bake features, because their proprietary runtime is unavailable in WebAssembly.
