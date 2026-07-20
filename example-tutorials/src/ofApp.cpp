#include "ofApp.h"

#include <algorithm>

void ofApp::setup() {
    ofSetWindowTitle("ofxOGraf - ograf.dev tutorial ports");
    ofSetWindowShape(WindowWidth, WindowHeight);
    ofSetFrameRate(50);
    graphic.setup();
#ifndef __EMSCRIPTEN__
    gui.setup();
#endif
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
#ifdef __EMSCRIPTEN__
    drawBrowserSelector();
#else
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
#endif
}

#ifdef __EMSCRIPTEN__
void ofApp::drawBrowserSelector() {
    constexpr float x = 16.0f;
    constexpr float y = 16.0f;
    constexpr float width = 260.0f;
    constexpr float headerHeight = 38.0f;
    constexpr float rowHeight = 44.0f;
    constexpr float gap = 8.0f;
    constexpr float actionHeight = 42.0f;

    const float panelHeight = headerHeight + tutorials.size() * rowHeight + gap + actionHeight + 16.0f;

    ofPushStyle();
    ofSetColor(18, 18, 18, 225);
    ofDrawRectRounded(x, y, width, panelHeight, 8.0f);

    ofSetColor(255);
    ofDrawBitmapString("Tutorials", x + 14.0f, y + 24.0f);

    float rowY = y + headerHeight;
    for (std::size_t index = 0; index < tutorials.size(); ++index) {
        if (index == current) ofSetColor(58, 92, 150, 240);
        else ofSetColor(48, 48, 48, 235);
        ofDrawRectRounded(x + 8.0f, rowY + 3.0f, width - 16.0f, rowHeight - 6.0f, 5.0f);
        ofSetColor(255);
        ofDrawBitmapString(tutorials[index].name, x + 20.0f, rowY + 27.0f);
        rowY += rowHeight;
    }

    rowY += gap;
    const float buttonWidth = (width - 24.0f) * 0.5f;
    ofSetColor(62, 62, 62, 240);
    ofDrawRectRounded(x + 8.0f, rowY, buttonWidth, actionHeight, 5.0f);
    ofDrawRectRounded(x + 16.0f + buttonWidth, rowY, buttonWidth, actionHeight, 5.0f);
    ofSetColor(255);
    ofDrawBitmapString(graphic.isPlaying() ? "Restart" : "Play", x + 22.0f, rowY + 26.0f);
    ofDrawBitmapString(graphic.isPlaying() ? "Pause" : "Resume", x + 30.0f + buttonWidth, rowY + 26.0f);

    if (!error.empty()) {
        ofSetColor(255, 120, 120);
        ofDrawBitmapString(error, x + 8.0f, y + panelHeight + 18.0f);
    }
    ofPopStyle();
}

void ofApp::handleBrowserPointer(float x, float y) {
    constexpr float panelX = 16.0f;
    constexpr float panelY = 16.0f;
    constexpr float panelWidth = 260.0f;
    constexpr float headerHeight = 38.0f;
    constexpr float rowHeight = 44.0f;
    constexpr float gap = 8.0f;
    constexpr float actionHeight = 42.0f;

    if (x < panelX || x > panelX + panelWidth) return;

    const float rowsTop = panelY + headerHeight;
    const float rowsBottom = rowsTop + tutorials.size() * rowHeight;
    if (y >= rowsTop && y < rowsBottom) {
        const auto index = static_cast<std::size_t>((y - rowsTop) / rowHeight);
        loadTutorial(index);
        return;
    }

    const float actionsTop = rowsBottom + gap;
    if (y < actionsTop || y > actionsTop + actionHeight) return;

    const float splitX = panelX + panelWidth * 0.5f;
    if (x < splitX) {
        graphic.play();
    } else if (graphic.isPlaying()) {
        graphic.pause();
    } else {
        graphic.resume();
    }
}
#endif

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

void ofApp::mousePressed(int x, int y, int button) {
#ifdef __EMSCRIPTEN__
    if (button == OF_MOUSE_BUTTON_LEFT) handleBrowserPointer(static_cast<float>(x), static_cast<float>(y));
#else
    (void)x;
    (void)y;
    (void)button;
#endif
}

void ofApp::touchDown(ofTouchEventArgs& touch) {
#ifdef __EMSCRIPTEN__
    handleBrowserPointer(touch.x, touch.y);
#else
    (void)touch;
#endif
}

void ofApp::windowResized(int width, int height) {
    if (width != WindowWidth || height != WindowHeight) {
        ofSetWindowShape(WindowWidth, WindowHeight);
    }
}
