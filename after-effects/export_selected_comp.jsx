/*
 * ofxOGraf Broadcast Scene Exporter
 * Select/open a composition, then run through File > Scripts > Run Script File.
 * Compatible with ExtendScript's older ECMAScript dialect.
 */
(function () {
    function abort(message) {
        alert("ofxOGraf Exporter\n\n" + message);
        throw new Error(message);
    }

    if (!app.project) abort("No project is open.");
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) abort("Open or select a composition first.");

    var report = { unsupported: [], warnings: [] };

    function pushUnique(list, value) {
        var i;
        for (i = 0; i < list.length; i++) if (list[i] === value) return;
        list.push(value);
    }

    function arrayFrom(value) {
        var result = [], i;
        if (value === null || value === undefined) return result;
        for (i = 0; i < value.length; i++) result.push(value[i]);
        return result;
    }

    function interpolationName(value) {
        if (value === KeyframeInterpolationType.HOLD) return "hold";
        if (value === KeyframeInterpolationType.BEZIER) return "bezier";
        return "linear";
    }

    function easeArray(value) {
        var result = [], i;
        for (i = 0; i < value.length; i++) {
            result.push({ speed: value[i].speed, influence: value[i].influence });
        }
        return result;
    }

    function shapeValue(shape) {
        return {
            closed: shape.closed,
            vertices: arrayFrom(shape.vertices),
            inTangents: arrayFrom(shape.inTangents),
            outTangents: arrayFrom(shape.outTangents)
        };
    }

    function textValue(doc) {
        var value = {
            text: doc.text,
            font: doc.font,
            fontFamily: doc.fontFamily,
            fontStyle: doc.fontStyle,
            fontSize: doc.fontSize,
            justification: String(doc.justification),
            tracking: doc.tracking,
            leading: doc.leading,
            autoLeading: doc.autoLeading,
            baselineShift: doc.baselineShift,
            applyFill: doc.applyFill,
            applyStroke: doc.applyStroke,
            strokeOverFill: doc.strokeOverFill,
            strokeWidth: doc.strokeWidth
        };
        if (doc.applyFill) value.fillColor = arrayFrom(doc.fillColor);
        if (doc.applyStroke) value.strokeColor = arrayFrom(doc.strokeColor);
        if (doc.boxText) {
            value.boxText = true;
            value.boxTextSize = arrayFrom(doc.boxTextSize);
            value.boxTextPos = arrayFrom(doc.boxTextPos);
        }
        return value;
    }

    function serializableValue(value) {
        if (value === null || value === undefined) return null;
        if (value instanceof TextDocument) return textValue(value);
        if (value instanceof Shape) return shapeValue(value);
        if (value instanceof MarkerValue) {
            return {
                comment: value.comment,
                chapter: value.chapter,
                cuePointName: value.cuePointName,
                duration: value.duration
            };
        }
        if (value instanceof Array) return arrayFrom(value);
        if (typeof value === "number" || typeof value === "string" || typeof value === "boolean") return value;
        return String(value);
    }

    function exportKeyframe(property, index) {
        var key = {
            time: property.keyTime(index),
            value: serializableValue(property.keyValue(index)),
            inInterpolation: interpolationName(property.keyInInterpolationType(index)),
            outInterpolation: interpolationName(property.keyOutInterpolationType(index))
        };
        try { key.inEase = easeArray(property.keyInTemporalEase(index)); } catch (_) {}
        try { key.outEase = easeArray(property.keyOutTemporalEase(index)); } catch (_) {}
        try { key.temporalContinuous = property.keyTemporalContinuous(index); } catch (_) {}
        try { key.temporalAutoBezier = property.keyTemporalAutoBezier(index); } catch (_) {}
        try { key.inSpatialTangent = arrayFrom(property.keyInSpatialTangent(index)); } catch (_) {}
        try { key.outSpatialTangent = arrayFrom(property.keyOutSpatialTangent(index)); } catch (_) {}
        try { key.spatialContinuous = property.keySpatialContinuous(index); } catch (_) {}
        try { key.spatialAutoBezier = property.keySpatialAutoBezier(index); } catch (_) {}
        return key;
    }

    function exportProperty(property) {
        var result = {
            name: property.name,
            matchName: property.matchName,
            propertyType: String(property.propertyType)
        };
        var i;

        if (property.propertyType === PropertyType.PROPERTY) {
            result.keyframes = [];
            for (i = 1; i <= property.numKeys; i++) result.keyframes.push(exportKeyframe(property, i));
            if (property.numKeys === 0) {
                try { result.value = serializableValue(property.value); } catch (err) {
                    report.warnings.push("Could not read " + property.name + ": " + err.toString());
                }
            }
            if (property.canSetExpression && property.expressionEnabled) {
                result.expression = property.expression;
                pushUnique(report.unsupported, "expressions");
            }
        } else {
            result.children = [];
            for (i = 1; i <= property.numProperties; i++) {
                try { result.children.push(exportProperty(property.property(i))); }
                catch (err2) { report.warnings.push("Skipped property " + property.name + ": " + err2.toString()); }
            }
        }
        return result;
    }

    function layerType(layer) {
        if (layer instanceof TextLayer) return "text";
        if (layer instanceof ShapeLayer) return "shape";
        if (layer instanceof CameraLayer) return "camera";
        if (layer instanceof LightLayer) return "light";
        if (layer.nullLayer) return "null";
        if (layer.source instanceof CompItem) return "precomp";
        if (layer.source instanceof FootageItem) {
            if (layer.source.mainSource instanceof SolidSource) return "solid";
            return "image";
        }
        return "unknown";
    }

    function exportLayer(layer) {
        var type = layerType(layer);
        var result = {
            index: layer.index,
            name: layer.name,
            type: type,
            enabled: layer.enabled,
            shy: layer.shy,
            locked: layer.locked,
            guideLayer: layer.guideLayer,
            adjustmentLayer: layer.adjustmentLayer,
            threeDLayer: layer.threeDLayer,
            startTime: layer.startTime,
            inPoint: layer.inPoint,
            outPoint: layer.outPoint,
            stretch: layer.stretch,
            blendingMode: String(layer.blendingMode),
            trackMatteType: String(layer.trackMatteType),
            parentIndex: layer.parent ? layer.parent.index : null,
            transform: exportProperty(layer.property("ADBE Transform Group"))
        };

        if (layer.threeDLayer) pushUnique(report.unsupported, "3d-layers");
        if (String(layer.trackMatteType) !== String(TrackMatteType.NO_TRACK_MATTE)) pushUnique(report.unsupported, "track-mattes");
        if (type === "precomp") {
            pushUnique(report.unsupported, "precompositions");
            result.source = { name: layer.source.name, id: layer.source.id };
        }
        if (type === "text") {
            result.text = exportProperty(layer.property("ADBE Text Properties").property("ADBE Text Document"));
            var animators = layer.property("ADBE Text Properties").property("ADBE Text Animators");
            if (animators && animators.numProperties) {
                result.textAnimators = exportProperty(animators);
                pushUnique(report.unsupported, "text-animators");
            }
        }
        if (type === "shape") result.contents = exportProperty(layer.property("ADBE Root Vectors Group"));

        var masks = layer.property("ADBE Mask Parade");
        if (masks && masks.numProperties) {
            result.masks = exportProperty(masks);
            pushUnique(report.unsupported, "masks");
        }
        var effects = layer.property("ADBE Effect Parade");
        if (effects && effects.numProperties) {
            result.effects = exportProperty(effects);
            pushUnique(report.unsupported, "effects");
        }
        return result;
    }

    function escapeString(value) {
        return '"' + String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')
            .replace(/\r/g, "\\r").replace(/\n/g, "\\n").replace(/\t/g, "\\t") + '"';
    }

    function stringify(value, indent) {
        var level = indent || 0, pad = "", childPad = "", i, parts = [], key;
        for (i = 0; i < level; i++) pad += "  ";
        childPad = pad + "  ";
        if (value === null) return "null";
        if (typeof value === "string") return escapeString(value);
        if (typeof value === "number") return isFinite(value) ? String(value) : "null";
        if (typeof value === "boolean") return value ? "true" : "false";
        if (value instanceof Array) {
            if (!value.length) return "[]";
            for (i = 0; i < value.length; i++) parts.push(childPad + stringify(value[i], level + 1));
            return "[\n" + parts.join(",\n") + "\n" + pad + "]";
        }
        for (key in value) if (value.hasOwnProperty(key) && value[key] !== undefined) {
            parts.push(childPad + escapeString(key) + ": " + stringify(value[key], level + 1));
        }
        return parts.length ? "{\n" + parts.join(",\n") + "\n" + pad + "}" : "{}";
    }

    var scene = {
        format: "broadcast-scene",
        version: "0.1.0",
        source: { application: "After Effects", version: app.version, compName: comp.name, compId: comp.id },
        composition: {
            width: comp.width,
            height: comp.height,
            pixelAspect: comp.pixelAspect,
            duration: comp.duration,
            frameRate: comp.frameRate,
            displayStartTime: comp.displayStartTime,
            backgroundColor: arrayFrom(comp.bgColor)
        },
        layers: [],
        controls: [],
        report: report
    };

    var layerIndex;
    for (layerIndex = 1; layerIndex <= comp.numLayers; layerIndex++) {
        try { scene.layers.push(exportLayer(comp.layer(layerIndex))); }
        catch (err) { report.warnings.push("Skipped layer " + layerIndex + ": " + err.toString()); }
    }

    var output = File.saveDialog("Save Broadcast Scene", "Broadcast Scene:*.scene.json");
    if (!output) return;
    output.encoding = "UTF-8";
    if (!output.open("w")) abort("Could not open output file.");
    output.write(stringify(scene, 0));
    output.close();
    alert("Exported " + scene.layers.length + " layers to:\n" + output.fsName);
}());
