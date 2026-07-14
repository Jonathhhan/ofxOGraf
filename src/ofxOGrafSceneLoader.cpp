#include "ofxOGrafSceneLoader.h"
#include "ofFileUtils.h"
#include <stdexcept>

namespace ofxOGraf {

void SceneLoader::validate(const ofJson& json) {
    if (!json.is_object()) throw std::runtime_error("Scene root must be an object.");
    if (json.value("format", "") != "broadcast-scene") {
        throw std::runtime_error("Unsupported or missing scene format.");
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

Scene SceneLoader::loadJson(const ofJson& json) {
    validate(json);
    Scene scene;
    scene.raw = json;
    const auto& composition = json.at("composition");
    scene.width = composition.value("width", 1920);
    scene.height = composition.value("height", 1080);
    scene.duration = composition.value("duration", 0.0);
    scene.frameRate = composition.value("frameRate", 50.0);

    for (const auto& value : json.at("layers")) {
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
