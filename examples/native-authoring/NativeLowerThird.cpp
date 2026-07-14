#include "NativeLowerThird.h"

#include <algorithm>

namespace ofxOGraf::examples {

TemplateDefinition NativeLowerThird::definition() const {
    TemplateDefinition value;
    value.id = "com.jonathan-frank.ofx-ograf-native-lower-third";
    value.name = "Native openFrameworks Lower Third";
    value.size = {1920, 1080};
    value.frameRate = 50.0;
    value.durationSeconds = 5.0;
    value.randomSeed = 424242;
    value.addControl(TypedControlDescriptor<std::string>{
        "headline", "Headline", "ofxOGraf", {}, {}, {}, {}, "Content"});
    value.addControl(TypedControlDescriptor<std::string>{
        "subtitle", "Subtitle", "Compiled C++ template", {}, {}, {}, {}, "Content", "", true});
    value.addControl(TypedControlDescriptor<ofFloatColor>{
        "accent-color", "Accent color", {1.0f, 0.8f, 0.0f, 1.0f}, {}, {}, {}, {}, "Style"});
    value.actions = {
        {"in", "Animate in", ActionKind::In, ActionPlayback::Once, 0.0, 0.4},
        {"update", "Update data", ActionKind::Update, ActionPlayback::Once, 0.4, 0.0},
        {"out", "Animate out", ActionKind::Out, ActionPlayback::Once, 4.5, 0.5}
    };
    value.metadata = {{"version", "0.1.0"}, {"source", {{"kind", "code"}, {"factory", "createNativeLowerThird"}}},
                      {"targets", {"native", "wasm", "ograf"}}, {"alpha", true},
                      {"supportsRealTime", true}, {"supportsNonRealTime", true}, {"stepCount", 1}};
    return value;
}

void NativeLowerThird::onDraw(const FrameContext& frame) {
    const auto& data = frame.data();
    const auto headline = data.value("headline", std::string("ofxOGraf"));
    const auto subtitle = data.value("subtitle", std::string("Compiled C++ template"));
    const auto accent = data.value("accent-color", ofJson::array({1.0, 0.8, 0.0, 1.0}));
    float alpha = 1.0f;
    if (frame.timeSeconds < 0.4) alpha = static_cast<float>(frame.timeSeconds / 0.4);
    else if (frame.timeSeconds > 4.5) alpha = static_cast<float>((5.0 - frame.timeSeconds) / 0.5);
    alpha = ofClamp(alpha, 0.0f, 1.0f);
    const float scale = std::min(ofGetWidth() / static_cast<float>(outputSize.x),
                                 ofGetHeight() / static_cast<float>(outputSize.y));
    const float offsetX = (ofGetWidth() - outputSize.x * scale) * 0.5f;
    const float offsetY = (ofGetHeight() - outputSize.y * scale) * 0.5f;
    ofPushMatrix();
    ofTranslate(offsetX, offsetY);
    ofScale(scale, scale);
    ofPushStyle();
    ofEnableAlphaBlending();
    ofSetColor(8, 24, 56, static_cast<int>(230.0f * alpha));
    ofDrawRectangle(220.0f, 760.0f, 1180.0f * alpha, 150.0f);
    ofSetColor(static_cast<int>(255.0 * accent[0].get<double>()),
               static_cast<int>(255.0 * accent[1].get<double>()),
               static_cast<int>(255.0 * accent[2].get<double>()),
               static_cast<int>(255.0 * (accent.size() > 3 ? accent[3].get<double>() : 1.0) * alpha));
    ofDrawRectangle(220.0f, 760.0f, 14.0f, 150.0f);
    ofSetColor(255, 255, 255, static_cast<int>(255.0f * alpha));
    ofDrawBitmapString(headline, 270.0f, 815.0f);
    ofSetColor(205, 215, 230, static_cast<int>(255.0f * alpha));
    ofDrawBitmapString(subtitle, 270.0f, 855.0f);
    ofPopStyle();
    ofPopMatrix();
}

std::unique_ptr<CodeTemplate> createNativeLowerThird() {
    return std::make_unique<NativeLowerThird>();
}

bool registerNativeLowerThird(CodeTemplateRegistry& registry, std::string* error) {
    return registry.registerFactory("native-lower-third", createNativeLowerThird, error);
}

} // namespace ofxOGraf::examples
