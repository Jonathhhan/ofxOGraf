const HTMLElementBase = globalThis.HTMLElement || class {};

const clone = value => value === undefined ? undefined : structuredClone(value);

export function normalizeControlType(control = {}) {
    if (Array.isArray(control.options)) return "enum";
    const type = String(control.type || "unknown").toLowerCase();
    const matchName = String(control.matchName || "").toLowerCase();
    if (["string", "text"].includes(type)) return "string";
    if (["boolean", "checkbox"].includes(type)) return "boolean";
    if (["integer", "int"].includes(type)) return "integer";
    if (["number", "slider", "float"].includes(type)) return "number";
    if (type === "color" || matchName.includes("color")) return "color";
    if (type.includes("vector")) return type === "color-or-vector" ? "color" : "vector";
    if (typeof control.default === "boolean") return "boolean";
    if (typeof control.default === "number") return Number.isInteger(control.default) ? "integer" : "number";
    if (Array.isArray(control.default)) return control.default.length >= 3 ? "color" : "vector";
    return "string";
}

export function normalizeControls(controls = []) {
    const ids = new Set();
    return (Array.isArray(controls) ? controls : []).filter(control => {
        if (!control || typeof control.id !== "string" || !control.id || ids.has(control.id)) return false;
        ids.add(control.id);
        return true;
    }).map(control => {
        const constraints = control.constraints || {};
        return {
            ...control,
            type: normalizeControlType(control),
            name: control.name || control.label || control.id,
            min: control.min ?? constraints.minimum,
            max: control.max ?? constraints.maximum,
            step: control.step ?? constraints.step
        };
    });
}

export function controlDefaults(controls = []) {
    return normalizeControls(controls).reduce((data, control) => {
        if (Object.hasOwn(control, "default")) data[control.id] = clone(control.default);
        return data;
    }, {});
}

export function colorToHex(value) {
    const channels = Array.isArray(value) ? value : [1, 1, 1];
    return `#${channels.slice(0, 3).map(channel => Math.round(Math.max(0, Math.min(1, Number(channel) || 0)) * 255).toString(16).padStart(2, "0")).join("")}`;
}

export function hexToColor(value, alpha = 1) {
    const match = /^#?([0-9a-f]{6})$/i.exec(String(value));
    if (!match) return [1, 1, 1, alpha];
    return [0, 2, 4].map(offset => parseInt(match[1].slice(offset, offset + 2), 16) / 255).concat(alpha);
}

export function coerceControlValue(control, raw, checked = false) {
    const type = normalizeControlType(control);
    if (type === "boolean") return Boolean(checked);
    if (type === "integer") return Math.round(Number(raw) || 0);
    if (type === "number") return Number(raw) || 0;
    if (type === "color") return hexToColor(raw, Array.isArray(control.default) && control.default.length > 3 ? control.default[3] : 1);
    return raw;
}

