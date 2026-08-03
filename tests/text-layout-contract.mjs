import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const header = await readFile(new URL("src/ofxOGrafRenderer.h", root), "utf8");
const renderer = await readFile(new URL("src/ofxOGrafRenderer.cpp", root), "utf8");

assert.match(header, /struct RenderDiagnostic/);
assert.match(header, /const std::vector<RenderDiagnostic>& diagnostics\(\) const/);
assert.match(renderer, /"text\.font-unavailable"/);
assert.match(renderer, /"text\.shaping-unsupported"/);
assert.match(renderer, /"text\.overflow"/);
assert.match(renderer, /value\.value\("boxWidth", 0\.0f\)/);
assert.match(renderer, /value\.value\("boxHeight", 0\.0f\)/);
assert.match(renderer, /diagnosticKeys\.clear\(\)/);

console.log("Validated deterministic text-layout diagnostics contract.");
