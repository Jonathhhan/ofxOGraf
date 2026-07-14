#include "ofxOGrafGraphic.h"
#include "ofxOGrafSceneLoader.h"

namespace ofxOGraf {

void Graphic::setup() {
    ofDisableDepthTest();
    ofEnableAlphaBlending();
    renderer.setup();
}

bool Graphic::loadFile(const std::string& path) {
    try {
        scene = SceneLoader::loadFile(path);
        data = Controls::withDefaults(scene, data);
        renderer.setScene(scene);
        renderer.setData(data);
        loaded = true;
        lastError.clear();
        timeline.setTime(0.0);
        return true;
    } catch (const std::exception& error) {
        loaded = false;
        lastError = error.what();
        ofLogError("ofxOGraf") << lastError;
        return false;
    }
}

bool Graphic::loadJson(const std::string& jsonText) {
    try {
        scene = SceneLoader::loadString(jsonText);
        data = Controls::withDefaults(scene, data);
        renderer.setScene(scene);
        renderer.setData(data);
        loaded = true;
        lastError.clear();
        timeline.setTime(0.0);
        return true;
    } catch (const std::exception& error) {
        loaded = false;
        lastError = error.what();
        ofLogError("ofxOGraf") << lastError;
        return false;
    }
}

bool Graphic::loadJson(const ofJson& document) {
    try {
        scene = SceneLoader::loadJson(document);
        data = Controls::withDefaults(scene, data);
        renderer.setScene(scene);
        renderer.setData(data);
        loaded = true;
        lastError.clear();
        timeline.setTime(0.0);
        return true;
    } catch (const std::exception& error) {
        loaded = false;
        lastError = error.what();
        ofLogError("ofxOGraf") << lastError;
        return false;
    }
}

void Graphic::setData(const ofJson& value) {
    data = loaded ? Controls::withDefaults(scene, value) : (value.is_object() ? value : ofJson::object());
    renderer.setData(data);
}

void Graphic::updateData(const ofJson& patch) {
    if (patch.is_object()) {
        data.merge_patch(patch);
        renderer.setData(data);
    }
}

void Graphic::setTime(double seconds) { timeline.setTime(ofClamp(seconds, 0.0, scene.duration)); }
void Graphic::setTimeMilliseconds(double milliseconds) { setTime(milliseconds / 1000.0); }
double Graphic::getTime() const { return timeline.getTime(); }

void Graphic::play(int, bool skipAnimation) {
    playing = !skipAnimation;
    stopping = false;
    actionComplete = skipAnimation;
    playStart = 0.0;
    timeline.setTime(skipAnimation ? scene.duration : playStart);
}

void Graphic::stop(bool skipAnimation) {
    playing = false;
    stopping = !skipAnimation;
    actionComplete = skipAnimation;
    stopElapsed = 0.0;
    if (skipAnimation) timeline.setTime(scene.duration);
}

bool Graphic::isActionComplete(const std::string&) const { return actionComplete; }

void Graphic::update(double deltaSeconds) {
    if (playing) {
        timeline.setTime(timeline.getTime() + deltaSeconds);
        if (timeline.getTime() >= scene.duration) {
            playing = false;
            actionComplete = true;
        }
    } else if (stopping) {
        stopElapsed += deltaSeconds;
        timeline.setTime(timeline.getTime() + deltaSeconds);
        if (timeline.getTime() >= scene.duration || stopElapsed >= stopDuration) {
            stopping = false;
            actionComplete = true;
        }
    }
}

void Graphic::draw() {
    ofClear(0, 0, 0, 0);
    if (loaded) renderer.draw(timeline.getTime());
}

bool Graphic::isLoaded() const { return loaded; }
const Scene& Graphic::getScene() const { return scene; }
const ofJson& Graphic::getDocument() const { return scene.sourceDocument(); }
const ofJson& Graphic::getData() const { return data; }
const ofJson& Graphic::getControls() const { return Controls::definitions(scene); }
ofJson Graphic::getControlDefaults() const { return Controls::defaultData(scene); }
const std::string& Graphic::getLastError() const { return lastError; }
Extensions& Graphic::extensions() { return renderer.extensions(); }

} // namespace ofxOGraf
