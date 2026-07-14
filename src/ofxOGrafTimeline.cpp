#include "ofxOGrafTimeline.h"
#include "ofMath.h"
#include <algorithm>
#include <cmath>

namespace ofxOGraf {

void Timeline::setTime(double seconds) { timeSeconds = std::max(0.0, seconds); }
double Timeline::getTime() const { return timeSeconds; }

static double cubicBezier(double x, double x1, double y1, double x2, double y2) {
    double low = 0.0;
    double high = 1.0;
    double u = x;
    for (int i = 0; i < 12; ++i) {
        u = (low + high) * 0.5;
        const double inv = 1.0 - u;
        const double estimate = 3.0 * inv * inv * u * x1 + 3.0 * inv * u * u * x2 + u * u * u;
        if (estimate < x) low = u; else high = u;
    }
    const double inv = 1.0 - u;
    return 3.0 * inv * inv * u * y1 + 3.0 * inv * u * u * y2 + u * u * u;
}

double Timeline::ease(double t, const ofJson& left, const ofJson& right) {
    if (left.value("outInterpolation", "linear") == "hold") return 0.0;
    if (left.value("outInterpolation", "linear") != "bezier") return t;

    // AE influence maps to the horizontal Bezier handles. Speed is retained in
    // the scene; without a value-range-normalized velocity, influence provides
    // the safest deterministic approximation.
    double outInfluence = 33.333;
    double inInfluence = 33.333;
    if (left.contains("outEase") && !left["outEase"].empty()) {
        outInfluence = left["outEase"][0].value("influence", outInfluence);
    }
    if (right.contains("inEase") && !right["inEase"].empty()) {
        inInfluence = right["inEase"][0].value("influence", inInfluence);
    }
    return cubicBezier(t, ofClamp(outInfluence / 100.0, 0.0, 1.0), 0.0,
                       1.0 - ofClamp(inInfluence / 100.0, 0.0, 1.0), 1.0);
}

ofJson Timeline::interpolate(const ofJson& a, const ofJson& b, double t) {
    if (a.is_number() && b.is_number()) {
        return a.get<double>() + (b.get<double>() - a.get<double>()) * t;
    }
    if (a.is_array() && b.is_array() && a.size() == b.size()) {
        ofJson result = ofJson::array();
        for (std::size_t i = 0; i < a.size(); ++i) result.push_back(interpolate(a[i], b[i], t));
        return result;
    }
    return t < 1.0 ? a : b;
}

ofJson Timeline::evaluate(const ofJson& property, double seconds) {
    if (property.contains("samples") && property["samples"].is_array() && !property["samples"].empty()) {
        const auto& samples = property["samples"];
        if (seconds <= samples.front().value("time", 0.0)) return samples.front().value("value", ofJson());
        if (seconds >= samples.back().value("time", 0.0)) return samples.back().value("value", ofJson());
        for (std::size_t i = 0; i + 1 < samples.size(); ++i) {
            const auto& a = samples[i];
            const auto& b = samples[i + 1];
            const double start = a.value("time", 0.0);
            const double end = b.value("time", start);
            if (seconds >= start && seconds <= end) {
                const double amount = end <= start
                    ? 1.0
                    : ofClamp((seconds - start) / (end - start), 0.0, 1.0);
                return interpolate(a.value("value", ofJson()), b.value("value", ofJson()), amount);
            }
        }
    }

    if (!property.contains("keyframes") || !property["keyframes"].is_array() || property["keyframes"].empty()) {
        return property.value("value", ofJson());
    }
    const auto& keys = property["keyframes"];
    if (seconds <= keys.front().value("time", 0.0)) return keys.front().value("value", ofJson());
    if (seconds >= keys.back().value("time", 0.0)) return keys.back().value("value", ofJson());
    for (std::size_t i = 0; i + 1 < keys.size(); ++i) {
        const auto& a = keys[i];
        const auto& b = keys[i + 1];
        const double start = a.value("time", 0.0);
        const double end = b.value("time", start);
        if (seconds >= start && seconds <= end) {
            const double linear = end <= start ? 1.0 : ofClamp((seconds - start) / (end - start), 0.0, 1.0);
            return interpolate(a.value("value", ofJson()), b.value("value", ofJson()), ease(linear, a, b));
        }
    }
    return property.value("value", ofJson());
}

} // namespace ofxOGraf
