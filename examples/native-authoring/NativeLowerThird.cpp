#include "NativeLowerThird.h"
#include "ofxOGrafAuthoring.h"

#include <algorithm>
#include <cmath>

namespace ofxOGraf::examples {
namespace {

constexpr double TemplateDuration = 5.0;

double numberControl(const ofJson& data, const char* id, double fallback) {
    const auto found = data.find(id);
    return found != data.end() && found->is_number() ? found->get<double>() : fallback;
}

bool booleanControl(const ofJson& data, const char* id, bool fallback) {
    const auto found = data.find(id);
    return found != data.end() && found->is_boolean() ? found->get<bool>() : fallback;
}

glm::vec2 vectorControl(const ofJson& data, const char* id, glm::vec2 fallback) {
    const auto found = data.find(id);
    if (found == data.end() || !found->is_array() || found->size() != 2 ||
        !(*found)[0].is_number() || !(*found)[1].is_number()) return fallback;
    return {(*found)[0].get<float>(), (*found)[1].get<float>()};
}

glm::vec2 unitDirection(glm::vec2 value, glm::vec2 fallback) {
    const float length = glm::length(value);
    return length > 0.0001f ? value / length : fallback;
}

double easedProgress(double progress, double influence) {
    progress = ofClamp(progress, 0.0, 1.0);
    const double smooth = progress * progress * (3.0 - 2.0 * progress);
    return ofLerp(progress, smooth, ofClamp(influence / 100.0, 0.0, 1.0));
}

} // namespace

TemplateDefinition NativeLowerThird::definition() const {
    TemplateDefinition value;
    value.id = "com.jonathan-frank.ofx-ograf-native-lower-third";
    value.name = "Native openFrameworks Lower Third";
    value.size = {1920, 1080};
    value.frameRate = 50.0;
    value.durationSeconds = TemplateDuration;
    value.randomSeed = 424242;
    value.addControl(TypedControlDescriptor<std::string>{
        "headline", "Headline", "ofxOGraf", {}, {}, {}, {}, "Content", "Primary on-air text."});
    value.addControl(TypedControlDescriptor<std::string>{
        "subtitle", "Subtitle", "Compiled C++ template", {}, {}, {}, {}, "Content", "Secondary on-air text.", true});
    value.addControl(TypedControlDescriptor<ofFloatColor>{
        "accent-color", "Accent color", {1.0f, 0.8f, 0.0f, 1.0f}, {}, {}, {}, {}, "Style", "Vertical accent strip."});
    value.addControl(TypedControlDescriptor<std::string>{
        "alignment", "Alignment", "left", {}, {}, {},
        {{"left", "Left"}, {"center", "Center"}, {"right", "Right"}},
        "Content", "Horizontal text alignment inside the panel."});

        const LowerThirdMotion defaults;

    // Keep these ids and defaults portable: the descriptor drives the HTML
    // Essential Controls panel while native hosts can use the same data patch.
    value.addControl(TypedControlDescriptor<glm::vec2>{
        "motion-position", "Banderole position", {static_cast<float>(defaults.position.x), static_cast<float>(defaults.position.y)}, {}, {}, {}, {}, "Motion", "Panel centre resting position in composition pixels."});
    value.addControl(TypedControlDescriptor<glm::vec2>{
        "motion-text-offset", "Headline inset", {static_cast<float>(defaults.textOffset.x), static_cast<float>(defaults.textOffset.y)}, {}, {}, {}, {}, "Motion", "Headline baseline offset from the panel."});
    value.addControl(TypedControlDescriptor<glm::vec2>{
        "motion-entry-direction", "Entry direction", {static_cast<float>(defaults.entryDirection.x), static_cast<float>(defaults.entryDirection.y)}, {}, {}, {}, {}, "Motion", "Direction from which the graphic enters."});
    value.addControl(TypedControlDescriptor<glm::vec2>{
        "motion-exit-direction", "Exit direction", {static_cast<float>(defaults.exitDirection.x), static_cast<float>(defaults.exitDirection.y)}, {}, {}, {}, {}, "Motion", "Direction toward which the graphic exits."});
    value.addControl(TypedControlDescriptor<double>{
        "motion-entry-travel", "Entry travel", defaults.entryDistance, 0.0, 3840.0, 1.0, {}, "Motion", "Travel distance before the resting position."});
    value.addControl(TypedControlDescriptor<double>{
        "motion-exit-travel", "Exit travel", defaults.exitDistance, 0.0, 3840.0, 1.0, {}, "Motion", "Travel distance after the resting position."});
    value.addControl(TypedControlDescriptor<double>{
        "motion-entry-duration", "Entry duration", defaults.entryDuration, 0.05, 4.0, 0.05, {}, "Motion", "Duration of the entrance segment."});
    value.addControl(TypedControlDescriptor<double>{
        "motion-hold-duration", "Hold duration", defaults.holdDuration, 0.0, 10.0, 0.05, {}, "Motion", "Time held at the resting position."});
    value.addControl(TypedControlDescriptor<double>{
        "motion-exit-duration", "Exit duration", defaults.exitDuration, 0.05, 4.0, 0.05, {}, "Motion", "Duration of the exit segment."});
    value.addControl(TypedControlDescriptor<double>{
        "motion-entry-influence", "Entry Bezier influence", defaults.entryEase.influence, 0.0, 100.0, 1.0, {}, "Motion", "Ease strength for the entrance segment."});
    value.addControl(TypedControlDescriptor<double>{
        "motion-exit-influence", "Exit Bezier influence", defaults.exitEase.influence, 0.0, 100.0, 1.0, {}, "Motion", "Ease strength for the exit segment."});
    value.addControl(TypedControlDescriptor<bool>{
        "motion-fade-in", "Fade in", defaults.fadeIn, {}, {}, {}, {}, "Motion", "Fade opacity during entrance."});
    value.addControl(TypedControlDescriptor<bool>{
        "motion-fade-out", "Fade out", defaults.fadeOut, {}, {}, {}, {}, "Motion", "Fade opacity during exit."});

    value.actions = {
        {"in", "Animate in", ActionKind::In, ActionPlayback::Once, 0.0, defaults.entryDuration},
        {"update", "Update data", ActionKind::Update, ActionPlayback::Once, defaults.entryDuration, 0.0},
        {"out", "Animate out", ActionKind::Out, ActionPlayback::Once, defaults.entryDuration + defaults.holdDuration, defaults.exitDuration}
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
    const LowerThirdMotion defaults;
    const auto position = vectorControl(data, "motion-position", {static_cast<float>(defaults.position.x), static_cast<float>(defaults.position.y)});
    const auto textOffset = vectorControl(data, "motion-text-offset", {static_cast<float>(defaults.textOffset.x), static_cast<float>(defaults.textOffset.y)});
    const auto entryDirection = unitDirection(vectorControl(data, "motion-entry-direction", {static_cast<float>(defaults.entryDirection.x), static_cast<float>(defaults.entryDirection.y)}), {-1.0f, 0.0f});
    const auto exitDirection = unitDirection(vectorControl(data, "motion-exit-direction", {static_cast<float>(defaults.exitDirection.x), static_cast<float>(defaults.exitDirection.y)}), {1.0f, 0.0f});
    const double entryDuration = std::max(0.05, numberControl(data, "motion-entry-duration", defaults.entryDuration));
    const double holdDuration = std::max(0.0, numberControl(data, "motion-hold-duration", defaults.holdDuration));
    const double exitDuration = std::max(0.05, numberControl(data, "motion-exit-duration", defaults.exitDuration));
    const double exitStart = entryDuration + holdDuration;
    const double entryProgress = easedProgress(frame.timeSeconds / entryDuration,
                                                numberControl(data, "motion-entry-influence", defaults.entryEase.influence));
    const double exitProgress = easedProgress((frame.timeSeconds - exitStart) / exitDuration,
                                               numberControl(data, "motion-exit-influence", defaults.exitEase.influence));
    glm::vec2 offset{0.0f, 0.0f};
    float alpha = 1.0f;
    if (frame.timeSeconds < entryDuration) {
        offset = entryDirection * static_cast<float>(numberControl(data, "motion-entry-travel", defaults.entryDistance) * (1.0 - entryProgress));
        if (booleanControl(data, "motion-fade-in", defaults.fadeIn)) alpha = static_cast<float>(entryProgress);
    } else if (frame.timeSeconds >= exitStart) {
        offset = exitDirection * static_cast<float>(numberControl(data, "motion-exit-travel", defaults.exitDistance) * exitProgress);
        if (booleanControl(data, "motion-fade-out", defaults.fadeOut)) alpha = static_cast<float>(1.0 - exitProgress);
    }
    alpha = ofClamp(alpha, 0.0f, 1.0f);

    const float scale = std::min(ofGetWidth() / static_cast<float>(outputSize.x),
                                 ofGetHeight() / static_cast<float>(outputSize.y));
    const float offsetX = (ofGetWidth() - outputSize.x * scale) * 0.5f;
    const float offsetY = (ofGetHeight() - outputSize.y * scale) * 0.5f;
    const glm::vec2 panelPosition = position + offset - glm::vec2{550.0f, 65.0f};
    ofPushMatrix();
    ofTranslate(offsetX, offsetY);
    ofScale(scale, scale);
    ofPushStyle();
    ofEnableAlphaBlending();
    ofSetColor(8, 24, 56, static_cast<int>(230.0f * alpha));
    ofDrawRectangle(panelPosition.x, panelPosition.y, 1180.0f, 150.0f);
    ofSetColor(static_cast<int>(255.0 * accent[0].get<double>()),
               static_cast<int>(255.0 * accent[1].get<double>()),
               static_cast<int>(255.0 * accent[2].get<double>()),
               static_cast<int>(255.0 * (accent.size() > 3 ? accent[3].get<double>() : 1.0) * alpha));
    ofDrawRectangle(panelPosition.x, panelPosition.y, 14.0f, 150.0f);
    const std::string alignment = data.value("alignment", std::string("left"));
    const ofBitmapFont bitmapFont;
    const auto alignedX = [&](const std::string& text) {
        const float width = bitmapFont.getBoundingBox(text, 0, 0).getWidth();
        if (alignment == "center") return panelPosition.x + 590.0f - width * 0.5f;
        if (alignment == "right") return panelPosition.x + 1140.0f - width;
        return position.x + offset.x + textOffset.x;
    };
    ofSetColor(255, 255, 255, static_cast<int>(255.0f * alpha));
    ofDrawBitmapString(headline, alignedX(headline), position.y + offset.y + textOffset.y);
    ofSetColor(205, 215, 230, static_cast<int>(255.0f * alpha));
    ofDrawBitmapString(subtitle, alignedX(subtitle), position.y + offset.y + textOffset.y + 40.0f);
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