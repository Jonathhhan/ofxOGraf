#include "ofApp.h"
#include "../../examples/native-authoring/NativeLowerThird.h"
#include <utility>

ofApp::ofApp(std::string outputPath, double outputTime)
    : frameOutputPath(std::move(outputPath))
    , frameTime(outputTime) {}

void ofApp::setup() {
    ofSetFrameRate(50);
    ofSetWindowShape(WindowWidth, WindowHeight);
    broadcastGraphic.setup();
    ofxOGraf::examples::registerNativeLowerThird(codeTemplateRegistry);

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
    preview.allocate(broadcastGraphic.getScene());
    if (frameOutputPath.empty()) {
        broadcastGraphic.play();
    } else {
        broadcastGraphic.setTime(frameTime);
    }
}

bool ofApp::loadCodeTemplate(const std::string& factoryId, const ofJson& initialData) {
    std::string error;
    auto instance = codeTemplateRegistry.create(factoryId, &error);
    if (!instance) {
        ofLogError("ofxOGraf") << error;
        return false;
    }
    if (!codeTemplate.load(std::move(instance), {}, initialData)) {
        ofLogError("ofxOGraf") << codeTemplate.lastError();
        return false;
    }
    usingCodeTemplate = true;
    return true;
}

bool ofApp::updateCodeTemplate(const ofJson& patch) {
    return usingCodeTemplate && codeTemplate.updateData(patch);
}

bool ofApp::playCodeTemplate() {
    return usingCodeTemplate && codeTemplate.play();
}

bool ofApp::stopCodeTemplate() {
    return usingCodeTemplate && codeTemplate.stop();
}

bool ofApp::seekCodeTemplate(double timeSeconds) {
    return usingCodeTemplate && codeTemplate.seek(timeSeconds);
}

bool ofApp::isCodeTemplateActionComplete() const {
    return !usingCodeTemplate || codeTemplate.state() != ofxOGraf::CodeTemplateState::Playing;
}

std::string ofApp::codeTemplateLastError() const {
    return codeTemplate.lastError();
}

void ofApp::useSceneGraphic() {
    usingCodeTemplate = false;
    codeTemplate.dispose();
}

void ofApp::update() {
    if (usingCodeTemplate) {
        codeTemplate.update(ofGetLastFrameTime());
        return;
    }
    broadcastGraphic.update(ofGetLastFrameTime());
}

void ofApp::draw() {
    if (usingCodeTemplate) {
        ofClear(0, 0, 0, 0);
        if (!codeTemplate.draw()) ofLogError("ofxOGraf") << codeTemplate.lastError();
        return;
    }

    preview.render(broadcastGraphic);
    if (!frameOutputPath.empty() && !frameExported) {
        frameExported = true;
        const bool saved = preview.savePng(frameOutputPath);
        if (saved) ofLogNotice("ofxOGraf") << "Exported RGBA frame: " << frameOutputPath;
        else ofLogError("ofxOGraf") << "Could not export RGBA frame: " << frameOutputPath;
        ofExit(saved ? 0 : 1);
        return;
    }

    ofClear(24, 24, 24, 255);
    preview.drawFit(0.0f, 0.0f, ofGetWidth(), ofGetHeight(), true);
}

void ofApp::windowResized(int width, int height) {
    if (width != WindowWidth || height != WindowHeight) {
        ofSetWindowShape(WindowWidth, WindowHeight);
    }
}

ofxOGraf::Graphic& ofApp::graphic() { return broadcastGraphic; }
