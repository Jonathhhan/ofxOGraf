import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { negotiateTemplateCapabilities, templateAbiFingerprint, templateAbiSignature } from "../ograf/TemplateAbi.js";

const root = new URL("../", import.meta.url);
const [registry, sample, app, bridge, wrapper, descriptorText, entry, manifestText, ografDescriptorText, preview] = await Promise.all([
    readFile(new URL("src/ofxOGrafCodeTemplateRegistry.h", root), "utf8"),
    readFile(new URL("examples/native-authoring/NativeLowerThird.cpp", root), "utf8"),
    readFile(new URL("example-basic/src/ofApp.cpp", root), "utf8"),
    readFile(new URL("example-basic/src/main.cpp", root), "utf8"),
    readFile(new URL("ograf/OfBroadcastGraphic.js", root), "utf8"),
    readFile(new URL("examples/native-authoring/lower-third.template.json", root), "utf8"),
    readFile(new URL("ograf/NativeLowerThirdGraphic.js", root), "utf8"),
    readFile(new URL("ograf/graphic.ograf.json", root), "utf8"),
    readFile(new URL("ograf/template-definition.json", root), "utf8"),
    readFile(new URL("ograf/index.html", root), "utf8"),
]);

for (const token of ["CodeTemplateRegistry", "registerFactory", "create", "ids"])
    assert.ok(registry.includes(token), `missing compiled-template registry API: ${token}`);

for (const token of ["NativeLowerThird", "createNativeLowerThird", "registerNativeLowerThird", "onDraw"])
    assert.ok(sample.includes(token), `missing native lower-third sample: ${token}`);

for (const token of ["loadCodeTemplate", "updateCodeTemplate", "playCodeTemplate", "seekCodeTemplate"])
    assert.ok(app.includes(token) && bridge.includes(token), `missing native/WASM lifecycle bridge: ${token}`);
assert.match(bridge, /playCodeTemplate\(const std::string& actionId, bool\)/);
assert.match(bridge, /getCodeTemplateAbiFingerprint/);
assert.match(bridge, /isRuntimeReady/);
assert.match(wrapper, /waitForRuntimeReady/);
assert.match(wrapper, /The openFrameworks runtime did not become ready/);
assert.match(registry, /abiFingerprint/);

assert.match(wrapper, /code-template/);
assert.match(wrapper, /template-definition/);
assert.match(wrapper, /loadCodeTemplate/);
assert.match(wrapper, /isCodeTemplateActionComplete/);
assert.match(wrapper, /playNamedAction/);
assert.match(wrapper, /templateAbiFingerprint/);
assert.match(wrapper, /Code template ABI mismatch/);
assert.match(entry, /playCodeTemplate\("in", skipAnimation\)/);
assert.match(entry, /playCodeTemplate\("out", skipAnimation\)/);
const manifest = JSON.parse(manifestText);
assert.equal(manifest.main, "./NativeLowerThirdGraphic.js");
assert.deepEqual(manifest.actionDurations, [
    { type: "playAction", duration: 650 },
    { type: "updateAction", duration: 0 },
    { type: "stopAction", duration: 900 }
]);
const descriptor = JSON.parse(descriptorText);
assert.equal(descriptor.metadata.source.factory, "createNativeLowerThird");
const ografDescriptor = JSON.parse(ografDescriptorText);
assert.equal(templateAbiSignature(ografDescriptor, "native-lower-third").split("\n")[0], "ofxograf-template-abi-v1");
assert.match(templateAbiFingerprint(ografDescriptor, "native-lower-third"), /^[0-9a-f]{16}$/);
assert.deepEqual(negotiateTemplateCapabilities(ografDescriptor).missing, []);
assert.deepEqual(negotiateTemplateCapabilities({ metadata: { rendererCapabilities: { required: ["webgl2", "gpu-timer"] } } }).missing, ["gpu-timer"]);
assert.match(wrapper, /negotiateTemplateCapabilities/);
assert.match(wrapper, /Renderer capabilities unavailable/);
assert.match(wrapper, /document\.querySelector\("#canvas"\)/);
assert.match(wrapper, /this\.canvas\.id = "canvas"/);
assert.match(wrapper, /this\.appendChild\(this\.canvas\)/);
assert.match(preview, /Preview failed/);
assert.match(preview, /Preview ready/);
assert.match(preview, /goToTime\(\{ timestamp: 1000 \}\)/);
const motionControlIds = [
    "motion-position", "motion-text-offset", "motion-entry-direction", "motion-exit-direction",
    "motion-entry-travel", "motion-exit-travel", "motion-entry-duration", "motion-hold-duration",
    "motion-exit-duration", "motion-entry-influence", "motion-exit-influence", "motion-fade-in", "motion-fade-out"
];
for (const id of motionControlIds) {
    assert.ok(sample.includes(`"${id}"`), `native lower-third lacks portable motion control ${id}`);
    const control = ografDescriptor.controls.find(value => value.id === id);
    assert.equal(control?.group, "Motion", `OGraf descriptor lacks Motion control ${id}`);
    assert.ok(manifest.schema.properties[id], `OGraf manifest lacks Motion data property ${id}`);
}

console.log("Validated compiled CodeTemplate registry, native example, and OGraf/WASM bridge contract.");
