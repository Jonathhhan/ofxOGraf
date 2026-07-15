#include "ofApp.h"
#include <algorithm>
#include <cmath>

ofJson ofApp::buildBanderoleScene() const {
    constexpr double ReferenceFontSize = 54.0;
    const double fontScale = std::max(0.1, fontSize / ReferenceFontSize);
    const double panelWidth = 1100.0 * fontScale;
    const double panelHeight = 130.0 * fontScale;
    ofxOGraf::SceneBuilder scene("scene:imgui-lower-third");
    scene.fontAsset("font:verdana", "fonts/verdana.ttf", "Verdana");
    auto composition = scene.composition(
        "composition:main", "ImGui lower third", CompositionWidth, CompositionHeight,
        std::max(0.01, motion.duration()), {50, 1});
    auto headline = composition.textLayer("layer:headline", "Headline", "Editable in ofxImGui");
    headline.position({motion.position.x + motion.textOffset.x * fontScale,
                       motion.position.y + motion.textOffset.y * fontScale, 0.0});
    headline.font("Verdana", fontSize).fontAsset("font:verdana");
    auto panel = composition.shapeLayer(
        "layer:panel", "Panel", ofxOGraf::ShapeGeometry::rectangle(panelWidth, panelHeight, 18.0 * fontScale));
    panel.position({motion.position.x, motion.position.y, 0.0});
    panel.fill({0.04, 0.10, 0.22, 0.72});

    ofxOGraf::animateLowerThird(scene, panel, headline, motion);

    scene.control("control:headline", "Headline", "string", "Editable in ofxImGui")
        .bind(headline.textPropertyId()).ui("Content", 0);
    scene.control("control:size", "Font size", "number", fontSize)
        .bind(headline.fontSizePropertyId()).range(24.0, 96.0, 1.0).ui("Style", 0);
    scene.control("control:panel-color", "Panel color", "color",
                  ofJson::array({0.04, 0.10, 0.22, 0.72}))
        .bind(panel.fillPropertyId()).ui("Style", 1);
    return scene.build();
}

void ofApp::rebuildBanderoleScene(bool restart) {
    const ofJson data = graphic.getData();
    const double previousTime = graphic.getTime();
    const bool wasPlaying = graphic.isPlaying();
    graphic.pause();
    if (!graphic.loadJson(buildBanderoleScene())) return;
    graphic.setData(data);
    preview.allocate(graphic.getScene());
    if (restart) {
        graphic.play();
    } else {
        graphic.setTime(std::min(previousTime, graphic.getScene().duration));
        if (wasPlaying) graphic.resume();
    }
}

void ofApp::setup() {
    ofSetFrameRate(50);
    ofSetWindowShape(WindowWidth, WindowHeight);
    graphic.setup();
    rebuildBanderoleScene(true);
    gui.setup();
}

void ofApp::update() {
    graphic.update(ofGetLastFrameTime() * animationSpeed);
}

