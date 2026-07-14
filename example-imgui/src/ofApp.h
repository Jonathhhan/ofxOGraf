#pragma once

#include "ofMain.h"
#include "ofxImGui.h"
#include "ofxOGraf.h"

class ofApp : public ofBaseApp {
public:
    void setup() override;
    void update() override;
    void draw() override;

private:
    ofxOGraf::Graphic graphic;
    ofxOGraf::ImGuiControls controls;
    ofxImGui::Gui gui;
};
