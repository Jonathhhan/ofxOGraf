#include "ofMain.h"
#include "ofApp.h"
#include "../../examples/native-authoring/NativeLowerThird.h"
#include <array>
#include <iostream>
#include <set>
#include <string>

namespace {
void collectStableIds(const ofJson& value, std::set<std::string>& ids) {
    if (value.is_object()) {
        const auto id = value.find("id");
        if (id != value.end() && id->is_string() && !id->get<std::string>().empty()) {
            ids.insert(id->get<std::string>());
        }
        for (const auto& entry : value.items()) collectStableIds(entry.value(), ids);
    } else if (value.is_array()) {
        for (const auto& entry : value) collectStableIds(entry, ids);
    }
}
}

std::string inspectSceneMigration(const std::string& jsonText) {
    ofJson response = ofJson::object();
    try {
        const auto migration = ofxOGraf::SceneLoader::migrate(ofJson::parse(jsonText));
        response["ok"] = true;
        response["sourceVersion"] = migration.sourceVersion;
        response["runtimeVersion"] = migration.runtimeVersion;
        response["migrated"] = migration.migrated;
        response["documentVersion"] = migration.document.value("version", "");
        const auto repeated = ofxOGraf::SceneLoader::migrate(migration.document);
        response["idempotent"] = repeated.document == migration.document;
        std::set<std::string> sourceIds;
        std::set<std::string> runtimeIds;
        collectStableIds(ofJson::parse(jsonText), sourceIds);
        collectStableIds(migration.document, runtimeIds);
        response["missingStableIds"] = ofJson::array();
        for (const auto& id : sourceIds) {
            if (!runtimeIds.count(id)) response["missingStableIds"].push_back(id);
        }
        response["stableIdsPreserved"] = response["missingStableIds"].empty();
        response["diagnostics"] = ofJson::array();
        for (const auto& diagnostic : migration.diagnostics) {
            response["diagnostics"].push_back({
                {"code", diagnostic.code},
                {"path", diagnostic.path},
                {"message", diagnostic.message}
            });
        }
    } catch (const std::exception& error) {
        response["ok"] = false;
        response["error"] = error.what();
    }
    return response.dump();
}


#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
#endif

#ifndef __EMSCRIPTEN__
void parseArguments(int argc, char* argv[], std::string& outputPath, double& timeSeconds,
                    std::string& scenePath, std::string& migrationFixtureDir, std::string& structuredControlsFixture,
                     std::string& extensionFixture, bool& codeTemplateControlsTest) {
    for (int index = 1; index < argc; ++index) {
        const std::string argument = argv[index];
        if (argument == "--frame" && index + 1 < argc) {
            outputPath = argv[++index];
        } else if (argument == "--time" && index + 1 < argc) {
            try {
                timeSeconds = std::stod(argv[++index]);
            } catch (...) {
                timeSeconds = 0.0;
            }
        } else if (argument == "--scene" && index + 1 < argc) {
            scenePath = argv[++index];
        } else if (argument == "--migration-test-dir" && index + 1 < argc) {
            migrationFixtureDir = argv[++index];
        } else if (argument == "--structured-controls-test" && index + 1 < argc) {
            structuredControlsFixture = argv[++index];
        } else if (argument == "--extension-contract-test" && index + 1 < argc) {
            extensionFixture = argv[++index];
        } else if (argument == "--code-template-controls-test") {
            codeTemplateControlsTest = true;
        }
    }
}
int runMigrationFixtureContract(const std::string& directory) {
    struct Fixture {
        const char* file;
        bool ok;
        bool migrated;
        const char* sourceVersion;
        const char* errorCode;
    };
    const std::array<Fixture, 5> fixtures{{
        {"scene-version-01.json", true, true, "0.1.0", ""},
        {"scene-version-02.json", true, false, "0.2.0", ""},
        {"scene-version-03.json", true, true, "0.3.0", ""},
        {"scene-version-malformed.json", false, false, "", "scene.version.invalid"},
        {"scene-version-forward.json", false, false, "", "scene.version.unsupported"}
    }};

    int failures = 0;
    for (const auto& fixture : fixtures) {
        const std::string path = ofFilePath::join(directory, fixture.file);
        const auto buffer = ofBufferFromFile(path);
        if (buffer.size() == 0) {
            std::cerr << "MISSING " << path << std::endl;
            ++failures;
            continue;
        }
        const ofJson result = ofJson::parse(inspectSceneMigration(buffer.getText()));
        bool passed = result.value("ok", false) == fixture.ok;
        if (fixture.ok) {
            passed = passed && result.value("migrated", false) == fixture.migrated;
            passed = passed && result.value("sourceVersion", "") == fixture.sourceVersion;
            passed = passed && result.value("runtimeVersion", "") == "0.2.0";
            passed = passed && result.value("documentVersion", "") == "0.2.0";
            passed = passed && result.value("idempotent", false);
            passed = passed && result.value("stableIdsPreserved", false);
        } else {
            passed = passed && result.value("error", "").find(fixture.errorCode) != std::string::npos;
        }
        std::cout << (passed ? "PASS " : "FAIL ") << fixture.file << " " << result.dump() << std::endl;
        if (!passed) ++failures;
    }
    return failures == 0 ? 0 : 1;
}

