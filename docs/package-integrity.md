# Production package integrity

`scripts/package-ograf.ps1` creates an offline, reproducible OGraf ZIP. Before archiving it validates the staged filesystem and writes two files at the package root:

- `package-integrity.json` is the SHA-256 allowlist. It records the portable path, byte size, and digest of every payload file, including the BOM.
- `package-bom.json` records package identity, version, authoring provenance, targets, licenses, and the hashed payload inventory. Missing license metadata is represented explicitly as `NOASSERTION`.

The packager rejects declared HTTP(S) assets, requires `renderRequirements[].accessToPublicInternet.exact` to be `false`, rejects symlinks, limits packages to 4,096 files, 128 MiB per file, and 512 MiB expanded size, sorts ZIP entries, and fixes their timestamp. Identical staged inputs therefore produce byte-identical ZIP files on the same supported packaging runtime.

Create a production package:

```powershell
scripts\package-ograf.ps1 `
  -TemplateDefinition path\to\template-definition.json `
  -AssetRoot path\to\data `
  -OutputPath build\graphic.zip
```

Do not use `-AllowMissingRuntime` for deployment; it exists for contract tests and staging diagnostics.

Verify the exact ZIP received by deployment or playout:

```powershell
scripts\verify-ograf-package.ps1 build\graphic.zip
```

Verification rejects missing, modified, additional, duplicate, or path-traversal entries and re-runs the offline policy. Run it after artifact transfer and before upload to the OGraf server. SHA-256 proves package integrity against the manifest inside the ZIP; it does not establish publisher identity. Optional signing remains a separate future trust layer.