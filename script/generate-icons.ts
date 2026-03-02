/**
 * PWA Icon Generator — generates all required icon sizes from favicon.png
 * Run: npx tsx script/generate-icons.ts
 */
import { execSync } from "child_process";
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const ICON_DIR = join(process.cwd(), "client/public/icons");
const SOURCE = join(process.cwd(), "client/public/favicon.png");

// Create icons dir
if (!existsSync(ICON_DIR)) {
  mkdirSync(ICON_DIR, { recursive: true });
}

// Check if source exists
if (!existsSync(SOURCE)) {
  console.error("❌ Source favicon.png not found at:", SOURCE);
  process.exit(1);
}

// Try using sharp (if available), otherwise create placeholder SVGs
async function generateIcons() {
  let sharp: any;
  try {
    sharp = (await import("sharp")).default;
  } catch {
    console.log("sharp not installed. Installing...");
    execSync("npm install sharp --save-dev", { stdio: "inherit" });
    sharp = (await import("sharp")).default;
  }

  const source = readFileSync(SOURCE);

  for (const size of SIZES) {
    const outFile = join(ICON_DIR, `icon-${size}x${size}.png`);
    await sharp(source)
      .resize(size, size, { fit: "contain", background: { r: 6, g: 6, b: 15, alpha: 1 } })
      .png()
      .toFile(outFile);
    console.log(`✓ icon-${size}x${size}.png`);
  }

  // Maskable icon (with padding for safe area — 80% of 512)
  const maskableSize = 512;
  const innerSize = Math.round(maskableSize * 0.7);
  const padding = Math.round((maskableSize - innerSize) / 2);

  const inner = await sharp(source)
    .resize(innerSize, innerSize, { fit: "contain", background: { r: 6, g: 6, b: 15, alpha: 1 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: maskableSize,
      height: maskableSize,
      channels: 4,
      background: { r: 12, g: 12, b: 29, alpha: 1 }, // #0c0c1d
    },
  })
    .composite([{ input: inner, left: padding, top: padding }])
    .png()
    .toFile(join(ICON_DIR, `maskable-${maskableSize}x${maskableSize}.png`));

  console.log(`✓ maskable-${maskableSize}x${maskableSize}.png`);
  console.log(`\n✅ All ${SIZES.length + 1} icons generated in client/public/icons/`);
}

generateIcons().catch((err) => {
  console.error("Icon generation failed:", err.message);
  console.log("\n📋 Manual alternative:");
  console.log("   Use https://www.pwabuilder.com/imageGenerator to generate icons from favicon.png");
  console.log("   Place them in client/public/icons/");
});
