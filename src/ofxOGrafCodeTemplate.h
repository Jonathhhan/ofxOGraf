#pragma once

#include "ofMain.h"

#include <chrono>
#include <cstdint>
#include <memory>
#include <optional>
#include <string>
#include <type_traits>
#include <utility>
#include <vector>

namespace ofxOGraf {

enum class ControlValueType {
    Boolean,
    Integer,
    Number,
    String,
    Color,
    Vector2,
    Vector3,
    Json
};

enum class AssetKind { Font, Image, Audio, Data, Shader, Other };
enum class ActionKind { In, Hold, Update, Out, Custom };
enum class ActionPlayback { Once, Loop, HoldLastFrame };

const char* toString(ControlValueType value);
const char* toString(AssetKind value);
const char* toString(ActionKind value);
const char* toString(ActionPlayback value);

struct ControlOption {
    ofJson value;
    std::string label;

    ofJson toJson() const;
};

// Runtime representation of a control. Use TypedControlDescriptor<T> while
// authoring so incompatible defaults/ranges are rejected by the C++ compiler.
struct ControlDescriptor {
    std::string id;
    std::string label;
    ControlValueType type = ControlValueType::Json;
    ofJson defaultValue;
    std::optional<ofJson> minimum;
    std::optional<ofJson> maximum;
    std::optional<ofJson> step;
    std::vector<ControlOption> options;
    std::string group;
    std::string description;
    bool multiline = false;
    ofJson metadata = ofJson::object();

    bool accepts(const ofJson& value) const;
    ofJson toJson() const;
};

namespace detail {

template<typename T>
struct ControlTraits {
    static constexpr bool supported = false;
    static constexpr ControlValueType type = ControlValueType::Json;
};

template<> struct ControlTraits<bool> { static constexpr bool supported = true; static constexpr ControlValueType type = ControlValueType::Boolean; };
template<> struct ControlTraits<int> { static constexpr bool supported = true; static constexpr ControlValueType type = ControlValueType::Integer; };
template<> struct ControlTraits<std::int64_t> { static constexpr bool supported = true; static constexpr ControlValueType type = ControlValueType::Integer; };
template<> struct ControlTraits<float> { static constexpr bool supported = true; static constexpr ControlValueType type = ControlValueType::Number; };
template<> struct ControlTraits<double> { static constexpr bool supported = true; static constexpr ControlValueType type = ControlValueType::Number; };
template<> struct ControlTraits<std::string> { static constexpr bool supported = true; static constexpr ControlValueType type = ControlValueType::String; };
template<> struct ControlTraits<ofFloatColor> { static constexpr bool supported = true; static constexpr ControlValueType type = ControlValueType::Color; };
template<> struct ControlTraits<glm::vec2> { static constexpr bool supported = true; static constexpr ControlValueType type = ControlValueType::Vector2; };
template<> struct ControlTraits<glm::vec3> { static constexpr bool supported = true; static constexpr ControlValueType type = ControlValueType::Vector3; };
template<> struct ControlTraits<ofJson> { static constexpr bool supported = true; static constexpr ControlValueType type = ControlValueType::Json; };

inline ofJson controlJson(bool value) { return value; }
inline ofJson controlJson(int value) { return value; }
inline ofJson controlJson(std::int64_t value) { return value; }
inline ofJson controlJson(float value) { return value; }
inline ofJson controlJson(double value) { return value; }
inline ofJson controlJson(const std::string& value) { return value; }
inline ofJson controlJson(const char* value) { return std::string(value ? value : ""); }
inline ofJson controlJson(const ofFloatColor& value) { return ofJson::array({value.r, value.g, value.b, value.a}); }
inline ofJson controlJson(const glm::vec2& value) { return ofJson::array({value.x, value.y}); }
inline ofJson controlJson(const glm::vec3& value) { return ofJson::array({value.x, value.y, value.z}); }
inline ofJson controlJson(const ofJson& value) { return value; }

} // namespace detail

template<typename T>
struct TypedControlDescriptor {
    static_assert(detail::ControlTraits<T>::supported, "Unsupported ofxOGraf control value type");

    std::string id;
    std::string label;
    T defaultValue{};
    std::optional<T> minimum;
    std::optional<T> maximum;
    std::optional<T> step;
    std::vector<std::pair<T, std::string>> options;
    std::string group;
    std::string description;
    bool multiline = false;
    ofJson metadata = ofJson::object();

    ControlDescriptor erase() const {
        ControlDescriptor result;
        result.id = id;
        result.label = label;
        result.type = detail::ControlTraits<T>::type;
        result.defaultValue = detail::controlJson(defaultValue);
        if (minimum) result.minimum = detail::controlJson(*minimum);
        if (maximum) result.maximum = detail::controlJson(*maximum);
        if (step) result.step = detail::controlJson(*step);
        for (const auto& option : options) result.options.push_back({detail::controlJson(option.first), option.second});
        result.group = group;
        result.description = description;
        result.multiline = multiline;
        result.metadata = metadata;
        return result;
    }
};

struct AssetDescriptor {
    std::string id;
    AssetKind kind = AssetKind::Other;
    std::string uri;
    bool required = true;
    bool preload = true;
    ofJson metadata = ofJson::object();

    ofJson toJson() const;
};

template<AssetKind Kind>
struct TypedAssetDescriptor {
    std::string id;
    std::string uri;
    bool required = true;
    bool preload = true;
    ofJson metadata = ofJson::object();

