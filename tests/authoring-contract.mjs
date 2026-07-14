import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [header, implementation, loader, example, imguiExample, schemaText, wrapper] = await Promise.all([
    readFile(new URL("src/ofxOGrafAuthoring.h", root), "utf8"),
    readFile(new URL("src/ofxOGrafAuthoring.cpp", root), "utf8"),
    readFile(new URL("src/ofxOGrafSceneLoader.cpp", root), "utf8"),
    readFile(new URL("example-basic/src/ofApp.cpp", root), "utf8"),
    readFile(new URL("example-imgui/src/ofApp.cpp", root), "utf8"),
    readFile(new URL("schema/broadcast-scene-0.3.schema.json", root), "utf8"),
    readFile(new URL("ograf/OfBroadcastGraphic.js", root), "utf8")
]);
const schema = JSON.parse(schemaText);

for (const token of [
    "SceneBuilder", "CompositionBuilder", "TextLayerBuilder", "ShapeLayerBuilder",
    "ControlBuilder", "RationalFrameRate", "AuthoringKeyframe", "animate", "stableId", "canonicalJson"
]) assert.ok(header.includes(token), `missing authoring API: ${token}`);

for (const token of [
    "rootCompositionId", "requiredExtensions", "targetId", "cc.openframeworks.ofxograf.builder"
]) assert.ok(implementation.includes(token), `missing neutral authoring contract: ${token}`);

assert.doesNotMatch(header + implementation, /ADBE|After Effects/);
assert.equal(schema.properties.format.const, "broadcast-scene");
assert.equal(schema.properties.version.pattern, "^0\\.3\\.[0-9]+$");
assert.ok(schema.$defs.composition);
assert.ok(schema.$defs.control);
assert.ok(schema.$defs.extensions);
assert.match(loader, /compileNeutral03/);
assert.match(loader, /rootCompositionId/);
assert.match(example, /SceneBuilder/);
assert.match(example, /scene\.animate/);
assert.match(example, /loadJson\(scene\.build\(\)\)/);
assert.match(wrapper, /compositionInfo\(scene/);
assert.match(imguiExample, /SceneBuilder/);
assert.match(imguiExample, /controls\.draw\(graphic\)/);
assert.match(wrapper, /this\.canvas\.width = resolution[\s\S]*this\.module = await createOfxOGrafModule/,
    "canvas must be sized before WebGL module creation");

console.log("Validated tool-neutral SceneBuilder, 0.3 schema, loader compiler, and native OF example.");
