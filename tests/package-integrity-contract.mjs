import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generatePackageMetadata, verifyPackageIntegrity } from "../scripts/lib/package-integrity.mjs";

const directory = await mkdtemp(join(tmpdir(), "ofxograf-integrity-"));
try {
  await writeFile(join(directory, "graphic.ograf.json"), JSON.stringify({
    id: "dev.ofxograf.test-package",
    version: "1.2.3",
    name: "Integrity fixture",
    renderRequirements: [{ accessToPublicInternet: { exact: false } }]
  }));
  await writeFile(join(directory, "scene.json"), JSON.stringify({
    format: "broadcast-scene",
    version: "0.2.0",
    assets: { images: [{ id: "logo", file: "data/logo.png" }] }
  }));
  await writeFile(join(directory, "runtime.js"), "export default true;\n");

  const generated = await generatePackageMetadata(directory);
  assert.equal(generated.integrity.algorithm, "sha256");
  assert.equal(generated.integrity.offline, true);
  assert.equal(generated.bom.package.id, "dev.ofxograf.test-package");
  assert.deepEqual(generated.bom.licenses, ["NOASSERTION"]);
  assert.deepEqual(generated.integrity.files.map(file => file.path),
    [...generated.integrity.files.map(file => file.path)].sort((a, b) => a.localeCompare(b, "en")));
  assert.equal((await verifyPackageIntegrity(directory)).valid, true);

  await assert.rejects(
    generatePackageMetadata(directory, {}, { maxFiles: 2, maxFileBytes: 1024, maxPackageBytes: 4096 }),
    /files; limit is 2/
  );
  await generatePackageMetadata(directory);

  await writeFile(join(directory, "runtime.js"), "export default false;\n");
  const tampered = await verifyPackageIntegrity(directory);
  assert.equal(tampered.valid, false);
  assert.match(tampered.errors.join("\n"), /runtime\.js: integrity mismatch/);

  await writeFile(join(directory, "runtime.js"), "export default true;\n");
  await writeFile(join(directory, "undeclared.txt"), "unexpected");
  const undeclared = await verifyPackageIntegrity(directory);
  assert.match(undeclared.errors.join("\n"), /undeclared\.txt: undeclared package file/);
} finally {
  await rm(directory, { recursive: true, force: true });
}

const remoteDirectory = await mkdtemp(join(tmpdir(), "ofxograf-offline-"));
try {
  await writeFile(join(remoteDirectory, "graphic.ograf.json"), JSON.stringify({
    renderRequirements: [{ accessToPublicInternet: { exact: false } }]
  }));
  await writeFile(join(remoteDirectory, "scene.json"), JSON.stringify({
    assets: [{ id: "remote", uri: "https://example.invalid/logo.png" }]
  }));
  await assert.rejects(generatePackageMetadata(remoteDirectory), /remote runtime asset is not allowed/);
} finally {
  await rm(remoteDirectory, { recursive: true, force: true });
}

console.log("Validated deterministic package BOM, SHA-256 integrity, tamper detection, allowlist, and offline policy.");