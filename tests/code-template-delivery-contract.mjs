import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [registry, sample, app, bridge, wrapper, descriptorText] = await Promise.all([
    readFile(new URL("src/ofxOGrafCodeTemplateRegistry.h", root), "utf8"),
    readFile(new URL("examples/native-authoring/NativeLowerThird.cpp", root), "utf8"),
    readFile(new URL("example-basic/src/ofApp.cpp", root), "utf8"),
    readFile(new URL("example-basic/src/main.cpp", root), "utf8"),
    readFile(new URL("ograf/OfBroadcastGraphic.js", root), "utf8"),
    readFile(new URL("examples/native-authoring/lower-third.template.json", root), "utf8")
]);

for (const token of ["CodeTemplateRegistry", "registerFactory", "create", "ids"])
    assert.ok(registry.includes(token), `missing compiled-template registry API: ${token}`);

for (const token of ["NativeLowerThird", "createNativeLowerThird", "registerNativeLowerThird", "onDraw"])
    assert.ok(sample.includes(token), `missing native lower-third sample: ${token}`);

for (const token of ["loadCodeTemplate", "updateCodeTemplate", "playCodeTemplate", "seekCodeTemplate"])
    assert.ok(app.includes(token) && bridge.includes(token), `missing native/WASM lifecycle bridge: ${token}`);

assert.match(wrapper, /code-template/);
assert.match(wrapper, /template-definition/);
assert.match(wrapper, /loadCodeTemplate/);
assert.match(wrapper, /isCodeTemplateActionComplete/);
const descriptor = JSON.parse(descriptorText);
assert.equal(descriptor.metadata.source.factory, "createNativeLowerThird");

console.log("Validated compiled CodeTemplate registry, native example, and OGraf/WASM bridge contract.");
