#include "ofxOGrafGraphic.h"
#include "ofxOGrafSceneLoader.h"
#include <cmath>

namespace ofxOGraf {

void Graphic::setup() {
    ofDisableDepthTest();
    ofEnableAlphaBlending();
    renderer.setup();
}

bool Graphic::installScene(Scene candidate) {
    const std::string extensionError = renderer.extensions().validateRequired(candidate.sourceDocument());
    if (!extensionError.empty()) {
        lastError = extensionError;
        ofLogError("ofxOGraf") << lastError;
        return false;
    }
    scene = std::move(candidate);
    data = Controls::withDefaults(scene, data);
    renderer.setScene(scene);
    renderer.setData(data);
    loaded = true;
    lastError.clear();
    timeline.setTime(0.0);
    return true;
}

bool Graphic::loadFile(const std::string& path) {
    try {
        return installScene(SceneLoader::loadFile(path));
    } catch (const std::exception& error) {
        loaded = false;
        lastError = error.what();
        ofLogError("ofxOGraf") << lastError;
        return false;
    }
}

bool Graphic::loadJson(const std::string& jsonText) {
    try {
        return installScene(SceneLoader::loadString(jsonText));
    } catch (const std::exception& error) {
        loaded = false;
        lastError = error.what();
        ofLogError("ofxOGraf") << lastError;
        return false;
    }
}

bool Graphic::loadJson(const ofJson& document) {
    try {
        return installScene(SceneLoader::loadJson(document));
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

bool Graphic::updateData(const ofJson& patch) {
    if (!patch.is_object()) {
        lastError = "[control.validation] /: Update patch must be an object.";
        return false;
    }
    ofJson candidate = data;
    candidate.merge_patch(patch);
    const auto errors = Controls::validateData(scene, candidate);
    if (!errors.empty()) {
        lastError = "[control.validation] " + errors.front().path + ": " + errors.front().message;
        return false;
    }
    data = std::move(candidate);
    renderer.setData(data);
    lastError.clear();
    return true;
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

void Graphic::pause() {
    playing = false;
}

void Graphic::resume() {
    if (!loaded || scene.duration <= 0.0) return;
    if (timeline.getTime() >= scene.duration) timeline.setTime(0.0);
    playing = true;
    stopping = false;
    actionComplete = false;
}

void Graphic::stop(bool skipAnimation) {
    playing = false;
    stopping = !skipAnimation;
    actionComplete = skipAnimation;
    stopElapsed = 0.0;
    if (skipAnimation) timeline.setTime(scene.duration);
}

bool Graphic::isPlaying() const { return playing; }
void Graphic::setLooping(bool enabled) { looping = enabled; }
bool Graphic::isLooping() const { return looping; }

bool Graphic::isActionComplete(const std::string&) const { return actionComplete; }

void Graphic::update(double deltaSeconds) {
    if (playing) {
        timeline.setTime(timeline.getTime() + deltaSeconds);
        if (timeline.getTime() >= scene.duration) {
            if (looping && scene.duration > 0.0) {
                timeline.setTime(std::fmod(timeline.getTime(), scene.duration));
            } else {
                playing = false;
                actionComplete = true;
            }
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
const std::vector<std::string>& Graphic::getAssetWarnings() const { return renderer.assetWarnings(); }
Extensions& Graphic::extensions() { return renderer.extensions(); }

} // namespace ofxOGraf
