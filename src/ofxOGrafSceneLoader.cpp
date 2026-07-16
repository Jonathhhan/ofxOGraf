#include "ofxOGrafSceneLoader.h"
#include "ofFileUtils.h"
#include <stdexcept>
#include <algorithm>
#include <sstream>
#include <unordered_map>

namespace {

using BindingMap = std::unordered_map<std::string, std::string>;

struct SceneVersion {
    int major = -1;
    int minor = -1;
    int patch = -1;
};

SceneVersion parseSceneVersion(const ofJson& document) {
    if (!document.contains("version") || !document["version"].is_string()) {
        throw std::runtime_error("[scene.version.missing] Scene version must be a semantic version string.");
    }
    const std::string value = document["version"].get<std::string>();
    SceneVersion version;
    char first = 0;
    char second = 0;
    std::istringstream stream(value);
    if (!(stream >> version.major >> first >> version.minor >> second >> version.patch) ||
        first != '.' || second != '.' || stream.peek() != std::char_traits<char>::eof() ||
        version.major < 0 || version.minor < 0 || version.patch < 0) {
        throw std::runtime_error("[scene.version.invalid] Scene version must use major.minor.patch: " + value);
    }
    return version;
}

void requireSupportedVersion(const SceneVersion& version, const std::string& value) {
    if (version.major != 0 || version.minor < 1 || version.minor > 3) {
        throw std::runtime_error("[scene.version.unsupported] Unsupported Broadcast Scene version: " + value);
    }
}


bool isNeutral03(const ofJson& document) {
    return document.contains("rootCompositionId") && document.contains("compositions");
}

double frameRateValue(const ofJson& value) {
    if (value.is_number()) return value.get<double>();
    if (!value.is_object()) return 50.0;
    const double numerator = value.value("numerator", 50.0);
    const double denominator = value.value("denominator", 1.0);
    return denominator == 0.0 ? 50.0 : numerator / denominator;
}

ofJson scaled(ofJson value, double multiplier) {
    if (multiplier == 1.0) return value;
    if (value.is_number()) return value.get<double>() * multiplier;
    if (value.is_array()) {
        for (auto& item : value) item = scaled(item, multiplier);
    }
    return value;
}

ofJson legacyProperty(
    const ofJson& property,
    const std::string& name,
    const std::string& matchName,
    const ofJson& fallback,
    const BindingMap& bindings,
    double multiplier = 1.0) {
    ofJson result = {
        {"name", name},
        {"matchName", matchName},
        {"value", scaled(property.value("value", fallback), multiplier)}
    };
    for (const auto* key : {"keyframes", "samples"}) {
        if (!property.contains(key) || !property[key].is_array()) continue;
        result[key] = property[key];
        if (multiplier != 1.0) {
            for (auto& entry : result[key]) {
                if (entry.contains("value")) entry["value"] = scaled(entry["value"], multiplier);
            }
        }
    }
    const std::string id = property.value("id", "");
    const auto binding = bindings.find(id);
    if (binding != bindings.end()) {
        result["controlId"] = binding->second;
        if (multiplier != 1.0) result["controlMultiplier"] = multiplier;
    }
    return result;
}

BindingMap collectBindings(const ofJson& document) {
    BindingMap result;
    if (!document.contains("controls") || !document["controls"].is_array()) return result;
    for (const auto& control : document["controls"]) {
        const std::string controlId = control.value("id", "");
        if (controlId.empty() || !control.contains("bindings") || !control["bindings"].is_array()) continue;
        for (const auto& binding : control["bindings"]) {
            const std::string targetId = binding.value("targetId", "");
            if (!targetId.empty()) result[targetId] = controlId;
        }
    }
    return result;
}

ofJson legacyTransform(const ofJson& transform, const BindingMap& bindings) {
    const ofJson empty = ofJson::object();
    ofJson children = ofJson::array();
    children.push_back(legacyProperty(transform.value("anchor", empty), "Anchor Point", "ADBE Anchor Point",
                                      ofJson::array({0, 0, 0}), bindings));
    children.push_back(legacyProperty(transform.value("position", empty), "Position", "ADBE Position",
                                      ofJson::array({0, 0, 0}), bindings));
    children.push_back(legacyProperty(transform.value("scale", empty), "Scale", "ADBE Scale",
                                      ofJson::array({1, 1, 1}), bindings, 100.0));
    children.push_back(legacyProperty(transform.value("rotation", empty), "Orientation", "ADBE Orientation",
                                      ofJson::array({0, 0, 0}), bindings));
    children.push_back(legacyProperty(transform.value("opacity", empty), "Opacity", "ADBE Opacity",
                                      1.0, bindings, 100.0));
    return {
        {"name", "Transform"},
        {"matchName", "ADBE Transform Group"},
        {"children", std::move(children)}
    };
}

ofJson legacyText(const ofJson& layer, const BindingMap& bindings) {
    const auto& content = layer.at("content");
    const ofJson source = content.value("source", ofJson::object());
    const ofJson style = content.value("style", ofJson::object());
    const ofJson fontSize = style.value("fontSize", ofJson::object());
    const ofJson fill = style.value("fill", ofJson::object());
    ofJson document = {
        {"text", source.value("value", layer.value("name", ""))},
        {"font", style.value("fontAssetId", style.value("fontFamily", ""))},
        {"fontSize", fontSize.value("value", 32.0)},
        {"fillColor", fill.value("value", ofJson::array({1, 1, 1, 1}))},
        {"applyFill", true}
    };
    ofJson result = {
        {"name", "Source Text"},
        {"matchName", "ADBE Text Document"},
        {"value", std::move(document)}
    };
    const auto binding = bindings.find(source.value("id", ""));
    if (binding != bindings.end()) result["controlId"] = binding->second;
    const auto fontSizeBinding = bindings.find(fontSize.value("id", ""));
    if (fontSizeBinding != bindings.end()) {
        result["styleControlIds"]["fontSize"] = fontSizeBinding->second;
    }
    const auto fillBinding = bindings.find(fill.value("id", ""));
    if (fillBinding != bindings.end()) {
        result["styleControlIds"]["fillColor"] = fillBinding->second;
    }
    return result;
}

ofJson legacyShape(const ofJson& layer, const BindingMap& bindings) {
    const auto& content = layer.at("content");
    const ofJson geometry = content.value("geometry", ofJson::object());
    const ofJson style = content.value("style", ofJson::object());
    const std::string geometryType = geometry.value("type", "rectangle");

    ofJson geometryChildren = ofJson::array();
    std::string geometryMatchName = "ADBE Vector Shape - Rect";
    if (geometryType == "ellipse") geometryMatchName = "ADBE Vector Shape - Ellipse";
    if (geometryType == "path") geometryMatchName = "ADBE Vector Shape - Group";

    if (geometryType == "path") {
        geometryChildren.push_back({
            {"name", "Path"},
            {"matchName", "ADBE Vector Shape"},
            {"value", {
                {"vertices", geometry.value("vertices", ofJson::array())},
                {"inTangents", geometry.value("inTangents", ofJson::array())},
                {"outTangents", geometry.value("outTangents", ofJson::array())},
                {"closed", geometry.value("closed", false)}
            }}
        });
    } else {
        const std::string prefix = geometryType == "ellipse" ? "Ellipse" : "Rect";
        const std::string matchPrefix = geometryType == "ellipse" ? "ADBE Vector Ellipse " : "ADBE Vector Rect ";
        geometryChildren.push_back({
            {"name", prefix + " Size"},
            {"matchName", matchPrefix + "Size"},
            {"value", geometry.value("size", ofJson::array({0, 0}))}
        });
        geometryChildren.push_back({
            {"name", prefix + " Position"},
            {"matchName", matchPrefix + "Position"},
            {"value", geometry.value("position", ofJson::array({0, 0}))}
        });
    }

    ofJson children = ofJson::array({
        {
            {"name", "Geometry"},
            {"matchName", geometryMatchName},
            {"children", std::move(geometryChildren)}
        }
    });

    if (style.contains("fill")) {
        children.push_back({
            {"name", "Fill"},
            {"matchName", "ADBE Vector Graphic - Fill"},
            {"children", ofJson::array({
                legacyProperty(style["fill"], "Color", "ADBE Vector Fill Color",
                               ofJson::array({1, 1, 1, 1}), bindings)
            })}
        });
    }
    if (style.contains("stroke") && style["stroke"].is_object()) {
        const auto& stroke = style["stroke"];
        children.push_back({
            {"name", "Stroke"},
            {"matchName", "ADBE Vector Graphic - Stroke"},
            {"children", ofJson::array({
                legacyProperty(stroke.value("color", ofJson::object()), "Color", "ADBE Vector Stroke Color",
                               ofJson::array({0, 0, 0, 1}), bindings),
                legacyProperty(stroke.value("width", ofJson::object()), "Width", "ADBE Vector Stroke Width",
                               0.0, bindings)
            })}
        });
    }
    return {
        {"name", "Contents"},
        {"matchName", "ADBE Root Vectors Group"},
        {"children", std::move(children)}
    };
}

ofJson legacyAssets(const ofJson& document) {
    ofJson result = {{"fonts", ofJson::array()}, {"images", ofJson::array()}};
    if (!document.contains("assets") || !document["assets"].is_array()) return result;
    for (const auto& asset : document["assets"]) {
        const std::string type = asset.value("type", "");
        const std::string id = asset.value("id", "");
        const std::string uri = asset.value("uri", "");
        if (type == "font") {
            result["fonts"].push_back({
                {"postScriptName", id},
                {"family", asset.value("family", id)},
                {"file", uri}
            });
        } else if (type == "image") {
            result["images"].push_back({{"id", id}, {"file", uri}});
        }
    }
    return result;
}

ofJson legacyComposition(const ofJson& composition, const BindingMap& bindings) {
    const double duration = composition.value("duration", 0.0);
    ofJson result = {
        {"id", composition.value("id", "")},
        {"name", composition.value("name", "")},
        {"composition", {
            {"width", composition.value("width", 1920)},
            {"height", composition.value("height", 1080)},
            {"duration", duration},
            {"frameRate", frameRateValue(composition.value("frameRate", ofJson(50.0)))}
        }},
        {"layers", ofJson::array()}
    };

    std::unordered_map<std::string, int> indices;
    int index = 1;
    for (const auto& layer : composition.value("layers", ofJson::array())) {
        indices[layer.value("id", "")] = index++;
    }

    index = 1;
    for (const auto& layer : composition.value("layers", ofJson::array())) {
        const ofJson timing = layer.value("timing", ofJson::object());
        const double start = timing.value("start", 0.0);
        const double layerDuration = timing.value("duration", duration);
        ofJson converted = {
            {"index", index++},
            {"id", layer.value("id", "")},
            {"name", layer.value("name", "")},
            {"type", layer.value("type", "unknown")},
            {"enabled", layer.value("enabled", true)},
            {"inPoint", start},
            {"outPoint", start + layerDuration},
            {"transform", legacyTransform(layer.value("transform", ofJson::object()), bindings)}
        };
        const std::string parentId = layer.value("parentId", "");
        const auto parent = indices.find(parentId);
        converted["parentIndex"] = parent == indices.end() ? 0 : parent->second;

        if (layer.value("type", "") == "text" && layer.contains("content")) {
            converted["text"] = legacyText(layer, bindings);
        } else if (layer.value("type", "") == "shape" && layer.contains("content")) {
            converted["contents"] = legacyShape(layer, bindings);
        } else if (layer.value("type", "") == "repeat" && layer.contains("content")) {
            converted["repeat"] = layer["content"];
            converted["controlId"] = layer["content"].value("controlId", "");
        } else if (layer.value("type", "") == "image" && layer.contains("content")) {
            converted["source"] = {
                {"assetId", layer["content"].value("assetId", "")}
            };
            converted["width"] = layer["content"].value("width", 0);
            converted["height"] = layer["content"].value("height", 0);
        }
        result["layers"].push_back(std::move(converted));
    }
    return result;
}

ofJson compileNeutral03(const ofJson& document) {
    if (!isNeutral03(document)) return document;
    const BindingMap bindings = collectBindings(document);
    const std::string rootId = document.value("rootCompositionId", "");
    const ofJson* root = nullptr;
    for (const auto& composition : document.at("compositions")) {
        if (composition.value("id", "") == rootId) {
            root = &composition;
            break;
        }
    }
    if (!root) throw std::runtime_error("Neutral scene rootCompositionId does not reference a composition.");

    ofJson compiled = document;
    ofJson rootComposition = legacyComposition(*root, bindings);
    compiled["composition"] = rootComposition["composition"];
    compiled["composition"]["id"] = rootComposition.value("id", rootId);
    compiled["layers"] = rootComposition["layers"];
    compiled["assets"] = legacyAssets(document);
    compiled["compositions"] = ofJson::array();
    for (const auto& composition : document.at("compositions")) {
        if (composition.value("id", "") == rootId) continue;
        compiled["compositions"].push_back(legacyComposition(composition, bindings));
    }
    compiled["extensions"]["cc.openframeworks.ofxograf"] = {
        {"version", "1.0.0"},
        {"data", {{"compiledFrom", "broadcast-scene-0.3"}}}
    };
    compiled["version"] = ofxOGraf::SceneLoader::RuntimeVersion;
    return compiled;
}

} // namespace

