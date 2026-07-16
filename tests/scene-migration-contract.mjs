import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const readJson = async path => JSON.parse(await readFile(new URL(path, root), "utf8"));
const [header, loader, legacy, forward, malformed, neutral] = await Promise.all([
    readFile(new URL("src/ofxOGrafSceneLoader.h", root), "utf8"),
    readFile(new URL("src/ofxOGrafSceneLoader.cpp", root), "utf8"),
    readJson("tests/fixtures/scene-version-01.json"),
    readJson("tests/fixtures/scene-version-forward.json"),
    readJson("tests/fixtures/scene-version-malformed.json"),
    readJson("tests/fixtures/scene-version-03.json")
]);

const [extensionsHeader, extensionsImplementation, graphicImplementation, migrationInspector, requiredExtension] = await Promise.all([
    readFile(new URL("src/ofxOGrafExtensions.h", root), "utf8"),
    readFile(new URL("src/ofxOGrafExtensions.cpp", root), "utf8"),
    readFile(new URL("src/ofxOGrafGraphic.cpp", root), "utf8"),
    readFile(new URL("example-basic/src/main.cpp", root), "utf8"),
    readJson("tests/fixtures/scene-required-extension.json")
]);

assert.equal(legacy.version, "0.1.0");
assert.equal(forward.version, "0.4.0");
assert.equal(malformed.version, "0.3");
assert.match(neutral.version, /^0\.3\./);
assert.ok(neutral.rootCompositionId);
assert.ok(Array.isArray(neutral.compositions));

for (const token of [
    "SceneMigrationDiagnostic", "SceneMigrationResult", "RuntimeVersion", "migrate"
]) assert.ok(header.includes(token), `missing migration API: ${token}`);

for (const token of [
    "scene.version.missing",
    "scene.version.invalid",
    "scene.version.unsupported",
    "scene.version.structure",
    "scene.migration.legacy-01",
    "scene.migration.neutral-03",
    "compileNeutral03",
    "without changing stable IDs"
]) assert.ok(loader.includes(token), `missing migration behavior: ${token}`);

assert.match(loader, /version\.minor < 1 \|\| version\.minor > 3/);
assert.match(loader, /result\.document\["version"\] = RuntimeVersion/);
assert.match(loader, /compiled\["version"\] = ofxOGraf::SceneLoader::RuntimeVersion/);
assert.match(loader, /compiled\["composition"\]\["id"\] = rootComposition\.value\("id", rootId\)/);
assert.match(loader, /const SceneMigrationResult migration = migrate\(json\)/);
assert.match(loader, /validate\(migration\.document\)/);

assert.match(migrationInspector, /response\["idempotent"\]/);
assert.match(migrationInspector, /response\["stableIdsPreserved"\]/);
assert.match(migrationInspector, /missingStableIds/);
assert.equal(requiredExtension.requiredExtensions[0].id, "dev.ofxograf.tests.missing");
assert.match(extensionsHeader, /registerProvider/);
assert.match(extensionsImplementation, /scene\.extension\.required/);
assert.match(extensionsImplementation, /scene\.extension\.version/);
assert.match(extensionsImplementation, /scene\.extension\.capability/);
assert.match(graphicImplementation, /validateRequired\(candidate\.sourceDocument\(\)\)/);
assert.match(migrationInspector, /--extension-contract-test/);
assert.match(migrationInspector, /runExtensionContract/);
assert.match(migrationInspector, /missingRejected && versionRejected && capabilityRejected && accepted/);

console.log("Validated explicit 0.1/0.2/0.3 migration policy and forward-version rejection contract.");
