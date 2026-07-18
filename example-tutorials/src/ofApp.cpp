#include "ofApp.h"

void ofApp::setup() {
    ofSetWindowTitle("ofxOGraf - ograf.dev tutorial ports");
    ofSetWindowShape(WindowWidth, WindowHeight);
    ofSetFrameRate(50);
    graphic.setup();
    loadTutorial(0);
}

void ofApp::loadTutorial(std::size_t index) {
    if (index >= tutorials.size()) return;
    const auto path = ofToDataPath(tutorials[index].file, true);
    const auto buffer = ofBufferFromFile(path);
    if (buffer.size() == 0) {
        error = "Could not read " + path;
        ofLogError("ofxOGraf") << error;
        return;
    }
    if (!graphic.loadJson(buffer.getText())) {
        error = graphic.getLastError();
        ofLogError("ofxOGraf") << error;
        return;
    }
    current = index;
    error.clear();
    preview.allocate(graphic.getScene());
    graphic.play();
}

void ofApp::update() {
    graphic.update(ofGetLastFrameTime());
}

void ofApp::draw() {
    ofClear(24, 24, 24, 255);
    if (error.empty()) {
        preview.render(graphic);
        preview.drawFit(0, 0, ofGetWidth(), ofGetHeight(), true);
    }

    constexpr float UiScale = 2.0f;
    ofPushStyle();
    ofPushMatrix();
    ofScale(UiScale, UiScale);
    ofSetColor(255);
    ofDrawBitmapStringHighlight(
        "1 Lower Third   2 Bug   3 Ticker   4 Score Bug   R Replay\n"
        "Current: " + tutorials[current].name,
        12, 18, ofColor(0, 0, 0, 210), ofColor::white);
    if (!error.empty()) {
        ofSetColor(255, 90, 90);
        ofDrawBitmapStringHighlight(error, 12, 48);
    }
    ofPopMatrix();
    ofPopStyle();
}

void ofApp::keyPressed(int key) {
    if (key >= '1' && key <= '4') {
        loadTutorial(static_cast<std::size_t>(key - '1'));
    } else if (key == 'r' || key == 'R') {
        loadTutorial(current);
    }
}

void ofApp::windowResized(int width, int height) {
    if (width != WindowWidth || height != WindowHeight) {
        ofSetWindowShape(WindowWidth, WindowHeight);
    }
}
