#include "ofApp.h"

void ofApp::setup() {
    ofSetFrameRate(50);
    ofSetWindowShape(WindowWidth, WindowHeight);
    graphic.setup();

    ofxOGraf::SceneBuilder scene("scene:imgui-lower-third");
    scene.fontAsset("font:verdana", "fonts/verdana.ttf", "Verdana");
    auto composition = scene.composition(
        "composition:main", "ImGui lower third", CompositionWidth, CompositionHeight, 5.0, {50, 1});
    auto headline = composition.textLayer("layer:headline", "Headline", "Editable in ofxImGui");
    headline.position({260.0, 740.0, 0.0});
    headline.font("Verdana", 54.0).fontAsset("font:verdana");
    auto panel = composition.shapeLayer(
        "layer:panel", "Panel", ofxOGraf::ShapeGeometry::rectangle(1100.0, 130.0, 18.0));
    panel.position({720.0, 700.0, 0.0});
    panel.fill({0.04, 0.10, 0.22, 0.96});

    scene.control("control:headline", "Headline", "string", "Editable in ofxImGui")
        .bind(headline.textPropertyId()).ui("Content", 0);
    scene.control("control:size", "Font size", "number", 54.0)
        .bind(headline.fontSizePropertyId()).range(24.0, 96.0, 1.0).ui("Style", 0);
    scene.control("control:panel-color", "Panel color", "color",
                  ofJson::array({0.04, 0.10, 0.22, 0.96}))
        .bind(panel.fillPropertyId()).ui("Style", 1);

    graphic.loadJson(scene.build());

    ofFbo::Settings targetSettings;
    targetSettings.width = CompositionWidth;
    targetSettings.height = CompositionHeight;
    targetSettings.internalformat = GL_RGBA;
    targetSettings.useDepth = false;
    targetSettings.useStencil = false;
    targetSettings.textureTarget = GL_TEXTURE_2D;
    renderTarget.allocate(targetSettings);

    gui.setup();
}

void ofApp::update() {
    graphic.update(ofGetLastFrameTime());
}

void ofApp::draw() {
    renderTarget.begin();
    ofClear(0, 0, 0, 0);
    graphic.draw();
    renderTarget.end();

    ofClear(24, 24, 24, 255);

    const float compositionWidth = static_cast<float>(CompositionWidth);
    const float compositionHeight = static_cast<float>(CompositionHeight);
    const float previewScale = std::min(
        static_cast<float>(ofGetWidth()) / compositionWidth,
        static_cast<float>(ofGetHeight()) / compositionHeight);
    const float previewX = (ofGetWidth() - compositionWidth * previewScale) * 0.5f;
    const float previewY = (ofGetHeight() - compositionHeight * previewScale) * 0.5f;

    const float previewWidth = compositionWidth * previewScale;
    const float previewHeight = compositionHeight * previewScale;
    drawTransparencyGrid(previewX, previewY, previewWidth, previewHeight);
    ofSetColor(255);
    renderTarget.draw(previewX, previewY, previewWidth, previewHeight);

    gui.begin();
    controls.draw(graphic);
    gui.end();
}

void ofApp::windowResized(int width, int height) {
    if (width != WindowWidth || height != WindowHeight) {
        ofSetWindowShape(WindowWidth, WindowHeight);
    }
}

void ofApp::drawTransparencyGrid(float x, float y, float width, float height) const {
    constexpr float TileSize = 24.0f;
    ofPushStyle();
    for (float tileY = 0.0f; tileY < height; tileY += TileSize) {
        for (float tileX = 0.0f; tileX < width; tileX += TileSize) {
            const auto column = static_cast<int>(tileX / TileSize);
            const auto row = static_cast<int>(tileY / TileSize);
            ofSetColor(((column + row) % 2 == 0) ? 52 : 72);
            ofDrawRectangle(x + tileX, y + tileY,
                            std::min(TileSize, width - tileX),
                            std::min(TileSize, height - tileY));
        }
    }
    ofPopStyle();
}
