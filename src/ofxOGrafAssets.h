#pragma once

#include "ofMain.h"
#include <memory>
#include <string>
#include <unordered_map>
#include <unordered_set>
#include <vector>

namespace ofxOGraf {

class Assets {
public:
    void configure(const ofJson& scene);
    void clear();

    ofTrueTypeFont* font(const std::string& postScriptName, float size);
    ofImage* image(const std::string& idOrPath);
    const std::vector<std::string>& warnings() const;

private:
    ofJson assetData = ofJson::object();
    std::unordered_map<std::string, std::unique_ptr<ofTrueTypeFont>> fonts;
    std::unordered_map<std::string, std::unique_ptr<ofImage>> images;
    std::unordered_set<std::string> unavailableFontPaths;
    std::unordered_set<std::string> unavailableImagePaths;
    std::unordered_set<std::string> warningKeys;
    std::vector<std::string> assetWarnings;

    std::string fontPath(const std::string& postScriptName) const;
    std::string imagePath(const std::string& idOrPath) const;
    void validateDeclaredAssets();
    void warnOnce(const std::string& key, const std::string& message);
};

} // namespace ofxOGraf
