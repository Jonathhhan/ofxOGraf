import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const root = new URL("../", import.meta.url);
const header = await readFile(new URL("src/ofxOGrafHarfBuzz.h", root), "utf8");
const implementation = await readFile(new URL("src/ofxOGrafHarfBuzz.cpp", root), "utf8");
const smoke = await readFile(new URL("tests/harfbuzz-shaping-smoke.cpp", root), "utf8");
const example = await readFile(new URL("example-basic/src/ofApp.cpp", root), "utf8");
const exampleConfig = await readFile(new URL("example-basic/config.make", root), "utf8");
const tutorialExample = await readFile(new URL("example-tutorials/src/ofApp.cpp", root), "utf8");
const tutorialHeader = await readFile(new URL("example-tutorials/src/ofApp.h", root), "utf8");
const tutorialConfig = await readFile(new URL("example-tutorials/config.make", root), "utf8");
const fixture = JSON.parse(await readFile(new URL("tests/fixtures/harfbuzz-arabic.scene.json", root), "utf8"));

for (const field of ["glyphId", "cluster", "xAdvance", "yAdvance", "xOffset", "yOffset"])
  assert.ok(header.includes(field), `shaped glyph lacks ${field}`);
assert.match(header, /class HarfBuzzShaper/);
assert.match(implementation, /hb_buffer_set_direction/);
assert.match(implementation, /hb_buffer_set_script/);
assert.match(implementation, /hb_buffer_set_language/);
assert.match(implementation, /HB_BUFFER_CLUSTER_LEVEL_MONOTONE_GRAPHEMES/);
assert.match(implementation, /hb_shape\(font, buffer/);
assert.match(implementation, /accepts exactly one pre-segmented text run/);
assert.doesNotMatch(implementation, /hb_buffer_guess_segment_properties/);
assert.match(implementation, /hb_font_draw_glyph_or_fail/);
assert.match(implementation, /state->current_x/);
assert.match(implementation, /bezierTo/);
assert.match(implementation, /builder\.originY - value \/ 64\.0f/);
assert.match(implementation, /builder\.originY = -glyph\.yOffset/);
assert.doesNotMatch(implementation, /builder\.originY \+ value \/ 64\.0f/);
assert.match(implementation, /makeTextLayoutHandler/);
assert.match(implementation, /value\.value\("direction", ""\)/);
assert.match(smoke, /"rtl", "Arab", "ar"/);
assert.match(smoke, /a\.glyphId != b\.glyphId/);
assert.match(example, /registerTextLayoutProvider/);
assert.match(example, /HarfBuzzShaper::makeTextLayoutHandler/);
assert.match(example, /harfbuzz-test=1/);
assert.match(exampleConfig, /tests\/fixtures\/harfbuzz-arabic\.scene\.json/);
assert.match(exampleConfig, /DejaVuSans\.ttf/);
assert.match(tutorialExample, /registerTextLayoutProvider/);
assert.match(tutorialHeader, /\{"Arabic RTL \(HarfBuzz\)", "harfbuzz-arabic\.scene\.json"\}/);
assert.match(tutorialConfig, /tests\/fixtures\/harfbuzz-arabic\.scene\.json/);
assert.match(tutorialConfig, /DejaVuSans\.ttf/);
assert.equal(fixture.layers[0].text.value.direction, "rtl");
assert.equal(fixture.layers[0].text.value.script, "Arab");

console.log("Validated explicit single-run HarfBuzz shaping contract.");
