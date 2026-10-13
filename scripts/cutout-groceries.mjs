// Turns the raw grocery photos in public/groceries into transparent,
// uniformly-sized cut-outs in public/groceries/cutout, so the rail's tile
// background (and therefore the light/dark theme) shows through.
// Run: node scripts/cutout-groceries.mjs
import sharp from "sharp";
import { readdirSync, mkdirSync } from "node:fs";

const SRC = "public/groceries";
const OUT = `${SRC}/cutout`;
const W = 424; // 2x the 212px tile
const H = 276; // 2x the 138px tile
const PAD = 0.08;
const HARD = 248; // >= this on every channel is certainly background
const SOFT = 228; // between SOFT and HARD fades out (anti-aliased edge)

// Per-photo fixes, in source px: cut a grey floor line / drop shadow that the
// near-white flood fill can't tell from the product.
const FIX = {
  "milo.jpeg": { cropRight: 142, cropBottom: 203 },
  "indomiecarton.jpeg": { cropBottom: 70 },
};

mkdirSync(OUT, { recursive: true });

for (const file of readdirSync(SRC).filter((f) => /\.jpe?g$/i.test(f))) {
  // Upscale first so the edge mask is smooth, then cut out.
  const fix = FIX[file] ?? {};
  const meta = await sharp(`${SRC}/${file}`).metadata();
  const scale = 2;
  const w = (meta.width - (fix.cropRight ?? 0)) * scale;
  const srcW = meta.width - (fix.cropRight ?? 0);
  const srcH = meta.height - (fix.cropBottom ?? 0);
  const h = srcH * scale;
  const { data } = await sharp(`${SRC}/${file}`)
    .extract({ left: 0, top: 0, width: srcW, height: srcH })
    .resize(w, h, { kernel: "lanczos3" })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const min = (i) => Math.min(data[i], data[i + 1], data[i + 2]);
  const isBg = (i) => min(i) >= SOFT;
  const bg = new Uint8Array(w * h); // 1 = reachable background
  const stack = [];
  const push = (x, y) => {
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const p = y * w + x;
    if (bg[p] || !isBg(p * 3)) return;
    bg[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (stack.length) {
    const p = stack.pop();
    const x = p % w, y = (p / w) | 0;
    push(x + 1, y); push(x - 1, y); push(x, y + 1); push(x, y - 1);
  }

  const rgba = Buffer.alloc(w * h * 4);
  for (let p = 0; p < w * h; p++) {
    const m = min(p * 3);
    let a = 255;
    if (bg[p]) a = m >= HARD || m < SOFT ? 0 : Math.round(((HARD - m) / (HARD - SOFT)) * 255);
    rgba[p * 4] = data[p * 3];
    rgba[p * 4 + 1] = data[p * 3 + 1];
    rgba[p * 4 + 2] = data[p * 3 + 2];
    rgba[p * 4 + 3] = a;
  }

  // Erode the matte by a hair to kill the white fringe, then trim + fit.
  const cut = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .png()
    .toBuffer();
  const trimmed = await sharp(cut).trim({ threshold: 10 }).toBuffer();
  const fitted = await sharp(trimmed)
    .resize(Math.round(W * (1 - PAD * 2)), Math.round(H * (1 - PAD * 2)), {
      fit: "inside",
      kernel: "lanczos3",
    })
    .sharpen({ sigma: 0.8 })
    .toBuffer();
  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: fitted, gravity: "centre" }])
    .webp({ quality: 90, alphaQuality: 100 })
    .toFile(`${OUT}/${file.replace(/\.jpe?g$/i, ".webp")}`);
  console.log("done", file);
}
