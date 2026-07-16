#pragma once

#include "ofxOGrafAssets.h"
#include "ofxOGrafExtensions.h"
#include "ofxOGrafScene.h"
#include <set>
#include <string>
#include <unordered_map>

namespace ofxOGraf {

class Renderer {
public:
    void setup();
    void setScene(const Scene& scene);
    void setData(const ofJson& data);
    void draw(double time);

    Extensions& extensions();
    const std::vector<std::string>& assetWarnings() const;

private:
    struct Style {
        bool filled = true;
        ofFloatColor fill = ofFloatColor::white;
        bool stroked = false;
        ofFloatColor stroke = ofFloatColor(0, 0, 0, 0);
        float strokeWidth = 0.0f;
        bool gradient = false;
        bool radialGradient = false;
        glm::vec2 gradientStart{0, 0};
        glm::vec2 gradientEnd{1, 0};
        std::vector<std::pair<float, ofFloatColor>> stops;
    };

    Scene rootScene;
    ofJson data = ofJson::object();
    Assets assets;
    Extensions extensionRegistry;
    std::unordered_map<std::string, Scene> compositions;
    std::set<std::string> warnedEffects;
    std::set<std::string> warnedStencilLayers;
    std::set<std::string> warnedNonAscii;
    bool ready = false;
    bool hasColorOverride = false;
    ofFloatColor colorOverride = ofFloatColor::white;
    float opacityMultiplier = 1.0f;

    void cacheCompositions();
    void drawComposition(const Scene& scene, double time);
    void drawLayer(const Scene& scene, const Layer& layer, double time, bool includeMasks = true);
    void drawLayerContent(const Scene& scene, const Layer& layer, double time);
    void drawRepeat(const Layer& layer, double time);
    void drawText(const Layer& layer, double time);
    void drawImage(const Layer& layer, double time);
    void drawFallback(const Layer& layer, double time);
    void drawShapeGroup(const ofJson& group, double time, bool ignoreRepeaters = false);
    void drawShapeGeometry(const ofJson& group, double time, const Style& style);
    std::vector<ofPath> collectPaths(const ofJson& group, double time) const;
    ofPath pathFromProperty(const ofJson& property, double time) const;
    Style styleFor(const ofJson& group, double time) const;
    void drawStyledPath(ofPath path, const Style& style) const;
    void drawGradient(const ofPath& path, const Style& style) const;
    void drawTrimmed(const ofPath& path, const Style& style, float start, float end, float offset) const;
    void drawRepeater(const ofJson& group, const ofJson& repeater, double time);

    void applyHierarchyTransform(const Scene& scene, const Layer& layer, double time, std::set<int>& visiting);
    void applyTransform(const ofJson& transform, double time) const;
    void applyEffectState(const Layer& layer, double time);
    bool applyMasks(const Layer& layer, double time, bool begin);
    bool beginMatte(const Scene& scene, const Layer& matte, const Layer& target,
                    double time, bool inverted);
    void endMatte();
    bool canUseStencil(const Layer& layer, const char* feature);

    ofJson evaluate(const ofJson& property, double time) const;
    static const ofJson* findProperty(const ofJson& group, const std::string& matchName);
    static const ofJson* findFirstValue(const ofJson& group, const std::string& nameFragment);
    static glm::vec2 vector2(const ofJson& value, glm::vec2 fallback = glm::vec2(0));
    static glm::vec3 vector3(const ofJson& value, glm::vec3 fallback = glm::vec3(0));
    static ofFloatColor color(const ofJson& value, float alpha = 1.0f);
    static std::string framePath(const ofJson& fallback, double time, double defaultFrameRate);
};

} // namespace ofxOGraf
