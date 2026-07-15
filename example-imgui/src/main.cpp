#include "ofMain.h"
#include "ofApp.h"

namespace {
std::shared_ptr<ofApp> appInstance;
}

int main(int argc, char* argv[]) {
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
