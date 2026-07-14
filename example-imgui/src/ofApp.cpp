#include "ofApp.h"

void ofApp::setup() {
    ofSetFrameRate(50);
    graphic.setup();
    graphic.loadFile("scene.json");
    gui.setup();
}

void ofApp::update() {
    graphic.update(ofGetLastFrameTime());
}

void ofApp::draw() {
    graphic.draw();
    gui.begin();
    controls.draw(graphic);
    gui.end();
}
