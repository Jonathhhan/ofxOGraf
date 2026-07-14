#pragma once

#include "ofMain.h"
#include "ofxOGrafGraphic.h"
#include <algorithm>

namespace ofxOGraf {

class RenderSurface {
public:
    void allocate(int width, int height) {
        ofFbo::Settings settings;
        settings.width = std::max(1, width);
        settings.height = std::max(1, height);
        settings.internalformat = GL_RGBA;
        settings.useDepth = false;
        settings.useStencil = true;
        settings.textureTarget = GL_TEXTURE_2D;
        target.allocate(settings);
    }

    void allocate(const Scene& scene) {
        allocate(scene.width, scene.height);
    }

    bool isAllocated() const {
        return target.isAllocated();
    }

    int width() const {
        return static_cast<int>(target.getWidth());
    }

    int height() const {
        return static_cast<int>(target.getHeight());
    }

    void render(Graphic& graphic) {
        if (!isAllocated()) return;
        ofPushStyle();
        target.begin();
        ofClear(0, 0, 0, 0);
        graphic.draw();
        target.end();
        ofPopStyle();
    }

    ofRectangle fittedBounds(float x, float y, float availableWidth, float availableHeight) const {
        if (!isAllocated() || availableWidth <= 0.0f || availableHeight <= 0.0f) return {};
        const float scale = std::min(availableWidth / target.getWidth(),
                                     availableHeight / target.getHeight());
        const float drawWidth = target.getWidth() * scale;
        const float drawHeight = target.getHeight() * scale;
        return {
            x + (availableWidth - drawWidth) * 0.5f,
            y + (availableHeight - drawHeight) * 0.5f,
            drawWidth,
            drawHeight
        };
    }

    void drawFit(float x, float y, float availableWidth, float availableHeight,
                 bool transparencyGrid = false, float gridTileSize = 24.0f) {
        const ofRectangle bounds = fittedBounds(x, y, availableWidth, availableHeight);
        if (bounds.isEmpty()) return;

        ofPushStyle();
        if (transparencyGrid) drawTransparencyGrid(bounds, gridTileSize);
        ofSetColor(255);
        ofEnableAlphaBlending();
        glBlendFunc(GL_ONE, GL_ONE_MINUS_SRC_ALPHA);
        target.draw(bounds.x, bounds.y, bounds.width, bounds.height);
        ofEnableAlphaBlending();
        ofPopStyle();
    }

    ofFbo& fbo() {
        return target;
    }

    const ofFbo& fbo() const {
        return target;
    }

    ofTexture& texture() {
        return target.getTexture();
    }

    const ofTexture& texture() const {
        return target.getTexture();
    }

    ofPixels readPixels(bool flipVertically = true) const {
        ofPixels pixels;
        if (!isAllocated()) return pixels;
        target.readToPixels(pixels);
        if (flipVertically) pixels.mirror(true, false);
        return pixels;
    }

    bool savePng(const std::string& path, bool flipVertically = true) const {
        if (path.empty()) return false;
        const ofPixels pixels = readPixels(flipVertically);
        return pixels.isAllocated() && ofSaveImage(pixels, path);
    }

private:
    static void drawTransparencyGrid(const ofRectangle& bounds, float tileSize) {
        tileSize = std::max(1.0f, tileSize);
        for (float tileY = 0.0f; tileY < bounds.height; tileY += tileSize) {
            for (float tileX = 0.0f; tileX < bounds.width; tileX += tileSize) {
                const auto column = static_cast<int>(tileX / tileSize);
                const auto row = static_cast<int>(tileY / tileSize);
                ofSetColor(((column + row) % 2 == 0) ? 52 : 72);
                ofDrawRectangle(bounds.x + tileX, bounds.y + tileY,
                                std::min(tileSize, bounds.width - tileX),
                                std::min(tileSize, bounds.height - tileY));
            }
        }
    }

    ofFbo target;
};

} // namespace ofxOGraf
