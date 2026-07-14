import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { inflateSync } from "node:zlib";

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function paeth(left, up, upLeft) {
    const estimate = left + up - upLeft;
    const leftDistance = Math.abs(estimate - left);
    const upDistance = Math.abs(estimate - up);
    const upLeftDistance = Math.abs(estimate - upLeft);
    return leftDistance <= upDistance && leftDistance <= upLeftDistance ? left
        : upDistance <= upLeftDistance ? up : upLeft;
}

async function decodeRgbaPng(path) {
    const png = await readFile(path);
    assert.ok(png.subarray(0, 8).equals(signature), `${path} is not a PNG`);

    let offset = 8;
    let width = 0;
    let height = 0;
    const idat = [];
    while (offset < png.length) {
        const length = png.readUInt32BE(offset);
        const type = png.subarray(offset + 4, offset + 8).toString("ascii");
        const data = png.subarray(offset + 8, offset + 8 + length);
        offset += length + 12;
        if (type === "IHDR") {
            width = data.readUInt32BE(0);
            height = data.readUInt32BE(4);
            assert.equal(data[8], 8, "golden frames must use 8-bit PNG channels");
            assert.equal(data[9], 6, "golden frames must use RGBA PNG");
            assert.equal(data[12], 0, "interlaced PNG golden frames are unsupported");
        } else if (type === "IDAT") {
            idat.push(data);
        } else if (type === "IEND") {
            break;
        }
    }

    assert.ok(width > 0 && height > 0 && idat.length > 0, "PNG is missing image data");
    const packed = inflateSync(Buffer.concat(idat));
    const stride = width * 4;
    assert.equal(packed.length, height * (stride + 1), "unexpected PNG scanline size");
    const pixels = Buffer.alloc(width * height * 4);
    for (let row = 0; row < height; ++row) {
        const sourceOffset = row * (stride + 1);
        const filter = packed[sourceOffset];
        for (let column = 0; column < stride; ++column) {
            const source = packed[sourceOffset + 1 + column];
            const destination = row * stride + column;
            const left = column >= 4 ? pixels[destination - 4] : 0;
            const up = row > 0 ? pixels[destination - stride] : 0;
            const upLeft = row > 0 && column >= 4 ? pixels[destination - stride - 4] : 0;
            if (filter === 0) pixels[destination] = source;
            else if (filter === 1) pixels[destination] = (source + left) & 255;
            else if (filter === 2) pixels[destination] = (source + up) & 255;
            else if (filter === 3) pixels[destination] = (source + Math.floor((left + up) / 2)) & 255;
            else if (filter === 4) pixels[destination] = (source + paeth(left, up, upLeft)) & 255;
            else throw new Error(`unsupported PNG filter ${filter}`);
        }
    }
    return { width, height, pixels };
}

function alphaSummary(pixels) {
    let transparent = 0;
    let translucent = 0;
    let opaque = 0;
    for (let offset = 3; offset < pixels.length; offset += 4) {
        if (pixels[offset] === 0) ++transparent;
        else if (pixels[offset] === 255) ++opaque;
        else ++translucent;
    }
    return { transparent, translucent, opaque };
}

function parseArguments(argumentsList) {
    const positional = [];
    let tolerance = 2;
    let maxDifferent = 0;
    let requireAlpha = false;
    for (let index = 0; index < argumentsList.length; ++index) {
        const argument = argumentsList[index];
        if (argument === "--tolerance") tolerance = Number(argumentsList[++index]);
        else if (argument === "--max-different") maxDifferent = Number(argumentsList[++index]);
        else if (argument === "--require-alpha") requireAlpha = true;
        else positional.push(argument);
    }
    assert.equal(positional.length, 2, "usage: verify-golden-frame.mjs <actual.png> <golden.png> [--tolerance N] [--max-different N] [--require-alpha]");
    return { actual: positional[0], golden: positional[1], tolerance, maxDifferent, requireAlpha };
}

const options = parseArguments(process.argv.slice(2));
const [actual, golden] = await Promise.all([decodeRgbaPng(options.actual), decodeRgbaPng(options.golden)]);
assert.equal(actual.width, golden.width, "frame width differs from golden");
assert.equal(actual.height, golden.height, "frame height differs from golden");

let differentPixels = 0;
let maximumDifference = 0;
for (let offset = 0; offset < actual.pixels.length; offset += 4) {
    const actualAlpha = actual.pixels[offset + 3];
    const goldenAlpha = golden.pixels[offset + 3];
    if (actualAlpha === 0 && goldenAlpha === 0) continue;
    let pixelDifference = 0;
    for (let channel = 0; channel < 4; ++channel) {
        pixelDifference = Math.max(pixelDifference, Math.abs(actual.pixels[offset + channel] - golden.pixels[offset + channel]));
    }
    maximumDifference = Math.max(maximumDifference, pixelDifference);
    if (pixelDifference > options.tolerance) ++differentPixels;
}
assert.ok(differentPixels <= options.maxDifferent,
    `${differentPixels} pixels exceed tolerance ${options.tolerance} (max difference ${maximumDifference})`);

const alpha = alphaSummary(actual.pixels);
if (options.requireAlpha) {
    assert.ok(alpha.transparent > 0, "frame has no transparent pixels");
    assert.ok(alpha.translucent > 0, "frame has no translucent pixels");
}
console.log(JSON.stringify({ width: actual.width, height: actual.height, differentPixels, maximumDifference, alpha }));
