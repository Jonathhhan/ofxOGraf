export const TEMPLATE_ABI_VERSION = "ofxograf-template-abi-v1";

export function templateAbiSignature(descriptor = {}, factoryId = "") {
    const lines = [
        TEMPLATE_ABI_VERSION,
        `factory=${factoryId}`,
        `template=${typeof descriptor.id === "string" ? descriptor.id : ""}`
    ];
    for (const control of Array.isArray(descriptor.controls) ? descriptor.controls : []) {
        lines.push(`control=${typeof control?.id === "string" ? control.id : ""}:${String(control?.type || "json").toLowerCase()}`);
    }
    for (const action of Array.isArray(descriptor.actions) ? descriptor.actions : []) {
        lines.push(`action=${typeof action?.id === "string" ? action.id : ""}:${String(action?.kind || "custom").toLowerCase()}:${String(action?.playback || "once").toLowerCase()}`);
    }
    return `${lines.join("\n")}\n`;
}

export function templateAbiFingerprint(descriptor = {}, factoryId = "") {
    let hash = 0xcbf29ce484222325n;
    for (const character of new TextEncoder().encode(templateAbiSignature(descriptor, factoryId))) {
        hash ^= BigInt(character);
        hash = BigInt.asUintN(64, hash * 0x100000001b3n);
    }
    return hash.toString(16).padStart(16, "0");
}
export const BROWSER_TEMPLATE_CAPABILITIES = Object.freeze([
    "webgl2",
    "alpha-canvas"
]);

function normalizedCapabilities(values) {
    if (!Array.isArray(values)) return [];
    return [...new Set(values
        .filter(value => typeof value === "string")
        .map(value => value.trim().toLowerCase())
        .filter(Boolean))];
}

export function templateRequiredCapabilities(descriptor = {}) {
    return normalizedCapabilities(descriptor?.metadata?.rendererCapabilities?.required);
}

export function negotiateTemplateCapabilities(descriptor = {}, provided = []) {
    const required = templateRequiredCapabilities(descriptor);
    const available = normalizedCapabilities([
        ...BROWSER_TEMPLATE_CAPABILITIES,
        ...(Array.isArray(provided) ? provided : [])
    ]);
    const availableSet = new Set(available);
    return {
        required,
        available,
        missing: required.filter(capability => !availableSet.has(capability))
    };
}