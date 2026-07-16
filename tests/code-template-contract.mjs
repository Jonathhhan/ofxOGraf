import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const header = await readFile(new URL("src/ofxOGrafCodeTemplate.h", root), "utf8");
const registry = await readFile(new URL("src/ofxOGrafCodeTemplateRegistry.cpp", root), "utf8");
const implementation = await readFile(new URL("src/ofxOGrafCodeTemplate.cpp", root), "utf8");

for (const token of [
    "TemplateDefinition",
    "TypedControlDescriptor",
    "TypedAssetDescriptor",
    "ActionDescriptor",
    "RenderContext",
    "FrameContext",
    "DeterministicRandom",
    "CodeTemplate",
    "CodeTemplateHost"
]) assert.ok(header.includes(token), `missing code-template contract: ${token}`);
for (const token of ["registerFactory", "unregisterFactory", "contains", "ids", "create"])
    assert.ok(registry.includes(token), `missing template registry operation: ${token}`);
assert.match(registry, /Unknown code template factory/);
assert.match(registry, /Code template factory returned null/);
assert.doesNotMatch(registry, /static\s+CodeTemplateRegistry/);


for (const method of ["load", "play", "update", "updateData", "stop", "seek", "draw", "dispose"])
    assert.match(header, new RegExp(`\\b${method}\\(`), `missing lifecycle method: ${method}`);

assert.match(implementation, /0x9e3779b97f4a7c15ULL/);
assert.match(implementation, /frameSeed = combineSeed\(renderContext\.randomSeed, frame\.frameIndex\)/);
assert.match(header, /validateValue\(const ofJson& value/);
assert.match(implementation, /value is below minimum/);
assert.match(implementation, /value is above maximum/);
assert.match(implementation, /value is not an allowed option/);
assert.match(implementation, /color channels must be finite/);
assert.match(implementation, /control\.validateValue\(value\.at\(control\.id\), "\/" \+ control\.id/);
assert.match(implementation, /actionStartSeconds\(const ActionDescriptor& action\)/);
assert.match(implementation, /actionDurationSeconds\(const ActionDescriptor& action\)/);
assert.match(implementation, /startControlIds/);
assert.match(implementation, /durationControlId/);
assert.doesNotMatch(implementation, /ofGetElapsedTime|ofGetLastFrameTime|ofRandom\s*\(/);
assert.doesNotMatch(header + implementation, /ImGui|ADBE|After Effects/);

console.log("Validated code-template descriptors, lifecycle, and deterministic time/random contract.");
