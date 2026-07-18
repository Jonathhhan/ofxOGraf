import createOfxOGrafModule from "./dist/ofxOGraf.js";
import { negotiateTemplateCapabilities, templateAbiFingerprint } from "./TemplateAbi.js";
import CssTextOverlay from "./CssTextOverlay-v2.js";

export default class OfBroadcastGraphic extends HTMLElement {
    constructor() {
        super();
        this.module = null;
        this.backend = "scene";
        this.scene = null;
        this.data = {};
        this.initialData = {};
        this.currentStep = undefined;
        this.stepCount = 1;
        this.schedule = [];
        this.appliedScheduleIndex = 0;
        this.canvas = document.createElement("canvas");
        this.canvas.id = "canvas";
        this.canvas.width = 1920;
        this.canvas.height = 1080;
        this.canvas.style.cssText = "display:block;width:100%;height:100%;background:transparent";
        this.style.position ||= "relative";
        this.style.overflow ||= "hidden";
        this.appendChild(this.canvas);
        this.cssTextOverlay = new CssTextOverlay(this);
    }

    async load({ data = {}, renderType = "realtime", renderCharacteristics = {} } = {}) {
        if (this.module) await this.dispose({});
        const templateId = this.getAttribute("code-template");
        const sceneUrl = templateId ? (this.getAttribute("template-definition") || "./template-definition.json") :
            (this.getAttribute("scene") || "./scene.json");
        const response = await fetch(sceneUrl);
        if (!response.ok) return { statusCode: response.status, statusMessage: `Could not load ${sceneUrl}` };
        const scene = await response.json();
        const composition = this.compositionInfo(scene);
        if (!composition) return { statusCode: 422, statusMessage: "Scene has no root composition" };
        const capabilityCheck = negotiateTemplateCapabilities(scene, renderCharacteristics.capabilities);
        if (capabilityCheck.missing.length) {
            return {
                statusCode: 422,
                statusMessage: `Renderer capabilities unavailable: ${capabilityCheck.missing.join(", ")}`
            };
        }
        const resolution = renderCharacteristics.resolution || composition;
        this.canvas.width = resolution.width || composition.width;
        this.canvas.height = resolution.height || composition.height;
        this.module = await createOfxOGrafModule({
            canvas: this.canvas,
            locateFile: path => {
                if (path === "index.wasm") return new URL("./dist/ofxOGraf.wasm", import.meta.url).href;
                if (path === "index.data") return new URL("./dist/ofxOGraf.data", import.meta.url).href;
                return path;
            }
        });
        if (!await this.waitForRuntimeReady()) {
            this.module.exit?.();
            this.module = null;
            return { statusCode: 503, statusMessage: "The openFrameworks runtime did not become ready" };
        }
        if (templateId) {
            const expectedAbi = templateAbiFingerprint(scene, templateId);
            const actualAbi = this.module.getCodeTemplateAbiFingerprint?.(templateId);
            if (!actualAbi || actualAbi !== expectedAbi) {
                this.module.exit?.();
                this.module = null;
                return {
                    statusCode: 422,
                    statusMessage: `Code template ABI mismatch for ${templateId}: expected ${expectedAbi}, got ${actualAbi || "unavailable"}`
                };
            }
        }
        this.scene = scene;
        this.backend = templateId ? "code-template" : "scene";
        const loaded = templateId ? this.module.loadCodeTemplate(templateId, JSON.stringify(data)) :
            this.module.loadGraphic(JSON.stringify(scene));
        if (!loaded) {
            const message = this.module.getLastError?.() || "Invalid scene";
            this.module.exit?.();
            this.module = null;
            return { statusCode: 422, statusMessage: message };
        }
        const resolvedData = this.mergePatch(this.sceneDefaults(scene), data);
        this.initialData = structuredClone(resolvedData);
        this.data = structuredClone(resolvedData);
        if (!this.updateRuntime(this.data, true)) {
            const message = this.module.getLastError?.() || "Could not apply template defaults";
            this.module.exit?.();
            this.module = null;
            return { statusCode: 422, statusMessage: message };
        }
        try {
            await this.cssTextOverlay.load(scene, composition);
            this.cssTextOverlay.update(this.data);
        } catch (error) {
            const message = `Could not load CSS text overlay: ${error?.message || error}`;
            await this.dispose();
            return { statusCode: 422, statusMessage: message };
        }
        this.renderType = renderType;
        this.dispatchState("ograf-ready");
        return { statusCode: 200, statusMessage: "OK" };
    }

