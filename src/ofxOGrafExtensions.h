#pragma once

#include "ofMain.h"
#include "ofxOGrafScene.h"
#include <functional>
#include <set>
#include <string>
#include <unordered_map>
#include <vector>

namespace ofxOGraf {

class Extensions {
public:
    using LayerHandler = std::function<bool(const Layer&, double, const ofJson&)>;
    using EffectHandler = std::function<bool(const ofJson&, double)>;
    using TextLayoutHandler = std::function<bool(const Layer&, const ofJson&, const std::string&,
                                                 double, const ofJson&)>;

    void registerLayerRenderer(const std::string& type, LayerHandler handler);
    void registerEffectRenderer(const std::string& matchName, EffectHandler handler);
    void registerTextLayoutProvider(const std::string& id, const std::string& version,
                                    TextLayoutHandler handler);
    void registerProvider(const std::string& id, const std::string& version,
                          const std::vector<std::string>& capabilities = {});
    std::string validateRequired(const ofJson& document) const;

    bool drawLayer(const Layer& layer, double time, const ofJson& data) const;
    bool applyEffect(const ofJson& effect, double time) const;
    bool drawText(const Layer& layer, const ofJson& evaluatedText, const std::string& text,
                  double time, const ofJson& data) const;

private:
    std::unordered_map<std::string, LayerHandler> layerHandlers;
    struct Provider {
        std::string version;
        std::set<std::string> capabilities;
    };
    std::unordered_map<std::string, EffectHandler> effectHandlers;
    TextLayoutHandler textLayoutHandler;
    std::unordered_map<std::string, Provider> providers;
};

} // namespace ofxOGraf
