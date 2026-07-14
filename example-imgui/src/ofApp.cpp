#include "ofApp.h"

void ofApp::setup() {
    ofSetFrameRate(50);
    graphic.setup();

    ofxOGraf::SceneBuilder scene("scene:imgui-lower-third");
    scene.fontAsset("font:verdana", "fonts/verdana.ttf", "Verdana");
    auto composition = scene.composition(
        "composition:main", "ImGui lower third", 1920, 1080, 5.0, {50, 1});
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
    gui.setup();
}

void ofApp::update() {
    graphic.update(ofGetLastFrameTime());
}

void ofApp::draw() {
    graphic.draw();
    gui.begin();
    controls.draw(graphic);
    gui.end();
}
