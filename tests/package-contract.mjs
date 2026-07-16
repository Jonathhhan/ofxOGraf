import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [packager, integrity] = await Promise.all([
    readFile(new URL("scripts/package-ograf.ps1", root), "utf8"),
    readFile(new URL("scripts/lib/package-integrity.mjs", root), "utf8")
]);

for (const token of [
    "validate-template-definition.mjs",
    "--json --strict --check-assets",
    "declaredAssets",
    "template-definition.json",
    "Staged TemplateDefinition validation failed.",
    "CreateEntry",
    "preflight-scene.mjs",
    "ExtensionProvider",
    "OGraf capability preflight failed",
    "package-integrity.mjs"
]) assert.ok(packager.includes(token), `packager lacks ${token}`);

for (const token of ["package-integrity.json", "package-bom.json", "sha256", "undeclared package file"])
    assert.ok(integrity.includes(token), `integrity module lacks ${token}`);

assert.match(packager, /Where-Object \{ \$_\.Name -ne 'data' \}/,
    "descriptor packages must not copy an unfiltered data directory");
assert.match(packager, /foreach \(\$asset in \$declaredAssets\)/,
    "descriptor packages must copy the validated asset allowlist");
assert.match(packager, /Sort-Object/,
    "ZIP entries must use deterministic ordering");
assert.match(packager, /1980, 1, 1/,
    "ZIP entries must use deterministic timestamps");
assert.match(packager, /--asset-root \(Join-Path \$stage 'data'\)/,
    "the staged package must be revalidated against staged data");

console.log("Validated descriptor-driven OGraf package staging contract.");
