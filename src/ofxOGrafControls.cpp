#include "ofxOGrafControls.h"
#include "ofUtils.h"

namespace ofxOGraf {

const ofJson& Controls::definitions(const Scene& scene) {
    static const ofJson empty = ofJson::array();
    const auto& document = scene.sourceDocument();
    if (!document.contains("controls") || !document["controls"].is_array()) return empty;
    return document["controls"];
}

ofJson Controls::defaultData(const Scene& scene) {
    ofJson result = ofJson::object();
    for (const auto& control : definitions(scene)) {
        if (!control.is_object() || !control.contains("default")) continue;
        const std::string id = control.value("id", "");
        if (!id.empty()) result[id] = control["default"];
    }
    return result;
}

ofJson Controls::withDefaults(const Scene& scene, const ofJson& data) {
    ofJson result = defaultData(scene);
    if (data.is_object()) result.merge_patch(data);
    return result;
}

std::string Controls::normalizedType(const ofJson& control) {
    if (control.contains("options") && control["options"].is_array()) return "enum";
    std::string type = ofToLower(control.value("type", "unknown"));
    const std::string matchName = ofToLower(control.value("matchName", ""));
    if (type == "string" || type == "text") return "string";
    if (type == "boolean" || type == "checkbox") return "boolean";
    if (type == "integer" || type == "int") return "integer";
    if (type == "number" || type == "slider" || type == "float") return "number";
    if (type == "color" || matchName.find("color") != std::string::npos) return "color";
    if (type.find("vector") != std::string::npos) return type == "color-or-vector" ? "color" : "vector";
    if (control.contains("default")) {
        const auto& value = control["default"];
        if (value.is_boolean()) return "boolean";
        if (value.is_number_integer()) return "integer";
        if (value.is_number()) return "number";
        if (value.is_string()) return "string";
        if (value.is_array()) return value.size() >= 3 ? "color" : "vector";
    }
    return "string";
}

} // namespace ofxOGraf
