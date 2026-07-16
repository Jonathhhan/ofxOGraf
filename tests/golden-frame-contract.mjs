import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const verify = fileURLToPath(new URL("../scripts/verify-golden-frame.mjs", import.meta.url));
const golden = fileURLToPath(new URL("golden/lower-third-0.5.png", import.meta.url));
const candidates = [
    process.env.OGRAF_FRAME_EXE,
    join(root, "example-basic", "bin", process.platform === "win32" ? "example-basic.exe" : "example-basic")
].filter(Boolean);
const executable = candidates.find(existsSync);
const requireRuntime = process.env.OGRAF_REQUIRE_RUNTIME_GOLDEN === "1";

if (!executable) {
    if (requireRuntime) {
        throw new Error(`No frame renderer found. Build example-basic or set OGRAF_FRAME_EXE. Searched: ${candidates.join(delimiter)}`);
    }
    console.log("SKIP runtime golden frame: build example-basic or set OGRAF_FRAME_EXE (set OGRAF_REQUIRE_RUNTIME_GOLDEN=1 in conformance CI).");
    process.exit(0);
}

const outputDirectory = mkdtempSync(join(tmpdir(), "ofxOGraf-golden-"));
const actual = join(outputDirectory, "lower-third-0.5.png");
try {
    execFileSync(executable, ["--frame", actual, "--time", "0.5"], {
        cwd: join(root, "example-basic", "bin"),
        stdio: "inherit",
        timeout: 30_000
    });
    if (!existsSync(actual)) throw new Error(`Renderer exited without producing ${actual}`);
    execFileSync(process.execPath, [
        verify,
        actual,
        golden,
        "--tolerance", process.env.OGRAF_GOLDEN_TOLERANCE ?? "2",
        "--max-different", process.env.OGRAF_GOLDEN_MAX_DIFFERENT ?? "2500",
        "--require-alpha"
    ], { stdio: "inherit" });
    console.log(`Validated renderer-generated RGBA Lower-third frame with ${executable}.`);
} finally {
    rmSync(outputDirectory, { recursive: true, force: true });
}
