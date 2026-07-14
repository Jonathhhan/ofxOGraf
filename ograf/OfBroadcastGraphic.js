import createOfxOGrafModule from "./dist/ofxOGraf.js";

export default class OfBroadcastGraphic extends HTMLElement {
    constructor() {
        super();
        this.module = null;
        this.scene = null;
        this.data = {};
        this.initialData = {};
        this.currentStep = undefined;
        this.stepCount = 1;
        this.schedule = [];
        this.appliedScheduleIndex = 0;
        const shadow = this.attachShadow({ mode: "open" });
        this.canvas = document.createElement("canvas");
        this.canvas.width = 1920;
        this.canvas.height = 1080;
        this.canvas.style.cssText = "display:block;width:100%;height:100%;background:transparent";
        shadow.appendChild(this.canvas);
    }

    async load({ data = {}, renderType = "realtime", renderCharacteristics = {} } = {}) {
        if (this.module) await this.dispose({});
        this.module = await createOfxOGrafModule({ canvas: this.canvas });
        const sceneUrl = this.getAttribute("scene") || "./scene.json";
        const response = await fetch(sceneUrl);
        if (!response.ok) return { statusCode: response.status, statusMessage: `Could not load ${sceneUrl}` };
        const scene = await response.json();
        this.scene = scene;
        if (!this.module.loadGraphic(JSON.stringify(scene))) {
            return { statusCode: 422, statusMessage: this.module.getLastError?.() || "Invalid scene" };
        }
        const resolvedData = this.mergePatch(this.sceneDefaults(scene), data);
        this.initialData = structuredClone(resolvedData);
        this.data = structuredClone(resolvedData);
        this.module.updateGraphic(JSON.stringify(this.data), true);
        this.renderType = renderType;
        const resolution = renderCharacteristics.resolution || scene.composition;
        this.canvas.width = resolution.width || scene.composition.width;
        this.canvas.height = resolution.height || scene.composition.height;
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
        this.module.playGraphic(target, skipAnimation);
        this.currentStep = target;
        await this.waitForAction("play");
        return { statusCode: 200, statusMessage: "OK", currentStep: this.currentStep };
    }

    async updateAction({ data = {}, skipAnimation = false } = {}) {
        this.ensureLoaded();
        this.data = this.mergePatch(this.data, data);
        if (!this.module.updateGraphic(JSON.stringify(data), skipAnimation)) {
            return { statusCode: 400, statusMessage: "Invalid update data" };
        }
        await this.waitForAction("update");
        this.dispatchState("ograf-data-change");
        return { statusCode: 200, statusMessage: "OK" };
    }

    async stopAction({ skipAnimation = false } = {}) {
        this.ensureLoaded();
        this.module.stopGraphic(skipAnimation);
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
            this.module.updateGraphic(JSON.stringify(this.data), true);
            this.currentStep = undefined;
            this.appliedScheduleIndex = 0;
        }
        while (this.appliedScheduleIndex < this.schedule.length && this.schedule[this.appliedScheduleIndex].timestamp <= timestamp) {
            const item = this.schedule[this.appliedScheduleIndex++];
            await this.applyScheduledAction(item.action);
        }
        this.module.goToTime(timestamp);
        this.lastTimestamp = timestamp;
        this.dispatchState("ograf-data-change");
        return { statusCode: 200, statusMessage: "OK" };
    }

    async dispose() {
        this.module?.exit?.();
        this.module = null;
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
                if (!this.module || this.module.isActionComplete(name)) resolve();
                else requestAnimationFrame(poll);
            };
            poll();
        });
    }

    ensureLoaded() {
        if (!this.module) throw new Error("Graphic has not been loaded");
    }

    getControls() {
        return Array.isArray(this.scene?.controls) ? structuredClone(this.scene.controls) : [];
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
