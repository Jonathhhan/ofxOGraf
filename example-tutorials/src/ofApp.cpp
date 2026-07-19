#include "ofApp.h"

#include <algorithm>

void ofApp::setup() {
    ofSetWindowTitle("ofxOGraf - ograf.dev tutorial ports");
    ofSetWindowShape(WindowWidth, WindowHeight);
    ofSetFrameRate(50);
    graphic.setup();
    gui.setup();
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
#ifndef __EMSCRIPTEN__
    preview.allocate(graphic.getScene());
#endif
    graphic.play();
}

void ofApp::update() {
    graphic.update(ofGetLastFrameTime());
}

void ofApp::drawSelector() {
    gui.begin();
    ImGui::SetNextWindowPos(ImVec2(16.0f, 16.0f), ImGuiCond_FirstUseEver);
    ImGui::SetNextWindowSize(ImVec2(250.0f, 0.0f), ImGuiCond_FirstUseEver);

    if (ImGui::Begin("Tutorials", nullptr, ImGuiWindowFlags_AlwaysAutoResize)) {
        for (std::size_t index = 0; index < tutorials.size(); ++index) {
            const bool selected = index == current;
            if (ImGui::Selectable(tutorials[index].name.c_str(), selected)) {
                loadTutorial(index);
            }
            if (selected) ImGui::SetItemDefaultFocus();
        }

        ImGui::Separator();
        if (ImGui::Button(graphic.isPlaying() ? "Restart" : "Play")) {
            graphic.play();
        }
        ImGui::SameLine();
        if (ImGui::Button(graphic.isPlaying() ? "Pause" : "Resume")) {
            if (graphic.isPlaying()) graphic.pause();
            else graphic.resume();
        }

        if (!error.empty()) {
            ImGui::Separator();
            ImGui::TextWrapped("%s", error.c_str());
        }
    }
    ImGui::End();
    gui.end();
}

void ofApp::draw() {
    ofClear(24, 24, 24, 255);
    if (error.empty()) {
#ifdef __EMSCRIPTEN__
        const auto& scene = graphic.getScene();
        const float sceneWidth = static_cast<float>(std::max(1, scene.width));
        const float sceneHeight = static_cast<float>(std::max(1, scene.height));
        const float scale = std::min(ofGetWidth() / sceneWidth, ofGetHeight() / sceneHeight);
        const float offsetX = (ofGetWidth() - sceneWidth * scale) * 0.5f;
        const float offsetY = (ofGetHeight() - sceneHeight * scale) * 0.5f;

        ofPushMatrix();
        ofTranslate(offsetX, offsetY);
        ofScale(scale, scale);
        graphic.draw();
        ofPopMatrix();
#else
        preview.render(graphic);
        preview.drawFit(0, 0, ofGetWidth(), ofGetHeight(), true);
#endif
    }

    drawSelector();
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
