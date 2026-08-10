import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [page, harness, readme, manifestText] = await Promise.all([
    readFile(new URL("example-ograf-package/index.html", root), "utf8"),
    readFile(new URL("example-ograf-package/main.js", root), "utf8"),
    readFile(new URL("example-ograf-package/README.md", root), "utf8"),
    readFile(new URL("ograf/graphic.ograf.json", root), "utf8")
]);

await Promise.all([
    access(new URL("ograf/NativeLowerThirdGraphic.js", root)),
    access(new URL("ograf/template-definition.json", root))
]);

assert.match(page, /<script type="module" src="\.\/main\.js"><\/script>/);
assert.match(page, /id="status" data-state="running"/);
assert.match(harness, /import NativeLowerThirdGraphic from "\.\.\/ograf\/NativeLowerThirdGraphic\.js"/);
assert.match(harness, /window\.__ofxOGrafExampleResult/);
assert.match(harness, /state: "pass"/);
assert.match(harness, /state: "fail"/);
assert.match(harness, /document\.createElement\(elementName\)/);

const lifecycle = ["load", "playAction", "updateAction", "stopAction", "dispose"];
let previous = -1;
for (const method of lifecycle) {
    const current = harness.indexOf(`record("${method}"`);
    assert.ok(current > previous, `${method} must occur after the preceding lifecycle step`);
    previous = current;
}

const manifest = JSON.parse(manifestText);
assert.equal(manifest.main, "./NativeLowerThirdGraphic.js");
assert.match(readme, /real browser lifecycle/);
assert.match(readme, /third-party OGraf Host remains the separate interoperability check/);

console.log("Validated the canonical OGraf package example and ordered lifecycle harness.");
