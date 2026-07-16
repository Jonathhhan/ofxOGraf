#include "ofxOGrafExtensions.h"
#include <sstream>

namespace ofxOGraf {

void Extensions::registerLayerRenderer(const std::string& type, LayerHandler handler) {
    layerHandlers[type] = std::move(handler);
}

void Extensions::registerEffectRenderer(const std::string& matchName, EffectHandler handler) {
    effectHandlers[matchName] = std::move(handler);
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
            if (!provider->second.capabilities.count(capability)) {
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

} // namespace ofxOGraf
