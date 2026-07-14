#include "ofMain.h"
#include "ofApp.h"
#include <string>

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
#endif

#ifndef __EMSCRIPTEN__
void parseFrameExportArguments(int argc, char* argv[], std::string& outputPath, double& timeSeconds) {
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
        }
    }
}
#endif
static std::shared_ptr<ofApp> appInstance;

static ofxOGraf::Graphic* graphic() {
    return appInstance ? &appInstance->graphic() : nullptr;
}

bool loadGraphic(const std::string& json) {
    return graphic() && graphic()->loadJson(json);
}

bool updateGraphic(const std::string& json, bool) {
    if (!graphic()) return false;
    try {
        graphic()->updateData(ofJson::parse(json));
        return true;
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

bool isActionComplete(const std::string& action) {
    return graphic() && graphic()->isActionComplete(action);
}

std::string getLastError() {
    return graphic() ? graphic()->getLastError() : "Application is not ready.";
}

#ifdef __EMSCRIPTEN__
EMSCRIPTEN_BINDINGS(ofx_ograf_bridge) {
    emscripten::function("loadGraphic", &loadGraphic);
    emscripten::function("updateGraphic", &updateGraphic);
    emscripten::function("playGraphic", &playGraphic);
    emscripten::function("stopGraphic", &stopGraphic);
    emscripten::function("goToTime", &goToTime);
    emscripten::function("isActionComplete", &isActionComplete);
    emscripten::function("getLastError", &getLastError);
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
    double frameTime = 0.0;
#ifndef __EMSCRIPTEN__
    parseFrameExportArguments(argc, argv, frameOutputPath, frameTime);
#endif

    auto window = ofCreateWindow(settings);
    appInstance = std::make_shared<ofApp>(frameOutputPath, frameTime);
    ofRunApp(window, appInstance);
    ofRunMainLoop();
}
