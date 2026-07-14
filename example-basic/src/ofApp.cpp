#include "ofApp.h"

void ofApp::setup() {
    ofSetFrameRate(50);
    broadcastGraphic.setup();

    ofxOGraf::SceneBuilder scene("scene:of-lower-third");
    scene.provenance("create", "cc.openframeworks.ofxograf.example-basic", "0.3.0");

    auto composition = scene.composition(
        "composition:main", "Native lower third", 1920, 1080, 5.0, {50, 1});

    // Layers use stable IDs. Top-most layers are authored first, matching the
    // Broadcast Scene render-order convention.
    auto headline = composition.textLayer("layer:headline", "Headline", "Built directly in openFrameworks");
    headline.position({260.0, 875.0, 0.0}).timing(0.0, 5.0);
    headline.font("sans-serif", 54.0).fill({1.0, 1.0, 1.0, 1.0});

    auto panel = composition.shapeLayer(
        "layer:panel", "Panel", ofxOGraf::ShapeGeometry::rectangle(1100.0, 130.0, 18.0));
    panel.position({720.0, 835.0, 0.0}).timing(0.0, 5.0);
    panel.fill({0.04, 0.10, 0.22, 0.96});
    scene.animate(panel.positionPropertyId(), {
        {0.0, ofJson::array({720.0, 930.0, 0.0}), "bezier"},
        {0.5, ofJson::array({720.0, 835.0, 0.0}), "bezier"}
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
}

void ofApp::update() {
    broadcastGraphic.update(ofGetLastFrameTime());
}

void ofApp::draw() {
    broadcastGraphic.draw();
}

ofxOGraf::Graphic& ofApp::graphic() { return broadcastGraphic; }
