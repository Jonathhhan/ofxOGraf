meta:
    ADDON_NAME = ofxOGraf
    ADDON_DESCRIPTION = Tool-neutral openFrameworks broadcast graphics authoring and OGraf runtime
    ADDON_AUTHOR = Jonathan Frank
    ADDON_TAGS = "graphics" "broadcast" "ograf" "emscripten"
    ADDON_URL = https://github.com/jfrank/ofxOGraf

common:
    ADDON_INCLUDES = src
    # ofxImGui is intentionally optional. Adding it to an application's
    # addons.make defines ofxAddons_ENABLE_IMGUI and activates the adapter.