    async playAction({ goto, delta = 1, skipAnimation = false } = {}) {
        this.ensureLoaded();
        const target = goto !== undefined ? goto : (this.currentStep ?? -1) + delta;
        if (target < 0) return { statusCode: 400, statusMessage: "Target step must be non-negative", currentStep: this.currentStep };
        if (target >= this.stepCount) {
            await this.stopAction({ skipAnimation });
            return { statusCode: 200, statusMessage: "OK", currentStep: undefined };
        }
        this.playRuntime(target, skipAnimation);
        this.currentStep = target;
        await this.waitForAction("play");
        return { statusCode: 200, statusMessage: "OK", currentStep: this.currentStep };
    }

    async playNamedAction({ actionId, skipAnimation = false } = {}) {
        this.ensureLoaded();
        if (this.backend !== "code-template") {
            return { statusCode: 400, statusMessage: "Named actions require a code template" };
        }
        const action = this.scene?.actions?.find(value => value?.id === actionId);
        if (!action) return { statusCode: 400, statusMessage: `Unknown template action: ${actionId || ""}` };
        if (!this.module.playCodeTemplate(actionId, skipAnimation)) {
            return { statusCode: 422, statusMessage: this.module.getLastError?.() || `Could not play template action: ${actionId}` };
        }
        await this.waitForAction(actionId);
        this.dispatchState("ograf-action-complete");
        return { statusCode: 200, statusMessage: "OK", actionId };
    }

    async updateAction({ data = {}, skipAnimation = false } = {}) {
        this.ensureLoaded();
        const candidate = this.mergePatch(this.data, data);
        if (!this.updateRuntime(data, skipAnimation)) {
            return { statusCode: 400, statusMessage: this.module.getLastError?.() || "Invalid update data" };
        }
        this.data = candidate;
        this.cssTextOverlay.update(this.data);
        await this.waitForAction("update");
        this.dispatchState("ograf-data-change");
        return { statusCode: 200, statusMessage: "OK" };
    }

    async stopAction({ skipAnimation = false } = {}) {
        this.ensureLoaded();
        this.stopRuntime(skipAnimation);
        await this.waitForAction("stop");
        this.currentStep = undefined;
        return { statusCode: 200, statusMessage: "OK" };
    }

    async customAction() {
        return { statusCode: 400, statusMessage: "No custom actions are defined" };
    }

    async setActionsSchedule({ schedule = [] } = {}) {
        if (!Array.isArray(schedule) || schedule.some(item => !Number.isFinite(item?.timestamp) || !item?.action?.type)) {
            return { statusCode: 400, statusMessage: "Invalid action schedule" };
        }
        this.schedule = [...schedule].sort((a, b) => a.timestamp - b.timestamp);
        this.appliedScheduleIndex = 0;
        return { statusCode: 200, statusMessage: "OK" };
    }

    async goToTime({ timestamp } = {}) {
        this.ensureLoaded();
        if (!Number.isFinite(timestamp) || timestamp < 0) return { statusCode: 400, statusMessage: "Invalid timestamp" };
        if (this.lastTimestamp !== undefined && timestamp < this.lastTimestamp) {
            this.data = structuredClone(this.initialData);
            if (!this.updateRuntime(this.data, true)) {
                const message = this.module.getLastError?.() || "Could not apply template defaults";
                this.module.exit?.();
                this.module = null;
                return { statusCode: 422, statusMessage: message };
            }
            this.currentStep = undefined;
            this.appliedScheduleIndex = 0;
        }
        while (this.appliedScheduleIndex < this.schedule.length && this.schedule[this.appliedScheduleIndex].timestamp <= timestamp) {
            const item = this.schedule[this.appliedScheduleIndex++];
            await this.applyScheduledAction(item.action);
        }
        this.seekRuntime(timestamp);
        this.cssTextOverlay.update(this.data);
        this.lastTimestamp = timestamp;
        this.dispatchState("ograf-data-change");
        return { statusCode: 200, statusMessage: "OK" };
    }

