import { readFile } from "node:fs/promises";

const registryUrl = new URL("../../capabilities/renderer-capabilities.json", import.meta.url);
const builtInLayers = new Set(["text", "shape", "image", "solid", "precomposition", "precomp", "composition", "null"]);

function layersOf(scene) {
  if (Array.isArray(scene.layers)) return scene.layers;
  return (scene.compositions || []).flatMap(composition => composition.layers || []);
}

function add(features, capability, path, reason, options = {}) {
  const key = `${capability}\0${path}`;
  if (!features.some(feature => feature.key === key)) features.push({key, capability, path, reason, ...options});
}

function visit(value, callback, path = "") {
  if (Array.isArray(value)) value.forEach((entry, index) => visit(entry, callback, `${path}/${index}`));
  else if (value && typeof value === "object") {
    callback(value, path || "/");
    for (const [key, entry] of Object.entries(value)) visit(entry, callback, `${path}/${key}`);
  }
}

export function detectSceneCapabilities(scene) {
  const features = [];
  add(features, "scene.core", "/", "Broadcast Scene loading and deterministic timeline");
  const layers = layersOf(scene);
  layers.forEach((layer, index) => {
    const path = `/layers/${index}`;
    const type = String(layer.type || "unknown").toLowerCase();
    if (type === "text") add(features, "layer.text", path, "Text rendering");
    else if (type === "shape" || type === "solid") add(features, "layer.shape", path, "Vector/solid rendering");
    else if (type === "image") add(features, "layer.image", path, "Image rendering");
    else if (["precomposition", "precomp", "composition"].includes(type)) add(features, "layer.precomposition", path, "Nested composition rendering");
    else if (type !== "null" && !builtInLayers.has(type)) add(features, "extension.runtime", path, `Custom layer type: ${type}`);

    if (Array.isArray(layer.masks) && layer.masks.length) add(features, "mask.alpha", `${path}/masks`, "Layer masks");
    if (layer.trackMatteType || layer.matte || layer.isTrackMatte) add(features, "matte.alpha", path, "Track matte");
    const transformText = JSON.stringify(layer.transform || {});
    if (/orientation|rotationX|rotationY|rotationZ|ADBE Rotate [XYZ]/i.test(transformText)) {
      add(features, "layer.3d", `${path}/transform`, "3D transform");
    }

    visit(layer, (object, objectPath) => {
      if (!Array.isArray(object.effects)) return;
      object.effects.forEach((effect, effectIndex) => {
        const matchName = String(effect.matchName || effect.type || "").toLowerCase();
        const capability = /fill|tint|color/.test(matchName) ? "effect.fill-tint" : "effect.arbitrary";
        add(features, capability, `${path}${objectPath}/effects/${effectIndex}`,
          capability === "effect.arbitrary" ? `Effect requires extension or baked fallback: ${matchName || "unknown"}` : "Portable color effect",
          {fallbackEnabled: layer.fallback?.enabled === true});
      });
    });
  });

  if ((scene.controls || []).some(control => ["object", "array", "media", "json"].includes(control.type))) {
    add(features, "controls.structured", "/controls", "Structured transactional live data");
  }
  if (scene.extensions?.["cc.openframeworks.ofxograf.css-text-overlay"]) {
    add(features, "css.overlay", "/extensions/cc.openframeworks.ofxograf.css-text-overlay", "Browser CSS text overlay");
  }
  return features.map(({key, ...feature}) => feature);
}

export async function loadCapabilityRegistry() {
  return JSON.parse(await readFile(registryUrl, "utf8"));
}

export function parseProvider(value) {
  const [identity, capabilityText = ""] = value.split(":");
  const separator = identity.lastIndexOf("@");
  if (separator <= 0) throw new Error(`invalid provider '${value}', expected id@version:capability,capability`);
  return {
    id: identity.slice(0, separator),
    version: identity.slice(separator + 1),
    capabilities: new Set(capabilityText.split(",").filter(Boolean))
  };
}

export async function preflightScene(scene, {target = "wasm", providers = []} = {}) {
  const registry = await loadCapabilityRegistry();
  const targetDefinition = registry.targets[target];
  if (!targetDefinition) throw new Error(`unknown target '${target}'; choose ${Object.keys(registry.targets).join(", ")}`);
  const providerMap = new Map(providers.map(provider => [provider.id, provider]));
  const diagnostics = [];
  const features = detectSceneCapabilities(scene).map(feature => {
    const status = targetDefinition.capabilities[feature.capability] || "unavailable";
    let available = status === "exact" || status === "tolerant";
    if (status === "baked") available = feature.fallbackEnabled === true;
    if (!available) diagnostics.push({
      severity: "error",
      code: status === "baked" ? "capability.bake-required" : "capability.unavailable",
      path: feature.path,
      capability: feature.capability,
      message: `${feature.reason} is ${status} for ${target}${status === "baked" ? " and has no enabled baked fallback" : ""}.`
    });
    return {...feature, status, available};
  });

  for (const [index, requirement] of (scene.requiredExtensions || []).entries()) {
    const provider = providerMap.get(requirement.id);
    let code = "";
    let message = "";
    if (!provider) {
      code = "extension.provider-missing";
      message = `Required extension provider is missing: ${requirement.id}@${requirement.version}.`;
    } else if (provider.version !== requirement.version) {
      code = "extension.version-mismatch";
      message = `Required ${requirement.id}@${requirement.version}, received ${provider.version}.`;
    } else {
      const missing = (requirement.capabilities || []).filter(capability => !provider.capabilities.has(capability));
      if (missing.length) {
        code = "extension.capability-missing";
        message = `Provider ${requirement.id} lacks: ${missing.join(", ")}.`;
      }
    }
    if (code) diagnostics.push({severity: "error", code, path: `/requiredExtensions/${index}`, message});
  }

  const statuses = [...new Set(features.map(feature => feature.status))];
  const assetValues = Array.isArray(scene.assets) ? scene.assets : [
    ...(scene.assets?.fonts || []).map(asset => ({...asset, type: "font"})),
    ...(scene.assets?.images || []).map(asset => ({...asset, type: "image"}))
  ];
  const assets = assetValues.map(asset => ({id: asset.id || asset.postScriptName || "", type: asset.type || "unknown", uri: asset.uri || asset.file || ""}));
  const fonts = assets.filter(asset => asset.type === "font");
  return {
    schemaVersion: registry.schemaVersion,
    target,
    targetLabel: targetDefinition.label,
    compatible: !diagnostics.some(diagnostic => diagnostic.severity === "error"),
    fidelity: diagnostics.length ? "blocked" : statuses.includes("tolerant") ? "tolerant" : "exact",
    scene: {format: scene.format || "", version: scene.version || "", id: scene.id || ""},
    features,
    requiredExtensions: scene.requiredExtensions || [],
    assets,
    fonts,
    diagnostics
  };
}