    AssetDescriptor erase() const { return {id, Kind, uri, required, preload, metadata}; }
};

using FontAssetDescriptor = TypedAssetDescriptor<AssetKind::Font>;
using ImageAssetDescriptor = TypedAssetDescriptor<AssetKind::Image>;
using AudioAssetDescriptor = TypedAssetDescriptor<AssetKind::Audio>;
using DataAssetDescriptor = TypedAssetDescriptor<AssetKind::Data>;
using ShaderAssetDescriptor = TypedAssetDescriptor<AssetKind::Shader>;

struct ActionDescriptor {
    std::string id;
    std::string label;
    ActionKind kind = ActionKind::Custom;
    ActionPlayback playback = ActionPlayback::Once;
    double startSeconds = 0.0;
    double durationSeconds = 0.0;
    ofJson metadata = ofJson::object();

    double endSeconds() const;
    ofJson toJson() const;
};

struct TemplateDefinition {
    std::string id;
    std::string name;
    glm::ivec2 size{1920, 1080};
    double frameRate = 50.0;
    double durationSeconds = 0.0;
    std::uint64_t randomSeed = 0;
    std::vector<ControlDescriptor> controls;
    std::vector<AssetDescriptor> assets;
    std::vector<ActionDescriptor> actions;
    ofJson metadata = ofJson::object();

    template<typename T>
    void addControl(const TypedControlDescriptor<T>& descriptor) { controls.push_back(descriptor.erase()); }

    template<AssetKind Kind>
    void addAsset(const TypedAssetDescriptor<Kind>& descriptor) { assets.push_back(descriptor.erase()); }

    std::vector<std::string> validate() const;
    ofJson controlDefaults() const;
    ofJson toJson() const;
};

// SplitMix64 has a completely specified integer-only sequence, making it safe
// for reproducible native/WebAssembly template behavior.
class DeterministicRandom {
public:
    explicit DeterministicRandom(std::uint64_t seed = 0);

    std::uint64_t nextU64();
    double nextUnit();
    double uniform(double minimum, double maximum);
    std::int64_t uniformInt(std::int64_t minimum, std::int64_t maximum);

private:
    std::uint64_t state;
};

struct RenderContext {
    glm::ivec2 outputSize{0, 0};
    double frameRate = 0.0;
    std::uint64_t randomSeed = 0;
    bool strictControls = true;
    ofJson capabilities = ofJson::object();
};

struct FrameContext {
    double timeSeconds = 0.0;
    double deltaSeconds = 0.0;
    std::uint64_t frameIndex = 0;
    double actionTimeSeconds = 0.0;
    double normalizedActionTime = 0.0;
    std::string actionId;
    bool seeking = false;
    bool playing = false;
    std::uint64_t frameSeed = 0;
    const ofJson* controlData = nullptr;

    // Each call returns a new deterministic stream. Templates should give
    // unrelated systems different stable stream ids.
    DeterministicRandom random(std::uint64_t streamId = 0) const;
    const ofJson& data() const;
};

class CodeTemplate {
public:
    virtual ~CodeTemplate() = default;

    virtual TemplateDefinition definition() const = 0;
    virtual bool onLoad(const RenderContext& context, const ofJson& initialData, std::string& error);
    virtual void onPlay(const ActionDescriptor* action, const FrameContext& frame);
    virtual void onDataChanged(const ofJson& data, const ofJson& patch, const FrameContext& frame);
    virtual void onUpdate(const FrameContext& frame);
    virtual void onDraw(const FrameContext& frame) = 0;
    virtual void onStop(bool completed, const FrameContext& frame);
    virtual void onSeek(double previousSeconds, const FrameContext& frame);
    virtual void onDispose();
};

enum class CodeTemplateState { Empty, Loaded, Playing, Stopped, Disposed, Failed };
const char* toString(CodeTemplateState value);

// Host time is explicit: update() advances by the supplied delta and seek()
// positions absolutely. The host never reads an OF clock or global RNG.
class CodeTemplateHost {
public:
    CodeTemplateHost() = default;
    ~CodeTemplateHost();
    CodeTemplateHost(const CodeTemplateHost&) = delete;
    CodeTemplateHost& operator=(const CodeTemplateHost&) = delete;

    bool load(std::unique_ptr<CodeTemplate> value,
              const RenderContext& context = {},
              const ofJson& initialData = ofJson::object());
    bool play(const std::string& actionId = {});
    bool update(double deltaSeconds);
    bool updateData(const ofJson& mergePatch);
    bool stop(bool completed = false);
    bool seek(double absoluteSeconds);
    bool draw();
    void dispose();

    CodeTemplateState state() const;
    bool isLoaded() const;
    double timeSeconds() const;
    const TemplateDefinition* definition() const;
    const ofJson& data() const;
    const std::string& lastError() const;

private:
    std::unique_ptr<CodeTemplate> instance;
    TemplateDefinition templateDefinition;
    RenderContext renderContext;
    ofJson controlData = ofJson::object();
    CodeTemplateState hostState = CodeTemplateState::Empty;
    double currentSeconds = 0.0;
    std::string currentActionId;
    std::string errorMessage;

    const ActionDescriptor* currentAction() const;
    const ActionDescriptor* findAction(const std::string& id) const;
    FrameContext makeFrame(double deltaSeconds, bool seeking) const;
    bool validateData(const ofJson& value, std::string& error) const;
    bool fail(const std::string& message);
    void completePlayback();
};

} // namespace ofxOGraf
