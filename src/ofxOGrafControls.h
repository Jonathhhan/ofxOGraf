#pragma once

#include "ofxOGrafScene.h"
#include <string>
#include <vector>

namespace ofxOGraf {

struct ControlValidationError {
    std::string path;
    std::string message;
};

class Controls {
public:
    static const ofJson& definitions(const Scene& scene);
    static ofJson defaultData(const Scene& scene);
    static ofJson withDefaults(const Scene& scene, const ofJson& data);
    static std::string normalizedType(const ofJson& control);
    static std::vector<ControlValidationError> validateData(const Scene& scene, const ofJson& data);
};

} // namespace ofxOGraf
