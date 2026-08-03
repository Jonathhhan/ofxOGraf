import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const verify = fileURLToPath(new URL("../scripts/verify-golden-frame.mjs", import.meta.url));
const manifest = JSON.parse(readFileSync(new URL("conformance/frames.json", import.meta.url), "utf8"));
const candidates = [
    process.env.OGRAF_FRAME_EXE,
    join(root, "example-basic", "bin", process.platform === "win32" ? "example-basic.exe" : "example-basic")
].filter(Boolean);
const executable = candidates.find(existsSync);
const requireRuntime = process.env.OGRAF_REQUIRE_RUNTIME_GOLDEN === "1";

assert.equal(manifest.schemaVersion, "1.0.0");
assert.ok(Array.isArray(manifest.fixtures) && manifest.fixtures.length > 0, "conformance manifest has no fixtures");

const fixtureIds = new Set();
for (const fixture of manifest.fixtures) {
    assert.match(fixture.id, /^[a-z0-9][a-z0-9-]*$/, "fixture id must be stable and path-safe");
    assert.ok(!fixtureIds.has(fixture.id), `duplicate fixture id: ${fixture.id}`);
    fixtureIds.add(fixture.id);
    assert.ok(Array.isArray(fixture.targets) && fixture.targets.length > 0, `${fixture.id} has no targets`);
    assert.ok(fixture.targets.every(target => target === "native" || target === "wasm"), `${fixture.id} has an unknown target`);
    assert.ok(Array.isArray(fixture.features) && fixture.features.length > 0, `${fixture.id} has no feature labels`);
    assert.ok(fixture.source?.type === "built-in" || fixture.source?.type === "scene", `${fixture.id} has an invalid source`);
    if (fixture.source.type === "built-in") {
        assert.ok(fixture.targets.includes("native"), `${fixture.id} built-in source has no native target`);
    } else {
        assert.equal(typeof fixture.source.path, "string", `${fixture.id} scene source has no path`);
        assert.ok(existsSync(join(root, fixture.source.path)), `${fixture.id} scene does not exist: ${fixture.source.path}`);
    }
    assert.ok(Array.isArray(fixture.captures) && fixture.captures.length > 0, `${fixture.id} has no captures`);
    for (const capture of fixture.captures) {
        assert.ok(Number.isFinite(capture.timeSeconds) && capture.timeSeconds >= 0, `${fixture.id} has an invalid capture time`);
        assert.ok(Number.isInteger(capture.width) && capture.width > 0, `${fixture.id} has an invalid capture width`);
        assert.ok(Number.isInteger(capture.height) && capture.height > 0, `${fixture.id} has an invalid capture height`);
        assert.ok(Number.isFinite(capture.tolerance) && capture.tolerance >= 0, `${fixture.id} has an invalid tolerance`);
        assert.ok(Number.isInteger(capture.maxDifferentPixels) && capture.maxDifferentPixels >= 0, `${fixture.id} has an invalid pixel threshold`);
        assert.equal(typeof capture.requireAlpha, "boolean", `${fixture.id} has an invalid alpha requirement`);
        assert.equal(typeof capture.golden, "string", `${fixture.id} capture has no golden path`);
        const goldenPath = join(root, capture.golden);
        assert.ok(existsSync(goldenPath), `${fixture.id} golden does not exist: ${capture.golden}`);
        const goldenHeader = readFileSync(goldenPath).subarray(0, 24);
        assert.ok(goldenHeader.length === 24 && goldenHeader.subarray(0, 8).toString("hex") === "89504e470d0a1a0a", `${fixture.id} golden is not a PNG`);
        assert.equal(goldenHeader.readUInt32BE(16), capture.width, `${fixture.id} golden width differs from manifest`);
        assert.equal(goldenHeader.readUInt32BE(20), capture.height, `${fixture.id} golden height differs from manifest`);
    }
}

if (!executable) {
    if (requireRuntime) {
        throw new Error(`No frame renderer found. Build example-basic or set OGRAF_FRAME_EXE. Searched: ${candidates.join(delimiter)}`);
    }
    console.log("SKIP runtime golden frame: build example-basic or set OGRAF_FRAME_EXE (set OGRAF_REQUIRE_RUNTIME_GOLDEN=1 in conformance CI).");
    process.exit(0);
}

const outputDirectory = mkdtempSync(join(tmpdir(), "ofxOGraf-golden-"));
try {
    for (const fixture of manifest.fixtures.filter(value => value.targets.includes("native"))) {
        const scene = fixture.source.type === "scene" ? join(root, fixture.source.path) : null;

        for (const capture of fixture.captures) {
            const suffix = String(capture.timeSeconds).replaceAll(".", "-");
            const actual = join(outputDirectory, `${fixture.id}-${suffix}.png`);
            const golden = join(root, capture.golden);
            const rendererArguments = ["--frame", actual, "--time", String(capture.timeSeconds)];
            if (scene) rendererArguments.push("--scene", scene);
            execFileSync(executable, rendererArguments, {
                cwd: join(root, "example-basic", "bin"),
                stdio: "inherit",
                timeout: 30_000
            });
            assert.ok(existsSync(actual), `renderer did not produce ${actual}`);
            const verifyArguments = [
                verify, actual, golden,
                "--tolerance", process.env.OGRAF_GOLDEN_TOLERANCE ?? String(capture.tolerance),
                "--max-different", process.env.OGRAF_GOLDEN_MAX_DIFFERENT ?? String(capture.maxDifferentPixels)
            ];
            if (capture.requireAlpha) verifyArguments.push("--require-alpha");
            execFileSync(process.execPath, verifyArguments, { stdio: "inherit" });
            console.log(`Validated ${fixture.id} at ${capture.timeSeconds}s (${fixture.features.join(", ")}).`);
        }
    }
} finally {
    rmSync(outputDirectory, { recursive: true, force: true });
}
