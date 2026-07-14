import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const packager = await readFile(new URL("scripts/package-ograf.ps1", root), "utf8");

for (const token of [
    "validate-template-definition.mjs",
    "--json --strict --check-assets",
    "declaredAssets",
    "template-definition.json",
    "Staged TemplateDefinition validation failed.",
    "Compress-Archive"
]) assert.ok(packager.includes(token), `packager lacks ${token}`);

assert.match(packager, /Where-Object \{ \$_\.Name -ne 'data' \}/,
    "descriptor packages must not copy an unfiltered data directory");
assert.match(packager, /foreach \(\$asset in \$declaredAssets\)/,
    "descriptor packages must copy the validated asset allowlist");
assert.match(packager, /--asset-root \(Join-Path \$stage 'data'\)/,
    "the staged package must be revalidated against staged data");

console.log("Validated descriptor-driven OGraf package staging contract.");
