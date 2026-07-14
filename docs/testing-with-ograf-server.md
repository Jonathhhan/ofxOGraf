# Testing with SuperFlyTV's OGraf server

The [SuperFlyTV OGraf Simple Rendering System](https://github.com/SuperFlyTV/ograf-server) is a useful integration target for this addon. It provides a browser renderer, ZIP upload endpoint, and controller UI. Its repository explicitly describes the Server/Control API as unstable, so `ofxOGraf` only targets the stable Graphics v1 interface.

## Important compatibility conventions

- Upload a ZIP containing the `.ograf.json` manifest and all referenced resources.
- Keep `graphic.ograf.json` at the ZIP root for the simplest layout.
- The manifest `main` path is loaded with a dynamic JavaScript `import()`.
- `main` must default-export the custom-element class.
- Do not register that class from the module. The server renderer registers it using the manifest `id` as the custom-element name.
- The manifest `id` must therefore be a valid lowercase custom-element name containing a hyphen. The included `com.jonathan-frank.ofx-ograf-broadcast-graphic` id satisfies this requirement.
- The WASM, generated JS, scene, fonts, images, and other runtime assets must all be inside the ZIP.

## Build and package

After producing the Emscripten artifacts described in the main README:

```powershell
scripts\package-ograf.ps1
```

This creates `build/ofxOGraf-graphic.zip` and fails when the manifest, scene, generated JavaScript, or WASM file is missing. During wrapper-only development, a structure-only ZIP can be made with:

```powershell
scripts\package-ograf.ps1 -AllowMissingRuntime
```

That archive is not renderable until the runtime artifacts are added.

## Run the reference server

Follow the server repository's current instructions:

```powershell
corepack enable
yarn install
yarn build
yarn dev
```

The main application is normally at `http://localhost:8080` and the controller at `http://localhost:8082`. Use **Upload Graphic** in the controller and select the generated ZIP. The renderer currently invokes real-time `load`, `playAction`, `updateAction`, `stopAction`, `customAction`, and `dispose`; it does not exercise the non-real-time methods.

## Scope boundary

Keep code for the draft server endpoints out of `src/` and the OGraf Web Component. If automated upload or control is added later, place it in a separate development adapter so server API changes do not affect the portable scene runtime.
