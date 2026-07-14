#include "ofxOGrafImGuiControls.h"
#include <algorithm>

#if defined(ofxAddons_ENABLE_IMGUI)
#include "ofxImGui.h"
#endif

namespace ofxOGraf {

bool ImGuiControls::available() {
#if defined(ofxAddons_ENABLE_IMGUI)
    return true;
#else
    return false;
#endif
}

void ImGuiControls::resetState() {
    textBuffers.clear();
    textSources.clear();
}

#if defined(ofxAddons_ENABLE_IMGUI)
namespace {

std::string optionLabel(const ofJson& option) {
    if (option.is_object()) return option.value("label", option.value("name", option.value("value", "")));
    if (option.is_string()) return option.get<std::string>();
    return option.dump();
}

ofJson optionValue(const ofJson& option) {
    return option.is_object() && option.contains("value") ? option["value"] : option;
}

ofJson currentValue(const Graphic& graphic, const ofJson& control) {
    const std::string id = control.value("id", "");
    const auto& data = graphic.getData();
    if (!id.empty() && data.contains(id)) return data[id];
    return control.value("default", ofJson());
}

} // namespace
#endif

bool ImGuiControls::draw(Graphic& graphic, const std::string& title, bool* open) {
#if !defined(ofxAddons_ENABLE_IMGUI)
    (void)graphic;
    (void)title;
    (void)open;
    return false;
#else
    bool changed = false;
    bool visible = ImGui::Begin(title.c_str(), open);
    if (!visible) {
        ImGui::End();
        return false;
    }

    const auto& controls = graphic.getControls();
    if (controls.empty()) {
        ImGui::TextDisabled("This scene has no Essential Graphics controls.");
        ImGui::End();
        return false;
    }

    if (ImGui::Button("Reset to defaults")) {
        graphic.updateData(Controls::defaultData(graphic.getScene()));
        resetState();
        changed = true;
    }
    ImGui::Separator();

    ofJson patch = ofJson::object();
    for (const auto& control : controls) {
        if (!control.is_object()) continue;
        const std::string id = control.value("id", "");
        if (id.empty()) continue;
        const std::string label = control.value("name", id);
        const std::string type = Controls::normalizedType(control);
        const ofJson value = currentValue(graphic, control);
        const ofJson constraints = control.value("constraints", ofJson::object());
        const bool hasRange = (control.contains("min") && control.contains("max")) ||
                              (constraints.contains("minimum") && constraints.contains("maximum"));
        bool controlChanged = false;

        ImGui::PushID(id.c_str());
        if (type == "boolean") {
            bool edited = value.is_boolean() ? value.get<bool>() : false;
            controlChanged = ImGui::Checkbox(label.c_str(), &edited);
            if (controlChanged) patch[id] = edited;
        } else if (type == "integer") {
            int edited = value.is_number() ? value.get<int>() : 0;
            const int step = std::max(1, control.value("step", constraints.value("step", 1)));
            if (hasRange) {
                const int minimum = control.contains("min") ? control["min"].get<int>() : constraints["minimum"].get<int>();
                const int maximum = control.contains("max") ? control["max"].get<int>() : constraints["maximum"].get<int>();
                controlChanged = ImGui::SliderInt(label.c_str(), &edited, minimum, maximum);
            } else controlChanged = ImGui::DragInt(label.c_str(), &edited, static_cast<float>(step));
            if (controlChanged) patch[id] = edited;
        } else if (type == "number") {
            float edited = value.is_number() ? value.get<float>() : 0.0f;
            const float step = control.value("step", constraints.value("step", 0.1f));
            if (hasRange) {
                const float minimum = control.contains("min") ? control["min"].get<float>() : constraints["minimum"].get<float>();
                const float maximum = control.contains("max") ? control["max"].get<float>() : constraints["maximum"].get<float>();
                controlChanged = ImGui::SliderFloat(label.c_str(), &edited, minimum, maximum);
            } else controlChanged = ImGui::DragFloat(label.c_str(), &edited, step);
            if (controlChanged) patch[id] = edited;
        } else if (type == "color") {
            std::array<float, 4> edited{1, 1, 1, 1};
            if (value.is_array()) {
                for (std::size_t i = 0; i < std::min<std::size_t>(4, value.size()); ++i) edited[i] = value[i].get<float>();
            }
            controlChanged = ImGui::ColorEdit4(label.c_str(), edited.data());
            if (controlChanged) patch[id] = {edited[0], edited[1], edited[2], edited[3]};
        } else if (type == "vector" || type == "vector2" || type == "vector3" || type == "vector4") {
            std::array<float, 4> edited{0, 0, 0, 0};
            std::size_t count = value.is_array() ? std::min<std::size_t>(4, value.size()) : 2;
            if (value.is_array()) for (std::size_t i = 0; i < count; ++i) edited[i] = value[i].get<float>();
            if (count == 2) controlChanged = ImGui::InputFloat2(label.c_str(), edited.data());
            else if (count == 3) controlChanged = ImGui::InputFloat3(label.c_str(), edited.data());
            else controlChanged = ImGui::InputFloat4(label.c_str(), edited.data());
            if (controlChanged) {
                patch[id] = ofJson::array();
                for (std::size_t i = 0; i < count; ++i) patch[id].push_back(edited[i]);
            }
        } else if (type == "enum" && control.contains("options")) {
            const std::string preview = optionLabel(value);
            if (ImGui::BeginCombo(label.c_str(), preview.c_str())) {
                for (const auto& option : control["options"]) {
                    const ofJson candidate = optionValue(option);
                    const bool selected = candidate == value;
                    if (ImGui::Selectable(optionLabel(option).c_str(), selected)) {
                        patch[id] = candidate;
                        controlChanged = true;
                    }
                    if (selected) ImGui::SetItemDefaultFocus();
                }
                ImGui::EndCombo();
            }
        } else {
            const std::string source = value.is_string() ? value.get<std::string>() : (value.is_null() ? "" : value.dump());
            auto& buffer = textBuffers[id];
            if (textSources[id] != source) {
                buffer.fill('\0');
                const auto count = std::min(source.size(), buffer.size() - 1);
                std::copy_n(source.data(), count, buffer.data());
                textSources[id] = source;
            }
            const bool multiline = control.value("multiline", false) || source.find('\n') != std::string::npos;
            controlChanged = multiline
                ? ImGui::InputTextMultiline(label.c_str(), buffer.data(), buffer.size())
                : ImGui::InputText(label.c_str(), buffer.data(), buffer.size());
            if (controlChanged) {
                patch[id] = std::string(buffer.data());
                textSources[id] = patch[id].get<std::string>();
            }
        }
        ImGui::PopID();
        changed = changed || controlChanged;
    }

    if (!patch.empty()) graphic.updateData(patch);
    ImGui::End();
    return changed;
#endif
}

} // namespace ofxOGraf
