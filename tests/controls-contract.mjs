import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
    coerceControlValue,
    colorToHex,
    controlDefaults,
    hexToColor,
    normalizeActions,
    normalizeControls
} from "../ograf/EssentialControls.js";

const controls = normalizeControls([
    { id: "headline", name: "Headline", type: "string", default: "Hello", ui: { group: "Content", order: 1, description: "Main lower-third text." } },
    { id: "visible", name: "Visible", type: "boolean", default: true },
    { id: "size", name: "Size", type: "number", default: 42, min: 10, max: 100, group: "Style", order: 0, description: "Legacy descriptor metadata." },
    { id: "accent", name: "Accent", type: "color-or-vector", matchName: "ADBE Color Control", default: [1, 0.5, 0, 1] },
    { id: "headline", name: "Duplicate", type: "string" },
    { id: "gain", label: "Gain", type: "number", default: 1, constraints: { minimum: 0, maximum: 2, step: 0.1 }, ui: { group: "Content", order: 0 } }
]);

assert.equal(controls.length, 5);
assert.deepEqual(controls.map(control => control.id), ["gain", "headline", "visible", "accent", "size"]);
assert.deepEqual(controlDefaults(controls), { headline: "Hello", visible: true, size: 42, accent: [1, 0.5, 0, 1], gain: 1 });
assert.equal(controls[0].name, "Gain");
assert.equal(controls[0].min, 0);
assert.equal(controls[0].step, 0.1);
assert.deepEqual(controls[1].ui, { group: "Content", order: 1, description: "Main lower-third text." });
assert.deepEqual(controls[2].ui, { group: "General", order: 0, description: "" });
assert.deepEqual(controls[4].ui, { group: "Style", order: 0, description: "Legacy descriptor metadata." });
assert.equal(coerceControlValue(controls[2], "", false), false);
assert.equal(coerceControlValue(controls[4], "52.5"), 52.5);
assert.equal(colorToHex([1, 0.5, 0]), "#ff8000");
assert.deepEqual(hexToColor("#336699", 0.5), [0.2, 0.4, 0.6, 0.5]);
assert.deepEqual(normalizeActions([
    { id: "in", label: "Animate in", kind: "in" },
    { id: "update", label: "Update data", kind: "update" },
    { id: "out", label: "Animate out", kind: "out" },
    { id: "in", label: "Duplicate" }
]).map(action => action.id), ["in", "out"]);

const root = new URL("../", import.meta.url);
const imgui = await readFile(new URL("src/ofxOGrafImGuiControls.cpp", root), "utf8");
const wrapper = await readFile(new URL("ograf/OfBroadcastGraphic.js", root), "utf8");
assert.match(imgui, /ofxAddons_ENABLE_IMGUI/);
assert.match(imgui, /Controls::defaultData/);
assert.match(imgui, /ImGuiColorEditFlags_AlphaBar/);
assert.match(imgui, /ImGui::TextDisabled/);
assert.match(imgui, /ImGui::SetTooltip/);
const renderer = await readFile(new URL("src/ofxOGrafRenderer.cpp", root), "utf8");
assert.ok(renderer.includes('property.value("controlId"'));
assert.match(renderer, /return controlled/);
assert.match(renderer, /value\.size\(\) > 3 && value\[3\]\.is_number\(\)/);
assert.match(renderer, /colorAlpha \* alpha/);
assert.match(renderer, /glBlendFuncSeparate\(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ONE_MINUS_SRC_ALPHA\)/);
assert.match(wrapper, /ograf-ready/);
assert.match(wrapper, /ograf-data-change/);
console.log("Validated shared HTML/ofxImGui Essential Graphics controls contract.");
