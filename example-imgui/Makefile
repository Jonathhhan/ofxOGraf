# Emscripten entry point. Native Visual Studio projects remain generated and
# maintained separately by the openFrameworks Project Generator.
ifneq ($(wildcard config.make),)
    include config.make
endif

ifndef OF_ROOT
    OF_ROOT=../../..
endif

include $(OF_ROOT)/libs/openFrameworksCompiled/project/makefileCommon/compile.project.mk
