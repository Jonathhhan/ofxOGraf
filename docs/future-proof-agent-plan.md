# Future-proof implementation plan for agents

This document turns the long-term direction of `ofxOGraf` into ordered, independently verifiable work. It is intended for coding agents and maintainers executing repository changes.

## Product promise

An `ofxOGraf` graphic should remain portable, deterministic, inspectable, and recoverable regardless of how it was authored or whether it runs natively, in WebAssembly, or inside an OGraf renderer.

## Working rules

1. Preserve the neutral Broadcast Scene model as the center of the architecture. Treat After Effects, native C++, MOGRT, HTML, and OGraf as adapters.
2. Do not couple the scene renderer to a particular server or controller implementation.
3. Keep old scene fixtures loadable. Schema changes require migrations and compatibility tests.
4. Every new feature must state its native, WebAssembly, and HTML/OGraf behavior.
5. Prefer absolute-time, deterministic evaluation. Stateful behavior must define reset, seek, serialization, and recovery.
6. Add tests with implementation changes. Do not weaken validation to make a fixture pass.
7. Preserve unrelated work in a dirty tree. Agents should report overlapping changes before editing them.
8. Generated build artifacts remain untracked unless a task explicitly changes the release policy.

## Standard agent workflow

For each task:

1. Read this plan, the relevant schema, implementation files, tests, and renderer-support documentation.
2. Record the intended compatibility impact and affected platforms.
3. Make the smallest complete change.
4. Add or update fixtures and contract tests.
5. Run the focused tests, then the repository validation suite.
6. Update documentation and the capability matrix.
7. Report changed files, commands run, known limitations, and follow-up work.

Baseline verification:

```powershell
node scripts/validate.mjs
node tests/feature-contract.mjs
node tests/controls-contract.mjs
node tests/authoring-contract.mjs
node tests/code-template-contract.mjs
node tests/golden-frame-contract.mjs
node tests/code-template-delivery-contract.mjs
node tests/package-contract.mjs
node tests/package-integrity-contract.mjs
node tests/preflight-contract.mjs
node tests/structured-controls-contract.mjs
node tests/scene-migration-contract.mjs
node --check ograf/OfBroadcastGraphic.js
node --check ograf/EssentialControls.js
```

Run relevant native and Emscripten builds when C++, rendering, packaging, or platform behavior changes.

## Workstream 1: compatibility and migrations

Priority: P0. Complete before expanding the scene schema substantially.

Tasks:

- Publish a compatibility policy for Broadcast Scene versions.
- Add explicit migrations from every supported version to the current in-memory model.
- Add valid, invalid, deprecated, and forward-version fixtures.
- Produce structured migration diagnostics, including losses and substitutions.
- Keep serialized identifiers stable across migrations.

Acceptance criteria:

- Every committed historical scene loads or fails with a documented, structured reason.
- Migration tests prove idempotence and stable IDs.
- Unknown required extensions fail before rendering.
- `docs/renderer-support.md` identifies supported schema versions.

## Workstream 2: renderer conformance and determinism

Priority: P0. Can proceed in parallel with workstream 1 if fixtures do not overlap.

Tasks:

- Expand golden frames across native and WebAssembly.
- Cover linear, hold, Bezier, parenting, precompositions, masks, mattes, and backward seeking.
- Define tolerances for GPU and font differences.
- Test repeated load/play/update/stop/dispose cycles.
- Add fixed seeds and explicit clocks to procedural templates.

Acceptance criteria:

- Reference timestamps render within documented tolerances.
- Seeking backward reconstructs the same frame as fresh evaluation.
- Replaying a scene does not retain undeclared state.
- CI reports the layer or feature responsible for a frame mismatch.

## Workstream 3: text shaping and layout

Priority: P1. Begin after deterministic golden-frame infrastructure is reliable.

Tasks:

- Evaluate a shared shaping engine such as HarfBuzz for native and WebAssembly.
- Add complex scripts, bidirectional text, emoji, and combining-mark fixtures.
- Implement wrapping, overflow, truncation, auto-fit, and crawl measurement.
- Add font substitution and missing-glyph diagnostics.
- Define variable-font and font-licensing metadata.

Acceptance criteria:

- Text layout is deterministic for the same fonts and inputs.
- Unsupported shaping never fails silently.
- Operators receive actionable overflow and missing-font diagnostics.
- The portability matrix distinguishes exact, tolerant, and browser-dependent layout.

