import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const verify = fileURLToPath(new URL("../scripts/verify-golden-frame.mjs", import.meta.url));
const golden = fileURLToPath(new URL("golden/lower-third-0.5.png", import.meta.url));
execFileSync(process.execPath, [verify, golden, golden, "--tolerance", "0", "--max-different", "0", "--require-alpha"], { stdio: "inherit" });
console.log("Validated deterministic RGBA lower-third golden frame.");
