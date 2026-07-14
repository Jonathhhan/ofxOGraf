import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));
const scene = await readJson("examples/feature-showcase.scene.json");
const schema = await readJson("schema/broadcast-scene-0.2.schema.json");
const renderer = await readFile(new URL("src/ofxOGrafRendererShapes.cpp", root), "utf8");
const exporter = await readFile(new URL("after-effects/export_broadcast_scene_v2.jsx", root), "utf8");

assert.equal(scene.format, "broadcast-scene");
assert.match(scene.version, /^0\.2/);
assert.ok(scene.assets.fonts.length > 0);
assert.ok(scene.controls.some(control => control.source === "essential-graphics"));
assert.ok(scene.layers.some(layer => layer.parentIndex));
assert.ok(scene.layers.some(layer => layer.threeDLayer));
assert.ok(scene.layers.some(layer => layer.fallback?.filePattern));

for (const token of [
    "ADBE Vector Stroke Width",
    "ADBE Vector Grad Colors",
    "ADBE Vector Trim End",
    "ADBE Vector Filter - Repeater",
    "ADBE Vector Filter - Merge",
    "ADBE Mask Shape"
]) assert.ok(renderer.includes(token), `renderer lacks ${token}`);

for (const token of [
    "motionGraphicsTemplateControllerCount",
    "samples",
    "compositions",
    "essentialProperties",
    "fallback",
    "trackMatteType",
    "threeDLayer"
]) assert.ok(exporter.includes(token), `exporter lacks ${token}`);

assert.ok(schema.$defs.fallback);
assert.ok(schema.$defs.property.properties.samples);
console.log("Validated expanded renderer/exporter feature contract.");