int runStructuredControlsContract(const std::string& path) {
    const auto buffer = ofBufferFromFile(path);
    if (buffer.size() == 0) {
        std::cerr << "MISSING " << path << std::endl;
        return 1;
    }
    ofxOGraf::Graphic candidate;
    if (!candidate.loadJson(buffer.getText())) {
        std::cerr << "LOAD FAILED " << candidate.getLastError() << std::endl;
        return 1;
    }
    const bool validAccepted = candidate.updateData({
        {"phase", "post"},
        {"rows", ofJson::array({{{"id", "row-2"}, {"label", "Beta"}, {"score", 2}}})}
    });
    const ofJson beforeInvalid = candidate.getData();
    const bool invalidAccepted = candidate.updateData({
        {"rows", ofJson::array({{{"id", "row-3"}, {"score", "not-an-integer"}}})}
    });
    const ofJson afterInvalid = candidate.getData();
    const bool passed = validAccepted && !invalidAccepted && beforeInvalid == afterInvalid &&
                        candidate.getLastError().find("/rows/0/label") != std::string::npos;
    std::cout << (passed ? "PASS" : "FAIL") << " structured controls "
              << candidate.getLastError() << std::endl;
    return passed ? 0 : 1;
}

int runExtensionContract(const std::string& path) {
    const auto buffer = ofBufferFromFile(path);
    if (buffer.size() == 0) {
        std::cerr << "MISSING " << path << std::endl;
        return 1;
    }
    const std::string source = buffer.getText();
    ofxOGraf::Graphic candidate;
    const bool missingRejected = !candidate.loadJson(source) &&
        candidate.getLastError().find("scene.extension.required") != std::string::npos;
    candidate.extensions().registerProvider("dev.ofxograf.tests.missing", "2.0.0", {"render"});
    const bool versionRejected = !candidate.loadJson(source) &&
        candidate.getLastError().find("scene.extension.version") != std::string::npos;
    candidate.extensions().registerProvider("dev.ofxograf.tests.missing", "1.0.0");
    const bool capabilityRejected = !candidate.loadJson(source) &&
        candidate.getLastError().find("scene.extension.capability") != std::string::npos;
    candidate.extensions().registerProvider("dev.ofxograf.tests.missing", "1.0.0", {"render"});
    const bool accepted = candidate.loadJson(source) && candidate.isLoaded();
    const bool passed = missingRejected && versionRejected && capabilityRejected && accepted;
    std::cout << (passed ? "PASS" : "FAIL") << " extension contract" << std::endl;
    return passed ? 0 : 1;
}
int runCodeTemplateControlsContract() {
    ofxOGraf::CodeTemplateHost host;
    if (!host.load(ofxOGraf::examples::createNativeLowerThird())) {
        std::cerr << "LOAD FAILED " << host.lastError() << std::endl;
        return 1;
    }
    const bool validAccepted = host.updateData({{"motion-entry-travel", 1200.0}});
    const ofJson validState = host.data();
    const bool rangeAccepted = host.updateData({{"motion-entry-travel", 5000.0}});
    const std::string rangeError = host.lastError();
    const bool rangeRejected = !rangeAccepted &&
        rangeError.find("/motion-entry-travel: value is above maximum") != std::string::npos &&
        host.data() == validState;
    const bool optionAccepted = host.updateData({{"alignment", "diagonal"}});
    const std::string optionError = host.lastError();
    const bool optionRejected = !optionAccepted &&
        optionError.find("/alignment: value is not an allowed option") != std::string::npos &&
        host.data() == validState;
    const bool colorAccepted = host.updateData({{"accent-color", ofJson::array({2.0, 0.0, 0.0, 1.0})}});
    const std::string colorError = host.lastError();
    const bool colorRejected = !colorAccepted &&
        colorError.find("/accent-color: color channels") != std::string::npos &&
        host.data() == validState;    const bool passed = validAccepted && rangeRejected && optionRejected && colorRejected;
    std::cout << (passed ? "PASS" : "FAIL") << " code-template controls"
              << " valid=" << validAccepted
              << " range=" << rangeRejected << " [" << rangeError << "]"
              << " option=" << optionRejected << " [" << optionError << "]"
              << " color=" << colorRejected << " [" << colorError << "]" << std::endl;
    return passed ? 0 : 1;
}

#endif
static std::shared_ptr<ofApp> appInstance;
static bool codeTemplateActive = false;

static ofxOGraf::Graphic* graphic() {
    return appInstance ? &appInstance->graphic() : nullptr;
}

bool loadGraphic(const std::string& json) {
    if (!appInstance) return false;
    codeTemplateActive = false;
    appInstance->useSceneGraphic();
    return appInstance->graphic().loadJson(json);
}

