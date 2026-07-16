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



namespace {
bool matchesStructuredType(const ofJson& value, const std::string& type) {
    if (type == "object") return value.is_object();
    if (type == "array") return value.is_array();
    if (type == "string") return value.is_string();
    if (type == "boolean") return value.is_boolean();
    if (type == "integer") return value.is_number_integer();
    if (type == "number") return value.is_number();
    return true;
}

void validateStructuredValue(const ofJson& value, const ofJson& schema, const std::string& path,
                             std::vector<ControlValidationError>& errors) {
    const std::string type = schema.value("type", "");
    if (!type.empty() && !matchesStructuredType(value, type)) {
        errors.push_back({path, "Expected " + type + "."});
        return;
    }
    if (value.is_object()) {
        for (const auto& name : schema.value("required", ofJson::array())) {
            const std::string field = name.get<std::string>();
            if (!value.contains(field)) errors.push_back({path + "/" + field, "Required field is missing."});
        }
        const auto properties = schema.value("properties", ofJson::object());
        for (const auto& property : properties.items()) {
            if (value.contains(property.key())) {
                validateStructuredValue(value[property.key()], property.value(), path + "/" + property.key(), errors);
            }
        }
    } else if (value.is_array() && schema.contains("items") && schema["items"].is_object()) {
        for (std::size_t index = 0; index < value.size(); ++index) {
            validateStructuredValue(value[index], schema["items"], path + "/" + std::to_string(index), errors);
        }
    }
}
}

std::vector<ControlValidationError> Controls::validateData(const Scene& scene, const ofJson& data) {
    std::vector<ControlValidationError> errors;
    if (!data.is_object()) {
        errors.push_back({"/", "Control data must be an object."});
        return errors;
    }
    for (const auto& control : definitions(scene)) {
        const std::string id = control.value("id", "");
        if (id.empty() || !data.contains(id)) continue;
        const auto& value = data[id];
        const std::string type = normalizedType(control);
        const std::string path = "/" + id;
        bool valid = true;
        if (type == "string") valid = value.is_string();
        else if (type == "boolean") valid = value.is_boolean();
        else if (type == "integer") valid = value.is_number_integer();
        else if (type == "number") valid = value.is_number();
        else if (type == "color" || type == "vector" || type == "vector2" || type == "vector3") valid = value.is_array();
        else if (type == "object") valid = value.is_object();
        else if (type == "array") valid = value.is_array();
        else if (type == "media") valid = value.is_string() || value.is_object();
        else if (type == "json") valid = true;
        if (!valid) {
            errors.push_back({path, "Expected control type " + type + "."});
            continue;
        }
        if (value.is_number()) {
            const auto constraints = control.value("constraints", ofJson::object());
            const auto& minimumSource = constraints.contains("minimum") ? constraints : control;
            const auto& maximumSource = constraints.contains("maximum") ? constraints : control;
            if (minimumSource.contains("minimum") && value.get<double>() < minimumSource["minimum"].get<double>())
                errors.push_back({path, "Value is below minimum."});
            if (maximumSource.contains("maximum") && value.get<double>() > maximumSource["maximum"].get<double>())
                errors.push_back({path, "Value is above maximum."});
        }
        if ((type == "object" || type == "array") && control.contains("schema") && control["schema"].is_object()) {
            validateStructuredValue(value, control["schema"], path, errors);
        }
        if (control.contains("options") && control["options"].is_array()) {
            bool matched = false;
            for (const auto& option : control["options"]) {
                const auto& optionValue = option.is_object() && option.contains("value") ? option["value"] : option;
                if (optionValue == value) { matched = true; break; }
            }
            if (!matched) errors.push_back({path, "Value is not an allowed option."});
        }
    }
    return errors;
}

std::string Controls::normalizedType(const ofJson& control) {
    if (control.contains("options") && control["options"].is_array()) return "enum";
    std::string type = ofToLower(control.value("type", "unknown"));
    const std::string matchName = ofToLower(control.value("matchName", ""));
    if (type == "string" || type == "text") return "string";
    if (type == "boolean" || type == "checkbox") return "boolean";
    if (type == "integer" || type == "int") return "integer";
    if (type == "number" || type == "slider" || type == "float") return "number";
    if (type == "object" || type == "array" || type == "json" || type == "enum") return type;
    if (type == "media" || type == "asset") return "media";
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
