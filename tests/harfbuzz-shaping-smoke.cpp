#ifndef OFXOGRAF_HARFBUZZ_SHAPING_ONLY
#define OFXOGRAF_HARFBUZZ_SHAPING_ONLY
#endif
#include "ofxOGrafHarfBuzz.h"
#include <cmath>
#include <iostream>

int main(int argc, char** argv) {
    if (argc != 2) return 2;
    ofxOGraf::ShapedTextRun first;
    ofxOGraf::ShapedTextRun second;
    std::string error;
    const std::string text =
        "\xd9\x85" "\xd8\xb1" "\xd8\xad" "\xd8\xa8" "\xd8\xa7" " "
        "\xd8\xa8" "\xd8\xa7" "\xd9\x84" "\xd8\xb9" "\xd8\xa7" "\xd9\x84" "\xd9\x85";
    if (!ofxOGraf::HarfBuzzShaper::shapeFontFile(argv[1], text, 48.0f, "rtl", "Arab", "ar",
                                                 first, error)) {
        std::cerr << error << '\n';
        return 3;
    }
    if (!ofxOGraf::HarfBuzzShaper::shapeFontFile(argv[1], text, 48.0f, "rtl", "Arab", "ar",
                                                 second, error)) return 4;
    if (first.glyphs.empty() || first.glyphs.size() > 13 || first.hasMissingGlyph ||
        first.glyphs.size() != second.glyphs.size()) return 5;
    for (std::size_t index = 0; index < first.glyphs.size(); ++index) {
        const auto& a = first.glyphs[index];
        const auto& b = second.glyphs[index];
        if (a.glyphId != b.glyphId || a.cluster != b.cluster ||
            std::abs(a.xAdvance - b.xAdvance) > 0.0001f ||
            std::abs(a.xOffset - b.xOffset) > 0.0001f) return 6;
    }
    std::cout << "glyphs=" << first.glyphs.size() << " advance=" << first.advanceX << '\n';
    return 0;
}
