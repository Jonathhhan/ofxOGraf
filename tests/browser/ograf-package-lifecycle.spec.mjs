import { expect, test } from "@playwright/test";

test("compiled CodeTemplate completes the OGraf lifecycle", async ({ page }) => {
    const browserErrors = [];
    page.on("console", message => {
        if (message.type() === "error") browserErrors.push(message.text());
    });
    page.on("pageerror", error => browserErrors.push(error.message));

    await page.goto("/example-ograf-package/", { waitUntil: "load" });
    await expect(page.locator("#status")).toHaveAttribute("data-state", "pass", { timeout: 20_000 });

    const result = await page.evaluate(() => window.__ofxOGrafExampleResult);
    expect(result?.state).toBe("pass");
    expect(result?.steps?.map(step => step.name)).toEqual([
        "load",
        "playAction",
        "updateAction",
        "stopAction",
        "dispose"
    ]);
    expect(result.steps.every(step => step.passed && step.result?.statusCode === 200)).toBe(true);
    expect(browserErrors).toEqual([]);
});
