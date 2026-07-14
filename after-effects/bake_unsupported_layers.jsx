/*
 * Bakes layers that need AE/plugin rendering into PNG sequences with alpha.
 * Run after exporting with export_broadcast_scene_v2.jsx and copy the output
 * folder beside the scene. Set each corresponding fallback.enabled to true.
 */
(function () {
    if (!app.project || !(app.project.activeItem instanceof CompItem)) {
        alert("Open or select a composition first.");
        return;
    }
    var sourceComp = app.project.activeItem;
    var outputRoot = Folder.selectDialog("Choose the package folder that will contain baked/");
    if (!outputRoot) return;

    function slug(value) {
        return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "layer";
    }
    function hasExpressions(group) {
        if (!group) return false;
        var i, property;
        for (i = 1; i <= group.numProperties; i++) {
            property = group.property(i);
            if (property.propertyType === PropertyType.PROPERTY) {
                if (property.canSetExpression && property.expressionEnabled) return true;
            } else if (hasExpressions(property)) return true;
        }
        return false;
    }
    function needsBake(layer) {
        if (layer.threeDLayer || layer.source instanceof CompItem) return true;
        var masks = layer.property("ADBE Mask Parade");
        var effects = layer.property("ADBE Effect Parade");
        if (masks && masks.numProperties) return true;
        if (effects && effects.numProperties) return true;
        if (hasExpressions(layer)) return true;
        try { if (String(layer.trackMatteType) !== String(TrackMatteType.NO_TRACK_MATTE)) return true; } catch (_) {}
        return false;
    }
    function ensureFolder(parent, name) {
        var folder = new Folder(parent.fsName + "/" + name);
        if (!folder.exists && !folder.create()) throw new Error("Could not create " + folder.fsName);
        return folder;
    }

    var bakedRoot = ensureFolder(outputRoot, "baked");
    var compFolder = ensureFolder(bakedRoot, slug(sourceComp.name));
    var duplicates = [], queued = 0, i;
    app.beginUndoGroup("Bake ofxOGraf fallbacks");
    try {
        for (i = 1; i <= sourceComp.numLayers; i++) {
            if (!needsBake(sourceComp.layer(i))) continue;
            var duplicate = sourceComp.duplicate();
            duplicate.name = "__ofxOGraf_bake__" + sourceComp.layer(i).name;
            duplicates.push(duplicate);
            var j;
            for (j = 1; j <= duplicate.numLayers; j++) duplicate.layer(j).solo = false;
            duplicate.layer(i).solo = true;

            var item = app.project.renderQueue.items.add(duplicate);
            var module = item.outputModule(1);
            try { module.applyTemplate("PNG Sequence with Alpha"); }
            catch (_) {
                try { module.applyTemplate("Lossless with Alpha"); }
                catch (_) {}
            }
            module.file = new File(compFolder.fsName + "/" + slug(sourceComp.layer(i).name) + "_[####].png");
            queued++;
        }
        if (!queued) {
            alert("No layers require a baked fallback.");
            return;
        }
        app.project.renderQueue.render();
        for (i = 0; i < duplicates.length; i++) {
            try { duplicates[i].remove(); } catch (_) {}
        }
        alert("Baked " + queued + " layer sequence(s) to:\n" + compFolder.fsName +
              "\n\nSet fallback.enabled=true for these layers in the exported scene.");
    } catch (error) {
        alert("Bake failed:\n" + error.toString());
    } finally {
        app.endUndoGroup();
    }
}());
