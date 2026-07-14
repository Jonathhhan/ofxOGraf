#include "ofxOGrafAssets.h"
#include <cmath>

namespace ofxOGraf {

void Assets::configure(const ofJson& scene) {
    clear();
    assetData = scene.value("assets", ofJson::object());
}

void Assets::clear() {
    fonts.clear();
    images.clear();
}

std::string Assets::fontPath(const std::string& postScriptName) const {
    if (assetData.contains("fonts") && assetData["fonts"].is_array()) {
        for (const auto& entry : assetData["fonts"]) {
            if (entry.value("postScriptName", "") == postScriptName || entry.value("family", "") == postScriptName) {
                return entry.value("file", "");
            }
        }
    }
    return "fonts/" + postScriptName + ".ttf";
}

ofTrueTypeFont* Assets::font(const std::string& postScriptName, float size) {
    const int pixelSize = std::max(1, static_cast<int>(std::round(size)));
    const std::string key = postScriptName + "@" + ofToString(pixelSize);
    const auto existing = fonts.find(key);
    if (existing != fonts.end()) return existing->second.get();

    auto loaded = std::make_unique<ofTrueTypeFont>();
    const std::string path = fontPath(postScriptName);
    if (path.empty() || !loaded->load(path, pixelSize, true, true, true)) {
        ofLogWarning("ofxOGraf") << "Font asset unavailable: " << postScriptName << " (expected " << path << ")";
        return nullptr;
    }
    auto* result = loaded.get();
    fonts.emplace(key, std::move(loaded));
    return result;
}

std::string Assets::imagePath(const std::string& idOrPath) const {
    if (assetData.contains("images") && assetData["images"].is_array()) {
        for (const auto& entry : assetData["images"]) {
            if (entry.value("id", "") == idOrPath) return entry.value("file", idOrPath);
        }
    }
    return idOrPath;
}

ofImage* Assets::image(const std::string& idOrPath) {
    const std::string path = imagePath(idOrPath);
    const auto existing = images.find(path);
    if (existing != images.end()) return existing->second.get();
    auto loaded = std::make_unique<ofImage>();
    if (path.empty() || !loaded->load(path)) {
        ofLogWarning("ofxOGraf") << "Image asset unavailable: " << path;
        return nullptr;
    }
    auto* result = loaded.get();
    images.emplace(path, std::move(loaded));
    return result;
}

} // namespace ofxOGraf
