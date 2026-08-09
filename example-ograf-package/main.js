import NativeLowerThirdGraphic from "../ograf/NativeLowerThirdGraphic.js";

const elementName = "ofx-ograf-package-example";
if (!customElements.get(elementName)) customElements.define(elementName, NativeLowerThirdGraphic);

const stage = document.querySelector("#stage");
const status = document.querySelector("#status");
const log = document.querySelector("#log");
const runButton = document.querySelector("#run");

const steps = [];
let graphic;

function record(name, result) {
    const passed = result?.statusCode === 200;
    steps.push({ name, passed, result });
    log.textContent = steps.map(step =>
        `${step.passed ? "PASS" : "FAIL"} ${step.name}: ${step.result?.statusCode} ${step.result?.statusMessage || ""}`
    ).join("\n");
    if (!passed) throw new Error(`${name} failed: ${result?.statusCode} ${result?.statusMessage || ""}`);
}

async function executeLifecycle() {
    runButton.disabled = true;
    status.dataset.state = "running";
    status.textContent = "Running real WebAssembly lifecycle…";
    steps.length = 0;
    log.textContent = "";
    window.__ofxOGrafExampleResult = { state: "running", steps };

    if (graphic) {
        try { await graphic.dispose({}); } catch {}
        graphic.remove();
    }
    graphic = document.createElement(elementName);
    stage.appendChild(graphic);

    try {
        record("load", await graphic.load({
            data: {
                headline: "Canonical OGraf example",
                subtitle: "Compiled from openFrameworks/C++",
                "accent-color": [0.15, 0.65, 1.0, 1.0],
                "motion-hold-duration": 0.2
            },
            renderType: "realtime",
            renderCharacteristics: {
                resolution: { width: 1920, height: 1080 },
                capabilities: ["webgl2", "alpha-canvas"]
            }
        }));
        record("playAction", await graphic.playAction({ goto: 0 }));
        record("updateAction", await graphic.updateAction({
            data: {
                headline: "Lifecycle update received",
                subtitle: "load · play · update · stop · dispose",
                "accent-color": [0.2, 0.9, 0.45, 1.0]
            }
        }));
        record("stopAction", await graphic.stopAction({}));
        record("dispose", await graphic.dispose({}));

        window.__ofxOGrafExampleResult = { state: "pass", steps: structuredClone(steps) };
        status.dataset.state = "pass";
        status.textContent = "PASS — complete OGraf lifecycle executed against the real WASM runtime.";
    } catch (error) {
        window.__ofxOGrafExampleResult = { state: "fail", message: String(error), steps: structuredClone(steps) };
        status.dataset.state = "fail";
        status.textContent = `FAIL — ${error.message || error}`;
        console.error(error);
    } finally {
        runButton.disabled = false;
    }
}

runButton.addEventListener("click", executeLifecycle);
executeLifecycle();
