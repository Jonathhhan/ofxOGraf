#include "ofxOGrafRenderer.h"
#include "ofxOGrafSceneLoader.h"
#include "ofxOGrafTimeline.h"
#include <algorithm>
#include <cmath>
#include <iomanip>
#include <sstream>

namespace {

#ifdef __EMSCRIPTEN__
void drawUnindexedTextMesh(const ofTrueTypeFont& font, const std::string& text, float x, float y) {
    const ofMesh& indexed = font.getStringMesh(text, x, y, ofIsVFlipped());
    const auto& vertices = indexed.getVertices();
    const auto& texCoords = indexed.getTexCoords();
    if (vertices.empty() || texCoords.size() != vertices.size()) return;

    ofMesh triangles;
    triangles.setMode(OF_PRIMITIVE_TRIANGLES);
    for (const auto sourceIndex : indexed.getIndices()) {
        const auto index = static_cast<std::size_t>(sourceIndex);
        if (index >= vertices.size()) continue;
        triangles.addVertex(vertices[index]);
        triangles.addTexCoord(texCoords[index]);
    }
    if (triangles.getVertices().empty()) return;

    font.getFontTexture().bind();
    triangles.draw();
    font.getFontTexture().unbind();
}
#endif

} // namespace

namespace ofxOGraf {

void Renderer::setup() {
    ofEnableAlphaBlending();
    ready = true;
}

void Renderer::setScene(const Scene& scene) {
    rootScene = scene;
    assets.configure(scene.raw);
    cacheCompositions();
    ready = true;
}

void Renderer::setData(const ofJson& value) {
    data = value.is_object() ? value : ofJson::object();
}

Extensions& Renderer::extensions() { return extensionRegistry; }
const std::vector<std::string>& Renderer::assetWarnings() const { return assets.warnings(); }

void Renderer::cacheCompositions() {
    compositions.clear();
    if (!rootScene.raw.contains("compositions") || !rootScene.raw["compositions"].is_array()) return;
    for (const auto& entry : rootScene.raw["compositions"]) {
        try {
            ofJson value = entry;
            value["format"] = "broadcast-scene";
            value["version"] = rootScene.raw.value("version", "0.2.0");
            Scene child = SceneLoader::loadJson(value);
            compositions[entry.value("id", entry.value("name", ""))] = std::move(child);
        } catch (const std::exception& error) {
            ofLogWarning("ofxOGraf") << "Could not cache precomposition: " << error.what();
        }
    }
}

void Renderer::draw(double time) {
    if (!ready) return;
    ofEnableAlphaBlending();
    glBlendFuncSeparate(GL_SRC_ALPHA, GL_ONE_MINUS_SRC_ALPHA, GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
    drawComposition(rootScene, time);
}

void Renderer::drawComposition(const Scene& scene, double time) {
    std::set<int> consumedMattes;
    for (auto it = scene.layers.rbegin(); it != scene.layers.rend(); ++it) {
        const Layer& layer = *it;
        if (consumedMattes.count(layer.index) || !layer.enabled || time < layer.inPoint || time > layer.outPoint) continue;
        const std::string matteType = layer.source.value("trackMatteType", "NO_TRACK_MATTE");
        if (matteType.find("NO_TRACK_MATTE") == std::string::npos) {
            const Layer* matte = scene.findLayer(layer.index - 1);
            if (matte) {
                const bool inverted = matteType.find("INVERTED") != std::string::npos;
                if (beginMatte(scene, *matte, layer, time, inverted)) {
                    drawLayer(scene, layer, time, false);
                    endMatte();
                }
                // Without a stencil attachment, rendering unmasked content would
                // be wrong. The target layer is intentionally skipped after the
                // once-per-layer diagnostic from beginMatte().
                consumedMattes.insert(matte->index);
                continue;
            }
        }
        drawLayer(scene, layer, time);
    }
}

void Renderer::applyHierarchyTransform(const Scene& scene, const Layer& layer, double time, std::set<int>& visiting) {
    if (visiting.count(layer.index)) {
        ofLogWarning("ofxOGraf") << "Parent cycle at layer " << layer.name;
        return;
    }
    visiting.insert(layer.index);
    if (layer.parentIndex != 0) {
        if (const auto* parent = scene.findLayer(layer.parentIndex)) applyHierarchyTransform(scene, *parent, time, visiting);
    }
    if (layer.source.contains("transform")) applyTransform(layer.source["transform"], time);
    visiting.erase(layer.index);
}

void Renderer::applyTransform(const ofJson& transform, double time) const {
    const auto* anchorProperty = findProperty(transform, "ADBE Anchor Point");
    const auto* positionProperty = findProperty(transform, "ADBE Position");
    const auto* scaleProperty = findProperty(transform, "ADBE Scale");
    const auto* orientationProperty = findProperty(transform, "ADBE Orientation");
    const auto* xRotationProperty = findProperty(transform, "ADBE Rotate X");
    const auto* yRotationProperty = findProperty(transform, "ADBE Rotate Y");
    const auto* zRotationProperty = findProperty(transform, "ADBE Rotate Z");

    glm::vec3 anchor = anchorProperty ? vector3(evaluate(*anchorProperty, time)) : glm::vec3(0);
    glm::vec3 position = positionProperty ? vector3(evaluate(*positionProperty, time)) : glm::vec3(0);
    glm::vec3 scale = scaleProperty ? vector3(evaluate(*scaleProperty, time), glm::vec3(100)) : glm::vec3(100);
    glm::vec3 orientation = orientationProperty ? vector3(evaluate(*orientationProperty, time)) : glm::vec3(0);
    const float rx = xRotationProperty ? evaluate(*xRotationProperty, time).get<float>() : 0.0f;
    const float ry = yRotationProperty ? evaluate(*yRotationProperty, time).get<float>() : 0.0f;
    const float rz = zRotationProperty ? evaluate(*zRotationProperty, time).get<float>() : 0.0f;

    ofTranslate(position);
    ofRotateXDeg(orientation.x + rx);
    ofRotateYDeg(orientation.y + ry);
    ofRotateZDeg(orientation.z + rz);
    ofScale(scale.x / 100.0f, scale.y / 100.0f, scale.z / 100.0f);
    ofTranslate(-anchor);
}

void Renderer::applyEffectState(const Layer& layer, double time) {
    hasColorOverride = false;
    opacityMultiplier = 1.0f;
    if (!layer.source.contains("effects")) return;
    const ofJson& effects = layer.source["effects"];
    const auto visit = [&](const auto& self, const ofJson& node) -> void {
        if (!node.is_object()) return;
        const std::string match = node.value("matchName", "");
        if (match.find("ADBE Fill") != std::string::npos || match.find("ADBE Tint") != std::string::npos) {
            if (const auto* property = findFirstValue(node, "Color")) {
                const ofJson value = evaluate(*property, time);
                if (value.is_array() && value.size() >= 3) {
                    colorOverride = color(value);
                    hasColorOverride = true;
                }
            }
        }
        if (!match.empty() && match != "ADBE Effect Parade" && !extensionRegistry.applyEffect(node, time)) {
            if (node.contains("children") && !node["children"].empty() && warnedEffects.insert(match).second) {
                ofLogNotice("ofxOGraf") << "Effect preserved for extension/bake fallback: " << match;
            }
        }
        if (node.contains("children") && node["children"].is_array()) {
            for (const auto& child : node["children"]) self(self, child);
        }
    };
    visit(visit, effects);
}

void Renderer::drawLayer(const Scene& scene, const Layer& layer, double time, bool includeMasks) {
    ofPushMatrix();
    std::set<int> visiting;
    applyHierarchyTransform(scene, layer, time, visiting);
    applyEffectState(layer, time);
    if (layer.source.contains("transform")) {
        if (const auto* opacity = findProperty(layer.source["transform"], "ADBE Opacity")) {
            const ofJson value = evaluate(*opacity, time);
            if (value.is_number()) opacityMultiplier *= ofClamp(value.get<float>() / 100.0f, 0.0f, 1.0f);
        }
    }
    bool masksApplied = false;
    if (includeMasks && layer.source.contains("masks")) {
        masksApplied = applyMasks(layer, time, true);
        if (!masksApplied) {
            hasColorOverride = false;
            opacityMultiplier = 1.0f;
            ofPopMatrix();
            return;
        }
    }
    drawLayerContent(scene, layer, time);
    if (masksApplied) applyMasks(layer, time, false);
    hasColorOverride = false;
    opacityMultiplier = 1.0f;
    ofPopMatrix();
}

void Renderer::drawLayerContent(const Scene&, const Layer& layer, double time) {
    if (layer.source.contains("fallback") && layer.source["fallback"].value("enabled", false)) {
        drawFallback(layer, time);
        return;
    }
    if (extensionRegistry.drawLayer(layer, time, data)) return;
    if (layer.type == "text") drawText(layer, time);
    else if (layer.type == "repeat") drawRepeat(layer, time);
    else if (layer.type == "shape" && layer.source.contains("contents")) drawShapeGroup(layer.source["contents"], time);
    else if (layer.type == "image" || layer.type == "solid") drawImage(layer, time);
    else if (layer.type == "precomp") {
        const std::string id = layer.source.contains("source") ? layer.source["source"].value("id", "") : "";
        const auto found = compositions.find(id);
        if (found != compositions.end()) {
            const double stretch = layer.source.value("stretch", 100.0) / 100.0;
            const double childTime = stretch == 0.0 ? 0.0 : (time - layer.source.value("startTime", 0.0)) / stretch;
            drawComposition(found->second, childTime);
        } else drawFallback(layer, time);
    }
}


void Renderer::drawRepeat(const Layer& layer, double time) {
    if (!layer.source.contains("repeat")) return;
    const auto& definition = layer.source["repeat"];
    const std::string controlId = layer.source.value("controlId", definition.value("controlId", ""));
    if (controlId.empty() || !data.contains(controlId) || !data[controlId].is_array()) return;
    const auto& items = data[controlId];
    const int maximum = std::max(0, definition.value("maxItems", 20));
    const float rowHeight = definition.value("rowHeight", 60.0f);
    const float rowWidth = definition.value("rowWidth", 600.0f);
    const auto background = definition.value("backgroundColor", ofJson::array({0.0, 0.0, 0.0, 0.0}));
    const auto columns = definition.value("columns", ofJson::array());

    const std::size_t count = std::min(items.size(), static_cast<std::size_t>(maximum));
    for (std::size_t index = 0; index < count; ++index) {
        const auto& item = items[index];
        ofPushMatrix();
        ofTranslate(0.0f, static_cast<float>(index) * rowHeight);
        ofSetColor(color(background));
        ofDrawRectangle(0.0f, 0.0f, rowWidth, rowHeight);
        for (const auto& column : columns) {
            const std::string field = column.value("field", "");
            if (field.empty() || !item.is_object() || !item.contains(field)) continue;
            std::string text;
            if (item[field].is_string()) text = item[field].get<std::string>();
            else if (item[field].is_number() || item[field].is_boolean()) text = item[field].dump();
            else continue;
            ofJson style = column.value("text", ofJson::object());
            style["text"] = text;
            Layer textLayer;
            textLayer.name = field;
            textLayer.type = "text";
            textLayer.source["text"] = {{"value", style}};
            ofPushMatrix();
            ofTranslate(column.value("x", 0.0f), column.value("y", rowHeight * 0.65f));
            drawText(textLayer, time);
            ofPopMatrix();
        }
        ofPopMatrix();
    }
}

void Renderer::drawText(const Layer& layer, double time) {
    if (!layer.source.contains("text")) return;
    ofJson value = evaluate(layer.source["text"], time);
    if (!value.is_object()) return;
    std::string text = value.value("text", layer.name);
    const std::string controlId = layer.source.value("controlId", "");
    if (!controlId.empty() && data.contains(controlId) && data[controlId].is_string()) text = data[controlId].get<std::string>();
    if (layer.source["text"].contains("styleControlIds")) {
        const auto& styleControls = layer.source["text"]["styleControlIds"];
        const std::string sizeControl = styleControls.value("fontSize", "");
        if (!sizeControl.empty() && data.contains(sizeControl) && data[sizeControl].is_number()) {
            value["fontSize"] = data[sizeControl];
        }
        const std::string fillControl = styleControls.value("fillColor", "");
        if (!fillControl.empty() && data.contains(fillControl) && data[fillControl].is_array() &&
            data[fillControl].size() >= 3) {
            value["fillColor"] = data[fillControl];
        }
    }

    const float size = value.value("fontSize", 32.0f);
    const std::string fontName = value.value("font", value.value("fontFamily", ""));
    ofTrueTypeFont* font = assets.font(fontName, size);
#ifdef __EMSCRIPTEN__
    // The Emscripten font atlas covers ASCII only. Non-ASCII characters render
    // as boxes; warn once per unique layer so authors can detect the issue.
    {
        const std::string warnKey = layer.name + "@" + fontName;
        if (warnedNonAscii.find(warnKey) == warnedNonAscii.end()) {
            bool hasNonAscii = false;
            for (unsigned char c : text) { if (c > 127) { hasNonAscii = true; break; } }
            if (hasNonAscii) {
                warnedNonAscii.insert(warnKey);
                ofLogWarning("ofxOGraf") << "Layer '" << layer.name << "': text contains non-ASCII characters"
                    " that will render as boxes on Emscripten (font '" << fontName << "')."
                    " Pre-bake or use ASCII-only text for WebGL targets.";
            }
        }
    }
#endif
    ofFloatColor fill = value.contains("fillColor") ? color(value["fillColor"]) : ofFloatColor::white;
    ofFloatColor stroke = value.contains("strokeColor") ? color(value["strokeColor"]) : ofFloatColor::black;
    if (hasColorOverride) fill = colorOverride;
    fill.a *= opacityMultiplier;
    stroke.a *= opacityMultiplier;
    const float strokeWidth = value.value("strokeWidth", 0.0f);
    const float leading = value.value("autoLeading", true) ? size * 1.2f : value.value("leading", size * 1.2f);
    const float tracking = value.value("tracking", 0.0f) * size / 1000.0f;
    const std::string justification = value.value("justification", "LEFT_JUSTIFY");
    const auto lines = ofSplitString(text, "\r", false, false);

    float y = value.value("baselineShift", 0.0f);
    for (const auto& line : lines) {
        float width = font ? font->stringWidth(line) : static_cast<float>(line.size() * 8);
        if (tracking != 0.0f) width += std::max(0, static_cast<int>(ofUTF8Length(line)) - 1) * tracking;
        float x = 0.0f;
        if (justification.find("CENTER") != std::string::npos) x = -width * 0.5f;
        else if (justification.find("RIGHT") != std::string::npos) x = -width;

        if (!font) {
            ofSetColor(fill);
            ofDrawBitmapString(line, x, y);
        }
#ifdef __EMSCRIPTEN__
        // Keep text dynamic while avoiding the indexed VBO submission that
        // tears one corner of glyph quads in the current WebGL renderer.
        else {
            ofSetColor(fill);
            drawUnindexedTextMesh(*font, line, x, y);
        }
#else
        else if (tracking == 0.0f) {
            if (value.value("applyStroke", false) && strokeWidth > 0.0f) {
                auto glyphPaths = font->getStringAsPoints(line, true, true);
                ofPushMatrix();
                ofTranslate(x, y);
                for (auto& glyph : glyphPaths) {
                    glyph.setFilled(value.value("applyFill", true));
                    glyph.setFillColor(fill);
                    glyph.setStrokeColor(stroke);
                    glyph.setStrokeWidth(strokeWidth);
                    glyph.draw();
                }
                ofPopMatrix();
            } else {
                ofSetColor(fill);
                font->drawString(line, x, y);
            }
        } else {
            float cursor = x;
            for (uint32_t codepoint : ofUTF8Iterator(line)) {
                const std::string glyph = ofUTF8ToString(codepoint);
                ofSetColor(fill);
                font->drawString(glyph, cursor, y);
                cursor += font->stringWidth(glyph) + tracking;
            }
        }
#endif
        y += leading;
    }
}

void Renderer::drawImage(const Layer& layer, double) {
    std::string asset;
    if (layer.source.contains("source")) asset = layer.source["source"].value("assetId", layer.source["source"].value("file", ""));
    if (auto* image = assets.image(asset)) {
        const float width = layer.source.value("width", static_cast<float>(image->getWidth()));
        const float height = layer.source.value("height", static_cast<float>(image->getHeight()));
        ofFloatColor tint = hasColorOverride ? colorOverride : ofFloatColor::white;
        tint.a *= opacityMultiplier;
        ofSetColor(tint);
        image->draw(0, 0, width, height);
    } else if (layer.type == "solid") {
        ofFloatColor tint = layer.source.contains("solidColor") ? color(layer.source["solidColor"]) : ofFloatColor::white;
        tint.a *= opacityMultiplier;
        ofSetColor(tint);
        ofDrawRectangle(0, 0, layer.source.value("width", rootScene.width), layer.source.value("height", rootScene.height));
    }
}

std::string Renderer::framePath(const ofJson& fallback, double time, double defaultFrameRate) {
    const double rate = fallback.value("frameRate", defaultFrameRate);
    const int frame = fallback.value("startFrame", 0) + std::max(0, static_cast<int>(std::floor(time * rate + 0.5)));
    if (fallback.contains("files") && fallback["files"].is_array() && !fallback["files"].empty()) {
        const int index = ofClamp(frame, 0, static_cast<int>(fallback["files"].size()) - 1);
        return fallback["files"][index].get<std::string>();
    }
    std::string pattern = fallback.value("filePattern", "");
    const auto first = pattern.find('#');
    if (first != std::string::npos) {
        const auto last = pattern.find_last_of('#');
        const int width = static_cast<int>(last - first + 1);
        std::ostringstream number;
        number << std::setw(width) << std::setfill('0') << frame;
        pattern.replace(first, width, number.str());
    }
    return pattern;
}

void Renderer::drawFallback(const Layer& layer, double time) {
    if (!layer.source.contains("fallback")) return;
    const std::string path = framePath(layer.source["fallback"], time, rootScene.frameRate);
    if (auto* frame = assets.image(path)) {
        ofSetColor(ofFloatColor(1, 1, 1, opacityMultiplier));
        frame->draw(0, 0);
    }
}

ofJson Renderer::evaluate(const ofJson& property, double time) const {
    ofJson value = Timeline::evaluate(property, time);
    const std::string controlId = property.value("controlId", "");
    if (controlId.empty() || !data.contains(controlId) || data[controlId].is_null()) return value;
    ofJson controlled = data[controlId];
    const double multiplier = property.value("controlMultiplier", 1.0);
    if (multiplier != 1.0) {
        const auto multiply = [&](const auto& self, ofJson& item) -> void {
            if (item.is_number()) item = item.get<double>() * multiplier;
            else if (item.is_array()) for (auto& child : item) self(self, child);
        };
        multiply(multiply, controlled);
    }
    if (value.is_object() && value.contains("text") && controlled.is_string()) {
        value["text"] = controlled;
        return value;
    }
    return controlled;
}

const ofJson* Renderer::findProperty(const ofJson& group, const std::string& matchName) {
    if (!group.is_object()) return nullptr;
    if (group.value("matchName", "") == matchName) return &group;
    if (group.contains("children") && group["children"].is_array()) {
        for (const auto& child : group["children"]) if (const auto* found = findProperty(child, matchName)) return found;
    }
    return nullptr;
}

const ofJson* Renderer::findFirstValue(const ofJson& group, const std::string& fragment) {
    if (!group.is_object()) return nullptr;
    if ((group.value("name", "").find(fragment) != std::string::npos || group.value("matchName", "").find(fragment) != std::string::npos) &&
        (group.contains("value") || group.contains("keyframes") || group.contains("samples"))) return &group;
    if (group.contains("children") && group["children"].is_array()) {
        for (const auto& child : group["children"]) if (const auto* found = findFirstValue(child, fragment)) return found;
    }
    return nullptr;
}

glm::vec2 Renderer::vector2(const ofJson& value, glm::vec2 fallback) {
    if (!value.is_array() || value.size() < 2) return fallback;
    return { value[0].get<float>(), value[1].get<float>() };
}

glm::vec3 Renderer::vector3(const ofJson& value, glm::vec3 fallback) {
    if (!value.is_array() || value.size() < 2) return fallback;
    return { value[0].get<float>(), value[1].get<float>(), value.size() > 2 ? value[2].get<float>() : fallback.z };
}

ofFloatColor Renderer::color(const ofJson& value, float alpha) {
    if (!value.is_array() || value.size() < 3) return ofFloatColor(1, 1, 1, alpha);
    const float colorAlpha = value.size() > 3 && value[3].is_number()
        ? value[3].get<float>()
        : 1.0f;
    return ofFloatColor(value[0].get<float>(), value[1].get<float>(), value[2].get<float>(),
                        ofClamp(colorAlpha * alpha, 0.0f, 1.0f));
}

} // namespace ofxOGraf
