import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const header = await readFile(new URL("src/ofxOGrafCodeTemplate.h", root), "utf8");
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

for (const method of ["load", "play", "update", "updateData", "stop", "seek", "draw", "dispose"])
    assert.match(header, new RegExp(`\\b${method}\\(`), `missing lifecycle method: ${method}`);

assert.match(implementation, /0x9e3779b97f4a7c15ULL/);
assert.match(implementation, /frameSeed = combineSeed\(renderContext\.randomSeed, frame\.frameIndex\)/);
assert.doesNotMatch(implementation, /ofGetElapsedTime|ofGetLastFrameTime|ofRandom\s*\(/);
assert.doesNotMatch(header + implementation, /ImGui|ADBE|After Effects/);

console.log("Validated code-template descriptors, lifecycle, and deterministic time/random contract.");
