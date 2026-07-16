#include "ofxOGrafRenderer.h"
#include "ofxOGrafTimeline.h"
#include <algorithm>
#include <cmath>

namespace ofxOGraf {

Renderer::Style Renderer::styleFor(const ofJson& group, double time) const {
    Style style;
    if (const auto* property = findProperty(group, "ADBE Vector Fill Color")) style.fill = color(evaluate(*property, time));
    if (const auto* property = findProperty(group, "ADBE Vector Fill Opacity")) style.fill.a *= evaluate(*property, time).get<float>() / 100.0f;
    if (const auto* property = findProperty(group, "ADBE Vector Stroke Color")) {
        style.stroked = true;
        style.stroke = color(evaluate(*property, time));
    }
    if (const auto* property = findProperty(group, "ADBE Vector Stroke Opacity")) style.stroke.a *= evaluate(*property, time).get<float>() / 100.0f;
    if (const auto* property = findProperty(group, "ADBE Vector Stroke Width")) {
        style.stroked = true;
        style.strokeWidth = evaluate(*property, time).get<float>();
    }
    if (const auto* gradientGroup = findProperty(group, "ADBE Vector Graphic - G-Fill")) {
        style.gradient = true;
        if (const auto* property = findProperty(*gradientGroup, "ADBE Vector Grad Type")) {
            const ofJson value = evaluate(*property, time);
            style.radialGradient = value.is_number() && value.get<int>() == 2;
        }
        if (const auto* property = findProperty(*gradientGroup, "ADBE Vector Grad Start Pt")) style.gradientStart = vector2(evaluate(*property, time));
        if (const auto* property = findProperty(*gradientGroup, "ADBE Vector Grad End Pt")) style.gradientEnd = vector2(evaluate(*property, time), glm::vec2(1, 0));
        if (const auto* property = findProperty(group, "ADBE Vector Grad Colors")) {
            const ofJson value = evaluate(*property, time);
            if (value.is_object() && value.contains("stops") && value["stops"].is_array()) {
                for (const auto& stop : value["stops"]) {
                    style.stops.emplace_back(stop.value("offset", 0.0f), color(stop.value("color", ofJson::array({1, 1, 1})), stop.value("opacity", 1.0f)));
                }
            }
        }
        if (style.stops.empty()) {
            style.stops.emplace_back(0.0f, style.fill);
            style.stops.emplace_back(1.0f, ofFloatColor(style.fill.r, style.fill.g, style.fill.b, 0.0f));
        }
        std::sort(style.stops.begin(), style.stops.end(),
                  [](const auto& a, const auto& b) { return a.first < b.first; });
    }
    if (hasColorOverride) {
        style.fill = colorOverride;
        style.stroke = colorOverride;
        style.gradient = false;
    }
    style.fill.a *= opacityMultiplier;
    style.stroke.a *= opacityMultiplier;
    return style;
}

ofPath Renderer::pathFromProperty(const ofJson& property, double time) const {
    ofPath path;
    const std::string match = property.value("matchName", "");
    if (match == "ADBE Vector Shape - Rect") {
        const auto* sizeProperty = findProperty(property, "ADBE Vector Rect Size");
        const auto* positionProperty = findProperty(property, "ADBE Vector Rect Position");
        const glm::vec2 size = sizeProperty ? vector2(evaluate(*sizeProperty, time)) : glm::vec2(0);
        const glm::vec2 position = positionProperty ? vector2(evaluate(*positionProperty, time)) : glm::vec2(0);
        path.rectangle(position.x - size.x * 0.5f, position.y - size.y * 0.5f, size.x, size.y);
        return path;
    }
    if (match == "ADBE Vector Shape - Ellipse") {
        const auto* sizeProperty = findProperty(property, "ADBE Vector Ellipse Size");
        const auto* positionProperty = findProperty(property, "ADBE Vector Ellipse Position");
        const glm::vec2 size = sizeProperty ? vector2(evaluate(*sizeProperty, time)) : glm::vec2(0);
        const glm::vec2 position = positionProperty ? vector2(evaluate(*positionProperty, time)) : glm::vec2(0);
        path.ellipse(position, size.x, size.y);
        return path;
    }

    const ofJson* shapeProperty = &property;
    if (!property.contains("value") && !property.contains("keyframes") && !property.contains("samples")) {
        shapeProperty = findProperty(property, "ADBE Vector Shape");
    }
    ofJson value = shapeProperty ? evaluate(*shapeProperty, time) : ofJson();
    if (!value.is_object() || !value.contains("vertices") || value["vertices"].empty()) return path;
    const auto& vertices = value["vertices"];
    const auto& ins = value.value("inTangents", ofJson::array());
    const auto& outs = value.value("outTangents", ofJson::array());
    path.moveTo(vector2(vertices[0]));
    for (std::size_t i = 1; i < vertices.size(); ++i) {
        const glm::vec2 previous = vector2(vertices[i - 1]);
        const glm::vec2 current = vector2(vertices[i]);
        const glm::vec2 out = i - 1 < outs.size() ? vector2(outs[i - 1]) : glm::vec2(0);
        const glm::vec2 in = i < ins.size() ? vector2(ins[i]) : glm::vec2(0);
        path.bezierTo(previous + out, current + in, current);
    }
    if (value.value("closed", false)) {
        const std::size_t last = vertices.size() - 1;
        const glm::vec2 previous = vector2(vertices[last]);
        const glm::vec2 current = vector2(vertices[0]);
        const glm::vec2 out = last < outs.size() ? vector2(outs[last]) : glm::vec2(0);
        const glm::vec2 in = !ins.empty() ? vector2(ins[0]) : glm::vec2(0);
        path.bezierTo(previous + out, current + in, current);
        path.close();
    }
    return path;
}

std::vector<ofPath> Renderer::collectPaths(const ofJson& group, double time) const {
    std::vector<ofPath> result;
    if (!group.is_object()) return result;
    const std::string match = group.value("matchName", "");
    if (match == "ADBE Vector Shape - Rect" || match == "ADBE Vector Shape - Ellipse" ||
        match == "ADBE Vector Shape - Group" || match == "ADBE Mask Shape") {
        ofPath path = pathFromProperty(group, time);
        if (!path.getCommands().empty()) result.push_back(std::move(path));
        return result;
    }
    if (group.contains("children") && group["children"].is_array()) {
        for (const auto& child : group["children"]) {
            auto paths = collectPaths(child, time);
            result.insert(result.end(), paths.begin(), paths.end());
        }
    }
    return result;
}

void Renderer::drawGradient(const ofPath& path, const Style& style) const {
    ofMesh mesh = path.getTessellation();
    mesh.clearColors();
    const glm::vec2 axis = style.gradientEnd - style.gradientStart;
    const float axisLength = std::max(0.0001f, glm::length(axis));
    const float lengthSquared = axisLength * axisLength;
    for (const auto& vertex : mesh.getVertices()) {
        const glm::vec2 relative = glm::vec2(vertex) - style.gradientStart;
        const float coordinate = style.radialGradient ? glm::length(relative) / axisLength : glm::dot(relative, axis) / lengthSquared;
        const float t = ofClamp(coordinate, 0.0f, 1.0f);
        auto right = std::lower_bound(style.stops.begin(), style.stops.end(), t,
            [](const auto& stop, float value) { return stop.first < value; });
        ofFloatColor value;
        if (right == style.stops.begin()) value = right->second;
        else if (right == style.stops.end()) value = style.stops.back().second;
        else {
            const auto& left = *(right - 1);
            const float gap = right->first - left.first;
            const float local = gap > 0.0f ? (t - left.first) / gap : 1.0f;
            value = left.second.getLerped(right->second, local);
        }
        mesh.addColor(value);
    }
    ofSetColor(255);
    mesh.draw();
}

void Renderer::drawStyledPath(ofPath path, const Style& style) const {
    path.setPolyWindingMode(OF_POLY_WINDING_NONZERO);
    if (style.gradient) {
        path.setFilled(true);
        drawGradient(path, style);
        if (style.stroked && style.strokeWidth > 0) {
            path.setFilled(false);
            path.setStrokeColor(style.stroke);
            path.setStrokeWidth(style.strokeWidth);
            path.draw();
        }
        return;
    }
    path.setFilled(style.filled);
    path.setFillColor(style.fill);
    path.setStrokeColor(style.stroke);
    path.setStrokeWidth(style.stroked ? style.strokeWidth : 0.0f);
    path.draw();
}

void Renderer::drawTrimmed(const ofPath& path, const Style& style, float start, float end, float offset) const {
    start = std::fmod(start + offset + 100.0f, 100.0f) / 100.0f;
    end = std::fmod(end + offset + 100.0f, 100.0f) / 100.0f;
    for (const auto& outline : path.getOutline()) {
        const float perimeter = outline.getPerimeter();
        if (perimeter <= 0.0f) continue;
        auto drawRange = [&](float from, float to) {
            ofPath trimmed;
            const int steps = std::max(2, static_cast<int>(std::ceil((to - from) * perimeter / 3.0f)));
            for (int i = 0; i <= steps; ++i) {
                const float distance = ofLerp(from, to, static_cast<float>(i) / steps) * perimeter;
                const glm::vec3 point = outline.getPointAtLength(distance);
                if (i == 0) trimmed.moveTo(point); else trimmed.lineTo(point);
            }
            Style lineStyle = style;
            lineStyle.filled = false;
            lineStyle.gradient = false;
            if (!lineStyle.stroked) {
                lineStyle.stroked = true;
                lineStyle.stroke = lineStyle.fill;
                lineStyle.strokeWidth = 1.0f;
            }
            drawStyledPath(trimmed, lineStyle);
        };
        if (end >= start) drawRange(start, end);
        else { drawRange(start, 1.0f); drawRange(0.0f, end); }
    }
}

void Renderer::drawShapeGeometry(const ofJson& group, double time, const Style& style) {
    auto paths = collectPaths(group, time);
    const auto* trimStart = findProperty(group, "ADBE Vector Trim Start");
    const auto* trimEnd = findProperty(group, "ADBE Vector Trim End");
    const auto* trimOffset = findProperty(group, "ADBE Vector Trim Offset");
    const bool trimmed = trimStart || trimEnd;
    const float start = trimStart ? evaluate(*trimStart, time).get<float>() : 0.0f;
    const float end = trimEnd ? evaluate(*trimEnd, time).get<float>() : 100.0f;
    const float offset = trimOffset ? evaluate(*trimOffset, time).get<float>() / 3.6f : 0.0f;
    if (const auto* merge = findProperty(group, "ADBE Vector Filter - Merge")) {
        const auto* modeProperty = findProperty(*merge, "ADBE Vector Merge Type");
        const int mode = modeProperty ? evaluate(*modeProperty, time).get<int>() : 1;
        ofPath combined;
        for (const auto& path : paths) combined.append(path);
        if (mode == 3) combined.setPolyWindingMode(OF_POLY_WINDING_NEGATIVE);
        else if (mode == 4) combined.setPolyWindingMode(OF_POLY_WINDING_ABS_GEQ_TWO);
        else if (mode == 5) combined.setPolyWindingMode(OF_POLY_WINDING_ODD);
        else combined.setPolyWindingMode(OF_POLY_WINDING_NONZERO);
        if (trimmed) drawTrimmed(combined, style, start, end, offset);
        else {
            ofPath merged = combined;
            merged.setFilled(style.filled);
            merged.setFillColor(style.fill);
            merged.setStrokeColor(style.stroke);
            merged.setStrokeWidth(style.stroked ? style.strokeWidth : 0.0f);
            merged.draw();
        }
        return;
    }
    for (auto& path : paths) {
        if (trimmed) drawTrimmed(path, style, start, end, offset);
        else drawStyledPath(path, style);
    }
}

void Renderer::drawRepeater(const ofJson& group, const ofJson& repeater, double time) {
    const auto* copiesProperty = findProperty(repeater, "ADBE Vector Repeater Copies");
    const auto* offsetProperty = findProperty(repeater, "ADBE Vector Repeater Offset");
    const auto* transform = findProperty(repeater, "ADBE Vector Repeater Transform");
    const int copies = std::max(0, copiesProperty ? static_cast<int>(std::round(evaluate(*copiesProperty, time).get<float>())) : 1);
    const float offset = offsetProperty ? evaluate(*offsetProperty, time).get<float>() : 0.0f;
    const glm::vec2 position = transform && findProperty(*transform, "ADBE Vector Repeater Position")
        ? vector2(evaluate(*findProperty(*transform, "ADBE Vector Repeater Position"), time)) : glm::vec2(0);
    const glm::vec2 scale = transform && findProperty(*transform, "ADBE Vector Repeater Scale")
        ? vector2(evaluate(*findProperty(*transform, "ADBE Vector Repeater Scale"), time), glm::vec2(100)) : glm::vec2(100);
    const float rotation = transform && findProperty(*transform, "ADBE Vector Repeater Rotation")
        ? evaluate(*findProperty(*transform, "ADBE Vector Repeater Rotation"), time).get<float>() : 0.0f;
    for (int i = 0; i < copies; ++i) {
        const float amount = static_cast<float>(i) + offset;
        ofPushMatrix();
        ofTranslate(position * amount);
        ofRotateDeg(rotation * amount);
        ofScale(std::pow(scale.x / 100.0f, amount), std::pow(scale.y / 100.0f, amount));
        drawShapeGroup(group, time, true);
        ofPopMatrix();
    }
}

void Renderer::drawShapeGroup(const ofJson& group, double time, bool ignoreRepeaters) {
    if (!group.is_object()) return;
    if (!ignoreRepeaters) {
        if (const auto* repeater = findProperty(group, "ADBE Vector Filter - Repeater")) {
            drawRepeater(group, *repeater, time);
            return;
        }
    }
    ofPushMatrix();
    if (const auto* transform = findProperty(group, "ADBE Vector Transform Group")) applyTransform(*transform, time);
    drawShapeGeometry(group, time, styleFor(group, time));
    ofPopMatrix();
}

bool Renderer::canUseStencil(const Layer& layer, const char* feature) {
    GLint stencilBits = 0;
    glGetIntegerv(GL_STENCIL_BITS, &stencilBits);
    if (stencilBits > 0) return true;

    const std::string key = std::string(feature) + ":" + std::to_string(layer.index);
    if (warnedStencilLayers.insert(key).second) {
        ofLogWarning("ofxOGraf") << "Skipping " << feature << " for layer '" << layer.name
                                  << "': the active render target has no stencil attachment."
                                  << " Use a stencil-capable native surface or bake the feature for WebGL.";
    }
    return false;
}

bool Renderer::applyMasks(const Layer& layer, double time, bool begin) {
    if (!begin) {
        endMatte();
        return true;
    }
    if (!canUseStencil(layer, "mask")) return false;
    glEnable(GL_STENCIL_TEST);
    glClearStencil(0);
    glClear(GL_STENCIL_BUFFER_BIT);
    glColorMask(GL_FALSE, GL_FALSE, GL_FALSE, GL_FALSE);
    glStencilMask(0xFF);
    glStencilFunc(GL_ALWAYS, 1, 0xFF);
    glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);
    bool inverted = false;
    const ofJson& masks = layer.source["masks"];
    if (masks.contains("children") && masks["children"].is_array()) {
        bool first = true;
        for (const auto& mask : masks["children"]) {
            const std::string mode = mask.value("maskMode", "ADD");
            const bool subtract = mode.find("SUBTRACT") != std::string::npos;
            if (first) inverted = mask.value("inverted", false);
            glStencilFunc(GL_ALWAYS, subtract ? 0 : 1, 0xFF);
            for (auto path : collectPaths(mask, time)) {
                path.setFilled(true);
                path.setFillColor(ofFloatColor::white);
                path.draw();
            }
            first = false;
        }
    } else {
        for (auto path : collectPaths(masks, time)) {
            path.setFilled(true);
            path.setFillColor(ofFloatColor::white);
            path.draw();
        }
    }
    glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
    glStencilFunc(inverted ? GL_NOTEQUAL : GL_EQUAL, 1, 0xFF);
    glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
    return true;
}

bool Renderer::beginMatte(const Scene& scene, const Layer& matte, const Layer& target,
                          double time, bool inverted) {
    if (!canUseStencil(target, "track matte")) return false;
    glEnable(GL_STENCIL_TEST);
    glClearStencil(0);
    glClear(GL_STENCIL_BUFFER_BIT);
    glColorMask(GL_FALSE, GL_FALSE, GL_FALSE, GL_FALSE);
    glStencilMask(0xFF);
    glStencilFunc(GL_ALWAYS, 1, 0xFF);
    glStencilOp(GL_KEEP, GL_KEEP, GL_REPLACE);
    drawLayer(scene, matte, time, false);
    glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
    glStencilFunc(inverted ? GL_NOTEQUAL : GL_EQUAL, 1, 0xFF);
    glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
    return true;
}

void Renderer::endMatte() {
    glColorMask(GL_TRUE, GL_TRUE, GL_TRUE, GL_TRUE);
    glStencilMask(0xFF);
    glStencilFunc(GL_ALWAYS, 0, 0xFF);
    glStencilOp(GL_KEEP, GL_KEEP, GL_KEEP);
    glDisable(GL_STENCIL_TEST);
}

} // namespace ofxOGraf
