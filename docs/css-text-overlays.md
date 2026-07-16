# CSS text overlays for CodeTemplate graphics

Compiled templates can keep procedural drawing in C++ while rendering selected text as HTML above the WebGL canvas. Add an optional `htmlTextOverlays` array to the CodeTemplate descriptor:

```json
{
  "htmlTextOverlays": [{
    "id": "css-headline",
    "dataKey": "headline",
    "fontAssetId": "inter-bold",
    "rect": { "x": 220, "y": 760, "width": 1200, "height": 100 },
    "style": {
      "color": "white",
      "fontFamily": "Inter",
      "fontSize": "64px",
      "fontWeight": 700,
      "fontVariationSettings": "'wght' 700",
      "letterSpacing": "0.02em",
      "lineHeight": 1.1
    }
  }]
}
```

`dataKey` must reference a declared control. The runtime uses `textContent`, so control values cannot inject markup. `visibleWhen` may reference a Boolean control. Overlay rectangles use the authored composition's pixel coordinates and scale with the canvas.

When `fontAssetId` is present, it must reference a declared `font` asset. The OGraf packager copies that asset under `data/`, and the browser loads it with `FontFace`. Set `style.fontFamily` to the family name used by the overlay. A CSS system-font stack works without `fontAssetId`, but bundled fonts are preferable for reproducible broadcast output.

The style object accepts typography-related properties only: color, font family/size/style/weight/stretch/features/kerning/variations, spacing, line height, alignment, decoration, shadow, transform, wrapping and opacity. Layout and network-bearing properties are rejected by descriptor validation.

## Output boundary

The overlay is part of the composed OGraf custom element and follows load, update, scheduled-update, backward-seek and dispose state. It is not drawn into the WebGL framebuffer. `RenderSurface::readPixels()`, canvas-only capture, and native rendering contain only the C++ layer. Use C++ text whenever downstream output captures only the canvas or native/WASM pixel parity is required.

Do not draw the same string in C++ and declare it as an HTML overlay unless duplication is intentional. A template should choose one renderer for each text element.
