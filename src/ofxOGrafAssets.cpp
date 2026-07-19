#include "ofxOGrafAssets.h"
#include <cmath>

namespace ofxOGraf {

void Assets::configure(const ofJson& scene) {
    clear();
    assetData = scene.value("assets", ofJson::object());
    validateDeclaredAssets();
}

void Assets::clear() {
    fonts.clear();
    images.clear();
    unavailableFontPaths.clear();
    unavailableImagePaths.clear();
    warningKeys.clear();
    assetWarnings.clear();
}

void Assets::warnOnce(const std::string& key, const std::string& message) {
    if (!warningKeys.insert(key).second) return;
    assetWarnings.push_back(message);
    ofLogWarning("ofxOGraf") << message;
}

void Assets::validateDeclaredAssets() {
    const auto validate = [&](const char* category, std::unordered_set<std::string>& unavailable) {
        if (!assetData.contains(category) || !assetData[category].is_array()) return;
        for (const auto& entry : assetData[category]) {
            const std::string path = entry.value("file", "");
            const std::string id = entry.value("id", entry.value("postScriptName", entry.value("family", path)));
            if (!path.empty() && ofFile::doesFileExist(path)) continue;
            unavailable.insert(path);
            warnOnce(std::string(category) + ":" + path,
                     std::string(std::string(category) == "fonts" ? "Font" : "Image") +
                         " asset unavailable: " + (path.empty() ? id : path));
        }
    };
    validate("fonts", unavailableFontPaths);
    validate("images", unavailableImagePaths);
}

std::string Assets::fontPath(const std::string& postScriptName) const {
    if (assetData.contains("fonts") && assetData["fonts"].is_array()) {
        for (const auto& entry : assetData["fonts"]) {
            if (entry.value("postScriptName", "") == postScriptName || entry.value("family", "") == postScriptName) {
                return entry.value("file", "");
            }
        }
    }
    // openFrameworks resolves this relative to bin/data on native targets and
    // to /data in Emscripten's packaged virtual filesystem.
    return "fonts/" + postScriptName + ".ttf";
}

ofTrueTypeFont* Assets::font(const std::string& postScriptName, float size) {
    const int pixelSize = std::max(1, static_cast<int>(std::round(size)));
    const std::string key = postScriptName + "@" + ofToString(pixelSize);
    const auto existing = fonts.find(key);
    if (existing != fonts.end()) return existing->second.get();

    auto loaded = std::make_unique<ofTrueTypeFont>();
    const std::string path = fontPath(postScriptName);
    if (unavailableFontPaths.count(path)) return nullptr;
#ifdef __EMSCRIPTEN__
    // Keep the browser atlas compact and avoid desktop-only contours.
    constexpr bool fullCharacterSet = false;
    constexpr bool makeContours = false;
#else
    constexpr bool fullCharacterSet = true;
    constexpr bool makeContours = true;
#endif
    if (path.empty() || !loaded->load(path, pixelSize, true, fullCharacterSet, makeContours)) {
        unavailableFontPaths.insert(path);
        warnOnce("font:" + path, "Font asset unavailable: " + postScriptName + " (expected " + path + ")");
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
    if (unavailableImagePaths.count(path)) return nullptr;
    const auto existing = images.find(path);
    if (existing != images.end()) return existing->second.get();
    auto loaded = std::make_unique<ofImage>();
    if (path.empty() || !loaded->load(path)) {
        unavailableImagePaths.insert(path);
        warnOnce("image:" + path, "Image asset unavailable: " + path);
        return nullptr;
    }
    auto* result = loaded.get();
    images.emplace(path, std::move(loaded));
    return result;
}

const std::vector<std::string>& Assets::warnings() const { return assetWarnings; }

} // namespace ofxOGraf
