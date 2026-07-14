#pragma once

#include "ofMain.h"
#include "ofxOGrafScene.h"
#include <functional>
#include <string>
#include <unordered_map>

namespace ofxOGraf {

class Extensions {
public:
    using LayerHandler = std::function<bool(const Layer&, double, const ofJson&)>;
    using EffectHandler = std::function<bool(const ofJson&, double)>;

    void registerLayerRenderer(const std::string& type, LayerHandler handler);
    void registerEffectRenderer(const std::string& matchName, EffectHandler handler);

    bool drawLayer(const Layer& layer, double time, const ofJson& data) const;
    bool applyEffect(const ofJson& effect, double time) const;

private:
    std::unordered_map<std::string, LayerHandler> layerHandlers;
    std::unordered_map<std::string, EffectHandler> effectHandlers;
};

} // namespace ofxOGraf
