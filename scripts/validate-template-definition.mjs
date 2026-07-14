import { access, readFile, stat } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const FORMAT = "ofxograf-template-definition";
const FORMAT_VERSION = "0.1.0";
const STABLE_ID = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;
const CUSTOM_ELEMENT_ID = /^[a-z][.0-9_a-z-]*-[.0-9_a-z-]*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const FACTORY_NAME = /^[A-Za-z_][A-Za-z0-9_:]*$/;
const CAPABILITY_ID = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/;
const CONTROL_TYPES = new Set(["string", "boolean", "integer", "number", "color", "vector", "enum", "json"]);
const TARGETS = new Set(["native", "wasm", "ograf"]);
const SOURCE_KINDS = new Set(["scene-builder", "code-template"]);
const STANDARD_ACTIONS = ["playAction", "updateAction", "stopAction"];
const ASSET_TYPES = new Set(["font", "image", "shader", "audio", "video", "data", "sequence"]);
const FORBIDDEN_KEYS = new Set(["__proto__", "prototype", "constructor"]);
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function isObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function printable(value) {
    try { return JSON.stringify(value); } catch { return String(value); }
}

function portableAssetPath(value) {
    const errors = [];
    if (typeof value !== "string" || !value.length) return { errors: ["must be a non-empty string"] };
    if (value !== value.normalize("NFC")) errors.push("must use Unicode NFC normalization");
    if (value.includes("\\")) errors.push("must use '/' separators, not backslashes");
    if (value.includes("%") || value.includes("?") || value.includes("#")) {
        errors.push("must not contain URL escaping, a query, or a fragment");
    }
    if (/^[A-Za-z][A-Za-z0-9+.-]*:/.test(value) || value.startsWith("//")) {
        errors.push("must not be a URL");
    }
    if (path.posix.isAbsolute(value) || path.win32.isAbsolute(value)) errors.push("must be relative");
    if (value.includes("\0")) errors.push("must not contain NUL bytes");

    const segments = value.split("/");
    if (segments.some(segment => !segment || segment === "." || segment === "..")) {
        errors.push("must not contain empty, '.' or '..' segments");
    }
    for (const segment of segments) {
        if (segment.endsWith(".") || segment.endsWith(" ")) {
            errors.push(`segment ${printable(segment)} must not end in a dot or space`);
        }
        if (WINDOWS_RESERVED.test(segment)) {
            errors.push(`segment ${printable(segment)} is reserved on Windows`);
        }
    }
    return { errors, normalized: segments.join("/") };
}

