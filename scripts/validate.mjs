import { readFile } from "node:fs/promises";
import { validateTemplateDefinitionFile } from "./validate-template-definition.mjs";

const root = new URL("../", import.meta.url);
const errors = [];

async function json(relative) {
    try {
        return JSON.parse(await readFile(new URL(relative, root), "utf8"));
    } catch (error) {
        errors.push(`${relative}: ${error.message}`);
        return null;
    }
}

function requireFields(value, fields, label) {
    for (const field of fields) {
        if (value?.[field] === undefined) errors.push(`${label}: missing ${field}`);
    }
}

function validateScene(scene, label) {
    if (!scene) return;
    requireFields(scene, ["format", "version", "composition", "layers"], label);
    if (scene.format !== "broadcast-scene") errors.push(`${label}: invalid format`);
    requireFields(scene.composition, ["width", "height", "duration", "frameRate"], `${label}.composition`);
    if (!Array.isArray(scene.layers)) errors.push(`${label}: layers must be an array`);
    for (const [index, layer] of (scene.layers || []).entries()) {
        requireFields(layer, ["index", "name", "type", "inPoint", "outPoint"], `${label}.layers[${index}]`);
    }
}

const manifest = await json("ograf/graphic.ograf.json");
requireFields(manifest, ["$schema", "id", "name", "main", "supportsRealTime", "supportsNonRealTime"], "manifest");
if (manifest?.$schema !== "https://ograf.ebu.io/v1/specification/json-schemas/graphics/schema.json") {
    errors.push("manifest: wrong OGraf v1 schema URL");
}
if (manifest?.id && !/^[a-z][.0-9_a-z-]*-[.0-9_a-z-]*$/.test(manifest.id)) {
    errors.push("manifest: id must be a valid lowercase custom-element name");
}

const wrapperPath = `ograf/${manifest?.main?.replace(/^\.\//, "") || "missing-main"}`;
let wrapper = "";
try {
    wrapper = await readFile(new URL(wrapperPath, root), "utf8");
} catch (error) {
    errors.push(`manifest: main could not be read (${error.message})`);
}
if (!wrapper.includes("export default class")) errors.push("wrapper: expected a default-exported class");
if (wrapper.includes("customElements.define(")) errors.push("wrapper: renderer must register the default export");

let controlsModule = "";
try {
    controlsModule = await readFile(new URL("ograf/EssentialControls.js", root), "utf8");
} catch (error) {
    errors.push(`controls: module could not be read (${error.message})`);
}
for (const token of ["of-essential-controls", "updateAction", "normalizeControls", "controlDefaults"]) {
    if (!controlsModule.includes(token)) errors.push(`controls: missing ${token}`);
}

if (manifest?.supportsNonRealTime) {
    for (const method of ["goToTime", "setActionsSchedule"]) {
        if (!wrapper.includes(`async ${method}(`)) errors.push(`wrapper: missing ${method}`);
    }
}

validateScene(await json("examples/lower-third.scene.json"), "example scene");
validateScene(await json("ograf/scene.json"), "OGraf scene");
validateScene(await json("example-basic/bin/data/scene.json"), "native example scene");
validateScene(await json("examples/feature-showcase.scene.json"), "feature showcase scene");
validateScene(await json("example-imgui/bin/data/scene.json"), "ofxImGui example scene");
await json("schema/broadcast-scene-0.2.schema.json");
await json("schema/broadcast-scene-0.3.schema.json");
const nativeDefinition = await validateTemplateDefinitionFile("examples/native-authoring/lower-third.template.json");
for (const error of nativeDefinition.errors) errors.push(`native authoring: ${error}`);
if (!nativeDefinition.valid) errors.push("native authoring: TemplateDefinition fixture is invalid");


if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
} else {
    console.log("Validated OGraf contracts, 0.2/0.3 schemas, 5 scenes, and native TemplateDefinition.");
}
