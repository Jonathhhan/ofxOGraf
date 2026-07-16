# Structured controls and transactional updates

Broadcast Scene 0.3 controls may use scalar types plus `object`, `array`, `media`, and `json`. Enum controls declare `options`; `visibleWhen` describes operator UI visibility without changing stored state.

Object and array controls may include a compact JSON-style `schema` with `type`, `required`, `properties`, and nested `items`:

```json
{
  "id": "rows",
  "name": "Results",
  "type": "array",
  "default": [],
  "schema": {
    "type": "array",
    "items": {
      "type": "object",
      "required": ["id", "label", "score"],
      "properties": {
        "id": {"type": "string"},
        "label": {"type": "string"},
        "score": {"type": "integer"}
      }
    }
  },
  "visibleWhen": {"controlId": "phase", "equals": "live"},
  "bindings": [],
  "ui": {},
  "extensions": {}
}
```

## Transaction contract

`Graphic::updateData` applies JSON Merge Patch semantics to a temporary candidate. The complete candidate is validated before it replaces current data or reaches the renderer.

- Success returns `true` and commits the complete candidate.
- Failure returns `false`, preserves the previous state, and exposes a path-bearing error through `getLastError()`.
- A missing nested field reports a path such as `/rows/0/label`.
- Native and Emscripten use the same C++ validation path.
- The OGraf adapter returns the WASM update result to its controller.

Controllers should treat one update call as one transaction. Do not split a scoreboard or lineup change into independently visible field updates when the fields must remain consistent.