export class OfEssentialControls extends HTMLElementBase {
    constructor() {
        super();
        this.graphic = null;
        this.controls = [];
        this.data = {};
        this.updateQueue = Promise.resolve();
        this.onReady = event => this.refresh(event.detail?.scene, event.detail?.data);
        this.onData = event => this.applyData(event.detail?.data);
        if (!this.attachShadow) return;
        this.attachShadow({ mode: "open" }).innerHTML = `
          <style>
            :host { color-scheme: dark; display:block; box-sizing:border-box; min-width:260px; font:13px/1.35 system-ui,sans-serif; color:#edf0f6; background:#17191e; }
            header { position:sticky; top:0; z-index:1; display:flex; align-items:center; justify-content:space-between; gap:12px; padding:14px 16px; background:#20232a; border-bottom:1px solid #343944; }
            h2 { margin:0; font-size:14px; font-weight:650; }
            button { border:1px solid #454c5a; border-radius:5px; padding:5px 9px; color:inherit; background:#292e37; cursor:pointer; }
            button:hover { background:#343a45; }
            #fields { display:grid; gap:14px; padding:16px; }
            .field { display:grid; gap:6px; }
            .row { display:flex; align-items:center; gap:8px; }
            label { color:#c9ced9; font-weight:600; }
            input, textarea, select { box-sizing:border-box; width:100%; border:1px solid #414754; border-radius:5px; padding:7px 8px; color:#f7f8fa; background:#242831; font:inherit; }
            input[type=checkbox] { width:auto; accent-color:#5ba6ff; }
            input[type=color] { height:36px; padding:3px; }
            input[type=range] { padding:0; accent-color:#5ba6ff; }
            textarea { min-height:78px; resize:vertical; }
            output { min-width:48px; text-align:right; font-variant-numeric:tabular-nums; }
            .vector { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:6px; }
            #status { padding:0 16px 14px; color:#8e96a5; min-height:18px; }
            .empty { color:#8e96a5; }
          </style>
          <header><h2>Essential Graphics</h2><button id="reset" type="button">Reset</button></header>
          <div id="fields"></div><div id="status" role="status" aria-live="polite"></div>`;
        this.shadowRoot.getElementById("reset").addEventListener("click", () => this.resetDefaults());
        this.shadowRoot.addEventListener("focusout", () => queueMicrotask(() => {
            if (!this.shadowRoot.activeElement) this.renderFields();
        }));
    }

    connectedCallback() {
        queueMicrotask(() => this.connectTarget());
    }

    disconnectedCallback() {
        this.bindGraphic(null);
    }

    connectTarget() {
        const id = this.getAttribute?.("for");
        const target = id ? document.getElementById(id) : this.previousElementSibling;
        if (target) this.bindGraphic(target);
    }

    bindGraphic(graphic) {
        this.graphic?.removeEventListener("ograf-ready", this.onReady);
        this.graphic?.removeEventListener("ograf-data-change", this.onData);
        this.graphic = graphic;
        this.graphic?.addEventListener("ograf-ready", this.onReady);
        this.graphic?.addEventListener("ograf-data-change", this.onData);
        if (graphic?.scene) this.refresh(graphic.scene, graphic.data);
    }

    refresh(scene = {}, data = {}) {
        this.controls = normalizeControls(scene?.controls);
        this.data = { ...controlDefaults(this.controls), ...(data || {}) };
        this.renderFields();
    }

    applyData(data = {}) {
        this.data = { ...controlDefaults(this.controls), ...(data || {}) };
        if (!this.shadowRoot?.activeElement) this.renderFields();
    }

    renderFields() {
        if (!this.shadowRoot) return;
        const fields = this.shadowRoot.getElementById("fields");
        fields.replaceChildren();
        if (!this.controls.length) {
            const empty = document.createElement("div");
            empty.className = "empty";
            empty.textContent = "This scene has no Essential Graphics controls.";
            fields.appendChild(empty);
            return;
        }
        for (const control of this.controls) fields.appendChild(this.createField(control));
    }

