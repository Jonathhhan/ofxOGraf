const STYLE_PROPERTIES = new Set([
    "color", "fontFamily", "fontSize", "fontStyle", "fontWeight", "fontStretch",
    "fontFeatureSettings", "fontKerning", "fontVariationSettings", "letterSpacing",
    "lineHeight", "textAlign", "textDecoration", "textShadow", "textTransform",
    "whiteSpace", "wordBreak", "overflowWrap", "opacity"
]);

export default class CssTextOverlay {
    constructor(host) {
        this.host = host;
        this.root = document.createElement("div");
        this.root.className = "ofxograf-css-text-overlay";
        this.root.style.cssText = "position:absolute;left:0;top:0;pointer-events:none;overflow:hidden;transform-origin:0 0";
        this.elements = [];
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.fontFamilies = new Map();
    }

    async load(definition, composition) {
        this.clear();
        const overlays = Array.isArray(definition?.htmlTextOverlays) ? definition.htmlTextOverlays : [];
        if (!overlays.length) return;
        this.composition = composition;
        this.root.style.width = `${composition.width}px`;
        this.root.style.height = `${composition.height}px`;
        this.host.appendChild(this.root);
        this.resizeObserver.observe(this.host);
        await this.loadFonts(definition, overlays);
        for (const descriptor of overlays) this.createElement(descriptor);
        this.resize();
    }

    async loadFonts(definition, overlays) {
        if (typeof FontFace !== "function" || !document.fonts) return;
        const assets = new Map((definition?.assets || []).map(asset => [asset.id, asset]));
        const requested = new Map();
        for (const overlay of overlays) {
            if (!overlay.fontAssetId || requested.has(overlay.fontAssetId)) continue;
            const asset = assets.get(overlay.fontAssetId);
            if (asset?.kind !== "font" || !asset.uri) continue;
            const family = overlay.style?.fontFamily || `ofxograf-${overlay.fontAssetId}`;
            const fontUrl = "./data/" + asset.uri;
            requested.set(overlay.fontAssetId, new FontFace(family, "url(" + JSON.stringify(fontUrl) + ")"));
            this.fontFamilies.set(overlay.fontAssetId, family);
        }
        await Promise.all([...requested.values()].map(async font => {
            document.fonts.add(await font.load());
        }));
    }

    createElement(descriptor) {
        const element = document.createElement("div");
        element.dataset.overlayId = descriptor.id;
        const rect = descriptor.rect;
        Object.assign(element.style, {
            position: "absolute",
            left: `${rect.x}px`, top: `${rect.y}px`,
            width: `${rect.width}px`, height: `${rect.height}px`,
            overflow: "hidden"
        });
        if (descriptor.fontAssetId && !descriptor.style?.fontFamily) element.style.fontFamily = this.fontFamilies.get(descriptor.fontAssetId) || "";
        for (const [property, value] of Object.entries(descriptor.style || {})) {
            if (STYLE_PROPERTIES.has(property)) element.style[property] = String(value);
        }
        this.root.appendChild(element);
        this.elements.push({ descriptor, element });
    }

    update(data = {}) {
        for (const { descriptor, element } of this.elements) {
            const value = Object.hasOwn(data, descriptor.dataKey) ? data[descriptor.dataKey] : descriptor.fallback;
            element.textContent = value === undefined || value === null ? "" : String(value);
            element.hidden = descriptor.visibleWhen ? data[descriptor.visibleWhen] !== true : false;
        }
    }

    resize() {
        if (!this.composition || !this.host.clientWidth || !this.host.clientHeight) return;
        this.root.style.transform = `scale(${this.host.clientWidth / this.composition.width},${this.host.clientHeight / this.composition.height})`;
    }

    clear() {
        this.resizeObserver.disconnect();
        this.root.remove();
        this.root.replaceChildren();
        this.fontFamilies.clear();
        this.elements = [];
        this.composition = null;
    }
}
