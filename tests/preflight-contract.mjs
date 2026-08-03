import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {analyzeTextShaping, parseProvider, preflightScene} from "../scripts/lib/scene-preflight.mjs";

const root = new URL("../", import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));
const ticker = await readJson("examples/ograf-dev-ticker.scene.json");
const tickerReport = await preflightScene(ticker, {target: "wasm"});
assert.equal(tickerReport.compatible, true);
assert.equal(tickerReport.fidelity, "tolerant");
assert.ok(tickerReport.features.some(feature => feature.capability === "layer.text"));
assert.ok(tickerReport.features.some(feature => feature.capability === "layer.shape"));

const shapingCases = await readJson("tests/fixtures/text-shaping-cases.json");
for (const fixture of shapingCases) assert.deepEqual(analyzeTextShaping(fixture.text), fixture.kinds, fixture.name);

const complexTextScene = {
    format: "broadcast-scene",
    version: "0.2.0",
    layers: [{type: "text", name: "RTL headline", text: {value: {text: "مرحبا بالعالم"}}}],
    assets: {fonts: [], images: []},
    controls: [],
    compositions: []
};
const unsupportedShaping = await preflightScene(complexTextScene, {target: "wasm"});
assert.equal(unsupportedShaping.compatible, false);
assert.ok(unsupportedShaping.features.some(feature =>
    feature.capability === "text.complex-shaping" && feature.status === "extension" &&
    feature.shapingKinds.includes("bidirectional script")));
assert.ok(unsupportedShaping.diagnostics.some(diagnostic => diagnostic.code === "capability.extension-required"));
const shapingProvider = parseProvider("dev.ofxograf.text-shaper@1.0.0:text.complex-shaping");
const providedShaping = await preflightScene(complexTextScene, {target: "wasm", providers: [shapingProvider]});
assert.equal(providedShaping.compatible, true);
complexTextScene.layers[0].fallback = {enabled: true};
const bakedShaping = await preflightScene(complexTextScene, {target: "wasm"});
assert.equal(bakedShaping.compatible, true);

const required = await readJson("tests/fixtures/scene-required-extension.json");
const missingReport = await preflightScene(required, {target: "ograf"});
assert.equal(missingReport.compatible, false);
assert.equal(missingReport.diagnostics[0].code, "extension.provider-missing");

const provider = parseProvider("dev.ofxograf.tests.missing@1.0.0:render");
const satisfiedReport = await preflightScene(required, {target: "ograf", providers: [provider]});
assert.equal(satisfiedReport.compatible, true);

const effectScene = structuredClone(ticker);
effectScene.layers[0].effects = [{matchName: "com.vendor.blur"}];
const unbaked = await preflightScene(effectScene, {target: "wasm"});
assert.equal(unbaked.compatible, false);
assert.ok(unbaked.diagnostics.some(diagnostic => diagnostic.code === "capability.bake-required"));
effectScene.layers[0].fallback = {enabled: true};
const baked = await preflightScene(effectScene, {target: "wasm"});
assert.equal(baked.compatible, true);
assert.ok(baked.features.some(feature => feature.capability === "effect.arbitrary" && feature.status === "baked"));

const cliSource = await readFile(new URL("../scripts/preflight-scene.mjs", import.meta.url), "utf8");
assert.match(cliSource, /process\.exitCode = 2/);
assert.match(cliSource, /--provider/);

console.log("Validated native/WASM/OGraf capability preflight, extensions, baked fallback, and CLI exit policy.");
