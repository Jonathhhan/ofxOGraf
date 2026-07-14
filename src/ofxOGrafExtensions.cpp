#include "ofxOGrafExtensions.h"

namespace ofxOGraf {

void Extensions::registerLayerRenderer(const std::string& type, LayerHandler handler) {
    layerHandlers[type] = std::move(handler);
}

void Extensions::registerEffectRenderer(const std::string& matchName, EffectHandler handler) {
    effectHandlers[matchName] = std::move(handler);
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