bool updateGraphic(const std::string& json, bool) {
    if (!graphic()) return false;
    try {
        return graphic()->updateData(ofJson::parse(json));
    } catch (...) {
        return false;
    }
}

void playGraphic(int step, bool skipAnimation) {
    if (graphic()) graphic()->play(step, skipAnimation);
}

void stopGraphic(bool skipAnimation) {
    if (graphic()) graphic()->stop(skipAnimation);
}

void goToTime(double milliseconds) {
    if (graphic()) graphic()->setTimeMilliseconds(milliseconds);
}

std::string renderFrameDiagnostics() {
    return appInstance ? appInstance->renderFrameDiagnostics() : std::string(R"({"error":"Application is not ready."})");
}

bool isActionComplete(const std::string& action) {
    return graphic() && graphic()->isActionComplete(action);
}

std::string getCodeTemplateAbiFingerprint(const std::string& factoryId) {
    return appInstance ? appInstance->codeTemplateAbiFingerprint(factoryId) : std::string();
}

bool isRuntimeReady() {
    return static_cast<bool>(appInstance);
}

std::string getGraphicData() {
    return graphic() ? graphic()->getData().dump() : std::string("{}");
}

std::string getLastError() {
    return !appInstance ? "Application is not ready." : (codeTemplateActive ? appInstance->codeTemplateLastError() : appInstance->graphic().getLastError());
}

bool loadCodeTemplate(const std::string& factoryId, const std::string& json) {
    if (!appInstance) return false;
    codeTemplateActive = true;
    try {
        return appInstance->loadCodeTemplate(factoryId, ofJson::parse(json));
    } catch (...) {
        return false;
    }
}

bool updateCodeTemplate(const std::string& json, bool) {
    if (!appInstance) return false;
    try {
        return appInstance->updateCodeTemplate(ofJson::parse(json));
    } catch (...) {
        return false;
    }
}

bool playCodeTemplate(const std::string& actionId, bool) {
    return appInstance && appInstance->playCodeTemplate(actionId);
}

void stopCodeTemplate(bool) {
    if (appInstance) appInstance->stopCodeTemplate();
}

void goToCodeTemplateTime(double milliseconds) {
    if (appInstance) appInstance->seekCodeTemplate(milliseconds / 1000.0);
}

bool isCodeTemplateActionComplete(const std::string&) {
    return !appInstance || appInstance->isCodeTemplateActionComplete();
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(ofx_ograf_bridge) {
    emscripten::function("loadGraphic", &loadGraphic);
    emscripten::function("updateGraphic", &updateGraphic);
    emscripten::function("playGraphic", &playGraphic);
    emscripten::function("stopGraphic", &stopGraphic);
    emscripten::function("goToTime", &goToTime);
    emscripten::function("renderFrameDiagnostics", &renderFrameDiagnostics);
    emscripten::function("isActionComplete", &isActionComplete);
    emscripten::function("getLastError", &getLastError);
    emscripten::function("getGraphicData", &getGraphicData);
    emscripten::function("getCodeTemplateAbiFingerprint", &getCodeTemplateAbiFingerprint);
    emscripten::function("isRuntimeReady", &isRuntimeReady);
    emscripten::function("inspectSceneMigration", &inspectSceneMigration);
    emscripten::function("loadCodeTemplate", &loadCodeTemplate);
    emscripten::function("updateCodeTemplate", &updateCodeTemplate);
    emscripten::function("playCodeTemplate", &playCodeTemplate);
    emscripten::function("stopCodeTemplate", &stopCodeTemplate);
    emscripten::function("goToCodeTemplateTime", &goToCodeTemplateTime);
    emscripten::function("isCodeTemplateActionComplete", &isCodeTemplateActionComplete);
}
#endif

int main(int argc, char* argv[]) {
#ifdef __EMSCRIPTEN__
    ofGLESWindowSettings settings;
#else
    ofGLWindowSettings settings;
    settings.setGLVersion(3, 2);
#endif
    settings.setSize(1280, 720);
    settings.windowMode = OF_WINDOW;

    std::string frameOutputPath;
    std::string scenePath;
    std::string migrationFixtureDir;
    std::string structuredControlsFixture;
    std::string extensionFixture;
    bool codeTemplateControlsTest = false;
    double frameTime = 0.0;
#ifndef __EMSCRIPTEN__
    parseArguments(argc, argv, frameOutputPath, frameTime, scenePath, migrationFixtureDir, structuredControlsFixture, extensionFixture, codeTemplateControlsTest);
    if (!migrationFixtureDir.empty()) return runMigrationFixtureContract(migrationFixtureDir);
    if (!structuredControlsFixture.empty()) return runStructuredControlsContract(structuredControlsFixture);
    if (!extensionFixture.empty()) return runExtensionContract(extensionFixture);
    if (codeTemplateControlsTest) return runCodeTemplateControlsContract();
#endif

    auto window = ofCreateWindow(settings);
    appInstance = std::make_shared<ofApp>(frameOutputPath, frameTime, scenePath);
    ofRunApp(window, appInstance);
    ofRunMainLoop();
}
