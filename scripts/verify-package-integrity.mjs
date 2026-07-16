import { verifyPackageIntegrity } from "./lib/package-integrity.mjs";

const directory = process.argv[2];
if (!directory) {
  console.error("usage: node scripts/verify-package-integrity.mjs <extracted-package-directory>");
  process.exitCode = 1;
} else {
  const result = await verifyPackageIntegrity(directory);
  if (!result.valid) {
    console.error(result.errors.join("\n"));
    process.exitCode = 2;
  } else console.log(`Verified ${directory}: SHA-256 integrity and offline policy pass.`);
}