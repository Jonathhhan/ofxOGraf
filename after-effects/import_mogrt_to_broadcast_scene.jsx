/* ofxOGraf MOGRT Importer
 * Opens an After Effects-authored .mogrt through After Effects, then invokes
 * the Broadcast Scene exporter on a user-selected extracted composition.
 * ExtendScript / After Effects 24+.
 */
(function () {
    function fail(message) {
        alert("ofxOGraf MOGRT Importer\n\n" + message);
        throw new Error(message);
    }

    function collectCompositions(project) {
        var compositions = [], index, item;
        for (index = 1; index <= project.numItems; ++index) {
            item = project.item(index);
            if (item instanceof CompItem) compositions.push(item);
        }
        return compositions;
    }

    function chooseComposition(compositions, activeItem) {
        var dialog = new Window("dialog", "Choose MOGRT root composition");
        dialog.orientation = "column";
        dialog.alignChildren = ["fill", "top"];
        dialog.add("statictext", undefined, "Export this extracted composition:");
        var list = dialog.add("dropdownlist", undefined, []);
        var index, selected = 0;
        for (index = 0; index < compositions.length; ++index) {
            list.add("item", compositions[index].name + " (" + compositions[index].width + "x" + compositions[index].height + ")");
            if (compositions[index] === activeItem) selected = index;
        }
        list.selection = selected;
        var buttons = dialog.add("group");
        buttons.alignment = ["right", "center"];
        buttons.add("button", undefined, "Cancel", { name: "cancel" });
        buttons.add("button", undefined, "Export", { name: "ok" });
        if (dialog.show() !== 1 || !list.selection) return null;
        return compositions[list.selection.index];
    }

    var importer = new File($.fileName);
    var exporter = new File(importer.parent.fsName + "/export_broadcast_scene_v2.jsx");
    if (!exporter.exists) fail("Missing exporter:\n" + exporter.fsName);

    var mogrt = File.openDialog("Choose an After Effects-authored Motion Graphics Template", "Motion Graphics Template:*.mogrt");
    if (!mogrt) return;
    if (!/\.mogrt$/i.test(mogrt.name)) fail("Choose a .mogrt file.");

    try {
        app.open(mogrt);
    } catch (error) {
        fail("After Effects could not open this MOGRT.\n\nThis importer supports After Effects-authored templates only. Premiere-authored templates need a separate importer.\n\n" + error.toString());
    }

    if (!app.project) fail("After Effects did not open an extracted project.");
    var compositions = collectCompositions(app.project);
    if (!compositions.length) fail("The extracted project contains no compositions.");
    var rootComp = chooseComposition(compositions, app.project.activeItem);
    if (!rootComp) return;

    var previousRoot = $.global.ofxOGrafRootComp;
    $.global.ofxOGrafRootComp = rootComp;
    try {
        $.evalFile(exporter);
    } finally {
        $.global.ofxOGrafRootComp = previousRoot;
    }
}());
