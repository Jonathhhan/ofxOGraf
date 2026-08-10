#include "ofxOGrafHarfBuzz.h"
#include "hb.h"
#include "hb-ot.h"
#include <cmath>

#ifndef OFXOGRAF_HARFBUZZ_SHAPING_ONLY
namespace {

struct PathBuilder {
    ofPath path;
    float originX = 0.0f;
    float originY = 0.0f;
};

float pathX(const PathBuilder& builder, float value) { return builder.originX + value / 64.0f; }
// HarfBuzz outlines use a Y-up font space; openFrameworks paths use the
// renderer's Y-down drawing space.
float pathY(const PathBuilder& builder, float value) { return builder.originY - value / 64.0f; }

void moveTo(hb_draw_funcs_t*, void* drawData, hb_draw_state_t*, float x, float y, void*) {
    auto& builder = *static_cast<PathBuilder*>(drawData);
    builder.path.moveTo(pathX(builder, x), pathY(builder, y));
}

void lineTo(hb_draw_funcs_t*, void* drawData, hb_draw_state_t*, float x, float y, void*) {
    auto& builder = *static_cast<PathBuilder*>(drawData);
    builder.path.lineTo(pathX(builder, x), pathY(builder, y));
}

void quadraticTo(hb_draw_funcs_t*, void* drawData, hb_draw_state_t* state,
                 float controlX, float controlY, float x, float y, void*) {
    auto& builder = *static_cast<PathBuilder*>(drawData);
    // Convert the quadratic segment to a cubic one. This avoids relying on
    // openFrameworks' nonstandard two-control-point quadBezierTo overload.
    const float control1X = state->current_x + (controlX - state->current_x) * 2.0f / 3.0f;
    const float control1Y = state->current_y + (controlY - state->current_y) * 2.0f / 3.0f;
    const float control2X = x + (controlX - x) * 2.0f / 3.0f;
    const float control2Y = y + (controlY - y) * 2.0f / 3.0f;
    builder.path.bezierTo(pathX(builder, control1X), pathY(builder, control1Y),
                          pathX(builder, control2X), pathY(builder, control2Y),
                          pathX(builder, x), pathY(builder, y));
}

void cubicTo(hb_draw_funcs_t*, void* drawData, hb_draw_state_t*,
             float control1X, float control1Y, float control2X, float control2Y,
             float x, float y, void*) {
    auto& builder = *static_cast<PathBuilder*>(drawData);
    builder.path.bezierTo(pathX(builder, control1X), pathY(builder, control1Y),
                          pathX(builder, control2X), pathY(builder, control2Y),
                          pathX(builder, x), pathY(builder, y));
}

void closePath(hb_draw_funcs_t*, void* drawData, hb_draw_state_t*, void*) {
    static_cast<PathBuilder*>(drawData)->path.close();
}

ofFloatColor jsonColor(const ofJson& value, const ofFloatColor& fallback) {
    if (!value.is_array() || value.size() < 3) return fallback;
    return ofFloatColor(value[0].get<float>(), value[1].get<float>(), value[2].get<float>(),
                        value.size() > 3 ? value[3].get<float>() : 1.0f);
}

} // namespace
#endif