namespace ofxOGraf {

void SceneLoader::validate(const ofJson& json) {
    if (!json.is_object()) throw std::runtime_error("Scene root must be an object.");
    const SceneVersion version = parseSceneVersion(json);
    const std::string versionText = json.at("version").get<std::string>();
    requireSupportedVersion(version, versionText);
    if (version.minor == 3 && !isNeutral03(json)) {
        throw std::runtime_error("[scene.version.structure] Broadcast Scene 0.3 requires the neutral compositions model.");
    }
    if (json.value("format", "") != "broadcast-scene") {
        throw std::runtime_error("Unsupported or missing scene format.");
    }
    if (version.minor == 3) {
        if (!json["compositions"].is_array() || json["compositions"].empty()) {
            throw std::runtime_error("Neutral scene has no compositions.");
        }
        const std::string rootId = json.value("rootCompositionId", "");
        bool foundRoot = false;
        for (const auto& composition : json["compositions"]) {
            if (!composition.is_object() || !composition.contains("id") ||
                !composition.contains("layers") || !composition["layers"].is_array()) {
                throw std::runtime_error("Neutral scene contains an invalid composition.");
            }
            if (composition.value("id", "") == rootId) foundRoot = true;
        }
        if (!foundRoot) throw std::runtime_error("Neutral scene rootCompositionId is invalid.");
        return;
    }
    if (!json.contains("composition") || !json["composition"].is_object()) {
        throw std::runtime_error("Scene has no composition object.");
    }
    if (!json.contains("layers") || !json["layers"].is_array()) {
        throw std::runtime_error("Scene has no layers array.");
    }
}

Scene SceneLoader::loadFile(const std::string& path) {
    ofFile file(path);
    if (!file.exists()) throw std::runtime_error("Scene file does not exist: " + path);
    return loadString(file.readToBuffer().getText());
}

Scene SceneLoader::loadString(const std::string& jsonText) {
    return loadJson(ofJson::parse(jsonText));
}

SceneMigrationResult SceneLoader::migrate(const ofJson& json) {
    if (!json.is_object()) throw std::runtime_error("Scene root must be an object.");
    if (json.value("format", "") != "broadcast-scene") {
        throw std::runtime_error("Unsupported or missing scene format.");
    }
    const SceneVersion version = parseSceneVersion(json);
    const std::string versionText = json.at("version").get<std::string>();
    requireSupportedVersion(version, versionText);

    SceneMigrationResult result;
    result.sourceVersion = versionText;
    result.runtimeVersion = RuntimeVersion;
    result.document = json;

    if (version.minor == 1) {
        result.document["version"] = RuntimeVersion;
        result.migrated = true;
        result.diagnostics.push_back({
            "scene.migration.legacy-01", "/version",
            "Broadcast Scene 0.1 was upgraded to the compatible 0.2 runtime representation."
        });
    } else if (version.minor == 2) {
        result.runtimeVersion = versionText;
    } else {
        if (!isNeutral03(json)) {
            throw std::runtime_error("[scene.version.structure] Broadcast Scene 0.3 requires the neutral compositions model.");
        }
        result.document = compileNeutral03(json);
        result.migrated = true;
        result.diagnostics.push_back({
            "scene.migration.neutral-03", "/",
            "Broadcast Scene 0.3 was compiled to the 0.2 runtime representation without changing stable IDs."
        });
    }
    return result;
}


Scene SceneLoader::loadJson(const ofJson& json) {
    const SceneMigrationResult migration = migrate(json);
    validate(migration.document);
    const ofJson& compiled = migration.document;
    Scene scene;
    scene.raw = compiled;
    const auto& composition = compiled.at("composition");
    scene.width = composition.value("width", 1920);
    scene.height = composition.value("height", 1080);
    scene.duration = composition.value("duration", 0.0);
    scene.frameRate = composition.value("frameRate", 50.0);
    scene.document = json;

    for (const auto& value : compiled.at("layers")) {
        Layer layer;
        layer.index = value.value("index", 0);
        layer.name = value.value("name", "");
        layer.type = value.value("type", "unknown");
        layer.enabled = value.value("enabled", true);
        layer.inPoint = value.value("inPoint", 0.0);
        layer.outPoint = value.value("outPoint", scene.duration);
        if (value.contains("parentIndex") && value["parentIndex"].is_number_integer()) {
            layer.parentIndex = value["parentIndex"].get<int>();
        }
        layer.source = value;
        scene.layers.push_back(std::move(layer));
    }
    return scene;
}

} // namespace ofxOGraf
