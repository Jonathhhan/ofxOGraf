#pragma once

#ifndef OFXOGRAF_HARFBUZZ_SHAPING_ONLY
#include "ofMain.h"
#include "ofxOGrafExtensions.h"
#endif
#include <cstdint>
#include <functional>
#include <string>
#include <vector>

namespace ofxOGraf {

struct ShapedGlyph {
    std::uint32_t glyphId = 0;
    std::uint32_t cluster = 0;
    float xAdvance = 0.0f;
    float yAdvance = 0.0f;
    float xOffset = 0.0f;
    float yOffset = 0.0f;
};

struct ShapedTextRun {
    std::vector<ShapedGlyph> glyphs;
    float advanceX = 0.0f;
    float advanceY = 0.0f;
    bool hasMissingGlyph = false;
};

class HarfBuzzShaper {
public:
#ifndef OFXOGRAF_HARFBUZZ_SHAPING_ONLY
    using FontResolver = std::function<std::string(const std::string&)>;
#endif

    static bool shapeFontFile(const std::string& fontPath, const std::string& utf8,
                              float pixelSize, const std::string& direction,
                              const std::string& script, const std::string& language,
                              ShapedTextRun& output, std::string& error);
#ifndef OFXOGRAF_HARFBUZZ_SHAPING_ONLY
    static bool drawFontFile(const std::string& fontPath, const std::string& utf8,
                             float pixelSize, const std::string& direction,
                             const std::string& script, const std::string& language,
                             const std::string& justification, const ofFloatColor& fill,
                             const ofFloatColor& stroke, float strokeWidth,
                             bool applyFill, bool applyStroke, std::string& error);
    static Extensions::TextLayoutHandler makeTextLayoutHandler(FontResolver resolver);
#endif
};

} // namespace ofxOGraf
