#pragma once

#include "ofxOGrafControls.h"
#include "ofxOGrafGraphic.h"
#include <array>
#include <string>
#include <unordered_map>

namespace ofxOGraf {

// Optional immediate-mode inspector. It becomes active when an application
// includes ofxImGui, whose addon_config defines ofxAddons_ENABLE_IMGUI.
class ImGuiControls {
public:
    static bool available();
    bool draw(Graphic& graphic, const std::string& title = "Essential Graphics", bool* open = nullptr);
    void resetState();

private:
    static constexpr std::size_t TextCapacity = 2048;
    std::unordered_map<std::string, std::array<char, TextCapacity>> textBuffers;
    std::unordered_map<std::string, std::string> textSources;
};

} // namespace ofxOGraf