    async dispose() {
        this.cssTextOverlay.clear();
        this.module?.exit?.();
        this.module = null;
        this.backend = "scene";
        this.scene = null;
        this.data = {};
        this.initialData = {};
        this.currentStep = undefined;
        this.schedule = [];
        this.appliedScheduleIndex = 0;
        this.lastTimestamp = undefined;
        return { statusCode: 200, statusMessage: "OK" };
    }

    async applyScheduledAction(action) {
        const params = { ...(action.params || {}), skipAnimation: true };
        if (action.type === "playAction") return this.playAction(params);
        if (action.type === "stopAction") return this.stopAction(params);
        if (action.type === "updateAction") return this.updateAction(params);
        if (action.type === "customAction") return this.customAction(params);
        return { statusCode: 400, statusMessage: `Unknown action ${action.type}` };
    }

    waitForAction(name) {
        return new Promise(resolve => {
            const poll = () => {
                if (!this.module || this.isRuntimeActionComplete(name)) resolve();
                else requestAnimationFrame(poll);
            };
            poll();
        });
    }

    playRuntime(step, skipAnimation) {
        if (this.backend === "code-template") return this.module.playCodeTemplate("", skipAnimation);
        return this.module.playGraphic(step, skipAnimation);
    }

    updateRuntime(data, skipAnimation) {
        if (this.backend === "code-template") return this.module.updateCodeTemplate(JSON.stringify(data), skipAnimation);
        return this.module.updateGraphic(JSON.stringify(data), skipAnimation);
    }

    stopRuntime(skipAnimation) {
        if (this.backend === "code-template") return this.module.stopCodeTemplate(skipAnimation);
        return this.module.stopGraphic(skipAnimation);
    }

    seekRuntime(timestamp) {
        if (this.backend === "code-template") return this.module.goToCodeTemplateTime(timestamp);
        return this.module.goToTime(timestamp);
    }

    isRuntimeActionComplete(name) {
        if (this.backend === "code-template") return this.module.isCodeTemplateActionComplete(name);
        return this.module.isActionComplete(name);
    }

    async waitForRuntimeReady(maxFrames = 120) {
        if (typeof this.module?.isRuntimeReady !== "function") return false;
        for (let frame = 0; frame < maxFrames; frame++) {
            if (this.module.isRuntimeReady()) return true;
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        return false;
    }

    ensureLoaded() {
        if (!this.module) throw new Error("Graphic has not been loaded");
    }

    getControls() {
        return Array.isArray(this.scene?.controls) ? structuredClone(this.scene.controls) : [];
    }

    compositionInfo(scene = this.scene) {
        if (scene?.composition?.width && scene?.composition?.height) return scene.composition;
        if (!Array.isArray(scene?.compositions)) return null;
        return scene.compositions.find(composition => composition?.id === scene.rootCompositionId) || null;
    }

    sceneDefaults(scene = this.scene) {
        const result = {};
        for (const control of scene?.controls || []) {
            if (control?.id && Object.hasOwn(control, "default")) result[control.id] = structuredClone(control.default);
        }
        return result;
    }

    dispatchState(type) {
        this.dispatchEvent(new CustomEvent(type, {
            detail: { scene: this.scene, controls: this.getControls(), data: structuredClone(this.data) }
        }));
    }

    mergePatch(target, patch) {
        const result = { ...target };
        for (const [key, value] of Object.entries(patch || {})) {
            if (value === null) delete result[key];
            else if (typeof value === "object" && !Array.isArray(value) && typeof result[key] === "object") {
                result[key] = this.mergePatch(result[key], value);
            } else result[key] = structuredClone(value);
        }
        return result;
    }
}
