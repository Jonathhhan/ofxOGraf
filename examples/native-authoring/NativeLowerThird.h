#pragma once

#include "ofxOGrafCodeTemplateRegistry.h"

namespace ofxOGraf::examples {

class NativeLowerThird final : public CodeTemplate {
public:
    TemplateDefinition definition() const override;
    void onDraw(const FrameContext& frame) override;

private:
    glm::ivec2 outputSize{1920, 1080};
};

std::unique_ptr<CodeTemplate> createNativeLowerThird();
bool registerNativeLowerThird(CodeTemplateRegistry& registry, std::string* error = nullptr);

} // namespace ofxOGraf::examples
