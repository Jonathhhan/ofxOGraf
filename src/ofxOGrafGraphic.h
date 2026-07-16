#pragma once

#include "ofMain.h"
#include "ofxOGrafControls.h"
#include "ofxOGrafRenderer.h"
#include "ofxOGrafScene.h"
#include "ofxOGrafTimeline.h"
#include <string>

namespace ofxOGraf {

class Graphic {
public:
    void setup();
    bool loadFile(const std::string& path);
    bool loadJson(const std::string& jsonText);
    bool loadJson(const ofJson& document);
    // Replace all control values. Missing keys are filled from the scene's
    // declared defaults. Does not validate; any value is accepted.
    void setData(const ofJson& value);
    // Merge-patch the current control data with `patch`. Validates the result
    // against the scene's control schema; returns false and sets getLastError()
    // if any value is out of range or has the wrong type.
    bool updateData(const ofJson& patch);

    void setTime(double seconds);
    void setTimeMilliseconds(double milliseconds);
    double getTime() const;

    void play(int step = 0, bool skipAnimation = false);
    void pause();
    void resume();
    void stop(bool skipAnimation = false);
    bool isPlaying() const;
    void setLooping(bool enabled);
    bool isLooping() const;
    bool isActionComplete(const std::string& action = "") const;
    void update(double deltaSeconds);
    void draw();

    bool isLoaded() const;
    const Scene& getScene() const;
    const ofJson& getDocument() const;
    const ofJson& getData() const;
    const ofJson& getControls() const;
    ofJson getControlDefaults() const;
    const std::string& getLastError() const;
    const std::vector<std::string>& getAssetWarnings() const;
    Extensions& extensions();

private:
    Scene scene;
    Timeline timeline;
    Renderer renderer;
    ofJson data = ofJson::object();
    bool loaded = false;
    bool playing = false;
    bool looping = false;
    bool stopping = false;
    bool actionComplete = true;
    double playStart = 0.0;
    double stopDuration = 0.5;
    double stopElapsed = 0.0;
    std::string lastError;

    bool installScene(Scene candidate);
};

} // namespace ofxOGraf
