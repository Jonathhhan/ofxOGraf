meta:
    ADDON_NAME = ofxOGraf
    ADDON_DESCRIPTION = Tool-neutral openFrameworks broadcast graphics authoring and OGraf runtime
    ADDON_AUTHOR = Jonathan Frank
    ADDON_TAGS = "graphics" "broadcast" "ograf" "emscripten"
    ADDON_URL = https://github.com/jfrank/ofxOGraf

common:
    ADDON_INCLUDES = src libs/harfbuzz/src
    # Keep the upstream HarfBuzz implementation behind its supported
    # simplified-build entry point; compiling its component .cc files as well
    # would duplicate every symbol.
    ADDON_SOURCES = src/ofxOGrafAssets.cpp
    ADDON_SOURCES += src/ofxOGrafAuthoring.cpp
    ADDON_SOURCES += src/ofxOGrafCodeTemplate.cpp
    ADDON_SOURCES += src/ofxOGrafCodeTemplateRegistry.cpp
    ADDON_SOURCES += src/ofxOGrafControls.cpp
    ADDON_SOURCES += src/ofxOGrafExtensions.cpp
    ADDON_SOURCES += src/ofxOGrafGraphic.cpp
    ADDON_SOURCES += src/ofxOGrafHarfBuzz.cpp
    ADDON_SOURCES += src/ofxOGrafHarfBuzzAmalgamation.cpp
    ADDON_SOURCES += src/ofxOGrafImGuiControls.cpp
    ADDON_SOURCES += src/ofxOGrafRenderer.cpp
    ADDON_SOURCES += src/ofxOGrafRendererShapes.cpp
    ADDON_SOURCES += src/ofxOGrafScene.cpp
    ADDON_SOURCES += src/ofxOGrafSceneLoader.cpp
    ADDON_SOURCES += src/ofxOGrafTimeline.cpp
    # ofxImGui is intentionally optional. Adding it to an application's
    # addons.make defines ofxAddons_ENABLE_IMGUI and activates the adapter.
