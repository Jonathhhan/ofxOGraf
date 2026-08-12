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

test("tutorial renders the Arabic HarfBuzz scene", async ({ page }) => {
    test.setTimeout(45_000);
    const browserErrors = [];
    const shapingFailures = [];
    page.on("console", message => {
        const text = message.text();
        if (message.type() === "error") browserErrors.push(text);
        if (text.includes("ofxOGraf.HarfBuzz") ||
            text.includes("Arabic headline") && text.includes("text.shaping-unsupported")) {
            shapingFailures.push(text);
        }
    });
    page.on("pageerror", error => browserErrors.push(error.message));

    const tutorialPath = process.env.OFXOGRAF_TUTORIAL_PATH ?? "/ograf/tutorials/";
    await page.goto(`${tutorialPath}?tutorial=harfbuzz`, { waitUntil: "load" });
    await page.waitForTimeout(10_000);

    // The white Arabic headline lands outside the selector around viewport
    // x=320..840, y=380..540. Inspect compositor pixels so a compiled but
    // blank HarfBuzz renderer cannot pass merely because its files exist.
    const image = PNG.sync.read(await page.screenshot());
    expect(countBrightPixels(image, { x: 320, y: 380, width: 520, height: 160 })).toBeGreaterThan(500);

    expect(shapingFailures).toEqual([]);
    expect(browserErrors).toEqual([]);
});