## Workstream 4: structured controls and live data

Priority: P1. May run in parallel with workstream 3.

Tasks:

- Add nested objects, arrays, enumerations, media references, and conditional visibility.
- Define replace, merge, and patch update semantics.
- Add transactional validation so invalid updates do not partially mutate state.
- Support repeating rows for lineups, results, weather, and tickers.
- Define controller-owned versus template-owned state.

Acceptance criteria:

- Score, ticker, and lineup fixtures use structured data without numbered field conventions.
- Invalid updates return precise paths and preserve the previous valid state.
- Restart and reconnect behavior is documented and tested.
- Backward seeking has defined behavior for live state.

## Workstream 5: portability capabilities

Priority: P1.

Tasks:

- Introduce machine-readable capability declarations.
- Report whether features are native, approximated, extension-backed, or baked.
- Add a preflight command that analyzes a scene and target platform.
- Track browser-only effects such as CSS filters explicitly.
- Extend the renderer-support matrix from prose into test-backed data.

Acceptance criteria:

- Packaging fails when a required target capability is unavailable.
- Approximation and baking decisions appear in diagnostics and provenance.
- The same capability report is available to native tools and OGraf packaging.

## Workstream 6: stable extensions

Priority: P2. Start after capability declarations stabilize.

Tasks:

- Version extension contracts for layers, effects, text engines, assets, and procedural templates.
- Separate compiler-specific C++ interfaces from any distributable ABI.
- Evaluate a versioned C ABI or serialized process boundary.
- Require capability, determinism, threading, and fallback declarations.
- Add extension compatibility and failure-isolation fixtures.

Acceptance criteria:

- Version mismatch is detected before an extension executes.
- Missing optional extensions use declared fallbacks.
- Missing required extensions fail cleanly.
- Extension failures cannot leave renderer state partially mutated.

## Workstream 7: package integrity and deployment

Priority: P2.

Tasks:

- Hash declared assets and reject undeclared runtime file access.
- Generate a package bill of materials with licenses and provenance.
- Add path normalization, duplicate detection, size limits, and offline validation.
- Design optional signing and verification without making a vendor-specific trust system part of the renderer.
- Test packages with representative OGraf renderers.

Acceptance criteria:

- Identical inputs produce equivalent package contents.
- Missing, modified, or undeclared assets are detected before playout.
- Packages operate without network access unless explicitly declared.
- Signing remains optional and separable from scene semantics.

## Workstream 8: operational resilience

Priority: P2, promoted to P1 for production deployment.

Tasks:

- Add frame-time, dropped-frame, memory, load-time, and asset diagnostics.
- Test graphics under long-running ticker, clock, and repeated-update workloads.
- Handle WebGL context loss and renderer recreation.
- Define safe fallback frames and watchdog integration points.
- Add structured error context for scene, layer, property, asset, and recovery action.

Acceptance criteria:

- Long-duration tests have bounded memory growth.
- Context recovery restores declared state.
- A failed graphic can be disposed and replaced without restarting the host.
- Diagnostics are machine-readable and operator-friendly.

## Workstream dependencies

```text
Compatibility and migrations -----> structured controls -----> stable extensions
              |                            |
              v                            v
Conformance and determinism ------> portability capabilities -> package integrity
              |
              v
Text shaping and layout ----------> operational resilience
```

Agents may work in parallel only when their file ownership and fixtures do not overlap. Schema, scene loader, and golden fixtures are high-conflict areas and should have one owner at a time.

## Milestones

### M1: compatibility foundation

Complete workstreams 1 and 2. Exit when historical schemas migrate predictably and native/WASM golden tests are dependable.

### M2: production authoring model

Complete workstreams 3, 4, and 5. Exit when complex text and structured live graphics can be preflighted for each target.

### M3: ecosystem boundary

Complete workstreams 6 and 7. Exit when third-party capabilities and packages have explicit, verifiable contracts.

### M4: on-air hardening

Complete workstream 8 and sustained load testing. Exit when failure recovery and operational telemetry are suitable for supervised production use.

## Task handoff template

Each agent should finish with:

- Objective and milestone
- Compatibility impact
- Files changed
- Fixtures and tests added
- Verification commands and results
- Native/WASM/OGraf behavior
- Known limitations
- Recommended next task
