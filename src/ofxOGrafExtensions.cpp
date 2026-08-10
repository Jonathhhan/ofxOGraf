#include "ofxOGrafExtensions.h"
#include <sstream>
#include <stdexcept>

namespace ofxOGraf {

void Extensions::registerLayerRenderer(const std::string& type, LayerHandler handler) {
    layerHandlers[type] = std::move(handler);
}

void Extensions::registerEffectRenderer(const std::string& matchName, EffectHandler handler) {
    effectHandlers[matchName] = std::move(handler);
}

void Extensions::registerTextLayoutProvider(const std::string& id, const std::string& version,
                                            TextLayoutHandler handler) {
    if (!handler) throw std::invalid_argument("text layout provider handler must be callable");
    textLayoutHandler = std::move(handler);
    registerProvider(id, version, {"text.complex-shaping"});
}


void Extensions::registerProvider(const std::string& id, const std::string& version,
                                  const std::vector<std::string>& capabilities) {
    providers[id] = {version, std::set<std::string>(capabilities.begin(), capabilities.end())};
}

std::string Extensions::validateRequired(const ofJson& document) const {
    if (!document.contains("requiredExtensions") || !document["requiredExtensions"].is_array()) return {};
    for (const auto& requirement : document["requiredExtensions"]) {
        const std::string id = requirement.value("id", "");
        const std::string version = requirement.value("version", "");
        const auto provider = providers.find(id);
        if (provider == providers.end()) {
            return "[scene.extension.required] Required extension is unavailable: " + id + "@" + version;
        }
        if (provider->second.version != version) {
            return "[scene.extension.version] Required extension version " + id + "@" + version +
                   " is unavailable; registered version is " + provider->second.version;
        }
        for (const auto& capabilityValue : requirement.value("capabilities", ofJson::array())) {
            const std::string capability = capabilityValue.get<std::string>();
            const bool executableTextProvider = capability != "text.complex-shaping" ||
                                                static_cast<bool>(textLayoutHandler);
            if (!provider->second.capabilities.count(capability) || !executableTextProvider) {
                return "[scene.extension.capability] Required capability is unavailable: " +
                       id + "/" + capability;
            }
        }
    }
    return {};
}

bool Extensions::drawLayer(const Layer& layer, double time, const ofJson& data) const {
    const auto found = layerHandlers.find(layer.type);
    return found != layerHandlers.end() && found->second(layer, time, data);
}

bool Extensions::applyEffect(const ofJson& effect, double time) const {
    const auto found = effectHandlers.find(effect.value("matchName", ""));
    return found != effectHandlers.end() && found->second(effect, time);
}

bool Extensions::drawText(const Layer& layer, const ofJson& evaluatedText,
                          const std::string& text, double time, const ofJson& data) const {
    return textLayoutHandler && textLayoutHandler(layer, evaluatedText, text, time, data);
}

} // namespace ofxOGraf
