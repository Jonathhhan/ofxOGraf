#pragma once

#include "ofJson.h"
#include <string>

namespace ofxOGraf {

class Timeline {
public:
    void setTime(double seconds);
    double getTime() const;

    static ofJson evaluate(const ofJson& property, double seconds);

private:
    double timeSeconds = 0.0;
    static double ease(double t, const ofJson& left, const ofJson& right);
    static ofJson interpolate(const ofJson& a, const ofJson& b, double t);
};

} // namespace ofxOGraf
