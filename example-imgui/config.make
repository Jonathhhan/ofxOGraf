# Native ofxImGui inspector example. Dependencies are declared in addons.make.
# These flags enable the browser/WebGL 2 target while retaining the native
# Visual Studio project-generator configuration.
# Serve with emrun, but do not link Emscripten's legacy self-closing wrapper.
# Force the openFrameworks engine. The GLES engine is intentionally incomplete;
# EngineOpenFrameworks uses Dear ImGui's OpenGL 3 backend with WebGL 2.
PROJECT_CFLAGS += -DOFXIMGUI_BACKEND_OPENFRAMEWORKS
PROJECT_LDFLAGS += -sMAIN_MODULE=0
PROJECT_LDFLAGS += -sALLOW_MEMORY_GROWTH=1
PROJECT_LDFLAGS += -sMIN_WEBGL_VERSION=2
PROJECT_LDFLAGS += -sMAX_WEBGL_VERSION=2
PROJECT_LDFLAGS += -sENVIRONMENT=web,worker
PROJECT_LDFLAGS += -sEMBIND_AOT=0