function scanForbiddenKeys(value, location, errors, depth = 0) {
    if (depth > 64) {
        errors.push(`${location}: nesting exceeds 64 levels`);
        return;
    }
    if (Array.isArray(value)) {
        value.forEach((entry, index) => scanForbiddenKeys(entry, `${location}[${index}]`, errors, depth + 1));
    } else if (isObject(value)) {
        for (const [key, entry] of Object.entries(value)) {
            if (FORBIDDEN_KEYS.has(key)) errors.push(`${location}: forbidden key ${printable(key)}`);
            scanForbiddenKeys(entry, `${location}.${key}`, errors, depth + 1);
        }
    }
}
function normalizeCodeTemplateContract(definition, errors) {
    if (definition.contract === undefined) return definition;
    if (definition.contract !== "ofxograf-code-template") {
        errors.push("contract: expected \"ofxograf-code-template\"");
    }
    if (definition.contractVersion !== 1) errors.push("contractVersion: expected 1");

    const metadata = isObject(definition.metadata) ? definition.metadata : {};
    if (!isObject(definition.metadata)) errors.push("metadata: delivery metadata is required");
    const composition = isObject(definition.composition) ? definition.composition : {};
    if (!isObject(definition.composition)) errors.push("composition: must be an object");
    if (!Number.isSafeInteger(definition.randomSeed) || definition.randomSeed < 0) {
        errors.push("randomSeed: must be a non-negative safe integer for native/JavaScript parity");
    }

    const controlType = {
        boolean: "boolean",
        integer: "integer",
        number: "number",
        string: "string",
        color: "color",
        vector2: "vector",
        vector3: "vector",
        json: "json"
    };
    const controls = (Array.isArray(definition.controls) ? definition.controls : []).map((control, index) => {
        if (!isObject(control)) return control;
        let type = controlType[control.type] || control.type;
        if (Array.isArray(control.options) && control.options.length) type = "enum";
        const normalized = { ...control, name: control.label, type };
        if (control.type === "vector2") normalized.dimensions = 2;
        if (control.type === "vector3") normalized.dimensions = 3;
        if (!controlType[control.type]) errors.push("controls[" + index + "].type: unsupported C++ control type");
        return normalized;
    });

    const assets = (Array.isArray(definition.assets) ? definition.assets : []).map(asset => {
        if (!isObject(asset)) return asset;
        return {
            ...asset,
            type: asset.kind === "other" ? "x-other" : asset.kind,
            path: asset.uri
        };
    });

    const actionKinds = new Set(["in", "hold", "update", "out", "custom"]);
    const playbacks = new Set(["once", "loop", "hold-last-frame"]);
    const actionIds = new Set();
    const actionTypes = { in: "playAction", update: "updateAction", out: "stopAction" };
    const duration = composition.duration;
    const sourceActions = Array.isArray(definition.actions) ? definition.actions : [];
    for (const [index, action] of sourceActions.entries()) {
        const location = "actions[" + index + "]";
        if (!isObject(action)) {
            errors.push(location + ": must be an object");
            continue;
        }
        if (typeof action.id !== "string" || !STABLE_ID.test(action.id)) errors.push(location + ".id: must be a stable lowercase id");
        else if (actionIds.has(action.id)) errors.push(location + ".id: duplicate action id " + printable(action.id));
        else actionIds.add(action.id);
        if (!actionKinds.has(action.kind)) errors.push(location + ".kind: invalid action kind");
        if (!playbacks.has(action.playback)) errors.push(location + ".playback: invalid playback mode");
        if (!isFiniteNumber(action.start) || action.start < 0) errors.push(location + ".start: must be non-negative and finite");
        if (!isFiniteNumber(action.duration) || action.duration < 0) errors.push(location + ".duration: must be non-negative and finite");
        if (isFiniteNumber(duration) && isFiniteNumber(action.start) && isFiniteNumber(action.duration) &&
            action.start + action.duration > duration + 1e-9) {
            errors.push(location + ": action exceeds composition duration");
        }
    }
    const actions = {
        stepCount: metadata.stepCount,
        durations: sourceActions.map(action => ({
            type: actionTypes[action?.kind] || ("customAction:" + (action?.id || "invalid")),
            duration: action?.duration
        }))
    };

    return {
        format: FORMAT,
        formatVersion: FORMAT_VERSION,
        id: definition.id,
        version: metadata.version,
        name: definition.name,
        source: {
            ...metadata.source,
            kind: metadata.source?.kind === "code" ? "code-template" : metadata.source?.kind
        },
        targets: metadata.targets,
        render: {
            width: composition.width,
            height: composition.height,
            frameRate: composition.frameRate,
            pixelAspect: metadata.pixelAspect ?? 1,
            alpha: metadata.alpha,
            supportsRealTime: metadata.supportsRealTime,
            supportsNonRealTime: metadata.supportsNonRealTime
        },
        controls,
        actions,
        assets,
        rendererCapabilities: metadata.rendererCapabilities
    };
}

