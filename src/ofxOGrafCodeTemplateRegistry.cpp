#include "ofxOGrafCodeTemplateRegistry.h"

#include <cstdint>
#include <exception>
#include <iomanip>
#include <sstream>
#include <utility>

namespace ofxOGraf {
namespace {

std::uint64_t fnv1a64(const std::string& value) {
    std::uint64_t hash = 14695981039346656037ULL;
    for (const unsigned char character : value) {
        hash ^= character;
        hash *= 1099511628211ULL;
    }
    return hash;
}

std::string fingerprintHex(std::uint64_t value) {
    std::ostringstream output;
    output << std::hex << std::nouppercase << std::setfill('0') << std::setw(16) << value;
    return output.str();
}

std::string abiSignature(const std::string& factoryId, const TemplateDefinition& definition) {
    std::ostringstream output;
    output << "ofxograf-template-abi-v1\n";
    output << "factory=" << factoryId << '\n';
    output << "template=" << definition.id << '\n';
    for (const auto& control : definition.controls) {
        output << "control=" << control.id << ':' << toString(control.type) << '\n';
    }
    for (const auto& action : definition.actions) {
        output << "action=" << action.id << ':' << toString(action.kind) << ':' << toString(action.playback) << '\n';
    }
    return output.str();
}

} // namespace

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

std::string CodeTemplateRegistry::abiFingerprint(const std::string& id, std::string* error) const {
    auto instance = create(id, error);
    if (!instance) return {};
    const auto definition = instance->definition();
    const auto errors = definition.validate();
    if (!errors.empty()) {
        if (error) *error = "Invalid code template definition for ABI fingerprint: " + errors.front();
        return {};
    }
    return fingerprintHex(fnv1a64(abiSignature(id, definition)));
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
