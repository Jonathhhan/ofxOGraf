import assert from "node:assert/strict";
import {createHash} from "node:crypto";
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
const fontSource = JSON.parse(await readFile(new URL("example-tutorials/assets/fonts/source.json", root), "utf8"));
const fixtures = await Promise.all([
  ["arabic", "rtl", "Arab", "ar"],
  ["hebrew", "rtl", "Hebr", "he"],
  ["devanagari", "ltr", "Deva", "hi"]
].map(async ([name, direction, script, language]) => ({
  name,
  direction,
  script,
  language,
  scene: JSON.parse(await readFile(new URL(`tests/fixtures/harfbuzz-${name}.scene.json`, root), "utf8"))
})));

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
assert.match(tutorialHeader, /\{"HarfBuzz: Arabic \(RTL\)", "harfbuzz-arabic\.scene\.json"\}/);
assert.match(tutorialHeader, /\{"HarfBuzz: Hebrew \(RTL\)", "harfbuzz-hebrew\.scene\.json"\}/);
assert.match(tutorialHeader, /\{"HarfBuzz: Devanagari \(LTR\)", "harfbuzz-devanagari\.scene\.json"\}/);
for (const fixture of fixtures) {
  assert.match(tutorialConfig, new RegExp(`tests/fixtures/harfbuzz-${fixture.name}\\.scene\\.json`));
  const value = fixture.scene.layers[0].text.value;
  assert.equal(value.direction, fixture.direction);
  assert.equal(value.script, fixture.script);
  assert.equal(value.language, fixture.language);
}
assert.match(tutorialConfig, /DejaVuSans\.ttf/);
assert.match(tutorialConfig, /NotoSansHebrew\.ttf/);
assert.match(tutorialConfig, /NotoSansDevanagari\.ttf/);
assert.match(tutorialConfig, /OFL-NotoSansHebrew\.txt/);
assert.match(tutorialConfig, /OFL-NotoSansDevanagari\.txt/);
assert.equal(fontSource.commit, "038b637da7b3fd956a4ed93ffc607c3d5e4ce172");
for (const font of fontSource.fonts) {
  const bytes = await readFile(new URL(`example-tutorials/assets/fonts/${font.file}`, root));
  assert.equal(createHash("sha256").update(bytes).digest("hex"), font.sha256, `${font.file} checksum`);
  const license = await readFile(new URL(`example-tutorials/assets/fonts/${font.licenseFile}`, root), "utf8");
  assert.match(license, /SIL OPEN FONT LICENSE Version 1\.1/);
}

console.log("Validated explicit Arabic, Hebrew, and Devanagari HarfBuzz shaping contracts.");
