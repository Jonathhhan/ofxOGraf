import OfBroadcastGraphic from "./OfBroadcastGraphic.js";

export default class NativeLowerThirdGraphic extends OfBroadcastGraphic {
    constructor() {
        super();
        this.setAttribute("code-template", "native-lower-third");
        this.setAttribute("template-definition", "./template-definition.json");
    }

    // Keep the OGraf lifecycle explicit on the package entry point; the
    // implementation and state handling remain in the reusable base class.
    async setActionsSchedule(value) {
        return super.setActionsSchedule(value);
    }

    async goToTime(value) {
        return super.goToTime(value);
    }

    // This template has authored in/out segments. Map OGraf's standard
    // play/stop lifecycle to them instead of using the host's generic
    // full-duration play and immediate stop operations.
    playRuntime(_step, skipAnimation) {
        return this.module.playCodeTemplate("in", skipAnimation);
    }

    stopRuntime(skipAnimation) {
        return this.module.playCodeTemplate("out", skipAnimation);
    }
}
