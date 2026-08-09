# Canonical OGraf package example

This is the smallest end-to-end host harness for the compiled `NativeLowerThird` CodeTemplate. It deliberately reuses the production package entry point in `ograf/` instead of copying the C++ template, descriptor, JavaScript lifecycle, or WASM runtime.

## Build and run

From the addon root:

```powershell
scripts\build-ograf.ps1
python -m http.server 8080
```

Open `http://localhost:8080/example-ograf-package/`.

The page executes the real browser lifecycle in order:

1. `load()` creates the WebAssembly runtime and validates the template ABI.
2. `playAction()` runs the authored entrance segment.
3. `updateAction()` changes headline, subtitle, and accent color.
4. `stopAction()` runs the authored exit segment.
5. `dispose()` releases the runtime.

The visible result is also published as `window.__ofxOGrafExampleResult` so browser automation can distinguish a complete pass from a page that merely loaded.

This harness proves the packaged component in a normal browser. Uploading `build/ofxOGraf-graphic.zip` to a third-party OGraf Host remains the separate interoperability check described in `docs/testing-with-ograf-server.md`.

GitHub Actions runs the same page in headless Chromium after the Emscripten build. The workflow fails unless all five lifecycle methods return status `200`; traces and screenshots are retained when the browser test fails.
