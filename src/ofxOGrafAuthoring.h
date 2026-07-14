#pragma once

#include "ofJson.h"
#include <array>
#include <string>
#include <vector>

namespace ofxOGraf {

enum class DiagnosticSeverity { Warning, Error };

struct AuthoringDiagnostic {
    DiagnosticSeverity severity = DiagnosticSeverity::Error;
    std::string code;
    std::string path;
    std::string message;
};

struct RationalFrameRate {
    int numerator = 50;
    int denominator = 1;
};

struct Vector2 {
    double x = 0.0;
    double y = 0.0;
};

struct Vector3 {
    double x = 0.0;
    double y = 0.0;
    double z = 0.0;
};

struct Color {
    double r = 1.0;
    double g = 1.0;
    double b = 1.0;
    double a = 1.0;
};
struct AuthoringKeyframe {
    double time = 0.0;
    ofJson value;
    std::string interpolation = "linear";
};


struct ShapeGeometry {
    std::string type = "rectangle";
    ofJson data = ofJson::object();

    static ShapeGeometry rectangle(double width, double height, double radius = 0.0);
    static ShapeGeometry ellipse(double width, double height);
    static ShapeGeometry path(const std::vector<Vector2>& vertices, bool closed = true);
};

class SceneBuilder;

class LayerBuilder {
public:
    const std::string& id() const { return layerId; }
    std::string anchorPropertyId() const;
    std::string positionPropertyId() const;
    std::string scalePropertyId() const;
    std::string rotationPropertyId() const;
    std::string opacityPropertyId() const;

    LayerBuilder& enabled(bool value);
    LayerBuilder& timing(double start, double duration);
    LayerBuilder& parent(const std::string& parentLayerId);
    LayerBuilder& anchor(Vector3 value);
    LayerBuilder& position(Vector3 value);
    LayerBuilder& scale(Vector3 value);
    LayerBuilder& rotation(Vector3 degrees);
    LayerBuilder& opacity(double value);
    LayerBuilder& extension(const std::string& namespaceId, const ofJson& data,
                            const std::string& version = "1.0.0");

protected:
    friend class CompositionBuilder;
    LayerBuilder(SceneBuilder* scene, std::string compositionId, std::string layerId);
    ofJson* layer();

    SceneBuilder* scene = nullptr;
    std::string compositionId;
    std::string layerId;
};

class TextLayerBuilder : public LayerBuilder {
public:
    std::string textPropertyId() const;
    std::string fontSizePropertyId() const;
    std::string fillPropertyId() const;

    TextLayerBuilder& text(const std::string& value);
    TextLayerBuilder& font(const std::string& family, double size);
    TextLayerBuilder& fontAsset(const std::string& assetId);
    TextLayerBuilder& fill(Color value);
    TextLayerBuilder& alignment(const std::string& value);

private:
    friend class CompositionBuilder;
    using LayerBuilder::LayerBuilder;
};

class ShapeLayerBuilder : public LayerBuilder {
public:
    std::string geometryPropertyId() const;
    std::string fillPropertyId() const;
    std::string strokeColorPropertyId() const;
    std::string strokeWidthPropertyId() const;

    ShapeLayerBuilder& geometry(const ShapeGeometry& value);
    ShapeLayerBuilder& fill(Color value);
    ShapeLayerBuilder& noFill();
    ShapeLayerBuilder& stroke(Color value, double width);

private:
    friend class CompositionBuilder;
    using LayerBuilder::LayerBuilder;
};

class CompositionBuilder {
public:
    const std::string& id() const { return compositionId; }
    CompositionBuilder& extension(const std::string& namespaceId, const ofJson& data,
                                  const std::string& version = "1.0.0");
    TextLayerBuilder textLayer(const std::string& id, const std::string& name,
                               const std::string& text);
    ShapeLayerBuilder shapeLayer(const std::string& id, const std::string& name,
                                 const ShapeGeometry& geometry);

private:
    friend class SceneBuilder;
    CompositionBuilder(SceneBuilder* scene, std::string compositionId);
    SceneBuilder* scene = nullptr;
    std::string compositionId;
};

class ControlBuilder {
public:
    const std::string& id() const { return controlId; }
    ControlBuilder& bind(const std::string& targetPropertyId,
                         const std::string& conversion = "identity");
    ControlBuilder& range(double minimum, double maximum, double step = 0.0);
    ControlBuilder& ui(const std::string& group, int order = 0,
                       const std::string& description = "");
    ControlBuilder& extension(const std::string& namespaceId, const ofJson& data,
                              const std::string& version = "1.0.0");

private:
    friend class SceneBuilder;
    ControlBuilder(SceneBuilder* scene, std::string controlId);
    SceneBuilder* scene = nullptr;
    std::string controlId;
};

class SceneBuilder {
public:
    explicit SceneBuilder(const std::string& sceneId);

    SceneBuilder& generator(const std::string& toolId, const std::string& version);
    SceneBuilder& provenance(const std::string& operation, const std::string& toolId,
                             const std::string& toolVersion,
                             const ofJson& source = ofJson::object(),
                             const ofJson& losses = ofJson::array());
    SceneBuilder& extension(const std::string& namespaceId, const ofJson& data,
                            const std::string& version = "1.0.0");
    SceneBuilder& requireExtension(const std::string& namespaceId,
                                   const std::string& versionRange,
                                   const std::vector<std::string>& capabilities = {});

    CompositionBuilder composition(const std::string& id, const std::string& name,
                                   int width, int height, double duration,
                                   RationalFrameRate frameRate = {});
    SceneBuilder& rootComposition(const std::string& compositionId);
    SceneBuilder& animate(const std::string& propertyId,
                          const std::vector<AuthoringKeyframe>& keyframes);

    SceneBuilder& imageAsset(const std::string& id, const std::string& uri,
                             int width = 0, int height = 0,
                             const std::string& sha256 = "");
    SceneBuilder& fontAsset(const std::string& id, const std::string& uri,
                            const std::string& family,
                            const std::string& style = "Regular",
                            const std::string& sha256 = "");

    ControlBuilder control(const std::string& id, const std::string& name,
                           const std::string& type, const ofJson& defaultValue);
    SceneBuilder& action(const std::string& id, const std::string& name,
                         const std::string& type,
                         const ofJson& parameters = ofJson::object());

    const ofJson& json() const { return document; }
    ofJson build() const { return document; }
    std::vector<AuthoringDiagnostic> validate() const;
    bool valid() const;
    std::string canonicalJson() const;
    std::string prettyJson(int indent = 2) const;
    bool write(const std::string& path, bool pretty = true) const;

    static std::string stableId(const std::string& prefix, const std::string& seed);

private:
    friend class CompositionBuilder;
    friend class LayerBuilder;
    friend class TextLayerBuilder;
    friend class ShapeLayerBuilder;
    friend class ControlBuilder;

    ofJson* findComposition(const std::string& id);
    const ofJson* findComposition(const std::string& id) const;
    ofJson* findLayer(const std::string& compositionId, const std::string& layerId);
    ofJson* findProperty(const std::string& propertyId);
    ofJson* findControl(const std::string& id);
    static ofJson property(const std::string& id, const std::string& type,
                           const ofJson& value);
    static void setExtension(ofJson& object, const std::string& namespaceId,
                             const std::string& version, const ofJson& data);

    ofJson document;
};

} // namespace ofxOGraf
