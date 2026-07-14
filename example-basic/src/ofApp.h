#pragma once

#include "ofMain.h"
#include "ofxOGraf.h"

class ofApp : public ofBaseApp {
public:
    void setup() override;
    void update() override;
    void draw() override;
    void windowResized(int width, int height) override;

    ofxOGraf::Graphic& graphic();

private:
    static constexpr int WindowWidth = 1280;
    static constexpr int WindowHeight = 720;
    static constexpr int CompositionWidth = 1920;
    static constexpr int CompositionHeight = 1080;

    ofxOGraf::Graphic broadcastGraphic;
    ofxOGraf::RenderSurface preview;
};
