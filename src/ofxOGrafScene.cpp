#include "ofxOGrafScene.h"

namespace ofxOGraf {

const Layer* Scene::findLayer(int index) const {
    for (const auto& layer : layers) {
        if (layer.index == index) return &layer;
    }
    return nullptr;
}

} // namespace ofxOGraf
