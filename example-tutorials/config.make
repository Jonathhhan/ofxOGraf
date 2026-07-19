# Browser build settings.
PROJECT_CFLAGS += -fexceptions
PROJECT_LDFLAGS += -fexceptions
PROJECT_LDFLAGS += -sALLOW_MEMORY_GROWTH=1
PROJECT_LDFLAGS += -sMIN_WEBGL_VERSION=2
PROJECT_LDFLAGS += -sMAX_WEBGL_VERSION=2
PROJECT_LDFLAGS += -sENVIRONMENT=web
PROJECT_LDFLAGS += -sNO_DISABLE_EXCEPTION_CATCHING

# openFrameworks automatically packages bin/data for Emscripten. Ensure the
# directory exists and contains the tutorial scenes and fonts before
# file_packager runs.
ifeq ($(PLATFORM_OS),emscripten)
# The OF Emscripten link step creates index.js, index.wasm and index.data as one
# artifact set. Running dependent link/package recipes in parallel can invoke
# file_packager while another recipe is still writing the same output.
.NOTPARALLEL:
$(shell mkdir -p bin/data/fonts)
$(shell cp -f ../examples/ograf-dev-lower-third.scene.json bin/data/)
$(shell cp -f ../examples/ograf-dev-bug.scene.json bin/data/)
$(shell cp -f ../examples/ograf-dev-ticker.scene.json bin/data/)
$(shell cp -f ../examples/ograf-dev-score-bug.scene.json bin/data/)

# The imported scenes request the PostScript names ArialMT and Arial-BoldMT.
# Keep project-provided files when present. GitHub's Ubuntu runner includes
# DejaVu Sans, so copy it under the requested filenames as a browser fallback.
$(shell test -s bin/data/fonts/ArialMT.ttf || \
    cp -f /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf bin/data/fonts/ArialMT.ttf)
$(shell test -s bin/data/fonts/Arial-BoldMT.ttf || \
    cp -f /usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf bin/data/fonts/Arial-BoldMT.ttf)
$(if $(wildcard bin/data/fonts/ArialMT.ttf),,$(error Missing bin/data/fonts/ArialMT.ttf))
$(if $(wildcard bin/data/fonts/Arial-BoldMT.ttf),,$(error Missing bin/data/fonts/Arial-BoldMT.ttf))
endif

# The tutorial has no Embind API. openFrameworks enables EMBIND_AOT globally,
# which currently crashes Emscripten's signature generator for this target.
PROJECT_LDFLAGS += -sEMBIND_AOT=0
