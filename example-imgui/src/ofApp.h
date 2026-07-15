#pragma once

#include "ofMain.h"
#include "ofxImGui.h"
#include "ofxOGraf.h"

class ofApp : public ofBaseApp {
public:
    void setup() override;
    void update() override;
    void draw() override;
    void windowResized(int width, int height) override;

private:
    static constexpr int WindowWidth = 1280;
    static constexpr int WindowHeight = 720;
    static constexpr int CompositionWidth = 1920;
    static constexpr int CompositionHeight = 1080;

    ofJson buildBanderoleScene() const;
    void rebuildBanderoleScene(bool restart);

    ofxOGraf::Graphic graphic;
    ofxOGraf::RenderSurface preview;
    ofxOGraf::ImGuiControls controls;
    ofxImGui::Gui gui;
    ofxOGraf::LowerThirdMotion motion;
    double fontSize = 54.0;
    float animationSpeed = 1.0f;
};