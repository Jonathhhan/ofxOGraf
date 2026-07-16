import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [header, implementation, graphic, bridge, wrapper, harness, schemaText, fixtureText] = await Promise.all([
  readFile(new URL("src/ofxOGrafControls.h", root), "utf8"),
  readFile(new URL("src/ofxOGrafControls.cpp", root), "utf8"),
  readFile(new URL("src/ofxOGrafGraphic.cpp", root), "utf8"),
  readFile(new URL("example-basic/src/main.cpp", root), "utf8"),
  readFile(new URL("ograf/OfBroadcastGraphic.js", root), "utf8"),
  readFile(new URL("tests/wasm-scene-migration.html", root), "utf8"),
  readFile(new URL("schema/broadcast-scene-0.3.schema.json", root), "utf8"),
  readFile(new URL("tests/fixtures/scene-structured-controls.json", root), "utf8")
]);
const schema = JSON.parse(schemaText);
const fixture = JSON.parse(fixtureText);
for (const type of ["object", "array", "media", "json", "enum"]) {
  assert.ok(schema.$defs.control.properties.type.enum.includes(type), `schema lacks structured type ${type}`);
}
assert.ok(schema.$defs.control.properties.visibleWhen);
assert.ok(schema.$defs.control.properties.schema);
assert.ok(fixture.controls.some(control => control.type === "array"));
assert.match(header, /ControlValidationError/);
assert.match(implementation, /validateStructuredValue/);
assert.match(implementation, /Required field is missing/);
assert.match(graphic, /ofJson candidate = data/);
assert.match(graphic, /candidate\.merge_patch\(patch\)/);
assert.match(graphic, /data = std::move\(candidate\)/);
assert.ok(graphic.indexOf("validateData(scene, candidate)") < graphic.indexOf("data = std::move(candidate)"));
assert.match(bridge, /return graphic\(\)->updateData/);
assert.match(bridge, /getGraphicData/);
assert.match(harness, /beforeInvalid === afterInvalid/);
assert.match(harness, /\/rows\/0\/label/);
assert.match(bridge, /--structured-controls-test/);
assert.match(bridge, /runStructuredControlsContract/);
assert.match(bridge, /beforeInvalid == afterInvalid/);
assert.match(wrapper, /const candidate = this\.mergePatch\(this\.data, data\)/);
assert.ok(wrapper.indexOf("updateRuntime(data, skipAnimation)") < wrapper.indexOf("this.data = candidate"));
console.log("Validated structured controls and transactional native/WASM update contract.");
