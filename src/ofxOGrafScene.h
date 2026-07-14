#pragma once

#include "ofJson.h"
#include <string>
#include <vector>

namespace ofxOGraf {

struct Layer {
    int index = 0;
    std::string name;
    std::string type = "unknown";
    bool enabled = true;
    double inPoint = 0.0;
    double outPoint = 0.0;
    int parentIndex = 0;
    ofJson source;
};

struct Scene {
    int width = 1920;
    int height = 1080;
    double duration = 0.0;
    double frameRate = 50.0;
    ofJson document;
    ofJson raw;
    std::vector<Layer> layers;

    const Layer* findLayer(int index) const;
    const ofJson& sourceDocument() const;
};

} // namespace ofxOGraf