void ofApp::draw() {
    preview.render(graphic);
    ofClear(24, 24, 24, 255);
    // Browser-frame marker: this must be visible before OGraf or ImGui draw.
    ofSetColor(255, 80, 20, 255);
    ofDrawRectangle(16, 16, 48, 48);
    preview.drawFit(0.0f, 0.0f, ofGetWidth(), ofGetHeight(), true);

    gui.begin();
    ImGui::SetNextWindowPos({900.0f, 20.0f}, ImGuiCond_FirstUseEver);
    ImGui::SetNextWindowSize({360.0f, 160.0f}, ImGuiCond_FirstUseEver);
    if (ImGui::Begin("Playback")) {
        const float duration = static_cast<float>(graphic.getScene().duration);
        if (ImGui::Button("Restart banderole")) graphic.play();
        ImGui::SameLine();
        if (ImGui::Button(graphic.isPlaying() ? "Pause" : "Resume")) {
            if (graphic.isPlaying()) graphic.pause();
            else graphic.resume();
        }
        ImGui::Text("%0.2f / %0.2f s", graphic.getTime(), graphic.getScene().duration);
        float timelineSeconds = static_cast<float>(graphic.getTime());
        if (ImGui::SliderFloat("Timeline", &timelineSeconds, 0.0f, duration, "%.2f s")) {
            graphic.setTime(timelineSeconds);
        }
        ImGui::SliderFloat("Animation speed", &animationSpeed, 0.10f, 3.00f, "%.2fx");
        bool looping = graphic.isLooping();
        if (ImGui::Checkbox("Loop", &looping)) graphic.setLooping(looping);
    }
    ImGui::End();

    bool motionChanged = false;
    ImGui::SetNextWindowPos({900.0f, 190.0f}, ImGuiCond_FirstUseEver);
    ImGui::SetNextWindowSize({360.0f, 510.0f}, ImGuiCond_FirstUseEver);
    controls.draw(graphic, "Essential Graphics", nullptr, [&] {
        ImGui::TextDisabled("Motion");
        float position[2] = {static_cast<float>(motion.position.x), static_cast<float>(motion.position.y)};
        if (ImGui::DragFloat2("Banderole position", position, 1.0f)) {
            motion.position = {position[0], position[1]};
            motionChanged = true;
        }
        float inset[2] = {static_cast<float>(motion.textOffset.x), static_cast<float>(motion.textOffset.y)};
        if (ImGui::DragFloat2("Headline inset", inset, 1.0f)) {
            motion.textOffset = {inset[0], inset[1]};
            motionChanged = true;
        }
        ImGui::Separator();
        float entryDirection[2] = {static_cast<float>(motion.entryDirection.x), static_cast<float>(motion.entryDirection.y)};
        if (ImGui::DragFloat2("Entry direction", entryDirection, 0.01f, -1.0f, 1.0f)) {
            motion.entryDirection = {entryDirection[0], entryDirection[1]};
            motionChanged = true;
        }
        float exitDirection[2] = {static_cast<float>(motion.exitDirection.x), static_cast<float>(motion.exitDirection.y)};
        if (ImGui::DragFloat2("Exit direction", exitDirection, 0.01f, -1.0f, 1.0f)) {
            motion.exitDirection = {exitDirection[0], exitDirection[1]};
            motionChanged = true;
        }
        float entryDistance = static_cast<float>(motion.entryDistance);
        if (ImGui::SliderFloat("Entry travel", &entryDistance, 100.0f, 2400.0f, "%.0f px")) {
            motion.entryDistance = entryDistance;
            motionChanged = true;
        }
        float exitDistance = static_cast<float>(motion.exitDistance);
        if (ImGui::SliderFloat("Exit travel", &exitDistance, 100.0f, 2400.0f, "%.0f px")) {
            motion.exitDistance = exitDistance;
            motionChanged = true;
        }
        ImGui::Separator();
        float entryDuration = static_cast<float>(motion.entryDuration);
        if (ImGui::SliderFloat("Entry duration", &entryDuration, 0.10f, 3.00f, "%.2f s")) {
            motion.entryDuration = entryDuration;
            motionChanged = true;
        }
        float holdDuration = static_cast<float>(motion.holdDuration);
        if (ImGui::SliderFloat("Hold duration", &holdDuration, 0.0f, 10.00f, "%.2f s")) {
            motion.holdDuration = holdDuration;
            motionChanged = true;
        }
        float exitDuration = static_cast<float>(motion.exitDuration);
        if (ImGui::SliderFloat("Exit duration", &exitDuration, 0.10f, 3.00f, "%.2f s")) {
            motion.exitDuration = exitDuration;
            motionChanged = true;
        }
        ImGui::Separator();
        float entryInfluence = static_cast<float>(motion.entryEase.influence);
        if (ImGui::SliderFloat("Entry Bezier influence", &entryInfluence, 0.0f, 100.0f, "%.0f%%")) {
            motion.entryEase.influence = entryInfluence;
            motionChanged = true;
        }
        float exitInfluence = static_cast<float>(motion.exitEase.influence);
        if (ImGui::SliderFloat("Exit Bezier influence", &exitInfluence, 0.0f, 100.0f, "%.0f%%")) {
            motion.exitEase.influence = exitInfluence;
            motionChanged = true;
        }
        if (ImGui::Checkbox("Fade in", &motion.fadeIn)) motionChanged = true;
        if (ImGui::Checkbox("Fade out", &motion.fadeOut)) motionChanged = true;
    });
    gui.end();

    bool fontSizeChanged = false;
    const auto fontSizeValue = graphic.getData().find("size");
    if (fontSizeValue != graphic.getData().end() && fontSizeValue->is_number()) {
        const double requestedFontSize = ofClamp(fontSizeValue->get<double>(), 24.0, 96.0);
        fontSizeChanged = std::abs(requestedFontSize - fontSize) > 0.001;
        if (fontSizeChanged) fontSize = requestedFontSize;
    }
    if (motionChanged || fontSizeChanged) rebuildBanderoleScene(false);
}

void ofApp::windowResized(int width, int height) {
    if (width != WindowWidth || height != WindowHeight) {
        ofSetWindowShape(WindowWidth, WindowHeight);
    }
}