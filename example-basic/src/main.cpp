#include "ofMain.h"
#include "ofApp.h"

#ifdef __EMSCRIPTEN__
#include <emscripten/bind.h>
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

int main() {
#ifdef __EMSCRIPTEN__
    ofGLESWindowSettings settings;
#else
    ofGLWindowSettings settings;
    settings.setGLVersion(3, 2);
#endif
    settings.setSize(1280, 720);
    settings.windowMode = OF_WINDOW;

    auto window = ofCreateWindow(settings);
    appInstance = std::make_shared<ofApp>();
    ofRunApp(window, appInstance);
    ofRunMainLoop();
}
