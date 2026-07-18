# Browser build settings. Tutorial scene files are copied into bin/data before
# the build so openFrameworks' standard Emscripten data packaging includes them.
PROJECT_CFLAGS += -fexceptions
PROJECT_LDFLAGS += -fexceptions
PROJECT_LDFLAGS += -sALLOW_MEMORY_GROWTH=1
PROJECT_LDFLAGS += -sMIN_WEBGL_VERSION=2
PROJECT_LDFLAGS += -sMAX_WEBGL_VERSION=2
PROJECT_LDFLAGS += -sENVIRONMENT=web
PROJECT_LDFLAGS += -sNO_DISABLE_EXCEPTION_CATCHING
# The tutorial has no Embind API. openFrameworks enables EMBIND_AOT globally,
# which currently crashes Emscripten's signature generator for this target.
PROJECT_LDFLAGS += -sEMBIND_AOT=0
