#pragma once

#include "ofMain.h"
#include <memory>
#include <string>
#include <unordered_map>

namespace ofxOGraf {

class Assets {
public:
    void configure(const ofJson& scene);
    void clear();

    ofTrueTypeFont* font(const std::string& postScriptName, float size);
    ofImage* image(const std::string& idOrPath);

private:
    ofJson assetData = ofJson::object();
    std::unordered_map<std::string, std::unique_ptr<ofTrueTypeFont>> fonts;
    std::unordered_map<std::string, std::unique_ptr<ofImage>> images;

    std::string fontPath(const std::string& postScriptName) const;
    std::string imagePath(const std::string& idOrPath) const;
};

} // namespace ofxOGraf
