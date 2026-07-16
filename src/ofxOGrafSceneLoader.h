#pragma once

#include "ofxOGrafScene.h"
#include <string>
#include <vector>

namespace ofxOGraf {

struct SceneMigrationDiagnostic {
    std::string code;
    std::string path;
    std::string message;
};

struct SceneMigrationResult {
    ofJson document;
    std::string sourceVersion;
    std::string runtimeVersion;
    bool migrated = false;
    std::vector<SceneMigrationDiagnostic> diagnostics;
};

class SceneLoader {
public:
    static constexpr const char* RuntimeVersion = "0.2.0";

    static Scene loadFile(const std::string& path);
    static Scene loadString(const std::string& jsonText);
    static Scene loadJson(const ofJson& json);
    static SceneMigrationResult migrate(const ofJson& json);
    static void validate(const ofJson& json);
};

} // namespace ofxOGraf
