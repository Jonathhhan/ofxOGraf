#include "ofxOGrafCodeTemplate.h"

#include <algorithm>
#include <cmath>
#include <limits>
#include <sstream>
#include <unordered_set>

namespace ofxOGraf {
namespace {

std::uint64_t mix64(std::uint64_t value) {
    value += 0x9e3779b97f4a7c15ULL;
    value = (value ^ (value >> 30U)) * 0xbf58476d1ce4e5b9ULL;
    value = (value ^ (value >> 27U)) * 0x94d049bb133111ebULL;
    return value ^ (value >> 31U);
}

std::uint64_t combineSeed(std::uint64_t left, std::uint64_t right) {
    return mix64(left ^ (mix64(right) + 0x9e3779b97f4a7c15ULL + (left << 6U) + (left >> 2U)));
}

bool numericArray(const ofJson& value, std::size_t minimum, std::size_t maximum) {
    if (!value.is_array() || value.size() < minimum || value.size() > maximum) return false;
    return std::all_of(value.begin(), value.end(), [](const ofJson& item) { return item.is_number(); });
}

std::string joinErrors(const std::vector<std::string>& errors) {
    std::ostringstream output;
    for (std::size_t i = 0; i < errors.size(); ++i) {
        if (i) output << "; ";
        output << errors[i];
    }
    return output.str();
}

} // namespace

const char* toString(ControlValueType value) {
    switch (value) {
        case ControlValueType::Boolean: return "boolean";
        case ControlValueType::Integer: return "integer";
        case ControlValueType::Number: return "number";
        case ControlValueType::String: return "string";
        case ControlValueType::Color: return "color";
        case ControlValueType::Vector2: return "vector2";
        case ControlValueType::Vector3: return "vector3";
        case ControlValueType::Json: return "json";
    }
    return "json";
}

const char* toString(AssetKind value) {
    switch (value) {
        case AssetKind::Font: return "font";
        case AssetKind::Image: return "image";
        case AssetKind::Audio: return "audio";
        case AssetKind::Data: return "data";
        case AssetKind::Shader: return "shader";
        case AssetKind::Other: return "other";
    }
    return "other";
}

const char* toString(ActionKind value) {
    switch (value) {
        case ActionKind::In: return "in";
        case ActionKind::Hold: return "hold";
        case ActionKind::Update: return "update";
        case ActionKind::Out: return "out";
        case ActionKind::Custom: return "custom";
    }
    return "custom";
}

const char* toString(ActionPlayback value) {
    switch (value) {
        case ActionPlayback::Once: return "once";
        case ActionPlayback::Loop: return "loop";
        case ActionPlayback::HoldLastFrame: return "hold-last-frame";
    }
    return "once";
}

ofJson ControlOption::toJson() const {
    return {{"value", value}, {"label", label}};
}

bool ControlDescriptor::accepts(const ofJson& value) const {
    switch (type) {
        case ControlValueType::Boolean: return value.is_boolean();
        case ControlValueType::Integer: return value.is_number_integer() || value.is_number_unsigned();
        case ControlValueType::Number: return value.is_number();
        case ControlValueType::String: return value.is_string();
        case ControlValueType::Color: return numericArray(value, 3, 4);
        case ControlValueType::Vector2: return numericArray(value, 2, 2);
        case ControlValueType::Vector3: return numericArray(value, 3, 3);
        case ControlValueType::Json: return true;
    }
    return false;
}

bool ControlDescriptor::validateValue(const ofJson& value, const std::string& path, std::string& error) const {
    if (!accepts(value)) {
        error = path + ": expected " + toString(type);
        return false;
    }
    if ((type == ControlValueType::Integer || type == ControlValueType::Number) && value.is_number()) {
        const double number = value.get<double>();
        if (!std::isfinite(number)) {
            error = path + ": number must be finite";
            return false;
        }
        if (minimum && minimum->is_number() && number < minimum->get<double>()) {
            error = path + ": value is below minimum " + minimum->dump();
            return false;
        }
        if (maximum && maximum->is_number() && number > maximum->get<double>()) {
            error = path + ": value is above maximum " + maximum->dump();
            return false;
        }
    }
    if (type == ControlValueType::Color) {
        for (const auto& channel : value) {
            const double number = channel.get<double>();
            if (!std::isfinite(number) || number < 0.0 || number > 1.0) {
                error = path + ": color channels must be finite and in the range 0..1";
                return false;
            }
        }
    }
    if (!options.empty()) {
        const bool matched = std::any_of(options.begin(), options.end(),
            [&](const ControlOption& option) { return option.value == value; });
        if (!matched) {
            error = path + ": value is not an allowed option";
            return false;
        }
    }
    return true;
}
ofJson ControlDescriptor::toJson() const {
    ofJson result = {
        {"id", id},
        {"label", label.empty() ? id : label},
        {"type", toString(type)},
        {"default", defaultValue}
    };
    if (minimum) result["min"] = *minimum;
    if (maximum) result["max"] = *maximum;
    if (step) result["step"] = *step;
    if (!options.empty()) {
        result["options"] = ofJson::array();
        for (const auto& option : options) result["options"].push_back(option.toJson());
    }
    if (!group.empty()) result["group"] = group;
    if (!description.empty()) result["description"] = description;
    if (multiline) result["multiline"] = true;
    if (!metadata.empty()) result["metadata"] = metadata;
    return result;
}

ofJson AssetDescriptor::toJson() const {
    ofJson result = {
        {"id", id}, {"kind", toString(kind)}, {"uri", uri},
        {"required", required}, {"preload", preload}
    };
    if (!metadata.empty()) result["metadata"] = metadata;
    return result;
}

double ActionDescriptor::endSeconds() const { return startSeconds + durationSeconds; }

ofJson ActionDescriptor::toJson() const {
    ofJson result = {
        {"id", id},
        {"label", label.empty() ? id : label},
        {"kind", toString(kind)},
        {"playback", toString(playback)},
        {"start", startSeconds},
        {"duration", durationSeconds}
    };
    if (!metadata.empty()) result["metadata"] = metadata;
    return result;
}

std::vector<std::string> TemplateDefinition::validate() const {
    std::vector<std::string> errors;
    if (id.empty()) errors.push_back("template id is empty");
    if (size.x <= 0 || size.y <= 0) errors.push_back("template size must be positive");
    if (!std::isfinite(frameRate) || frameRate <= 0.0) errors.push_back("frame rate must be positive and finite");
    if (!std::isfinite(durationSeconds) || durationSeconds < 0.0) errors.push_back("duration must be non-negative and finite");

    std::unordered_set<std::string> controlIds;
    for (const auto& control : controls) {
        if (control.id.empty()) errors.push_back("control id is empty");
        else if (!controlIds.insert(control.id).second) errors.push_back("duplicate control id: " + control.id);
        std::string controlError;
        if (!control.validateValue(control.defaultValue, "/" + control.id, controlError))
            errors.push_back("invalid default for control " + control.id + ": " + controlError);
    }

    std::unordered_set<std::string> assetIds;
    for (const auto& asset : assets) {
        if (asset.id.empty()) errors.push_back("asset id is empty");
        else if (!assetIds.insert(asset.id).second) errors.push_back("duplicate asset id: " + asset.id);
        if (asset.required && asset.uri.empty()) errors.push_back("required asset has no URI: " + asset.id);
    }

    std::unordered_set<std::string> actionIds;
    for (const auto& action : actions) {
        if (action.id.empty()) errors.push_back("action id is empty");
        else if (!actionIds.insert(action.id).second) errors.push_back("duplicate action id: " + action.id);
        if (!std::isfinite(action.startSeconds) || action.startSeconds < 0.0) errors.push_back("invalid action start: " + action.id);
        if (!std::isfinite(action.durationSeconds) || action.durationSeconds < 0.0) errors.push_back("invalid action duration: " + action.id);
        if (action.endSeconds() > durationSeconds + 1e-9) errors.push_back("action exceeds template duration: " + action.id);
    }
    return errors;
}

ofJson TemplateDefinition::controlDefaults() const {
    ofJson result = ofJson::object();
    for (const auto& control : controls) if (!control.id.empty()) result[control.id] = control.defaultValue;
    return result;
}

ofJson TemplateDefinition::toJson() const {
    ofJson result = {
        {"contract", "ofxograf-code-template"},
        {"contractVersion", 1},
        {"id", id},
        {"name", name.empty() ? id : name},
        {"composition", {
            {"width", size.x}, {"height", size.y},
            {"frameRate", frameRate}, {"duration", durationSeconds}
        }},
        {"randomSeed", randomSeed},
        {"controls", ofJson::array()},
        {"assets", ofJson::array()},
        {"actions", ofJson::array()}
    };
    for (const auto& control : controls) result["controls"].push_back(control.toJson());
    for (const auto& asset : assets) result["assets"].push_back(asset.toJson());
    for (const auto& action : actions) result["actions"].push_back(action.toJson());
    if (!metadata.empty()) result["metadata"] = metadata;
    return result;
}

DeterministicRandom::DeterministicRandom(std::uint64_t seed) : state(seed) {}

std::uint64_t DeterministicRandom::nextU64() {
    state += 0x9e3779b97f4a7c15ULL;
    std::uint64_t value = state;
    value = (value ^ (value >> 30U)) * 0xbf58476d1ce4e5b9ULL;
    value = (value ^ (value >> 27U)) * 0x94d049bb133111ebULL;
    return value ^ (value >> 31U);
}

double DeterministicRandom::nextUnit() {
    return static_cast<double>(nextU64() >> 11U) * (1.0 / 9007199254740992.0);
}

double DeterministicRandom::uniform(double minimum, double maximum) {
    if (maximum < minimum) std::swap(minimum, maximum);
    return minimum + (maximum - minimum) * nextUnit();
}

std::int64_t DeterministicRandom::uniformInt(std::int64_t minimum, std::int64_t maximum) {
    if (maximum < minimum) std::swap(minimum, maximum);
    const std::uint64_t span = static_cast<std::uint64_t>(maximum) - static_cast<std::uint64_t>(minimum) + 1ULL;
    if (span == 0ULL) return static_cast<std::int64_t>(nextU64());
    const std::uint64_t threshold = (0ULL - span) % span;
    std::uint64_t value;
    do { value = nextU64(); } while (value < threshold);
    return minimum + static_cast<std::int64_t>(value % span);
}

DeterministicRandom FrameContext::random(std::uint64_t streamId) const {
    return DeterministicRandom(combineSeed(frameSeed, streamId));
}

const ofJson& FrameContext::data() const {
    static const ofJson empty = ofJson::object();
    return controlData ? *controlData : empty;
}

bool CodeTemplate::onLoad(const RenderContext&, const ofJson&, std::string&) { return true; }
void CodeTemplate::onPlay(const ActionDescriptor*, const FrameContext&) {}
void CodeTemplate::onDataChanged(const ofJson&, const ofJson&, const FrameContext&) {}
void CodeTemplate::onUpdate(const FrameContext&) {}
void CodeTemplate::onStop(bool, const FrameContext&) {}
void CodeTemplate::onSeek(double, const FrameContext&) {}
void CodeTemplate::onDispose() {}

const char* toString(CodeTemplateState value) {
    switch (value) {
        case CodeTemplateState::Empty: return "empty";
        case CodeTemplateState::Loaded: return "loaded";
        case CodeTemplateState::Playing: return "playing";
        case CodeTemplateState::Stopped: return "stopped";
        case CodeTemplateState::Disposed: return "disposed";
        case CodeTemplateState::Failed: return "failed";
    }
    return "failed";
}

CodeTemplateHost::~CodeTemplateHost() { dispose(); }

bool CodeTemplateHost::load(std::unique_ptr<CodeTemplate> value,
                            const RenderContext& context,
                            const ofJson& initialData) {
    dispose();
    errorMessage.clear();
    if (!value) return fail("Cannot load a null code template");
    instance = std::move(value);
    try {
        templateDefinition = instance->definition();
    } catch (const std::exception& error) {
        return fail(std::string("Template definition failed: ") + error.what());
    } catch (...) {
        return fail("Template definition failed with an unknown exception");
    }

    const auto errors = templateDefinition.validate();
    if (!errors.empty()) return fail(joinErrors(errors));

    renderContext = context;
    if (renderContext.outputSize.x <= 0 || renderContext.outputSize.y <= 0) renderContext.outputSize = templateDefinition.size;
    if (!std::isfinite(renderContext.frameRate) || renderContext.frameRate <= 0.0) renderContext.frameRate = templateDefinition.frameRate;
    renderContext.randomSeed = combineSeed(renderContext.randomSeed, templateDefinition.randomSeed);

    controlData = templateDefinition.controlDefaults();
    if (initialData.is_object()) controlData.merge_patch(initialData);
    std::string dataError;
    if (!validateData(controlData, dataError)) return fail(dataError);

    currentSeconds = 0.0;
    currentActionId.clear();
    std::string loadError;
    try {
        if (!instance->onLoad(renderContext, controlData, loadError)) {
            return fail(loadError.empty() ? "Template rejected load" : loadError);
        }
    } catch (const std::exception& error) {
        return fail(std::string("Template load failed: ") + error.what());
    } catch (...) {
        return fail("Template load failed with an unknown exception");
    }
    hostState = CodeTemplateState::Loaded;
    return true;
}

bool CodeTemplateHost::play(const std::string& actionId) {
    if (!isLoaded()) { errorMessage = "Cannot play an unloaded template"; return false; }
    const ActionDescriptor* action = actionId.empty() ? nullptr : findAction(actionId);
    if (!actionId.empty() && !action) { errorMessage = "Unknown action: " + actionId; return false; }

    currentActionId = action ? action->id : std::string();
    if (action) currentSeconds = actionStartSeconds(*action);
    else if (currentSeconds >= templateDefinition.durationSeconds) currentSeconds = 0.0;
    hostState = CodeTemplateState::Playing;
    try {
        instance->onPlay(action, makeFrame(0.0, false));
    } catch (const std::exception& error) {
        return fail(std::string("Template play callback failed: ") + error.what());
    } catch (...) {
        return fail("Template play callback failed with an unknown exception");
    }
    errorMessage.clear();
    return true;
}

bool CodeTemplateHost::update(double deltaSeconds) {
    if (!isLoaded()) { errorMessage = "Cannot update an unloaded template"; return false; }
    if (!std::isfinite(deltaSeconds) || deltaSeconds < 0.0) { errorMessage = "Delta time must be non-negative and finite"; return false; }

    bool completed = false;
    if (hostState == CodeTemplateState::Playing) {
        const ActionDescriptor* action = currentAction();
        currentSeconds += deltaSeconds;
        const double start = action ? actionStartSeconds(*action) : 0.0;
        const double end = action ? start + actionDurationSeconds(*action) : templateDefinition.durationSeconds;
        const ActionPlayback playback = action ? action->playback : ActionPlayback::Once;
        if (currentSeconds >= end) {
            if (playback == ActionPlayback::Loop && end > start) {
                currentSeconds = start + std::fmod(currentSeconds - start, end - start);
            } else {
                currentSeconds = end;
                completed = true;
            }
        }
    }

    try {
        instance->onUpdate(makeFrame(deltaSeconds, false));
        if (completed) completePlayback();
    } catch (const std::exception& error) {
        return fail(std::string("Template update callback failed: ") + error.what());
    } catch (...) {
        return fail("Template update callback failed with an unknown exception");
    }
    errorMessage.clear();
    return true;
}

bool CodeTemplateHost::updateData(const ofJson& mergePatch) {
    if (!isLoaded()) { errorMessage = "Cannot update data on an unloaded template"; return false; }
    if (!mergePatch.is_object()) { errorMessage = "Control update must be a JSON object"; return false; }
    ofJson candidate = controlData;
    candidate.merge_patch(mergePatch);
    std::string dataError;
    if (!validateData(candidate, dataError)) { errorMessage = dataError; return false; }

    const ofJson previous = controlData;
    controlData = std::move(candidate);
    try {
        instance->onDataChanged(controlData, mergePatch, makeFrame(0.0, false));
    } catch (const std::exception& error) {
        controlData = previous;
        return fail(std::string("Template data callback failed: ") + error.what());
    } catch (...) {
        controlData = previous;
        return fail("Template data callback failed with an unknown exception");
    }
    errorMessage.clear();
    return true;
}

bool CodeTemplateHost::stop(bool completed) {
    if (!isLoaded()) { errorMessage = "Cannot stop an unloaded template"; return false; }
    hostState = CodeTemplateState::Stopped;
    try {
        instance->onStop(completed, makeFrame(0.0, false));
    } catch (const std::exception& error) {
        return fail(std::string("Template stop callback failed: ") + error.what());
    } catch (...) {
        return fail("Template stop callback failed with an unknown exception");
    }
    errorMessage.clear();
    return true;
}

bool CodeTemplateHost::seek(double absoluteSeconds) {
    if (!isLoaded()) { errorMessage = "Cannot seek an unloaded template"; return false; }
    if (!std::isfinite(absoluteSeconds)) { errorMessage = "Seek time must be finite"; return false; }
    const double previous = currentSeconds;
    currentSeconds = ofClamp(absoluteSeconds, 0.0, templateDefinition.durationSeconds);
    try {
        instance->onSeek(previous, makeFrame(0.0, true));
    } catch (const std::exception& error) {
        currentSeconds = previous;
        return fail(std::string("Template seek callback failed: ") + error.what());
    } catch (...) {
        currentSeconds = previous;
        return fail("Template seek callback failed with an unknown exception");
    }
    errorMessage.clear();
    return true;
}

bool CodeTemplateHost::draw() {
    if (!isLoaded()) { errorMessage = "Cannot draw an unloaded template"; return false; }
    try {
        instance->onDraw(makeFrame(0.0, false));
    } catch (const std::exception& error) {
        return fail(std::string("Template draw callback failed: ") + error.what());
    } catch (...) {
        return fail("Template draw callback failed with an unknown exception");
    }
    errorMessage.clear();
    return true;
}

void CodeTemplateHost::dispose() {
    if (instance) {
        try { instance->onDispose(); }
        catch (const std::exception& error) { errorMessage = std::string("Template dispose callback failed: ") + error.what(); }
        catch (...) { errorMessage = "Template dispose callback failed with an unknown exception"; }
    }
    instance.reset();
    templateDefinition = TemplateDefinition{};
    controlData = ofJson::object();
    currentSeconds = 0.0;
    currentActionId.clear();
    hostState = CodeTemplateState::Disposed;
}

CodeTemplateState CodeTemplateHost::state() const { return hostState; }

bool CodeTemplateHost::isLoaded() const {
    return instance && hostState != CodeTemplateState::Empty &&
           hostState != CodeTemplateState::Disposed && hostState != CodeTemplateState::Failed;
}

double CodeTemplateHost::timeSeconds() const { return currentSeconds; }
const TemplateDefinition* CodeTemplateHost::definition() const { return instance ? &templateDefinition : nullptr; }
const ofJson& CodeTemplateHost::data() const { return controlData; }
const std::string& CodeTemplateHost::lastError() const { return errorMessage; }

const ActionDescriptor* CodeTemplateHost::currentAction() const {
    return currentActionId.empty() ? nullptr : findAction(currentActionId);
}

const ActionDescriptor* CodeTemplateHost::findAction(const std::string& id) const {
    const auto found = std::find_if(templateDefinition.actions.begin(), templateDefinition.actions.end(),
        [&](const ActionDescriptor& action) { return action.id == id; });
    return found == templateDefinition.actions.end() ? nullptr : &*found;
}

double CodeTemplateHost::actionStartSeconds(const ActionDescriptor& action) const {
    const auto controlIds = action.metadata.find("startControlIds");
    if (controlIds == action.metadata.end() || !controlIds->is_array()) return action.startSeconds;
    double result = 0.0;
    for (const auto& idValue : *controlIds) {
        if (!idValue.is_string()) return action.startSeconds;
        const auto value = controlData.find(idValue.get<std::string>());
        if (value == controlData.end() || !value->is_number()) return action.startSeconds;
        result += std::max(0.0, value->get<double>());
    }
    return result;
}

double CodeTemplateHost::actionDurationSeconds(const ActionDescriptor& action) const {
    const std::string controlId = action.metadata.value("durationControlId", "");
    if (controlId.empty()) return action.durationSeconds;
    const auto value = controlData.find(controlId);
    return value != controlData.end() && value->is_number()
        ? std::max(0.0, value->get<double>()) : action.durationSeconds;
}
FrameContext CodeTemplateHost::makeFrame(double deltaSeconds, bool seeking) const {
    FrameContext frame;
    frame.timeSeconds = currentSeconds;
    frame.deltaSeconds = deltaSeconds;
    const double rate = renderContext.frameRate > 0.0 ? renderContext.frameRate : templateDefinition.frameRate;
    frame.frameIndex = static_cast<std::uint64_t>(std::max(0.0, std::floor(currentSeconds * rate + 1e-9)));
    frame.actionId = currentActionId;
    frame.seeking = seeking;
    frame.playing = hostState == CodeTemplateState::Playing;
    frame.controlData = &controlData;
    if (const auto* action = currentAction()) {
        const double start = actionStartSeconds(*action);
        const double duration = actionDurationSeconds(*action);
        frame.actionTimeSeconds = ofClamp(currentSeconds - start, 0.0, duration);
        frame.normalizedActionTime = duration > 0.0
            ? frame.actionTimeSeconds / duration : 1.0;
    } else {
        frame.actionTimeSeconds = currentSeconds;
        frame.normalizedActionTime = templateDefinition.durationSeconds > 0.0
            ? currentSeconds / templateDefinition.durationSeconds : 1.0;
    }
    frame.frameSeed = combineSeed(renderContext.randomSeed, frame.frameIndex);
    return frame;
}

bool CodeTemplateHost::validateData(const ofJson& value, std::string& error) const {
    if (!value.is_object()) { error = "Control data must be a JSON object"; return false; }
    if (renderContext.strictControls) {
        for (auto item = value.begin(); item != value.end(); ++item) {
            const auto found = std::find_if(templateDefinition.controls.begin(), templateDefinition.controls.end(),
                [&](const ControlDescriptor& control) { return control.id == item.key(); });
            if (found == templateDefinition.controls.end()) { error = "Unknown control: " + item.key(); return false; }
        }
    }
    for (const auto& control : templateDefinition.controls) {
        if (value.contains(control.id) && !control.validateValue(value.at(control.id), "/" + control.id, error)) {
            return false;
        }
    }
    return true;
}

bool CodeTemplateHost::fail(const std::string& message) {
    errorMessage = message;
    hostState = CodeTemplateState::Failed;
    return false;
}

void CodeTemplateHost::completePlayback() {
    hostState = CodeTemplateState::Stopped;
    try {
        instance->onStop(true, makeFrame(0.0, false));
    } catch (const std::exception& error) {
        fail(std::string("Template stop callback failed: ") + error.what());
    } catch (...) {
        fail("Template stop callback failed with an unknown exception");
    }
}

} // namespace ofxOGraf
