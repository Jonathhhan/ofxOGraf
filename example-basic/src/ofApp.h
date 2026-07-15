#pragma once

#include "ofMain.h"
#include <string>
#include "ofxOGraf.h"

class ofApp : public ofBaseApp {
public:
    void setup() override;
    explicit ofApp(std::string frameOutputPath = {}, double frameTime = 0.0);
    void update() override;
    void draw() override;
    void windowResized(int width, int height) override;
    bool loadCodeTemplate(const std::string& factoryId, const ofJson& initialData = ofJson::object());
    bool updateCodeTemplate(const ofJson& patch);
    bool playCodeTemplate(const std::string& actionId = {});
    bool stopCodeTemplate();
    bool seekCodeTemplate(double timeSeconds);
    bool isCodeTemplateActionComplete() const;
    std::string codeTemplateLastError() const;
    std::string codeTemplateAbiFingerprint(const std::string& factoryId) const;
    void useSceneGraphic();


    ofxOGraf::Graphic& graphic();

private:
    static constexpr int WindowWidth = 1280;
    static constexpr int WindowHeight = 720;
    static constexpr int CompositionWidth = 1920;
    static constexpr int CompositionHeight = 1080;

    ofxOGraf::Graphic broadcastGraphic;
    ofxOGraf::CodeTemplateRegistry codeTemplateRegistry;
    ofxOGraf::CodeTemplateHost codeTemplate;
    bool usingCodeTemplate = false;
    ofxOGraf::RenderSurface preview;
    std::string frameOutputPath;
    double frameTime = 0.0;
    bool frameExported = false;
};
