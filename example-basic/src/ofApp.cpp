#include "ofApp.h"

void ofApp::setup() {
    ofSetFrameRate(50);
    ofSetWindowShape(WindowWidth, WindowHeight);
    broadcastGraphic.setup();

    ofxOGraf::SceneBuilder scene("scene:of-lower-third");
    scene.provenance("create", "cc.openframeworks.ofxograf.example-basic", "0.3.0");
    scene.fontAsset("font:verdana", "fonts/verdana.ttf", "Verdana");

    auto composition = scene.composition(
        "composition:main", "Native lower third", CompositionWidth, CompositionHeight, 5.0, {50, 1});

    // Layers use stable IDs. Top-most layers are authored first, matching the
    // Broadcast Scene render-order convention.
    auto headline = composition.textLayer("layer:headline", "Headline", "Built directly in openFrameworks");
    headline.position({260.0, 740.0, 0.0}).timing(0.0, 5.0);
    headline.font("Verdana", 54.0).fontAsset("font:verdana");
    headline.fill({1.0, 1.0, 1.0, 1.0});

    auto panel = composition.shapeLayer(
        "layer:panel", "Panel", ofxOGraf::ShapeGeometry::rectangle(1100.0, 130.0, 18.0));
    panel.position({720.0, 700.0, 0.0}).timing(0.0, 5.0);
    panel.fill({0.04, 0.10, 0.22, 0.96});
    scene.animate(panel.positionPropertyId(), {
        {0.0, ofJson::array({720.0, 830.0, 0.0}), "bezier"},
        {0.5, ofJson::array({720.0, 700.0, 0.0}), "bezier"}
    });
    scene.animate(headline.opacityPropertyId(), {
        {0.0, 0.0, "linear"},
        {0.5, 1.0, "linear"}
    });

    scene.control("control:headline", "Headline", "string", "Built directly in openFrameworks")
        .bind(headline.textPropertyId())
        .ui("Content", 0);
    scene.action("action:play", "Play", "segment", {{"start", 0.0}, {"duration", 5.0}});

    const auto diagnostics = scene.validate();
    for (const auto& diagnostic : diagnostics) {
        ofLogError("ofxOGraf") << diagnostic.code << " at " << diagnostic.path
                                << ": " << diagnostic.message;
    }
    broadcastGraphic.loadJson(scene.build());

    ofFbo::Settings targetSettings;
    targetSettings.width = CompositionWidth;
    targetSettings.height = CompositionHeight;
    targetSettings.internalformat = GL_RGBA;
    targetSettings.useDepth = false;
    targetSettings.useStencil = false;
    targetSettings.textureTarget = GL_TEXTURE_2D;
    renderTarget.allocate(targetSettings);
    broadcastGraphic.play();
}

void ofApp::update() {
    broadcastGraphic.update(ofGetLastFrameTime());
}

void ofApp::draw() {
    renderTarget.begin();
    ofClear(0, 0, 0, 0);
    broadcastGraphic.draw();
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
    ofEnableAlphaBlending();
    glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
    renderTarget.draw(previewX, previewY, previewWidth, previewHeight);
    ofEnableAlphaBlending();
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

ofxOGraf::Graphic& ofApp::graphic() { return broadcastGraphic; }
