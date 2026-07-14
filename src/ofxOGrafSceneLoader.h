#pragma once

#include "ofxOGrafScene.h"
#include <string>

namespace ofxOGraf {

class SceneLoader {
public:
    static Scene loadFile(const std::string& path);
    static Scene loadString(const std::string& jsonText);
    static Scene loadJson(const ofJson& json);
    static void validate(const ofJson& json);
};

} // namespace ofxOGraf
