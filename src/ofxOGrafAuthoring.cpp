#include "ofxOGrafAuthoring.h"
#include <algorithm>
#include <cctype>
#include <cmath>
#include <limits>
#include <cstdint>
#include <fstream>
#include <functional>
#include <iomanip>
#include <sstream>
#include <unordered_map>
#include <unordered_set>
#include <utility>

namespace ofxOGraf {
namespace {

ofJson vector2(Vector2 value) { return ofJson::array({value.x, value.y}); }
ofJson vector3(Vector3 value) { return ofJson::array({value.x, value.y, value.z}); }
ofJson color(Color value) { return ofJson::array({value.r, value.g, value.b, value.a}); }

bool validId(const std::string& value) {
    if (value.empty()) return false;
    for (const unsigned char c : value) {
        if (!(std::isalnum(c) || c == '.' || c == ':' || c == '_' || c == '-')) return false;
    }
    return true;
}

bool portableUri(const std::string& value) {
    if (value.empty() || value.front() == '/' || value.find('\\') != std::string::npos) return false;
    if (value.size() > 1 && std::isalpha(static_cast<unsigned char>(value[0])) && value[1] == ':') return false;
    std::istringstream stream(value);
    std::string segment;
    while (std::getline(stream, segment, '/')) if (segment == "..") return false;
    return true;
}

std::string propertyId(const std::string& layerId, const std::string& suffix) {
    return layerId + "." + suffix;
}

} // namespace

ShapeGeometry ShapeGeometry::rectangle(double width, double height, double radius) {
    ShapeGeometry result;
    result.type = "rectangle";
    result.data = {{"size", ofJson::array({width, height})}, {"radius", radius}};
    return result;
}

ShapeGeometry ShapeGeometry::ellipse(double width, double height) {
    ShapeGeometry result;
    result.type = "ellipse";
    result.data = {{"size", ofJson::array({width, height})}};
    return result;
}

ShapeGeometry ShapeGeometry::path(const std::vector<Vector2>& vertices, bool closed) {
    ShapeGeometry result;
    result.type = "path";
    result.data = {{"vertices", ofJson::array()}, {"closed", closed}};
    for (const auto& vertex : vertices) result.data["vertices"].push_back(vector2(vertex));
    return result;
}

LayerBuilder::LayerBuilder(SceneBuilder* owner, std::string compId, std::string id)
    : scene(owner), compositionId(std::move(compId)), layerId(std::move(id)) {}

ofJson* LayerBuilder::layer() {
    return scene ? scene->findLayer(compositionId, layerId) : nullptr;
}

std::string LayerBuilder::anchorPropertyId() const { return propertyId(layerId, "transform.anchor"); }
std::string LayerBuilder::positionPropertyId() const { return propertyId(layerId, "transform.position"); }
std::string LayerBuilder::scalePropertyId() const { return propertyId(layerId, "transform.scale"); }
std::string LayerBuilder::rotationPropertyId() const { return propertyId(layerId, "transform.rotation"); }
std::string LayerBuilder::opacityPropertyId() const { return propertyId(layerId, "transform.opacity"); }

LayerBuilder& LayerBuilder::enabled(bool value) {
    if (auto* valueLayer = layer()) (*valueLayer)["enabled"] = value;
    return *this;
}

LayerBuilder& LayerBuilder::timing(double start, double duration) {
    if (auto* valueLayer = layer()) (*valueLayer)["timing"] = {{"start", start}, {"duration", duration}};
    return *this;
}

LayerBuilder& LayerBuilder::parent(const std::string& parentLayerId) {
    if (auto* valueLayer = layer()) (*valueLayer)["parentId"] = parentLayerId;
    return *this;
}

LayerBuilder& LayerBuilder::anchor(Vector3 value) {
    if (auto* valueLayer = layer()) (*valueLayer)["transform"]["anchor"]["value"] = vector3(value);
    return *this;
}

LayerBuilder& LayerBuilder::position(Vector3 value) {
    if (auto* valueLayer = layer()) (*valueLayer)["transform"]["position"]["value"] = vector3(value);
    return *this;
}

LayerBuilder& LayerBuilder::scale(Vector3 value) {
    if (auto* valueLayer = layer()) (*valueLayer)["transform"]["scale"]["value"] = vector3(value);
    return *this;
}

LayerBuilder& LayerBuilder::rotation(Vector3 value) {
    if (auto* valueLayer = layer()) (*valueLayer)["transform"]["rotation"]["value"] = vector3(value);
    return *this;
}

LayerBuilder& LayerBuilder::opacity(double value) {
    if (auto* valueLayer = layer()) (*valueLayer)["transform"]["opacity"]["value"] = value;
    return *this;
}

LayerBuilder& LayerBuilder::extension(const std::string& namespaceId, const ofJson& data,
                                      const std::string& version) {
    if (auto* valueLayer = layer()) SceneBuilder::setExtension(*valueLayer, namespaceId, version, data);
    return *this;
}

std::string TextLayerBuilder::textPropertyId() const { return propertyId(layerId, "content.text"); }
std::string TextLayerBuilder::fontSizePropertyId() const { return propertyId(layerId, "style.fontSize"); }
std::string TextLayerBuilder::fillPropertyId() const { return propertyId(layerId, "style.fill"); }

TextLayerBuilder& TextLayerBuilder::text(const std::string& value) {
    if (auto* valueLayer = layer()) (*valueLayer)["content"]["source"]["value"] = value;
    return *this;
}

TextLayerBuilder& TextLayerBuilder::font(const std::string& family, double size) {
    if (auto* valueLayer = layer()) {
        (*valueLayer)["content"]["style"]["fontFamily"] = family;
        (*valueLayer)["content"]["style"]["fontSize"]["value"] = size;
    }
    return *this;
}

TextLayerBuilder& TextLayerBuilder::fontAsset(const std::string& assetId) {
    if (auto* valueLayer = layer()) (*valueLayer)["content"]["style"]["fontAssetId"] = assetId;
    return *this;
}

TextLayerBuilder& TextLayerBuilder::fill(Color value) {
    if (auto* valueLayer = layer()) (*valueLayer)["content"]["style"]["fill"]["value"] = color(value);
    return *this;
}

TextLayerBuilder& TextLayerBuilder::alignment(const std::string& value) {
    if (auto* valueLayer = layer()) (*valueLayer)["content"]["style"]["alignment"] = value;
    return *this;
}

std::string ShapeLayerBuilder::geometryPropertyId() const { return propertyId(layerId, "content.geometry"); }
std::string ShapeLayerBuilder::fillPropertyId() const { return propertyId(layerId, "style.fill"); }
std::string ShapeLayerBuilder::strokeColorPropertyId() const { return propertyId(layerId, "style.stroke.color"); }
std::string ShapeLayerBuilder::strokeWidthPropertyId() const { return propertyId(layerId, "style.stroke.width"); }

ShapeLayerBuilder& ShapeLayerBuilder::geometry(const ShapeGeometry& value) {
    if (auto* valueLayer = layer()) {
        ofJson geometryValue = value.data;
        geometryValue["id"] = geometryPropertyId();
        geometryValue["type"] = value.type;
        (*valueLayer)["content"]["geometry"] = std::move(geometryValue);
    }
    return *this;
}

ShapeLayerBuilder& ShapeLayerBuilder::fill(Color value) {
    if (auto* valueLayer = layer()) (*valueLayer)["content"]["style"]["fill"] = SceneBuilder::property(fillPropertyId(), "color", color(value));
    return *this;
}

ShapeLayerBuilder& ShapeLayerBuilder::noFill() {
    if (auto* valueLayer = layer()) (*valueLayer)["content"]["style"].erase("fill");
    return *this;
}

ShapeLayerBuilder& ShapeLayerBuilder::stroke(Color value, double width) {
    if (auto* valueLayer = layer()) {
        (*valueLayer)["content"]["style"]["stroke"] = {
            {"color", SceneBuilder::property(strokeColorPropertyId(), "color", color(value))},
            {"width", SceneBuilder::property(strokeWidthPropertyId(), "scalar", width)}
        };
    }
    return *this;
}

CompositionBuilder::CompositionBuilder(SceneBuilder* owner, std::string id)
    : scene(owner), compositionId(std::move(id)) {}

CompositionBuilder& CompositionBuilder::extension(const std::string& namespaceId, const ofJson& data,
                                                  const std::string& version) {
    if (scene) if (auto* value = scene->findComposition(compositionId)) SceneBuilder::setExtension(*value, namespaceId, version, data);
    return *this;
}

TextLayerBuilder CompositionBuilder::textLayer(const std::string& id, const std::string& name,
                                               const std::string& text) {
    if (scene) if (auto* comp = scene->findComposition(compositionId)) {
        ofJson layerValue = {
            {"id", id}, {"name", name}, {"type", "text"}, {"enabled", true},
            {"timing", {{"start", 0.0}, {"duration", comp->value("duration", 0.0)}}},
            {"transform", {
                {"anchor", SceneBuilder::property(propertyId(id, "transform.anchor"), "vector3", ofJson::array({0.0, 0.0, 0.0}))},
                {"position", SceneBuilder::property(propertyId(id, "transform.position"), "vector3", ofJson::array({0.0, 0.0, 0.0}))},
                {"scale", SceneBuilder::property(propertyId(id, "transform.scale"), "vector3", ofJson::array({1.0, 1.0, 1.0}))},
                {"rotation", SceneBuilder::property(propertyId(id, "transform.rotation"), "vector3", ofJson::array({0.0, 0.0, 0.0}))},
                {"opacity", SceneBuilder::property(propertyId(id, "transform.opacity"), "scalar", 1.0)}
            }},
            {"content", {
                {"type", "text"},
                {"source", SceneBuilder::property(propertyId(id, "content.text"), "string", text)},
                {"style", {
                    {"fontFamily", ""},
                    {"fontSize", SceneBuilder::property(propertyId(id, "style.fontSize"), "scalar", 32.0)},
                    {"fill", SceneBuilder::property(propertyId(id, "style.fill"), "color", ofJson::array({1.0, 1.0, 1.0, 1.0}))},
                    {"alignment", "left"}
                }}
            }},
            {"extensions", ofJson::object()}
        };
        (*comp)["layers"].push_back(std::move(layerValue));
    }
    return TextLayerBuilder(scene, compositionId, id);
}

ShapeLayerBuilder CompositionBuilder::shapeLayer(const std::string& id, const std::string& name,
                                                 const ShapeGeometry& geometry) {
    if (scene) if (auto* comp = scene->findComposition(compositionId)) {
        ofJson geometryValue = geometry.data;
        geometryValue["id"] = propertyId(id, "content.geometry");
        geometryValue["type"] = geometry.type;
        ofJson layerValue = {
            {"id", id}, {"name", name}, {"type", "shape"}, {"enabled", true},
            {"timing", {{"start", 0.0}, {"duration", comp->value("duration", 0.0)}}},
            {"transform", {
                {"anchor", SceneBuilder::property(propertyId(id, "transform.anchor"), "vector3", ofJson::array({0.0, 0.0, 0.0}))},
                {"position", SceneBuilder::property(propertyId(id, "transform.position"), "vector3", ofJson::array({0.0, 0.0, 0.0}))},
                {"scale", SceneBuilder::property(propertyId(id, "transform.scale"), "vector3", ofJson::array({1.0, 1.0, 1.0}))},
                {"rotation", SceneBuilder::property(propertyId(id, "transform.rotation"), "vector3", ofJson::array({0.0, 0.0, 0.0}))},
                {"opacity", SceneBuilder::property(propertyId(id, "transform.opacity"), "scalar", 1.0)}
            }},
            {"content", {
                {"type", "shape"}, {"geometry", geometryValue},
                {"style", {{"fill", SceneBuilder::property(propertyId(id, "style.fill"), "color", ofJson::array({1.0, 1.0, 1.0, 1.0}))}}}
            }},
            {"extensions", ofJson::object()}
        };
        (*comp)["layers"].push_back(std::move(layerValue));
    }
    return ShapeLayerBuilder(scene, compositionId, id);
}

ControlBuilder::ControlBuilder(SceneBuilder* owner, std::string id)
    : scene(owner), controlId(std::move(id)) {}

ControlBuilder& ControlBuilder::bind(const std::string& targetPropertyId, const std::string& conversion) {
    if (scene) if (auto* value = scene->findControl(controlId))
        (*value)["bindings"].push_back({{"targetId", targetPropertyId}, {"conversion", conversion}});
    return *this;
}

ControlBuilder& ControlBuilder::range(double minimum, double maximum, double step) {
    if (scene) if (auto* value = scene->findControl(controlId)) {
        (*value)["constraints"] = {{"minimum", minimum}, {"maximum", maximum}};
        if (step > 0.0) (*value)["constraints"]["step"] = step;
    }
    return *this;
}

ControlBuilder& ControlBuilder::ui(const std::string& group, int order, const std::string& description) {
    if (scene) if (auto* value = scene->findControl(controlId)) {
        (*value)["ui"] = {{"group", group}, {"order", order}};
        if (!description.empty()) (*value)["ui"]["description"] = description;
    }
    return *this;
}

ControlBuilder& ControlBuilder::extension(const std::string& namespaceId, const ofJson& data,
                                          const std::string& version) {
    if (scene) if (auto* value = scene->findControl(controlId)) SceneBuilder::setExtension(*value, namespaceId, version, data);
    return *this;
}

SceneBuilder::SceneBuilder(const std::string& sceneId) {
    document = {
        {"$schema", "https://ofxograf.dev/schema/broadcast-scene-0.3.schema.json"},
        {"format", "broadcast-scene"}, {"version", "0.3.0"}, {"id", sceneId},
        {"generator", {{"id", "cc.openframeworks.ofxograf.builder"}, {"version", "0.3.0"}}},
        {"provenance", ofJson::array()},
        {"coordinateSystem", {{"origin", "top-left"}, {"xAxis", "right"}, {"yAxis", "down"}, {"units", "pixels"}}},
        {"rootCompositionId", ""}, {"compositions", ofJson::array()}, {"assets", ofJson::array()},
        {"controls", ofJson::array()}, {"actions", ofJson::array()},
        {"requiredExtensions", ofJson::array()}, {"extensions", ofJson::object()}
    };
}

SceneBuilder& SceneBuilder::generator(const std::string& toolId, const std::string& version) {
    document["generator"] = {{"id", toolId}, {"version", version}};
    return *this;
}

SceneBuilder& SceneBuilder::provenance(const std::string& operation, const std::string& toolId,
                                      const std::string& toolVersion, const ofJson& source,
                                      const ofJson& losses) {
    ofJson value = {{"operation", operation}, {"tool", {{"id", toolId}, {"version", toolVersion}}}};
    if (source.is_object() && !source.empty()) value["source"] = source;
    if (losses.is_array() && !losses.empty()) value["losses"] = losses;
    document["provenance"].push_back(std::move(value));
    return *this;
}

SceneBuilder& SceneBuilder::extension(const std::string& namespaceId, const ofJson& data,
                                     const std::string& version) {
    setExtension(document, namespaceId, version, data);
    return *this;
}

SceneBuilder& SceneBuilder::requireExtension(const std::string& namespaceId,
                                            const std::string& versionRange,
                                            const std::vector<std::string>& capabilities) {
    document["requiredExtensions"].push_back({{"id", namespaceId}, {"version", versionRange}, {"capabilities", capabilities}});
    return *this;
}

CompositionBuilder SceneBuilder::composition(const std::string& id, const std::string& name,
                                             int width, int height, double duration,
                                             RationalFrameRate frameRate) {
    document["compositions"].push_back({
        {"id", id}, {"name", name}, {"width", width}, {"height", height}, {"duration", duration},
        {"frameRate", {{"numerator", frameRate.numerator}, {"denominator", frameRate.denominator}}},
        {"layers", ofJson::array()}, {"extensions", ofJson::object()}
    });
    if (document.value("rootCompositionId", std::string()).empty()) document["rootCompositionId"] = id;
    return CompositionBuilder(this, id);
}

SceneBuilder& SceneBuilder::rootComposition(const std::string& compositionId) {
    document["rootCompositionId"] = compositionId;
    return *this;
}
SceneBuilder& SceneBuilder::animate(const std::string& propertyId,
                                    const std::vector<AuthoringKeyframe>& keyframes) {
    if (auto* value = findProperty(propertyId)) {
        std::vector<AuthoringKeyframe> ordered = keyframes;
        std::stable_sort(ordered.begin(), ordered.end(),
                         [](const AuthoringKeyframe& left, const AuthoringKeyframe& right) {
                             return left.time < right.time;
                         });
        (*value)["keyframes"] = ofJson::array();
        for (const auto& keyframe : ordered) {
            (*value)["keyframes"].push_back({
                {"time", keyframe.time},
                {"value", keyframe.value},
                {"inInterpolation", keyframe.interpolation},
                {"outInterpolation", keyframe.interpolation}
            });
        }
    }
    return *this;
}

SceneBuilder& SceneBuilder::imageAsset(const std::string& id, const std::string& uri,
                                      int width, int height, const std::string& sha256) {
    ofJson value = {{"id", id}, {"type", "image"}, {"uri", uri}, {"extensions", ofJson::object()}};
    if (width > 0) value["width"] = width;
    if (height > 0) value["height"] = height;
    if (!sha256.empty()) value["sha256"] = sha256;
    document["assets"].push_back(std::move(value));
    return *this;
}

SceneBuilder& SceneBuilder::fontAsset(const std::string& id, const std::string& uri,
                                     const std::string& family, const std::string& style,
                                     const std::string& sha256) {
    ofJson value = {{"id", id}, {"type", "font"}, {"uri", uri}, {"family", family},
                    {"style", style}, {"extensions", ofJson::object()}};
    if (!sha256.empty()) value["sha256"] = sha256;
    document["assets"].push_back(std::move(value));
    return *this;
}

ControlBuilder SceneBuilder::control(const std::string& id, const std::string& name,
                                     const std::string& type, const ofJson& defaultValue) {
    document["controls"].push_back({{"id", id}, {"name", name}, {"type", type},
                                    {"default", defaultValue}, {"bindings", ofJson::array()},
                                    {"ui", ofJson::object()}, {"extensions", ofJson::object()}});
    return ControlBuilder(this, id);
}

SceneBuilder& SceneBuilder::action(const std::string& id, const std::string& name,
                                  const std::string& type, const ofJson& parameters) {
    document["actions"].push_back({{"id", id}, {"name", name}, {"type", type},
                                   {"parameters", parameters}, {"extensions", ofJson::object()}});
    return *this;
}

ofJson* SceneBuilder::findComposition(const std::string& id) {
    for (auto& value : document["compositions"]) if (value.value("id", std::string()) == id) return &value;
    return nullptr;
}

const ofJson* SceneBuilder::findComposition(const std::string& id) const {
    for (const auto& value : document["compositions"]) if (value.value("id", std::string()) == id) return &value;
    return nullptr;
}

ofJson* SceneBuilder::findLayer(const std::string& compId, const std::string& id) {
    if (auto* comp = findComposition(compId))
        for (auto& value : (*comp)["layers"]) if (value.value("id", std::string()) == id) return &value;
    return nullptr;
}

ofJson* SceneBuilder::findProperty(const std::string& propertyId) {
    ofJson* result = nullptr;
    const auto visit = [&](const auto& self, ofJson& value) -> void {
        if (result) return;
        if (value.is_object()) {
            if (value.value("id", std::string()) == propertyId &&
                value.contains("type") && value.contains("value")) {
                result = &value;
                return;
            }
            for (auto it = value.begin(); it != value.end(); ++it) self(self, it.value());
        } else if (value.is_array()) {
            for (auto& item : value) self(self, item);
        }
    };
    for (auto& composition : document["compositions"]) visit(visit, composition);
    return result;
}
ofJson* SceneBuilder::findControl(const std::string& id) {
    for (auto& value : document["controls"]) if (value.value("id", std::string()) == id) return &value;
    return nullptr;
}

ofJson SceneBuilder::property(const std::string& id, const std::string& type, const ofJson& value) {
    return {{"id", id}, {"type", type}, {"value", value}};
}

void SceneBuilder::setExtension(ofJson& object, const std::string& namespaceId,
                                const std::string& version, const ofJson& data) {
    if (!object.contains("extensions") || !object["extensions"].is_object()) object["extensions"] = ofJson::object();
    object["extensions"][namespaceId] = {{"version", version}, {"data", data}};
}

std::vector<AuthoringDiagnostic> SceneBuilder::validate() const {
    std::vector<AuthoringDiagnostic> diagnostics;
    std::unordered_map<std::string, std::string> ids;
    std::unordered_set<std::string> compositionIds, assetIds, propertyIds;
    auto error = [&](const std::string& code, const std::string& path, const std::string& message) {
        diagnostics.push_back({DiagnosticSeverity::Error, code, path, message});
    };
    auto addId = [&](const std::string& id, const std::string& path) {
        if (!validId(id)) error("id.invalid", path, "ID must use letters, digits, '.', ':', '_' or '-'.");
        const auto inserted = ids.emplace(id, path);
        if (!inserted.second) error("id.duplicate", path, "ID is already used at " + inserted.first->second + ".");
    };
    addId(document.value("id", std::string()), "$.id");

    for (std::size_t ci = 0; ci < document["compositions"].size(); ++ci) {
        const auto& comp = document["compositions"][ci];
        const std::string compPath = "$.compositions[" + std::to_string(ci) + "]";
        const std::string compId = comp.value("id", std::string());
        addId(compId, compPath + ".id"); compositionIds.insert(compId);
        if (comp.value("width", 0) <= 0 || comp.value("height", 0) <= 0) error("composition.size", compPath, "Composition dimensions must be positive.");
        if (comp.value("duration", -1.0) < 0.0) error("composition.duration", compPath + ".duration", "Duration cannot be negative.");
        if (comp["frameRate"].value("numerator", 0) <= 0 || comp["frameRate"].value("denominator", 0) <= 0)
            error("composition.frame-rate", compPath + ".frameRate", "Frame-rate numerator and denominator must be positive.");
        std::unordered_set<std::string> localLayers;
        for (std::size_t li = 0; li < comp["layers"].size(); ++li) {
            const auto& layerValue = comp["layers"][li];
            const std::string layerPath = compPath + ".layers[" + std::to_string(li) + "]";
            const std::string layerId = layerValue.value("id", std::string());
            addId(layerId, layerPath + ".id"); localLayers.insert(layerId);
            std::function<void(const ofJson&, const std::string&)> collectProperties;
            collectProperties = [&](const ofJson& value, const std::string& path) {
                if (value.is_object()) {
                    const std::string type = value.value("type", std::string());
                    const bool geometry = type == "rectangle" || type == "ellipse" || type == "path";
                    if (value.contains("id") && value.contains("type") && (value.contains("value") || geometry)) {
                        const std::string id = value.value("id", std::string()); addId(id, path + ".id"); propertyIds.insert(id);
                    }
                    if (value.contains("keyframes")) {
                        double previous = -std::numeric_limits<double>::infinity();
                        for (std::size_t ki = 0; ki < value["keyframes"].size(); ++ki) {
                            const auto& keyframe = value["keyframes"][ki];
                            const double time = keyframe.value("time", std::numeric_limits<double>::quiet_NaN());
                            const std::string interpolation = keyframe.value("outInterpolation", "");
                            if (!std::isfinite(time) || time < previous) {
                                error("animation.time", path + ".keyframes[" + std::to_string(ki) + "].time",
                                      "Keyframe times must be finite and ordered.");
                            }
                            if (interpolation != "linear" && interpolation != "hold" && interpolation != "bezier") {
                                error("animation.interpolation", path + ".keyframes[" + std::to_string(ki) + "]",
                                      "Interpolation must be linear, hold, or bezier.");
                            }
                            previous = time;
                        }
                    }
                    for (auto it = value.begin(); it != value.end(); ++it)
                        if (it.key() != "extensions") collectProperties(it.value(), path + "." + it.key());
                } else if (value.is_array()) {
                    for (std::size_t i = 0; i < value.size(); ++i) collectProperties(value[i], path + "[" + std::to_string(i) + "]");
                }
            };
            collectProperties(layerValue.value("transform", ofJson::object()), layerPath + ".transform");
            collectProperties(layerValue.value("content", ofJson::object()), layerPath + ".content");
        }
        for (std::size_t li = 0; li < comp["layers"].size(); ++li) {
            const auto& layerValue = comp["layers"][li];
            if (layerValue.contains("parentId") && !localLayers.count(layerValue["parentId"].get<std::string>()))
                error("reference.parent", compPath + ".layers[" + std::to_string(li) + "].parentId", "Parent layer does not exist in this composition.");
        }
    }
    const std::string root = document.value("rootCompositionId", std::string());
    if (!compositionIds.count(root)) error("reference.root", "$.rootCompositionId", "Root composition does not exist.");

    for (std::size_t i = 0; i < document["assets"].size(); ++i) {
        const auto& asset = document["assets"][i];
        const std::string path = "$.assets[" + std::to_string(i) + "]";
        const std::string id = asset.value("id", std::string()); addId(id, path + ".id"); assetIds.insert(id);
        if (!portableUri(asset.value("uri", std::string()))) error("asset.uri", path + ".uri", "Asset URI must be a portable relative path.");
    }
    for (std::size_t i = 0; i < document["controls"].size(); ++i) {
        const auto& controlValue = document["controls"][i];
        const std::string path = "$.controls[" + std::to_string(i) + "]";
        addId(controlValue.value("id", std::string()), path + ".id");
        for (std::size_t bi = 0; bi < controlValue["bindings"].size(); ++bi) {
            const std::string target = controlValue["bindings"][bi].value("targetId", std::string());
            if (!propertyIds.count(target)) error("reference.binding", path + ".bindings[" + std::to_string(bi) + "].targetId", "Binding target property does not exist.");
        }
    }
    for (std::size_t i = 0; i < document["actions"].size(); ++i)
        addId(document["actions"][i].value("id", std::string()), "$.actions[" + std::to_string(i) + "].id");

    for (std::size_t ci = 0; ci < document["compositions"].size(); ++ci)
        for (std::size_t li = 0; li < document["compositions"][ci]["layers"].size(); ++li) {
            const auto& layerValue = document["compositions"][ci]["layers"][li];
            if (layerValue.value("type", std::string()) == "text") {
                const auto& style = layerValue["content"]["style"];
                if (style.contains("fontAssetId") && !assetIds.count(style["fontAssetId"].get<std::string>()))
                    error("reference.font", "$.compositions[" + std::to_string(ci) + "].layers[" + std::to_string(li) + "].content.style.fontAssetId", "Font asset does not exist.");
            }
        }
    return diagnostics;
}

bool SceneBuilder::valid() const {
    const auto diagnostics = validate();
    return std::none_of(diagnostics.begin(), diagnostics.end(), [](const AuthoringDiagnostic& value) {
        return value.severity == DiagnosticSeverity::Error;
    });
}

std::string SceneBuilder::canonicalJson() const { return document.dump(); }
std::string SceneBuilder::prettyJson(int indent) const { return document.dump(indent); }

bool SceneBuilder::write(const std::string& path, bool pretty) const {
    if (!valid()) return false;
    if (!valid()) return false;
    std::ofstream output(path, std::ios::binary | std::ios::trunc);
    if (!output) return false;
    output << (pretty ? prettyJson() : canonicalJson()) << '\n';
    return output.good();
}

std::string SceneBuilder::stableId(const std::string& prefix, const std::string& seed) {
    std::uint64_t hash = 14695981039346656037ull;
    for (const unsigned char c : seed) { hash ^= c; hash *= 1099511628211ull; }
    std::ostringstream value;
    value << prefix << ':' << std::hex << std::setw(16) << std::setfill('0') << hash;
    return value.str();
}

} // namespace ofxOGraf
