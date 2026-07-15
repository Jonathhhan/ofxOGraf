# Emscripten/WebGL 2 additions. Native project-generator settings remain valid.

# Compile the same procedural template factory in native and WebAssembly builds.
PROJECT_EXTERNAL_SOURCE_PATHS += ../examples/native-authoring
PROJECT_LDFLAGS += -sMAIN_MODULE=0
PROJECT_LDFLAGS += -sALLOW_MEMORY_GROWTH=1
PROJECT_LDFLAGS += -sMIN_WEBGL_VERSION=2
PROJECT_LDFLAGS += -sMAX_WEBGL_VERSION=2
PROJECT_LDFLAGS += -sENVIRONMENT=web,worker

# The localhost preview remains a classic script. OGraf loads its runtime
# through dynamic import(), so its packaging build explicitly requests ESM.
ifeq ($(OGRAF_BUILD),1)
PROJECT_LDFLAGS += -sMODULARIZE=1
PROJECT_LDFLAGS += -sEXPORT_ES6=1
PROJECT_LDFLAGS += -sEXPORT_NAME=createOfxOGrafModule
endif
