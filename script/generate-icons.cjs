/**
 * PWA Icon Generator — generates all required icon sizes from favicon.png
 * Run: node script/generate-icons.cjs
 */
const sharp = require("sharp");
const { mkdirSync, existsSync } = require("fs");
const { join } = require("path");

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICON_DIR = join(__dirname, "..", "client", "public", "icons");
const SOURCE = join(__dirname, "..", "client", "public", "favicon.png");

if (!existsSync(ICON_DIR)) mkdirSync(ICON_DIR, { recursive: true });
if (!existsSync(SOURCE)) { console.error("Source not found:", SOURCE); process.exit(1); }

async function run() {
  for (const size of SIZES) {
    await sharp(SOURCE)
      .resize(size, size, { fit: "contain", background: { r: 6, g: 6, b: 15, alpha: 1 } })
      .png()
      .toFile(join(ICON_DIR, `icon-${size}x${size}.png`));
    console.log(`✓ icon-${size}x${size}.png`);
  }

  // Maskable icon with safe-area padding
  const ms = 512;
  const inner = Math.round(ms * 0.7);
  const pad = Math.round((ms - inner) / 2);

  const innerBuf = await sharp(SOURCE)
    .resize(inner, inner, { fit: "contain", background: { r: 6, g: 6, b: 15, alpha: 1 } })
    .png()
    .toBuffer();

  await sharp({ create: { width: ms, height: ms, channels: 4, background: { r: 12, g: 12, b: 29, alpha: 255 } } })
    .composite([{ input: innerBuf, left: pad, top: pad }])
    .png()
    .toFile(join(ICON_DIR, `maskable-${ms}x${ms}.png`));
  console.log(`✓ maskable-${ms}x${ms}.png`);

  console.log(`\n✅ All icons generated in client/public/icons/`);
}

run().catch(e => { console.error(e); process.exit(1); });
