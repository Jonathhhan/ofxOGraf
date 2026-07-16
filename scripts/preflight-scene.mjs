import { readFile } from "node:fs/promises";
import { parseProvider, preflightScene } from "./lib/scene-preflight.mjs";

function parseArguments(args) {
  const options = {target: "wasm", providers: [], json: false, scenePath: ""};
  for (let index = 0; index < args.length; ++index) {
    const argument = args[index];
    if (argument === "--target") options.target = args[++index] || "";
    else if (argument === "--provider") options.providers.push(parseProvider(args[++index] || ""));
    else if (argument === "--json") options.json = true;
    else if (argument.startsWith("-")) throw new Error(`unknown option: ${argument}`);
    else if (!options.scenePath) options.scenePath = argument;
    else throw new Error(`unexpected argument: ${argument}`);
  }
  if (!options.scenePath) throw new Error("usage: node scripts/preflight-scene.mjs <scene.json> [--target native|wasm|ograf] [--provider id@version:capability,...] [--json]");
  return options;
}

try {
  const options = parseArguments(process.argv.slice(2));
  const scene = JSON.parse(await readFile(options.scenePath, "utf8"));
  const report = await preflightScene(scene, options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`${report.compatible ? "PASS" : "BLOCKED"} ${options.scenePath} -> ${report.target} (${report.fidelity})`);
    for (const feature of report.features) console.log(`  ${feature.status.padEnd(11)} ${feature.capability} ${feature.path}`);
    for (const diagnostic of report.diagnostics) console.error(`  ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`);
  }
  if (!report.compatible) process.exitCode = 2;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
