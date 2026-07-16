# Broadcast Scene compatibility policy

`ofxOGraf` separates authored scene versions from its internal runtime representation. The loader owns all version detection and migration; renderers must not infer a schema version from document shape.

## Supported versions

| Authored version | Status | Loader behavior |
|---|---|---|
| 0.1.x | Deprecated, supported | Upgraded to the compatible 0.2 runtime representation with a migration diagnostic |
| 0.2.x | Supported runtime form | Loaded directly |
| 0.3.x | Current authoring form | Compiled from the neutral compositions model to the 0.2 runtime representation |
| 0.4.x and later | Unsupported until implemented | Rejected before rendering |
| Missing or malformed | Invalid | Rejected before rendering |

Patch versions within a supported minor version are accepted. Major, minor, and patch components are mandatory non-negative integers.

## Compatibility guarantees

- Existing 0.1, 0.2, and 0.3 fixtures remain loadable unless a documented security or correctness issue requires removal.
- Migration preserves stable scene, composition, layer, property, control, asset, and action identifiers.
- The original authored document remains available as `Scene::document`; `Scene::raw` contains the runtime representation.
- A migration reports a stable diagnostic code, JSON path, and operator-readable message.
- Unknown forward versions fail closed. They are never interpreted as the latest known legacy structure.
- Required extensions are validated separately and may impose narrower compatibility requirements.

## Adding a schema version

An agent adding version 0.x must:

1. Add its schema and valid, invalid, deprecated, and forward-version fixtures.
2. Add one explicit migration step into the current runtime representation.
3. Preserve stable identifiers or record every loss/substitution in migration diagnostics and provenance.
4. Add source and runtime contract tests.
5. Update this document and `docs/renderer-support.md`.
6. Prove native and WebAssembly loading and run golden-frame tests when rendering semantics change.

Do not add structural version guessing to individual renderers. Precompositions inherit the already-migrated runtime version from the root scene.
