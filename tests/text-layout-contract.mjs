import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const header = await readFile(new URL("src/ofxOGrafRenderer.h", root), "utf8");
const renderer = await readFile(new URL("src/ofxOGrafRenderer.cpp", root), "utf8");
const extensionsHeader = await readFile(new URL("src/ofxOGrafExtensions.h", root), "utf8");
const extensions = await readFile(new URL("src/ofxOGrafExtensions.cpp", root), "utf8");

assert.match(header, /struct RenderDiagnostic/);
assert.match(header, /const std::vector<RenderDiagnostic>& diagnostics\(\) const/);
assert.match(renderer, /"text\.font-unavailable"/);
assert.match(renderer, /"text\.shaping-unsupported"/);
assert.match(renderer, /"text\.overflow"/);
assert.match(renderer, /value\.value\("boxWidth", 0\.0f\)/);
assert.match(renderer, /value\.value\("boxHeight", 0\.0f\)/);
assert.match(renderer, /diagnosticKeys\.clear\(\)/);
assert.match(extensionsHeader, /using TextLayoutHandler/);
assert.match(extensionsHeader, /registerTextLayoutProvider/);
assert.match(extensionsHeader, /bool drawText\(/);
assert.match(extensions, /if \(!handler\) throw std::invalid_argument/);
assert.match(extensions, /registerProvider\(id, version, \{"text\.complex-shaping"\}\)/);
assert.match(extensions, /capability != "text\.complex-shaping" \|\|/);
assert.match(extensions, /static_cast<bool>\(textLayoutHandler\)/);
assert.match(renderer, /extensionRegistry\.drawText\(layer, value, text, time, data\)/);
assert.ok(renderer.indexOf("extensionRegistry.drawText(layer, value, text, time, data)") <
          renderer.indexOf("assets.font(fontName, size)"),
          "text provider must run before the built-in font path");

console.log("Validated executable text-layout provider and diagnostics contract.");
