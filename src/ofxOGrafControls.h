#pragma once

#include "ofxOGrafScene.h"
#include <string>

namespace ofxOGraf {

class Controls {
public:
    static const ofJson& definitions(const Scene& scene);
    static ofJson defaultData(const Scene& scene);
    static ofJson withDefaults(const Scene& scene, const ofJson& data);
    static std::string normalizedType(const ofJson& control);
};

} // namespace ofxOGraf
