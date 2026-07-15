# Essential Graphics controls

The exported `scene.controls` array is the single source of truth for both control surfaces. `ofxOGraf` does not require a GUI dependency.
Both surfaces normalize optional presentation metadata before rendering. Use `ui` in a scene control; code-template descriptors may instead use the equivalent top-level fields for compatibility:

```json
{
  "id": "headline",
  "name": "Headline",
  "type": "string",
  "default": "Breaking news",
  "ui": {
    "group": "Content",
    "order": 10,
    "description": "Primary on-air text."
  }
}
```

Controls are grouped in first-declared group order, then sorted by `order` (and original declaration order for ties). Missing metadata becomes `General`, `0`, and an empty description. ImGui shows descriptions as hover tooltips; the browser panel shows them below the label.

## Browser/OGraf controls

Import the reusable Web Component next to an OGraf graphic:

```html
<of-broadcast-graphic id="graphic" scene="./scene.json"></of-broadcast-graphic>
<of-essential-controls for="graphic"></of-essential-controls>

<script type="module">
  import OfBroadcastGraphic from "./OfBroadcastGraphic.js";
  import "./EssentialControls.js";

  customElements.define("of-broadcast-graphic", OfBroadcastGraphic);
  await document.querySelector("#graphic").load({ data: {} });
</script>
```

The panel generates text, multiline text, checkbox, numeric, slider, color, vector and option controls. Changes use the standard OGraf `updateAction()` lifecycle. Add the `animate` attribute when updates should not set `skipAnimation`.

The component is intended for preview and operator applications. The OGraf renderer imports only `OfBroadcastGraphic.js`, so the control panel is not drawn into program output.

## Native ofxImGui inspector

Add both addons to the consuming application's `addons.make`:

```text
ofxOGraf
ofxImGui
```

`ofxImGui` defines `ofxAddons_ENABLE_IMGUI`; this activates `ofxOGraf::ImGuiControls` automatically. The adapter does not own an ImGui context, so it fits the normal `gui.begin()` / `gui.end()` application lifecycle:

```cpp
ofxImGui::Gui gui;
ofxOGraf::Graphic graphic;
ofxOGraf::ImGuiControls controls;

void ofApp::setup() {
    graphic.setup();
    graphic.loadFile("scene.json");
    gui.setup();
}

void ofApp::draw() {
    graphic.draw();
    gui.begin();
    controls.draw(graphic);
    gui.end();
}
```

Applications that include only `ofxOGraf` still compile the adapter as a dependency-free stub; `ImGuiControls::available()` returns `false`.
