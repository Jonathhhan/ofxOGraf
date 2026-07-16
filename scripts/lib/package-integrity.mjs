import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { join, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const INTEGRITY_FILE = "package-integrity.json";
export const BOM_FILE = "package-bom.json";
const GENERATED_FILES = new Set([INTEGRITY_FILE, BOM_FILE]);
const REMOTE_URI = /^(?:https?:)?\/\//i;
export const DEFAULT_LIMITS = Object.freeze({ maxFiles: 4096, maxFileBytes: 128 * 1024 * 1024, maxPackageBytes: 512 * 1024 * 1024 });

function portablePath(root, path) {
  return relative(root, path).split(sep).join("/");
}

async function packageFiles(root, { includeBom = true } = {}) {
  const files = [];
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const absolutePath = join(directory, entry.name);
      const packagePath = portablePath(root, absolutePath);
      if (entry.isSymbolicLink()) throw new Error(`Package symlinks are not allowed: ${packagePath}`);
      if (entry.isDirectory()) await visit(absolutePath);
      else if (entry.isFile() && packagePath !== INTEGRITY_FILE && (includeBom || packagePath !== BOM_FILE)) {
        files.push({ absolutePath, path: packagePath });
      }
    }
  }
  await visit(root);
  return files.sort((a, b) => a.path.localeCompare(b.path, "en"));
}

async function digest(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function entriesFor(root, options = {}) {
  const limits = options.limits || DEFAULT_LIMITS;
  const files = await packageFiles(root, options);
  if (files.length > limits.maxFiles) throw new Error(`Package contains ${files.length} files; limit is ${limits.maxFiles}.`);
  let packageBytes = 0;
  return Promise.all(files.map(async file => {
    const size = (await stat(file.absolutePath)).size;
    if (size > limits.maxFileBytes) throw new Error(`${file.path}: file size ${size} exceeds limit ${limits.maxFileBytes}.`);
    packageBytes += size;
    if (packageBytes > limits.maxPackageBytes) throw new Error(`Package size exceeds limit ${limits.maxPackageBytes}.`);
    return { path: file.path, size, sha256: await digest(file.absolutePath) };
  }));
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function declaredUris(document) {
  const values = [];
  function visit(value) {
    if (Array.isArray(value)) {
      for (const entry of value) visit(entry);
    } else if (value && typeof value === "object") {
      for (const [key, entry] of Object.entries(value)) {
        if (["uri", "file", "src", "url"].includes(key) && typeof entry === "string") values.push(entry);
        else visit(entry);
      }
    }
  }
  visit(document?.assets);
  return values;
}

async function readOptionalJson(path) {
  try { return JSON.parse(await readFile(path, "utf8")); }
  catch (error) { if (error?.code === "ENOENT") return null; throw error; }
}

export async function validateOfflinePackage(directory) {
  const root = resolve(directory);
  const errors = [];
  for (const name of ["scene.json", "template-definition.json"]) {
    const document = await readOptionalJson(join(root, name));
    for (const uri of declaredUris(document)) {
      if (REMOTE_URI.test(uri)) errors.push(`${name}: remote runtime asset is not allowed in an offline package: ${uri}`);
    }
  }
  const manifest = await readOptionalJson(join(root, "graphic.ograf.json"));
  const requirements = manifest?.renderRequirements || [];
  if (!requirements.some(value => value?.accessToPublicInternet?.exact === false)) {
    errors.push("graphic.ograf.json: renderRequirements must declare accessToPublicInternet.exact=false");
  }
  return errors;
}

export async function generatePackageMetadata(directory, provenance = {}, limits = DEFAULT_LIMITS) {
  const root = resolve(directory);
  const offlineErrors = await validateOfflinePackage(root);
  if (offlineErrors.length) throw new Error(offlineErrors.join("\n"));
  const graphic = await readOptionalJson(join(root, "graphic.ograf.json"));
  const definition = await readOptionalJson(join(root, "template-definition.json"));
  const packageProvenance = {
    id: graphic?.id || definition?.id || "unknown",
    version: graphic?.version || definition?.metadata?.version || "0.0.0",
    name: graphic?.name || definition?.name || "Unnamed OGraf package",
    generator: definition?.metadata?.source || null,
    targets: definition?.metadata?.targets || ["ograf"],
    ...provenance
  };
  const payload = await entriesFor(root, { includeBom: false, limits });
  const bom = {
    format: "ofxograf-package-bom",
    version: 1,
    package: packageProvenance,
    licenses: packageProvenance.licenses || definition?.metadata?.licenses || ["NOASSERTION"],
    files: payload
  };
  await writeFile(join(root, BOM_FILE), stableJson(bom), "utf8");
  const files = await entriesFor(root, { includeBom: true, limits });
  const integrity = {
    format: "ofxograf-package-integrity",
    version: 1,
    algorithm: "sha256",
    offline: true,
    limits,
    files
  };
  await writeFile(join(root, INTEGRITY_FILE), stableJson(integrity), "utf8");
  return { integrity, bom };
}

export async function verifyPackageIntegrity(directory) {
  const root = resolve(directory);
  const errors = await validateOfflinePackage(root);
  const manifest = await readOptionalJson(join(root, INTEGRITY_FILE));
  if (!manifest || manifest.format !== "ofxograf-package-integrity" || manifest.algorithm !== "sha256") {
    return { valid: false, errors: [...errors, `${INTEGRITY_FILE}: missing or unsupported integrity manifest`] };
  }
  const actual = await entriesFor(root, { includeBom: true });
  const expected = Array.isArray(manifest.files) ? manifest.files : [];
  const actualByPath = new Map(actual.map(value => [value.path, value]));
  const expectedByPath = new Map(expected.map(value => [value.path, value]));
  for (const file of expected) {
    const found = actualByPath.get(file.path);
    if (!found) errors.push(`${file.path}: missing package file`);
    else if (found.size !== file.size || found.sha256 !== file.sha256) errors.push(`${file.path}: integrity mismatch`);
  }
  for (const file of actual) if (!expectedByPath.has(file.path)) errors.push(`${file.path}: undeclared package file`);
  return { valid: errors.length === 0, errors };
}

async function main() {
  const [mode, directory] = process.argv.slice(2);
  if (!directory || !["generate", "verify"].includes(mode)) {
    throw new Error("usage: node scripts/lib/package-integrity.mjs generate|verify <package-directory>");
  }
  if ((await lstat(directory)).isSymbolicLink()) throw new Error("Package root may not be a symlink.");
  if (mode === "generate") await generatePackageMetadata(directory);
  const result = await verifyPackageIntegrity(directory);
  if (!result.valid) {
    console.error(result.errors.join("\n"));
    process.exitCode = 2;
  } else console.log(`Verified ${directory}: SHA-256 integrity and offline policy pass.`);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});