namespace ofxOGraf {

bool HarfBuzzShaper::shapeFontFile(const std::string& fontPath, const std::string& utf8,
                                   float pixelSize, const std::string& direction,
                                   const std::string& script, const std::string& language,
                                   ShapedTextRun& output, std::string& error) {
    output = {};
    error.clear();
    if (fontPath.empty() || utf8.empty() || pixelSize <= 0.0f) {
        error = "font path, text, and positive pixel size are required";
        return false;
    }
    if (utf8.find('\r') != std::string::npos || utf8.find('\n') != std::string::npos) {
        error = "shapeFontFile accepts exactly one pre-segmented text run";
        return false;
    }

    const hb_direction_t hbDirection = hb_direction_from_string(direction.c_str(), -1);
    const hb_script_t hbScript = hb_script_from_string(script.c_str(), -1);
    const hb_language_t hbLanguage = hb_language_from_string(language.c_str(), -1);
    if (!HB_DIRECTION_IS_VALID(hbDirection) || hbScript == HB_SCRIPT_INVALID ||
        hbLanguage == HB_LANGUAGE_INVALID) {
        error = "explicit valid direction, script, and language are required";
        return false;
    }

    hb_blob_t* blob = hb_blob_create_from_file_or_fail(fontPath.c_str());
    if (!blob) {
        error = "could not open font: " + fontPath;
        return false;
    }
    hb_face_t* face = hb_face_create(blob, 0);
    hb_font_t* font = hb_font_create(face);
    hb_ot_font_set_funcs(font);
    const int scale = std::max(1, static_cast<int>(std::lround(pixelSize * 64.0f)));
    hb_font_set_scale(font, scale, scale);

    hb_buffer_t* buffer = hb_buffer_create();
    hb_buffer_set_direction(buffer, hbDirection);
    hb_buffer_set_script(buffer, hbScript);
    hb_buffer_set_language(buffer, hbLanguage);
    hb_buffer_set_cluster_level(buffer, HB_BUFFER_CLUSTER_LEVEL_MONOTONE_GRAPHEMES);
    hb_buffer_add_utf8(buffer, utf8.c_str(), static_cast<int>(utf8.size()), 0, -1);
    hb_shape(font, buffer, nullptr, 0);

    unsigned count = 0;
    const hb_glyph_info_t* info = hb_buffer_get_glyph_infos(buffer, &count);
    const hb_glyph_position_t* positions = hb_buffer_get_glyph_positions(buffer, &count);
    output.glyphs.reserve(count);
    for (unsigned index = 0; index < count; ++index) {
        ShapedGlyph glyph;
        glyph.glyphId = info[index].codepoint;
        glyph.cluster = info[index].cluster;
        glyph.xAdvance = positions[index].x_advance / 64.0f;
        glyph.yAdvance = positions[index].y_advance / 64.0f;
        glyph.xOffset = positions[index].x_offset / 64.0f;
        glyph.yOffset = positions[index].y_offset / 64.0f;
        output.advanceX += glyph.xAdvance;
        output.advanceY += glyph.yAdvance;
        output.hasMissingGlyph = output.hasMissingGlyph || glyph.glyphId == 0;
        output.glyphs.push_back(glyph);
    }

    hb_buffer_destroy(buffer);
    hb_font_destroy(font);
    hb_face_destroy(face);
    hb_blob_destroy(blob);
    return true;
}

#ifndef OFXOGRAF_HARFBUZZ_SHAPING_ONLY
bool HarfBuzzShaper::drawFontFile(const std::string& fontPath, const std::string& utf8,
                                  float pixelSize, const std::string& direction,
                                  const std::string& script, const std::string& language,
                                  const std::string& justification, const ofFloatColor& fill,
                                  const ofFloatColor& stroke, float strokeWidth,
                                  bool applyFill, bool applyStroke, std::string& error) {
    ShapedTextRun run;
    if (!shapeFontFile(fontPath, utf8, pixelSize, direction, script, language, run, error)) return false;
    if (run.hasMissingGlyph) {
        error = "font contains missing glyphs for the shaped run";
        return false;
    }

    hb_blob_t* blob = hb_blob_create_from_file_or_fail(fontPath.c_str());
    if (!blob) {
        error = "could not reopen font: " + fontPath;
        return false;
    }
    hb_face_t* face = hb_face_create(blob, 0);
    hb_font_t* font = hb_font_create(face);
    hb_ot_font_set_funcs(font);
    const int scale = std::max(1, static_cast<int>(std::lround(pixelSize * 64.0f)));
    hb_font_set_scale(font, scale, scale);

    hb_draw_funcs_t* drawFunctions = hb_draw_funcs_create();
    hb_draw_funcs_set_move_to_func(drawFunctions, moveTo, nullptr, nullptr);
    hb_draw_funcs_set_line_to_func(drawFunctions, lineTo, nullptr, nullptr);
    hb_draw_funcs_set_quadratic_to_func(drawFunctions, quadraticTo, nullptr, nullptr);
    hb_draw_funcs_set_cubic_to_func(drawFunctions, cubicTo, nullptr, nullptr);
    hb_draw_funcs_set_close_path_func(drawFunctions, closePath, nullptr, nullptr);
    hb_draw_funcs_make_immutable(drawFunctions);

    float cursorX = 0.0f;
    if (justification.find("CENTER") != std::string::npos) cursorX = -run.advanceX * 0.5f;
    else if (justification.find("RIGHT") != std::string::npos) cursorX = -run.advanceX;
    bool drewAllGlyphs = true;
    for (const auto& glyph : run.glyphs) {
        PathBuilder builder;
        builder.originX = cursorX + glyph.xOffset;
        builder.originY = -glyph.yOffset;
        if (!hb_font_draw_glyph_or_fail(font, glyph.glyphId, drawFunctions, &builder)) {
            drewAllGlyphs = false;
            break;
        }
        builder.path.setFilled(applyFill);
        builder.path.setFillColor(fill);
        builder.path.setStrokeColor(stroke);
        builder.path.setStrokeWidth(applyStroke ? strokeWidth : 0.0f);
        builder.path.draw();
        cursorX += glyph.xAdvance;
    }

    hb_draw_funcs_destroy(drawFunctions);
    hb_font_destroy(font);
    hb_face_destroy(face);
    hb_blob_destroy(blob);
    if (!drewAllGlyphs) error = "font has no drawable outline for a shaped glyph";
    return drewAllGlyphs;
}

Extensions::TextLayoutHandler HarfBuzzShaper::makeTextLayoutHandler(FontResolver resolver) {
    return [resolver = std::move(resolver)](const Layer&, const ofJson& value,
                                            const std::string& text, double, const ofJson&) {
        const std::string direction = value.value("direction", "");
        const std::string script = value.value("script", "");
        const std::string language = value.value("language", "");
        const std::string fontName = value.value("font", value.value("fontFamily", ""));
        if (!resolver || direction.empty() || script.empty() || language.empty() || fontName.empty()) return false;
        const std::string fontPath = resolver(fontName);
        if (fontPath.empty()) return false;
        std::string error;
        const bool drawn = drawFontFile(
            fontPath, text, value.value("fontSize", 32.0f), direction, script, language,
            value.value("justification", "LEFT_JUSTIFY"),
            jsonColor(value.value("fillColor", ofJson()), ofFloatColor::white),
            jsonColor(value.value("strokeColor", ofJson()), ofFloatColor::black),
            value.value("strokeWidth", 0.0f), value.value("applyFill", true),
            value.value("applyStroke", false), error);
        if (!drawn && !error.empty()) ofLogWarning("ofxOGraf.HarfBuzz") << error;
        return drawn;
    };
}
#endif

} // namespace ofxOGraf
