import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    coerceControlValue,
    colorToHex,
    controlDefaults,
    hexToColor,
    normalizeControls
} from "../ograf/EssentialControls.js";

const controls = normalizeControls([
    { id: "headline", name: "Headline", type: "string", default: "Hello" },
    { id: "visible", name: "Visible", type: "boolean", default: true },
    { id: "size", name: "Size", type: "number", default: 42, min: 10, max: 100 },
    { id: "accent", name: "Accent", type: "color-or-vector", matchName: "ADBE Color Control", default: [1, 0.5, 0, 1] },
    { id: "headline", name: "Duplicate", type: "string" },
    { id: "gain", label: "Gain", type: "number", default: 1, constraints: { minimum: 0, maximum: 2, step: 0.1 } }
]);

assert.equal(controls.length, 5);
assert.deepEqual(controlDefaults(controls), { headline: "Hello", visible: true, size: 42, accent: [1, 0.5, 0, 1], gain: 1 });
assert.equal(controls[4].name, "Gain");
assert.equal(controls[4].min, 0);
assert.equal(controls[4].step, 0.1);
assert.equal(coerceControlValue(controls[1], "", false), false);
assert.equal(coerceControlValue(controls[2], "52.5"), 52.5);
assert.equal(colorToHex([1, 0.5, 0]), "#ff8000");
assert.deepEqual(hexToColor("#336699", 0.5), [0.2, 0.4, 0.6, 0.5]);

const root = new URL("../", import.meta.url);
const imgui = await readFile(new URL("src/ofxOGrafImGuiControls.cpp", root), "utf8");
const wrapper = await readFile(new URL("ograf/OfBroadcastGraphic.js", root), "utf8");
assert.match(imgui, /ofxAddons_ENABLE_IMGUI/);
assert.match(imgui, /Controls::defaultData/);
const renderer = await readFile(new URL("src/ofxOGrafRenderer.cpp", root), "utf8");
assert.ok(renderer.includes('property.value("controlId"'));
assert.match(renderer, /return controlled/);
assert.match(wrapper, /ograf-ready/);
assert.match(wrapper, /ograf-data-change/);
console.log("Validated shared HTML/ofxImGui Essential Graphics controls contract.");