function validateControl(control, location, errors) {
    if (!isObject(control)) {
        errors.push(`${location}: must be an object`);
        return;
    }
    if (typeof control.id !== "string" || !STABLE_ID.test(control.id)) {
        errors.push(`${location}.id: must be a stable lowercase id (${STABLE_ID})`);
    }
    if (typeof control.name !== "string" || !control.name.trim()) errors.push(`${location}.name: must be non-empty`);
    if (!CONTROL_TYPES.has(control.type)) {
        errors.push(`${location}.type: expected one of ${[...CONTROL_TYPES].join(", ")}`);
        return;
    }
    if (!Object.hasOwn(control, "default")) {
        errors.push(`${location}.default: is required so native, WASM, and manifest defaults cannot drift`);
        return;
    }

    const value = control.default;
    if (control.type === "string" && typeof value !== "string") errors.push(`${location}.default: must be a string`);
    if (control.type === "boolean" && typeof value !== "boolean") errors.push(`${location}.default: must be Boolean`);
    if (control.type === "integer" && !Number.isInteger(value)) errors.push(`${location}.default: must be an integer`);
    if (control.type === "number" && !isFiniteNumber(value)) errors.push(`${location}.default: must be a finite number`);
    if (control.type === "color") {
        if (!Array.isArray(value) || ![3, 4].includes(value.length) || value.some(channel => !isFiniteNumber(channel) || channel < 0 || channel > 1)) {
            errors.push(`${location}.default: color must have 3 or 4 finite channels in the range 0..1`);
        }
    }
    if (control.type === "vector") {
        if (!Array.isArray(value) || value.length < 2 || value.length > 4 || value.some(component => !isFiniteNumber(component))) {
            errors.push(`${location}.default: vector must have 2 to 4 finite components`);
        }
        if (control.dimensions !== undefined && (!Number.isInteger(control.dimensions) || control.dimensions < 2 || control.dimensions > 4)) {
            errors.push(`${location}.dimensions: must be an integer from 2 to 4`);
        } else if (Number.isInteger(control.dimensions) && Array.isArray(value) && value.length !== control.dimensions) {
            errors.push(`${location}.default: component count must equal dimensions (${control.dimensions})`);
        }
    }
    if (control.type === "enum") {
        if (!Array.isArray(control.options) || !control.options.length) {
            errors.push(`${location}.options: enum controls require at least one option`);
        } else {
            const values = control.options.map(option => isObject(option) ? option.value : option);
            const keys = values.map(option => JSON.stringify(option));
            if (new Set(keys).size !== keys.length) errors.push(`${location}.options: option values must be unique`);
            if (!keys.includes(JSON.stringify(value))) errors.push(`${location}.default: must match an enum option value`);
            control.options.forEach((option, index) => {
                if (isObject(option) && (typeof option.label !== "string" || !option.label.trim())) {
                    errors.push(`${location}.options[${index}].label: must be non-empty`);
                }
            });
        }
    }

    const numeric = control.type === "number" || control.type === "integer";
    for (const field of ["min", "max", "step"]) {
        if (control[field] !== undefined && (!numeric || !isFiniteNumber(control[field]))) {
            errors.push(`${location}.${field}: is valid only as a finite number on numeric controls`);
        }
    }
    if (numeric) {
        if (isFiniteNumber(control.min) && isFiniteNumber(control.max) && control.min > control.max) {
            errors.push(`${location}: min must not exceed max`);
        }
        if (isFiniteNumber(control.step) && control.step <= 0) errors.push(`${location}.step: must be greater than zero`);
        if (isFiniteNumber(value) && isFiniteNumber(control.min) && value < control.min) errors.push(`${location}.default: is below min`);
        if (isFiniteNumber(value) && isFiniteNumber(control.max) && value > control.max) errors.push(`${location}.default: is above max`);
        if (control.type === "integer" && [control.min, control.max, control.step].some(entry => entry !== undefined && !Number.isInteger(entry))) {
            errors.push(`${location}: integer min, max, and step must also be integers`);
        }
    }
}

function validateActions(actions, errors) {
    if (!isObject(actions)) {
        errors.push("actions: must be an object");
        return;
    }
    if (!Number.isInteger(actions.stepCount) || actions.stepCount < 1) {
        errors.push("actions.stepCount: must be an integer of at least 1");
    }
    if (!Array.isArray(actions.durations)) {
        errors.push("actions.durations: must be an array");
        return;
    }
    const types = new Set();
    actions.durations.forEach((entry, index) => {
        const location = `actions.durations[${index}]`;
        if (!isObject(entry)) {
            errors.push(`${location}: must be an object`);
            return;
        }
        if (typeof entry.type !== "string" || !entry.type) errors.push(`${location}.type: must be non-empty`);
        else if (types.has(entry.type)) errors.push(`${location}.type: duplicate action ${printable(entry.type)}`);
        else types.add(entry.type);
        if (!isFiniteNumber(entry.duration) || entry.duration < -1) {
            errors.push(`${location}.duration: must be -1 (indefinite) or a non-negative finite number`);
        }
    });
    for (const type of STANDARD_ACTIONS) {
        if (!types.has(type)) errors.push(`actions.durations: missing standard action ${type}`);
    }
}

