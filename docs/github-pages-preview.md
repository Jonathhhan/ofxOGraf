# GitHub Pages static preview

This branch adds a GitHub Pages-friendly static preview entrypoint under `ograf/` and a first-pass GitHub Actions workflow at `.github/workflows/pages.yml`.

## What this setup does

- keeps the browser preview at `ograf/index.html`
- deploys the `ograf/` directory to GitHub Pages
- attempts to build the Emscripten browser artifacts on GitHub Actions using `windows-latest`
- shows a clearer in-browser status message when the generated WASM runtime is missing

## What may still need adjustment

This repository's browser build depends on openFrameworks plus Emscripten. The workflow is a best-effort CI setup and may need follow-up fixes if:

- the expected openFrameworks checkout layout differs from the workflow assumption
- extra toolchain dependencies are required on `windows-latest`
- the openFrameworks Emscripten build expects additional environment variables or scripts
- asset packaging depends on files not available in CI by default

## Workflow file

- `.github/workflows/pages.yml`

The workflow currently:

1. checks out this repository
2. checks out `openframeworks/openFrameworks`
3. installs `emsdk` 4.0.12
4. installs GNU Make
5. runs:

```powershell
scripts\build-ograf.ps1
```

6. uploads `ograf/` to GitHub Pages

## To make the GitHub Pages preview actually run

1. Push this branch.
2. Let the `pages.yml` workflow run.
3. If the build job fails, inspect the Actions logs and tune the workflow.
4. In repository settings, enable GitHub Pages to use GitHub Actions as the source.

If the CI build succeeds, GitHub Pages should serve the browser preview directly from the generated `ograf/` payload.
