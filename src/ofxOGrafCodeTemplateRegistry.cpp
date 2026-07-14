#include "ofxOGrafCodeTemplateRegistry.h"

#include <exception>
#include <utility>

namespace ofxOGraf {

bool CodeTemplateRegistry::registerFactory(const std::string& id, Factory factory, std::string* error) {
    if (id.empty()) {
        if (error) *error = "Code template factory id must not be empty";
        return false;
    }
    if (!factory) {
        if (error) *error = "Code template factory is empty: " + id;
        return false;
    }
    if (factories.find(id) != factories.end()) {
        if (error) *error = "Code template factory is already registered: " + id;
        return false;
    }
    factories.emplace(id, std::move(factory));
    return true;
}

bool CodeTemplateRegistry::unregisterFactory(const std::string& id) {
    return factories.erase(id) != 0;
}

void CodeTemplateRegistry::clear() {
    factories.clear();
}

bool CodeTemplateRegistry::contains(const std::string& id) const {
    return factories.find(id) != factories.end();
}

std::vector<std::string> CodeTemplateRegistry::ids() const {
    std::vector<std::string> result;
    result.reserve(factories.size());
    for (const auto& factory : factories) result.push_back(factory.first);
    return result;
}

std::unique_ptr<CodeTemplate> CodeTemplateRegistry::create(const std::string& id, std::string* error) const {
    const auto found = factories.find(id);
    if (found == factories.end()) {
        if (error) *error = "Unknown code template factory: " + id;
        return nullptr;
    }
    try {
        auto result = found->second();
        if (!result && error) *error = "Code template factory returned null: " + id;
        return result;
    } catch (const std::exception& exception) {
        if (error) *error = "Code template factory failed: " + id + " (" + exception.what() + ")";
    } catch (...) {
        if (error) *error = "Code template factory failed: " + id;
    }
    return nullptr;

}


} // namespace ofxOGraf