function validateAssets(assets, errors) {
    if (!Array.isArray(assets)) {
        errors.push("assets: must be an array");
        return [];
    }
    const ids = new Set();
    const files = [];
    assets.forEach((asset, index) => {
        const location = `assets[${index}]`;
        if (!isObject(asset)) {
            errors.push(`${location}: must be an object`);
            return;
        }
        if (typeof asset.id !== "string" || !STABLE_ID.test(asset.id)) {
            errors.push(`${location}.id: must be a stable lowercase id (${STABLE_ID})`);
        } else if (ids.has(asset.id)) errors.push(`${location}.id: duplicate asset id ${printable(asset.id)}`);
        else ids.add(asset.id);

        if (!ASSET_TYPES.has(asset.type) && !(typeof asset.type === "string" && asset.type.startsWith("x-"))) {
            errors.push(`${location}.type: expected a known type or an x- extension type`);
        }
        const hasPath = Object.hasOwn(asset, "path");
        const hasFiles = Object.hasOwn(asset, "files");
        if (hasPath === hasFiles) {
            errors.push(`${location}: declare exactly one of path or files`);
            return;
        }
        const declared = hasPath ? [asset.path] : asset.files;
        if (!Array.isArray(declared) || !declared.length) {
            errors.push(`${location}.files: must be a non-empty array`);
            return;
        }
        if (hasFiles && asset.type !== "sequence" && asset.type !== "shader") {
            errors.push(`${location}.files: multiple files are supported only for sequence and shader assets`);
        }
        declared.forEach((assetPath, fileIndex) => {
            const pathLocation = hasPath ? `${location}.path` : `${location}.files[${fileIndex}]`;
            const checked = portableAssetPath(assetPath);
            checked.errors.forEach(message => errors.push(`${pathLocation}: ${message}`));
            if (!checked.errors.length) files.push({ id: asset.id, type: asset.type, path: checked.normalized, location: pathLocation });
        });
    });

    const destinations = new Map();
    for (const file of files) {
        const folded = file.path.normalize("NFC").toLocaleLowerCase("en-US");
        if (destinations.has(folded)) {
            errors.push(`${file.location}: collides with ${destinations.get(folded).location} on a case-insensitive filesystem`);
        } else destinations.set(folded, file);
    }
    for (const [destination, file] of destinations) {
        const segments = destination.split("/");
        for (let length = 1; length < segments.length; length += 1) {
            const prefix = segments.slice(0, length).join("/");
            if (destinations.has(prefix)) {
                errors.push(`${file.location}: file/directory collision with ${destinations.get(prefix).location}`);
                break;
            }
        }
    }
    return files;
}

export function validateTemplateDefinition(definition, { label = "template definition" } = {}) {
    const errors = [];
    const warnings = [];
    const assets = [];
    if (!isObject(definition)) return { valid: false, errors: [`${label}: root must be an object`], warnings, assets, normalized: null };
    scanForbiddenKeys(definition, label, errors);
    definition = normalizeCodeTemplateContract(definition, errors);

    if (definition.format !== FORMAT) errors.push(`format: expected ${printable(FORMAT)}`);
    if (definition.formatVersion !== FORMAT_VERSION) errors.push(`formatVersion: expected ${printable(FORMAT_VERSION)}`);
    if (typeof definition.id !== "string" || !CUSTOM_ELEMENT_ID.test(definition.id)) {
        errors.push("id: must be a lowercase custom-element id containing a hyphen");
    }
    if (typeof definition.version !== "string" || !SEMVER.test(definition.version)) errors.push("version: must be semantic versioning");
    if (typeof definition.name !== "string" || !definition.name.trim()) errors.push("name: must be non-empty");

    if (!isObject(definition.source) || !SOURCE_KINDS.has(definition.source.kind)) {
        errors.push(`source.kind: expected one of ${[...SOURCE_KINDS].join(", ")}`);
    }
    if (!isObject(definition.source) || typeof definition.source.factory !== "string" || !FACTORY_NAME.test(definition.source.factory)) {
        errors.push("source.factory: must be a stable C++ factory name");
    }

    if (!Array.isArray(definition.targets) || !definition.targets.length) errors.push("targets: must be a non-empty array");
    const targets = new Set();
    for (const [index, target] of (Array.isArray(definition.targets) ? definition.targets : []).entries()) {
        if (!TARGETS.has(target)) errors.push(`targets[${index}]: expected one of ${[...TARGETS].join(", ")}`);
        if (targets.has(target)) errors.push(`targets[${index}]: duplicate target ${printable(target)}`);
        targets.add(target);
    }

    const render = definition.render;
    if (!isObject(render)) errors.push("render: must be an object");
    else {
        if (!Number.isInteger(render.width) || render.width < 1) errors.push("render.width: must be a positive integer");
        if (!Number.isInteger(render.height) || render.height < 1) errors.push("render.height: must be a positive integer");
        if (!isFiniteNumber(render.frameRate) || render.frameRate <= 0) errors.push("render.frameRate: must be greater than zero");
        if (render.pixelAspect !== undefined && (!isFiniteNumber(render.pixelAspect) || render.pixelAspect <= 0)) {
            errors.push("render.pixelAspect: must be greater than zero");
        }
        for (const field of ["alpha", "supportsRealTime", "supportsNonRealTime"]) {
            if (typeof render[field] !== "boolean") errors.push(`render.${field}: must be Boolean`);
        }
    }

    if (!Array.isArray(definition.controls)) errors.push("controls: must be an array");
    const controlIds = new Set();
    for (const [index, control] of (Array.isArray(definition.controls) ? definition.controls : []).entries()) {
        validateControl(control, `controls[${index}]`, errors);
        if (typeof control?.id === "string") {
            if (controlIds.has(control.id)) errors.push(`controls[${index}].id: duplicate control id ${printable(control.id)}`);
            controlIds.add(control.id);
        }
    }

    validateActions(definition.actions, errors);
    assets.push(...validateAssets(definition.assets, errors));

    const capabilities = definition.rendererCapabilities;
    if (!isObject(capabilities)) errors.push("rendererCapabilities: must be an object");
    else {
        const allCapabilities = new Set();
        for (const group of ["required", "optional"]) {
            if (!Array.isArray(capabilities[group])) {
                errors.push(`rendererCapabilities.${group}: must be an array`);
                continue;
            }
            capabilities[group].forEach((capability, index) => {
                const location = `rendererCapabilities.${group}[${index}]`;
                if (typeof capability !== "string" || !CAPABILITY_ID.test(capability)) errors.push(`${location}: invalid capability id`);
                else if (allCapabilities.has(capability)) errors.push(`${location}: capability is duplicated across required/optional lists`);
                else allCapabilities.add(capability);
            });
        }
        if ((targets.has("wasm") || targets.has("ograf")) && !capabilities.required?.includes("webgl2")) {
            errors.push("rendererCapabilities.required: webgl2 is required for WASM/OGraf targets");
        }
    }

    return { valid: errors.length === 0, errors, warnings, assets, normalized: definition };
}

