# Emscripten/WebGL 2 additions. Native project-generator settings remain valid.

# Compile the same procedural template factory in native and WebAssembly builds.
PROJECT_EXTERNAL_SOURCE_PATHS += ../examples/native-authoring
PROJECT_CFLAGS += -fexceptions
PROJECT_LDFLAGS += -fexceptions
PROJECT_LDFLAGS += -sMAIN_MODULE=0
PROJECT_LDFLAGS += -sALLOW_MEMORY_GROWTH=1
PROJECT_LDFLAGS += -sMIN_WEBGL_VERSION=2
PROJECT_LDFLAGS += -sMAX_WEBGL_VERSION=2
PROJECT_LDFLAGS += -sENVIRONMENT=web,worker
PROJECT_LDFLAGS += -sNO_DISABLE_EXCEPTION_CATCHING

# The localhost preview remains a classic script. OGraf loads its runtime
# through dynamic import(), so its packaging build explicitly requests ESM.
ifeq ($(OGRAF_BUILD),1)
PROJECT_LDFLAGS += -sMODULARIZE=1
PROJECT_LDFLAGS += -sEXPORT_ES6=1
PROJECT_LDFLAGS += -sEXPORT_NAME=createOfxOGrafModule
endif

ifeq ($(OGRAF_TEST),1)
PROJECT_LDFLAGS += -sASSERTIONS=1
endif

# Keep the browser HarfBuzz fixture and its redistributable CI font fallback
# inside Emscripten's packaged data. Local projects may provide their own
# ArialMT-compatible files; GitHub's Ubuntu runner supplies DejaVu Sans.
ifeq ($(PLATFORM_OS),emscripten)
$(shell mkdir -p bin/data/fonts)
$(shell cp -f ../tests/fixtures/harfbuzz-arabic.scene.json bin/data/)
$(shell test -s bin/data/fonts/ArialMT.ttf || \
    cp -f /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf bin/data/fonts/ArialMT.ttf)
$(if $(wildcard bin/data/fonts/ArialMT.ttf),,$(error Missing bin/data/fonts/ArialMT.ttf))
endif
