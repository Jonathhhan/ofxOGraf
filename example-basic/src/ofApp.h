#pragma once

#include "ofMain.h"
#include "ofxOGraf.h"

class ofApp : public ofBaseApp {
public:
    void setup() override;
    void update() override;
    void draw() override;

    ofxOGraf::Graphic& graphic();

private:
    ofxOGraf::Graphic broadcastGraphic;
};