export async function validateTemplateDefinitionFile(filePath, { checkAssets = false, assetRoot } = {}) {
    const absolutePath = path.resolve(filePath);
    let definition;
    try {
        definition = JSON.parse(await readFile(absolutePath, "utf8"));
    } catch (error) {
        return { file: absolutePath, valid: false, errors: [`${absolutePath}: ${error.message}`], warnings: [], assets: [], normalized: null };
    }
    const result = validateTemplateDefinition(definition, { label: absolutePath });
    const root = path.resolve(assetRoot || path.dirname(absolutePath));
    const resolvedAssets = result.assets.map(asset => ({ ...asset, absolutePath: path.resolve(root, ...asset.path.split("/")) }));
    if (checkAssets) {
        for (const asset of resolvedAssets) {
            const relative = path.relative(root, asset.absolutePath);
            if (relative.startsWith("..") || path.isAbsolute(relative)) {
                result.errors.push(`${asset.location}: resolves outside asset root`);
                continue;
            }
            try {
                await access(asset.absolutePath, fsConstants.R_OK);
                if (!(await stat(asset.absolutePath)).isFile()) throw new Error("not a regular file");
            } catch {
                result.errors.push(`${asset.location}: file is not a readable regular file at ${asset.absolutePath}`);
            }
        }
    }
    return { file: absolutePath, ...result, valid: result.errors.length === 0, assets: resolvedAssets };
}

function parseArguments(argv) {
    const options = { checkAssets: false, strict: false, json: false, assetRoot: undefined, files: [] };
    for (let index = 0; index < argv.length; index += 1) {
        const argument = argv[index];
        if (argument === "--check-assets") options.checkAssets = true;
        else if (argument === "--strict") options.strict = true;
        else if (argument === "--json") options.json = true;
        else if (argument === "--asset-root") {
            if (!argv[index + 1]) throw new Error("--asset-root requires a directory");
            options.assetRoot = argv[++index];
        } else if (argument === "--help" || argument === "-h") options.help = true;
        else if (argument.startsWith("-")) throw new Error(`Unknown option ${argument}`);
        else options.files.push(argument);
    }
    return options;
}

async function main(argv) {
    const options = parseArguments(argv);
    if (options.help) {
        console.log("Usage: node scripts/validate-template-definition.mjs [--check-assets] [--asset-root DIR] [--strict] [--json] [FILE ...]");
        return;
    }
    if (!options.files.length) options.files.push("examples/native-authoring/lower-third.template.json");
    const results = [];
    for (const file of options.files) results.push(await validateTemplateDefinitionFile(file, options));
    const valid = results.every(result => result.valid && (!options.strict || !result.warnings.length));
    if (options.json) {
        console.log(JSON.stringify({ valid, results }, null, 2));
    } else {
        for (const result of results) {
            for (const error of result.errors) console.error(`${result.file}: ${error}`);
            for (const warning of result.warnings) console.warn(`${result.file}: warning: ${warning}`);
            if (!result.errors.length) console.log(`Validated TemplateDefinition: ${result.file} (${result.assets.length} declared files).`);
        }
    }
    if (!valid) process.exitCode = 1;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
    main(process.argv.slice(2)).catch(error => {
        console.error(error.message);
        process.exitCode = 1;
    });
}
