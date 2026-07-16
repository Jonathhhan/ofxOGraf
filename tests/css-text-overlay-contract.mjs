import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { validateTemplateDefinition } from "../scripts/validate-template-definition.mjs";

const root = new URL("../", import.meta.url);
const [overlay, wrapper, descriptorText] = await Promise.all([
    readFile(new URL("ograf/CssTextOverlay.js", root), "utf8"),
    readFile(new URL("ograf/OfBroadcastGraphic.js", root), "utf8"),
    readFile(new URL("examples/native-authoring/lower-third.template.json", root), "utf8")
]);

for (const token of ["ResizeObserver", "FontFace", "textContent", "fontVariationSettings", "visibleWhen", "./data/"])
    assert.ok(overlay.includes(token), `missing CSS text overlay behavior: ${token}`);
assert.doesNotMatch(overlay, /innerHTML|insertAdjacentHTML|eval\s*\(/);
assert.match(wrapper, /cssTextOverlay\.load\(scene, composition\)/);
assert.match(wrapper, /cssTextOverlay\.update\(this\.data\)/);
assert.match(wrapper, /cssTextOverlay\.clear\(\)/);
assert.match(wrapper, /Could not load CSS text overlay/);
assert.match(wrapper, /catch \(error\)[\s\S]*await this\.dispose\(\)/);

const descriptor = JSON.parse(descriptorText);
descriptor.htmlTextOverlays = [{
    id: "css-headline",
    dataKey: "headline",
    visibleWhen: "safe-area",
    fontAssetId: "inter-bold",
    rect: { x: 220, y: 760, width: 1200, height: 100 },
    style: {
        color: "white",
        fontFamily: "Inter",
        fontSize: "64px",
        fontWeight: 700,
        fontVariationSettings: "'wght' 700",
        letterSpacing: "0.02em"
    }
}];
assert.equal(validateTemplateDefinition(descriptor).valid, true);

const badCss = structuredClone(descriptor);
badCss.htmlTextOverlays[0].style.backgroundImage = "url(https://example.invalid/a.png)";
assert.match(validateTemplateDefinition(badCss).errors.join("\n"), /CSS property is not allowed/);
const badControl = structuredClone(descriptor);
badControl.htmlTextOverlays[0].dataKey = "undeclared";
assert.match(validateTemplateDefinition(badControl).errors.join("\n"), /must reference a declared control/);
const badFont = structuredClone(descriptor);
badFont.htmlTextOverlays[0].fontAssetId = "brand-mark";
assert.match(validateTemplateDefinition(badFont).errors.join("\n"), /declared font asset/);

console.log("Validated descriptor-driven CSS text overlays and safe OGraf lifecycle synchronization.");
