import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const [header, implementation, loader, renderSurface, example, basicMain, imguiExample, imguiMain, schemaText, wrapper, renderer, assetsHeader, assetsImplementation] = await Promise.all([
    readFile(new URL("src/ofxOGrafAuthoring.h", root), "utf8"),
    readFile(new URL("src/ofxOGrafAuthoring.cpp", root), "utf8"),
    readFile(new URL("src/ofxOGrafSceneLoader.cpp", root), "utf8"),
    readFile(new URL("src/ofxOGrafRenderSurface.h", root), "utf8"),
    readFile(new URL("example-basic/src/ofApp.cpp", root), "utf8"),
    readFile(new URL("example-basic/src/main.cpp", root), "utf8"),
    readFile(new URL("example-imgui/src/ofApp.cpp", root), "utf8"),
    readFile(new URL("example-imgui/src/main.cpp", root), "utf8"),
    readFile(new URL("schema/broadcast-scene-0.3.schema.json", root), "utf8"),
    readFile(new URL("ograf/OfBroadcastGraphic.js", root), "utf8"),
    readFile(new URL("src/ofxOGrafRendererShapes.cpp", root), "utf8"),
    readFile(new URL("src/ofxOGrafAssets.h", root), "utf8"),
    readFile(new URL("src/ofxOGrafAssets.cpp", root), "utf8")
]);
const schema = JSON.parse(schemaText);

for (const token of [
    "SceneBuilder", "CompositionBuilder", "TextLayerBuilder", "ShapeLayerBuilder",
    "ControlBuilder", "RationalFrameRate", "AuthoringKeyframe", "animate", "stableId", "canonicalJson"
]) assert.ok(header.includes(token), `missing authoring API: ${token}`);

for (const token of [
    "rootCompositionId", "requiredExtensions", "targetId", "cc.openframeworks.ofxograf.builder"
]) assert.ok(implementation.includes(token), `missing neutral authoring contract: ${token}`);

assert.doesNotMatch(header + implementation, /ADBE|After Effects/);
assert.equal(schema.properties.format.const, "broadcast-scene");
assert.equal(schema.properties.version.pattern, "^0\\.3\\.[0-9]+$");
assert.ok(schema.$defs.composition);
assert.ok(schema.$defs.control);
assert.ok(schema.$defs.extensions);
assert.match(loader, /compileNeutral03/);
assert.match(loader, /rootCompositionId/);
assert.match(example, /SceneBuilder/);
assert.match(example, /scene\.animate/);
assert.match(renderSurface, /class RenderSurface/);
assert.match(renderSurface, /ofFbo::Settings/);
assert.match(renderSurface, /internalformat = GL_RGBA/);
assert.match(renderSurface, /ofClear\(0, 0, 0, 0\)/);
assert.match(renderSurface, /#ifdef __EMSCRIPTEN__/);
assert.match(renderSurface, /useStencil = false/);
assert.match(renderSurface, /useStencil = true/);
assert.match(renderer, /GL_STENCIL_BITS/);
assert.match(renderer, /warnedStencilLayers/);
assert.match(renderer, /return false;/);
assert.match(assetsHeader, /warnings\(\) const/);
assert.match(assetsImplementation, /validateDeclaredAssets/);
assert.match(assetsImplementation, /unavailableFontPaths/);
assert.match(assetsImplementation, /unavailableImagePaths/);
assert.match(assetsImplementation, /warnOnce/);
assert.match(renderSurface, /glBlendFunc\(GL_ONE, GL_ONE_MINUS_SRC_ALPHA\)/);
assert.match(renderSurface, /fittedBounds/);
assert.match(renderSurface, /ofTexture& texture\(\)/);
assert.match(example, /preview\.allocate\(broadcastGraphic\.getScene\(\)\)/);
assert.match(example, /preview\.render\(broadcastGraphic\)/);
assert.match(example, /preview\.drawFit/);
assert.match(example, /headline\.position\(\{260\.0, 740\.0, 0\.0\}\)/);
assert.match(example, /panel\.position\(\{720\.0, 700\.0, 0\.0\}\)/);
assert.match(basicMain, /setSize\(1280, 720\)/);
assert.match(example, /broadcastGraphic\.play\(\)/);
assert.doesNotMatch(basicMain, /GLFW/);
assert.match(example, /loadJson\(scene\.build\(\)\)/);
assert.match(wrapper, /compositionInfo\(scene/);
assert.match(imguiExample, /SceneBuilder/);
assert.match(imguiExample, /controls\.draw\(graphic/);
assert.match(imguiExample, /preview\.allocate\(graphic\.getScene\(\)\)/);
assert.match(imguiExample, /preview\.render\(graphic\)/);
assert.match(imguiExample, /preview\.drawFit/);
assert.match(imguiExample, /panelWidth/);
assert.match(imguiExample, /fontSizeChanged/);
assert.doesNotMatch(example + imguiExample, /ofFbo::Settings|renderTarget/);
assert.doesNotMatch(imguiMain, /GLFW/);
assert.match(wrapper, /this\.canvas\.width = resolution[\s\S]*this\.module = await createOfxOGrafModule/,
    "canvas must be sized before WebGL module creation");

console.log("Validated tool-neutral SceneBuilder, 0.3 schema, loader compiler, and native OF example.");
assert.match(renderSurface, /ofPixels readPixels/);
assert.match(renderSurface, /savePng/);
assert.match(basicMain, /--frame/);