    createField(control) {
        const field = document.createElement("div");
        field.className = "field";
        const label = document.createElement("label");
        label.textContent = control.name;
        const value = this.data[control.id] ?? control.default;
        let input;

        if (control.type === "boolean") {
            field.classList.add("row");
            input = document.createElement("input");
            input.type = "checkbox";
            input.checked = Boolean(value);
            input.addEventListener("change", () => this.commit(control, input.checked));
            field.append(input, label);
            return field;
        }
        field.appendChild(label);

        if (control.type === "enum") {
            input = document.createElement("select");
            for (const [index, option] of control.options.entries()) {
                const element = document.createElement("option");
                const optionValue = typeof option === "object" ? option.value : option;
                element.value = String(index);
                element.textContent = typeof option === "object" ? option.label || option.name || String(optionValue) : String(option);
                element.selected = JSON.stringify(optionValue) === JSON.stringify(value);
                input.appendChild(element);
            }
            input.addEventListener("change", () => {
                const option = control.options[Number(input.value)];
                this.commit(control, clone(typeof option === "object" ? option.value : option));
            });
        } else if (control.type === "color") {
            input = document.createElement("input");
            input.type = "color";
            input.value = colorToHex(value);
            input.addEventListener("input", () => {
                const alpha = Array.isArray(this.data[control.id]) ? this.data[control.id][3] ?? 1 : 1;
                this.commit(control, hexToColor(input.value, alpha));
            });
        } else if (control.type === "vector") {
            input = document.createElement("div");
            input.className = "vector";
            const vector = Array.isArray(value) ? value : [0, 0];
            vector.forEach((component, index) => {
                const componentInput = document.createElement("input");
                componentInput.type = "number";
                componentInput.step = control.step || "any";
                componentInput.value = component;
                componentInput.setAttribute("aria-label", `${control.name} ${index + 1}`);
                componentInput.addEventListener("input", () => {
                    const edited = Array.isArray(this.data[control.id]) ? [...this.data[control.id]] : [...vector];
                    edited[index] = Number(componentInput.value) || 0;
                    this.commit(control, edited);
                });
                input.appendChild(componentInput);
            });
        } else if (["number", "integer"].includes(control.type) && Number.isFinite(control.min) && Number.isFinite(control.max)) {
            const row = document.createElement("div");
            row.className = "row";
            input = document.createElement("input");
            input.type = "range";
            input.min = control.min;
            input.max = control.max;
            input.step = control.step || (control.type === "integer" ? 1 : "any");
            input.value = value ?? control.min;
            const output = document.createElement("output");
            output.value = input.value;
            input.addEventListener("input", () => {
                output.value = input.value;
                this.commit(control, coerceControlValue(control, input.value));
            });
            row.append(input, output);
            field.appendChild(row);
            return field;
        } else if (["number", "integer"].includes(control.type)) {
            input = document.createElement("input");
            input.type = "number";
            input.step = control.step || (control.type === "integer" ? 1 : "any");
            input.value = value ?? 0;
            input.addEventListener("input", () => this.commit(control, coerceControlValue(control, input.value)));
        } else if (control.multiline || String(value || "").includes("\n")) {
            input = document.createElement("textarea");
            input.value = value ?? "";
            input.addEventListener("input", () => this.commit(control, input.value));
        } else {
            input = document.createElement("input");
            input.type = "text";
            input.value = value ?? "";
            input.addEventListener("input", () => this.commit(control, input.value));
        }
        field.appendChild(input);
        return field;
    }

    commit(control, value) {
        this.data[control.id] = clone(value);
        const patch = { [control.id]: clone(value) };
        const status = this.shadowRoot?.getElementById("status");
        if (status) status.textContent = "Updating…";
        this.updateQueue = this.updateQueue.then(async () => {
            if (!this.graphic?.updateAction) return;
            const result = await this.graphic.updateAction({ data: patch, skipAnimation: !this.hasAttribute("animate") });
            if (result?.statusCode !== 200) throw new Error(result?.statusMessage || "Update failed");
            this.dispatchEvent(new CustomEvent("control-input", { detail: { control, value: clone(value) }, bubbles: true }));
        }).then(() => {
            if (status) status.textContent = "";
        }).catch(error => {
            if (status) status.textContent = error.message;
        });
    }

    resetDefaults() {
        const defaults = controlDefaults(this.controls);
        for (const control of this.controls) {
            if (Object.hasOwn(defaults, control.id)) this.data[control.id] = clone(defaults[control.id]);
        }
        this.renderFields();
        if (Object.keys(defaults).length) {
            this.updateQueue = this.updateQueue.then(() => this.graphic?.updateAction?.({ data: defaults, skipAnimation: true }));
        }
    }
}

if (globalThis.customElements && !customElements.get("of-essential-controls")) {
    customElements.define("of-essential-controls", OfEssentialControls);
}
