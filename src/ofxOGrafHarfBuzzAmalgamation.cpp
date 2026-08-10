// HarfBuzz is kept byte-identical to its pinned upstream release. Suppress
// vendor diagnostics only while compiling its supported simplified entry point.
#ifdef _MSC_VER
#pragma warning(push, 0)
#endif

#include "../libs/harfbuzz/src/harfbuzz.cc"

#ifdef _MSC_VER
#pragma warning(pop)
#endif
