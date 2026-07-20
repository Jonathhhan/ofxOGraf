#pragma once

#include "ofMain.h"
#include "ofxImGui.h"
#include "ofxOGraf.h"
#include <array>
#include <string>

class ofApp : public ofBaseApp {
public:
    void setup() override;
    void update() override;
    void draw() override;
    void keyPressed(int key) override;
    void mousePressed(int x, int y, int button) override;
    void touchDown(ofTouchEventArgs& touch) override;
    void windowResized(int width, int height) override;

private:
    struct Tutorial {
        std::string name;
        std::string file;
    };

    void loadTutorial(std::size_t index);
    void drawSelector();
#ifdef __EMSCRIPTEN__
    void drawBrowserSelector();
    void handleBrowserPointer(float x, float y);
#endif

    static constexpr int WindowWidth = 1280;
    static constexpr int WindowHeight = 720;
    std::array<Tutorial, 4> tutorials{{
        {"Lower Third", "ograf-dev-lower-third.scene.json"},
        {"Corner Bug / LIVE", "ograf-dev-bug.scene.json"},
        {"News Ticker", "ograf-dev-ticker.scene.json"},
        {"Score Bug", "ograf-dev-score-bug.scene.json"}
    }};
    std::size_t current = 0;
    ofxOGraf::Graphic graphic;
    ofxOGraf::RenderSurface preview;
    ofxImGui::Gui gui;
    std::string error;
};
