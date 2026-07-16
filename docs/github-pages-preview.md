# GitHub Pages static preview

This branch adds a GitHub Pages-friendly static preview entrypoint under `ograf/`.

## What this setup does

- keeps the browser preview at `ograf/index.html`
- works with GitHub Pages static hosting once Pages is enabled
- shows a clearer in-browser status message when the generated WASM runtime is missing

## What this setup does not do

This branch does **not** add generated browser artifacts. The preview still requires these files in `ograf/dist/`:

- `ofxOGraf.js`
- `ofxOGraf.wasm`
- `ofxOGraf.data` (if emitted by the build)

The repository currently keeps `ograf/dist/.gitkeep`, and the README notes that generated WASM artifacts are ignored.

## To make the GitHub Pages preview actually run

1. Build the Emscripten target locally:

```powershell
scripts\build-ograf.ps1
```

2. Ensure the generated files exist in `ograf/dist/`.
3. Commit or otherwise publish those generated browser artifacts.
4. Enable GitHub Pages for the branch/folder you want to serve.

Once those runtime files are present, `ograf/index.html` can be served directly by GitHub Pages.
