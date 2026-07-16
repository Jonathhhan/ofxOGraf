# Browser build settings and tutorial assets.
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
PROJECT_LDFLAGS += --preload-file ../examples/ograf-dev-lower-third.scene.json@/data/ograf-dev-lower-third.scene.json
PROJECT_LDFLAGS += --preload-file ../examples/ograf-dev-bug.scene.json@/data/ograf-dev-bug.scene.json
PROJECT_LDFLAGS += --preload-file ../examples/ograf-dev-ticker.scene.json@/data/ograf-dev-ticker.scene.json
PROJECT_LDFLAGS += --preload-file ../examples/ograf-dev-score-bug.scene.json@/data/ograf-dev-score-bug.scene.json
