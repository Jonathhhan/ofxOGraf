#pragma once

#include "ofxOGrafCodeTemplate.h"

#include <functional>
#include <map>
#include <memory>
#include <string>
#include <vector>

namespace ofxOGraf {

// Applications own a registry and explicitly register the compiled templates
// they want to ship. This avoids static initialization order and keeps a
// package's available template surface auditable.
class CodeTemplateRegistry {
public:
    using Factory = std::function<std::unique_ptr<CodeTemplate>()>;

    bool registerFactory(const std::string& id, Factory factory, std::string* error = nullptr);
    bool unregisterFactory(const std::string& id);
    void clear();

    bool contains(const std::string& id) const;
    std::vector<std::string> ids() const;
    // Stable v1 interface fingerprint for descriptor/runtime compatibility checks.
    std::string abiFingerprint(const std::string& id, std::string* error = nullptr) const;
    std::unique_ptr<CodeTemplate> create(const std::string& id, std::string* error = nullptr) const;

private:
    std::map<std::string, Factory> factories;
};

} // namespace ofxOGraf
