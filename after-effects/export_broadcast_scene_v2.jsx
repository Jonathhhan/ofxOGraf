/* ofxOGraf Broadcast Scene Exporter 0.2
 * Exports recursive comps, controls, assets, expressions, effects and bake hints.
 * ExtendScript / After Effects 24+.
 */
(function () {
    var SAMPLE_EXPRESSIONS = true;
    var MAX_EXPRESSION_SAMPLES = 12000;
    var report = { unsupported: [], warnings: [], fallbacks: [] };
    var assets = { fonts: [], images: [] };
    var compositions = [];
    var exportedComps = {};
    var controllerIds = {};

    function abort(message) { alert("ofxOGraf Exporter\n\n" + message); throw new Error(message); }
    if (!app.project) abort("No project is open.");
    var rootComp = $.global.ofxOGrafRootComp || app.project.activeItem;
    if (!(rootComp instanceof CompItem)) abort("Open or select a composition first.");

    function pushUnique(list, value) {
        var i; for (i = 0; i < list.length; i++) if (list[i] === value) return;
        list.push(value);
    }
    function arrayFrom(value) {
        var out = [], i; if (value === null || value === undefined) return out;
        for (i = 0; i < value.length; i++) out.push(value[i]); return out;
    }
    function slug(value) {
        return String(value).toLowerCase().replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "control";
    }
    function interpolationName(value) {
        if (value === KeyframeInterpolationType.HOLD) return "hold";
        if (value === KeyframeInterpolationType.BEZIER) return "bezier";
        return "linear";
    }
    function easeArray(value) {
        var out = [], i; for (i = 0; i < value.length; i++) out.push({ speed: value[i].speed, influence: value[i].influence });
        return out;
    }
    function shapeValue(shape) {
        return { closed: shape.closed, vertices: arrayFrom(shape.vertices), inTangents: arrayFrom(shape.inTangents), outTangents: arrayFrom(shape.outTangents) };
    }
    function registerFont(doc) {
        var i, name = doc.font || doc.fontFamily || "Unknown";
        for (i = 0; i < assets.fonts.length; i++) if (assets.fonts[i].postScriptName === name) return;
        assets.fonts.push({
            postScriptName: name,
            family: doc.fontFamily || name,
            style: doc.fontStyle || "Regular",
            file: "fonts/" + slug(name) + ".ttf",
            licensing: "Font file must be supplied by the package author"
        });
    }
    function textValue(doc) {
        registerFont(doc);
        var out = {
            text: doc.text, font: doc.font, fontFamily: doc.fontFamily, fontStyle: doc.fontStyle,
            fontSize: doc.fontSize, justification: String(doc.justification), tracking: doc.tracking,
            leading: doc.leading, autoLeading: doc.autoLeading, baselineShift: doc.baselineShift,
            applyFill: doc.applyFill, applyStroke: doc.applyStroke, strokeOverFill: doc.strokeOverFill,
            strokeWidth: doc.strokeWidth
        };
        if (doc.applyFill) out.fillColor = arrayFrom(doc.fillColor);
        if (doc.applyStroke) out.strokeColor = arrayFrom(doc.strokeColor);
        if (doc.boxText) { out.boxText = true; out.boxTextSize = arrayFrom(doc.boxTextSize); out.boxTextPos = arrayFrom(doc.boxTextPos); }
        return out;
    }
    function serializableValue(value) {
        if (value === null || value === undefined) return null;
        if (value instanceof TextDocument) return textValue(value);
        if (value instanceof Shape) return shapeValue(value);
        if (value instanceof MarkerValue) return { comment: value.comment, chapter: value.chapter, cuePointName: value.cuePointName, duration: value.duration };
        if (value instanceof Array) return arrayFrom(value);
        if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
        try {
            if (value.length !== undefined) return arrayFrom(value);
        } catch (_) {}
        return String(value);
    }
    function controlType(value) {
        if (value instanceof TextDocument || typeof value === "string") return "string";
        if (typeof value === "boolean") return "boolean";
        if (typeof value === "number") return "number";
        if (value instanceof Array && (value.length === 3 || value.length === 4)) return "color-or-vector";
        return "unknown";
    }
    function propertyControlType(property, value) {
        var matchName = String(property.matchName || "");
        if (matchName.indexOf("Checkbox") >= 0) return "boolean";
        if (matchName.indexOf("Color") >= 0) return "color";
        try {
            if (property.propertyValueType === PropertyValueType.COLOR) return "color";
            if (property.propertyValueType === PropertyValueType.TwoD ||
                property.propertyValueType === PropertyValueType.TwoD_SPATIAL ||
                property.propertyValueType === PropertyValueType.ThreeD ||
                property.propertyValueType === PropertyValueType.ThreeD_SPATIAL) return "vector";
        } catch (_) {}
        return controlType(value);
    }
    function exportKeyframe(property, index) {
        var out = {
            time: property.keyTime(index), value: serializableValue(property.keyValue(index)),
            inInterpolation: interpolationName(property.keyInInterpolationType(index)),
            outInterpolation: interpolationName(property.keyOutInterpolationType(index))
        };
        try { out.inEase = easeArray(property.keyInTemporalEase(index)); } catch (_) {}
        try { out.outEase = easeArray(property.keyOutTemporalEase(index)); } catch (_) {}
        try { out.inSpatialTangent = arrayFrom(property.keyInSpatialTangent(index)); } catch (_) {}
        try { out.outSpatialTangent = arrayFrom(property.keyOutSpatialTangent(index)); } catch (_) {}
        return out;
    }
    function sampleExpression(property, comp) {
        var samples = [], frame, frames = Math.ceil(comp.duration * comp.frameRate);
        if (frames > MAX_EXPRESSION_SAMPLES) {
            report.warnings.push("Expression sampling capped on " + property.name + " (" + frames + " frames)");
            frames = MAX_EXPRESSION_SAMPLES;
        }
        for (frame = 0; frame <= frames; frame++) {
            var time = Math.min(comp.duration, frame / comp.frameRate);
            try { samples.push({ time: time, value: serializableValue(property.valueAtTime(time, false)) }); }
            catch (error) { report.warnings.push("Expression sample failed on " + property.name + ": " + error.toString()); break; }
        }
        return samples;
    }
    function normalizedGradient(property) {
        var value;
        try { value = property.value; } catch (_) { return null; }
        if (!(value instanceof Array)) return null;
        var stops = [], i;
        // AE custom gradient layouts vary by version. Preserve the raw array and
        // also recognize the normalized [offset,r,g,b,a] form used by tools.
        if (value.length >= 5 && value.length % 5 === 0) {
            for (i = 0; i < value.length; i += 5) stops.push({ offset: value[i], color: [value[i + 1], value[i + 2], value[i + 3]], opacity: value[i + 4] });
        }
        return { raw: arrayFrom(value), stops: stops };
    }
    function exportProperty(property, comp) {
        var out = { name: property.name, matchName: property.matchName, propertyType: String(property.propertyType) }, i;
        if (property.propertyType === PropertyType.PROPERTY) {
            out.keyframes = [];
            for (i = 1; i <= property.numKeys; i++) out.keyframes.push(exportKeyframe(property, i));
            if (property.matchName === "ADBE Vector Grad Colors") {
                var gradient = normalizedGradient(property); if (gradient) out.value = gradient;
            } else if (property.numKeys === 0) {
                try { out.value = serializableValue(property.value); } catch (error) { report.warnings.push("Could not read " + property.name + ": " + error.toString()); }
            }
            if (property.canSetExpression && property.expressionEnabled) {
                out.expression = property.expression;
                if (SAMPLE_EXPRESSIONS) out.samples = sampleExpression(property, comp);
                else pushUnique(report.unsupported, "expressions");
            }
            if (controllerIds[property.name]) out.controlId = controllerIds[property.name];
        } else {
            out.children = [];
            for (i = 1; i <= property.numProperties; i++) {
                try { out.children.push(exportProperty(property.property(i), comp)); }
                catch (error2) { report.warnings.push("Skipped property " + property.name + ": " + error2.toString()); }
            }
        }
        return out;
    }
    function exportMasks(group, comp) {
        var out = exportProperty(group, comp), i, mask, child;
        if (!out.children) return out;
        for (i = 1; i <= group.numProperties; i++) {
            mask = group.property(i); child = out.children[i - 1];
            if (!child) continue;
            try { child.maskMode = String(mask.maskMode); } catch (_) {}
            try { child.inverted = !!mask.inverted; } catch (_) {}
            try { child.rotoBezier = !!mask.rotoBezier; } catch (_) {}
            try {
                child.color = arrayFrom(mask.color);
                child.opacity = mask.opacity;
                child.featherFalloff = String(mask.maskFeatherFalloff);
            } catch (_) {}
        }
        return out;
    }
    function layerType(layer) {
        if (layer instanceof TextLayer) return "text";
        if (layer instanceof ShapeLayer) return "shape";
        if (layer instanceof CameraLayer) return "camera";
        if (layer instanceof LightLayer) return "light";
        if (layer.nullLayer) return "null";
        if (layer.source instanceof CompItem) return "precomp";
        if (layer.source instanceof FootageItem) return layer.source.mainSource instanceof SolidSource ? "solid" : "image";
        return "unknown";
    }
    function fallbackFor(layer, comp, reasons) {
        var base = "baked/" + slug(comp.name) + "/" + slug(layer.name) + "_####.png";
        var fallback = { enabled: false, reasons: reasons, filePattern: base, frameRate: comp.frameRate, startFrame: 0 };
        report.fallbacks.push({ comp: comp.name, layer: layer.name, filePattern: base, reasons: reasons });
        return fallback;
    }
    function registerImage(layer) {
        if (!(layer.source instanceof FootageItem) || !layer.source.file) return null;
        var id = "asset-" + layer.source.id, i;
        for (i = 0; i < assets.images.length; i++) if (assets.images[i].id === id) return assets.images[i];
        var entry = { id: id, file: "images/" + layer.source.file.name, originalFile: layer.source.file.fsName };
        assets.images.push(entry); return entry;
    }
    function exportLayer(layer, comp) {
        var type = layerType(layer), reasons = [], out = {
            index: layer.index, name: layer.name, type: type, enabled: layer.enabled,
            inPoint: layer.inPoint, outPoint: layer.outPoint, startTime: layer.startTime, stretch: layer.stretch,
            parentIndex: layer.parent ? layer.parent.index : null, threeDLayer: layer.threeDLayer,
            blendingMode: String(layer.blendingMode), trackMatteType: String(layer.trackMatteType),
            transform: exportProperty(layer.property("ADBE Transform Group"), comp)
        };
        if (layer.threeDLayer) reasons.push("3d-layer");
        if (String(layer.trackMatteType) !== String(TrackMatteType.NO_TRACK_MATTE)) reasons.push("track-matte");
        if (type === "precomp") {
            out.source = { id: "comp-" + layer.source.id, name: layer.source.name };
            exportComposition(layer.source, false);
        }
        if (type === "image") {
            var asset = registerImage(layer); if (asset) out.source = { assetId: asset.id, file: asset.file };
            out.width = layer.width; out.height = layer.height;
        }
        if (type === "solid") {
            out.width = layer.width; out.height = layer.height;
            try { out.solidColor = arrayFrom(layer.source.mainSource.color); } catch (_) {}
        }
        if (type === "text") {
            out.text = exportProperty(layer.property("ADBE Text Properties").property("ADBE Text Document"), comp);
            if (controllerIds[layer.name]) out.controlId = controllerIds[layer.name];
            var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
            if (animators && animators.numProperties) { out.textAnimators = exportProperty(animators, comp); reasons.push("text-animators"); }
        }
        if (type === "shape") out.contents = exportProperty(layer.property("ADBE Root Vectors Group"), comp);
        var masks = layer.property("ADBE Mask Parade");
        if (masks && masks.numProperties) { out.masks = exportMasks(masks, comp); reasons.push("masks"); }
        var effects = layer.property("ADBE Effect Parade");
        if (effects && effects.numProperties) { out.effects = exportProperty(effects, comp); reasons.push("effects-or-plugins"); }
        try {
            var overrides = layer.property("ADBE Layer Overrides");
            if (overrides && overrides.numProperties) out.essentialProperties = exportProperty(overrides, comp);
        } catch (_) {}
        if (reasons.length) out.fallback = fallbackFor(layer, comp, reasons);
        return out;
    }
    function compositionInfo(comp) {
        return {
            width: comp.width, height: comp.height, pixelAspect: comp.pixelAspect,
            duration: comp.duration, frameRate: comp.frameRate,
            displayStartTime: comp.displayStartTime, backgroundColor: arrayFrom(comp.bgColor)
        };
    }
    function exportComposition(comp, root) {
        var id = "comp-" + comp.id, i;
        if (!root && exportedComps[id]) return;
        exportedComps[id] = true;
        var out = { id: id, name: comp.name, composition: compositionInfo(comp), layers: [] };
        for (i = 1; i <= comp.numLayers; i++) {
            try { out.layers.push(exportLayer(comp.layer(i), comp)); }
            catch (error) { report.warnings.push("Skipped " + comp.name + " layer " + i + ": " + error.toString()); }
        }
        if (!root) compositions.push(out);
        return out;
    }
    function findNamedProperty(group, name) {
        if (!group) return null;
        var i, property, found;
        for (i = 1; i <= group.numProperties; i++) {
            property = group.property(i);
            if (property.name === name && property.propertyType === PropertyType.PROPERTY) return property;
            if (property.propertyType !== PropertyType.PROPERTY) {
                found = findNamedProperty(property, name); if (found) return found;
            }
        }
        return null;
    }
    function inferControlProperty(comp, name) {
        var i, layer, property;
        for (i = 1; i <= comp.numLayers; i++) {
            layer = comp.layer(i);
            if (layer.name === name && layer instanceof TextLayer) {
                try { return layer.property("ADBE Text Properties").property("ADBE Text Document"); } catch (_) {}
            }
            property = findNamedProperty(layer, name); if (property) return property;
        }
        return null;
    }
    function discoverControls(comp) {
        var controls = [], count = 0, i, name, id, property, value, control;
        try { count = comp.motionGraphicsTemplateControllerCount; } catch (_) {}
        for (i = 1; i <= count; i++) {
            try { name = comp.getMotionGraphicsTemplateControllerName(i); } catch (_) { name = "Control " + i; }
            id = slug(name); controllerIds[name] = id;
            control = { id: id, name: name, type: "unknown", source: "essential-graphics", controllerIndex: i };
            property = inferControlProperty(comp, name);
            if (property) {
                try {
                    var rawValue = property.value;
                    value = rawValue instanceof TextDocument ? rawValue.text : serializableValue(rawValue);
                    control.type = propertyControlType(property, value);
                    control.default = value;
                    control.matchName = property.matchName;
                    try { if (property.hasMin) control.min = property.minValue; } catch (_) {}
                    try { if (property.hasMax) control.max = property.maxValue; } catch (_) {}
                    if (control.type === "string" && String(value).indexOf("\r") >= 0) control.multiline = true;
                } catch (_) {}
            }
            controls.push(control);
        }
        return controls;
    }
    function escapeString(value) {
        return '"' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
    }
    function stringify(value, indent) {
        var level = indent || 0, pad = "", childPad, i, parts = [], key;
        for (i = 0; i < level; i++) pad += "  "; childPad = pad + "  ";
        if (value === null) return "null";
        if (typeof value === "string") return escapeString(value);
        if (typeof value === "number") return isFinite(value) ? String(value) : "null";
        if (typeof value === "boolean") return value ? "true" : "false";
        if (value instanceof Array) {
            if (!value.length) return "[]";
            for (i = 0; i < value.length; i++) parts.push(childPad + stringify(value[i], level + 1));
            return "[\n" + parts.join(",\n") + "\n" + pad + "]";
        }
        for (key in value) if (value.hasOwnProperty(key) && value[key] !== undefined) parts.push(childPad + escapeString(key) + ": " + stringify(value[key], level + 1));
        return parts.length ? "{\n" + parts.join(",\n") + "\n" + pad + "}" : "{}";
    }

    var controls = discoverControls(rootComp);
    var root = exportComposition(rootComp, true);
    var scene = {
        format: "broadcast-scene", version: "0.2.0",
        source: { application: "After Effects", version: app.version, compName: rootComp.name, compId: rootComp.id },
        composition: root.composition, layers: root.layers, compositions: compositions,
        assets: assets, controls: controls, report: report
    };
    var output = File.saveDialog("Save Broadcast Scene 0.2", "Broadcast Scene:*.scene.json");
    if (!output) return;
    output.encoding = "UTF-8";
    if (!output.open("w")) abort("Could not open output file.");
    output.write(stringify(scene, 0)); output.close();
    alert("Exported " + root.layers.length + " root layers and " + compositions.length + " precompositions.\n\n" + output.fsName);
}());
