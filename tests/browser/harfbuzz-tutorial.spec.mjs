import { expect, test } from "@playwright/test";
import { PNG } from "pngjs";

function countBrightPixels(image, region) {
    let count = 0;
    for (let y = region.y; y < Math.min(region.y + region.height, image.height); ++y) {
        for (let x = region.x; x < Math.min(region.x + region.width, image.width); ++x) {
            const index = (y * image.width + x) * 4;
            if (image.data[index] > 180 && image.data[index + 1] > 180 &&
                image.data[index + 2] > 180 && image.data[index + 3] > 0) {
                count += 1;
            }
        }
    }
    return count;
}

function countDarkPixels(image, region) {
    let count = 0;
    for (let y = region.y; y < Math.min(region.y + region.height, image.height); ++y) {
        for (let x = region.x; x < Math.min(region.x + region.width, image.width); ++x) {
            const index = (y * image.width + x) * 4;
            if (image.data[index] < 40 && image.data[index + 1] < 40 &&
                image.data[index + 2] < 40 && image.data[index + 3] > 0) {
                count += 1;
            }
        }
    }
    return count;
}

function brightBounds(image, region) {
    let left = region.x + region.width;
    let top = region.y + region.height;
    let right = -1;
    let bottom = -1;
    for (let y = region.y; y < Math.min(region.y + region.height, image.height); ++y) {
        for (let x = region.x; x < Math.min(region.x + region.width, image.width); ++x) {
            const index = (y * image.width + x) * 4;
            if (image.data[index] > 128 && image.data[index + 1] > 128 && image.data[index + 2] > 128) {
                left = Math.min(left, x);
                top = Math.min(top, y);
                right = Math.max(right, x);
                bottom = Math.max(bottom, y);
            }
        }
    }
    return { left, top, right, bottom };
}

function normalizedMask(image, bounds, width = 320, height = 96) {
    const mask = new Uint8Array(width * height);
    const sourceWidth = bounds.right - bounds.left + 1;
    const sourceHeight = bounds.bottom - bounds.top + 1;
    for (let y = 0; y < height; ++y) {
        for (let x = 0; x < width; ++x) {
            const sourceX = bounds.left + Math.min(sourceWidth - 1, Math.floor((x + 0.5) * sourceWidth / width));
            const sourceY = bounds.top + Math.min(sourceHeight - 1, Math.floor((y + 0.5) * sourceHeight / height));
            const index = (sourceY * image.width + sourceX) * 4;
            mask[y * width + x] = image.data[index] > 128 && image.data[index + 1] > 128 &&
                image.data[index + 2] > 128 ? 1 : 0;
        }
    }
    return mask;
}

function intersectionOverUnion(a, b) {
    let intersection = 0;
    let union = 0;
    for (let index = 0; index < a.length; ++index) {
        if (a[index] || b[index]) ++union;
        if (a[index] && b[index]) ++intersection;
    }
    return intersection / union;
}

const shapingCases = [
    { tutorial: "arabic", script: "Arabic", layer: "Arabic headline" },
    { tutorial: "hebrew", script: "Hebrew", layer: "Hebrew headline" },
    { tutorial: "devanagari", script: "Devanagari", layer: "Devanagari headline" }
];

for (const shapingCase of shapingCases) {
    test(`tutorial renders the ${shapingCase.script} HarfBuzz scene`, async ({ page }) => {
        test.setTimeout(45_000);
        const browserErrors = [];
        const shapingFailures = [];
        page.on("console", message => {
            const text = message.text();
            if (message.type() === "error") browserErrors.push(text);
            if (text.includes("ofxOGraf.HarfBuzz") ||
                text.includes(shapingCase.layer) && text.includes("text.shaping-unsupported")) {
                shapingFailures.push(text);
            }
        });
        page.on("pageerror", error => browserErrors.push(error.message));

        const tutorialPath = process.env.OFXOGRAF_TUTORIAL_PATH ?? "/ograf/tutorials/";
        await page.goto(`${tutorialPath}?tutorial=${shapingCase.tutorial}`, { waitUntil: "load" });
        await page.addStyleTag({ content: "html, body, canvas { background: #000 !important; }" });
        await page.waitForTimeout(10_000);

        // Every white headline lands outside the selector around viewport
        // x=320..840, y=380..540. Inspect compositor pixels so a compiled but
        // blank HarfBuzz renderer cannot pass merely because its files exist.
        const image = PNG.sync.read(await page.screenshot());
        const headlineRegion = { x: 320, y: 380, width: 520, height: 160 };
        const brightPixels = countBrightPixels(image, headlineRegion);
        expect(brightPixels).toBeGreaterThan(500);
        expect(brightPixels).toBeLessThan(15_000);
        expect(countDarkPixels(image, headlineRegion)).toBeGreaterThan(60_000);

        if (shapingCase.tutorial === "devanagari") {
            const tutorialMask = normalizedMask(image, brightBounds(image, headlineRegion));
            const referencePath = process.env.OFXOGRAF_DEVANAGARI_REFERENCE_PATH ??
                "/tests/browser/devanagari-reference.html";
            await page.goto(referencePath, { waitUntil: "load" });
            await page.evaluate(() => document.fonts.ready);
            const referenceImage = PNG.sync.read(await page.screenshot());
            const referenceRegion = { x: 0, y: 0, width: referenceImage.width, height: referenceImage.height };
            const referenceMask = normalizedMask(referenceImage, brightBounds(referenceImage, referenceRegion));
            expect(intersectionOverUnion(tutorialMask, referenceMask)).toBeGreaterThan(0.7);
        }

        expect(shapingFailures).toEqual([]);
        expect(browserErrors).toEqual([]);
    });
}
