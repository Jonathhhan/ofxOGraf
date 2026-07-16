#include "ofMain.h"
#include "ofApp.h"

int main() {
#ifdef __EMSCRIPTEN__
    ofGLESWindowSettings settings;
#else
    ofGLWindowSettings settings;
    settings.setGLVersion(3, 2);
#endif
    settings.setSize(1280, 720);
    settings.windowMode = OF_WINDOW;

    const auto window = ofCreateWindow(settings);
    ofRunApp(window, std::make_shared<ofApp>());
    ofRunMainLoop();
    return 0;
}
