#include "ofApp.h"

void ofApp::setup() {
    ofSetFrameRate(50);
    broadcastGraphic.setup();
    broadcastGraphic.loadFile("scene.json");
}

void ofApp::update() {
    broadcastGraphic.update(ofGetLastFrameTime());
}

void ofApp::draw() {
    broadcastGraphic.draw();
}

ofxOGraf::Graphic& ofApp::graphic() { return broadcastGraphic; }
