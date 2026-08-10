import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const metadata = JSON.parse(await read("libs/harfbuzz/source.json"));
const entryPoint = await read("libs/harfbuzz/src/harfbuzz.cc");
const publicHeader = await read("libs/harfbuzz/src/hb.h");
const license = await read("libs/harfbuzz/COPYING");
const addonConfig = await read("addon_config.mk");
const amalgamation = await read("src/ofxOGrafHarfBuzzAmalgamation.cpp");

assert.equal(metadata.version, "14.3.0");
assert.match(metadata.source, /github\.com\/harfbuzz\/harfbuzz\/releases\/download\/14\.3\.0/);
assert.match(metadata.archiveSha256, /^[a-f0-9]{64}$/);
assert.equal(metadata.entryPoint, "src/harfbuzz.cc");
for (const source of [
  "hb-ot-shaper-arabic.cc",
  "hb-ot-shaper-hebrew.cc",
  "hb-ot-shaper-indic.cc",
  "hb-ot-shaper-khmer.cc",
  "hb-ot-shaper-myanmar.cc",
  "hb-ot-shaper-thai.cc"
]) assert.ok(entryPoint.includes(source), `amalgamation lacks ${source}`);
assert.match(publicHeader, /HB_H_IN/);
assert.match(license, /Old MIT/);
assert.match(addonConfig, /ADDON_INCLUDES = src libs\/harfbuzz\/src/);
assert.match(addonConfig, /ADDON_SOURCES \+= src\/ofxOGrafHarfBuzzAmalgamation\.cpp/);
assert.match(amalgamation, /#include "\.\.\/libs\/harfbuzz\/src\/harfbuzz\.cc"/);
assert.match(amalgamation, /#pragma warning\(push, 0\)/);

console.log("Validated pinned HarfBuzz source, shaping entry point, and license metadata.");
