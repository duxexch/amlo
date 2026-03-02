/**
 * Aplo Brand Asset Generator
 * ═══════════════════════════
 * Generates: logo (SVG→PNG), favicon, PWA icons (9 sizes), maskable icon, og-image
 * Run: node script/generate-brand.cjs
 */
const sharp = require("sharp");
const { mkdirSync, writeFileSync, existsSync } = require("fs");
const { join } = require("path");

const PUBLIC = join(__dirname, "..", "client", "public");
const ICONS = join(PUBLIC, "icons");

mkdirSync(ICONS, { recursive: true });

// ═══════════════════════════════════════════════════════════
// LOGO SVG — Chat bubble + Play triangle (no text)
// Gradient: Purple → Violet → Pink
// ═══════════════════════════════════════════════════════════

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="play" x1="440" y1="320" x2="640" y2="560" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#d946ef"/>
    </linearGradient>
  </defs>

  <!-- Rounded square background -->
  <rect width="1024" height="1024" rx="224" fill="url(#bg)"/>

  <!-- Subtle inner highlight -->
  <rect x="24" y="24" width="976" height="488" rx="210"
        fill="white" fill-opacity="0.04"/>

  <!-- Chat bubble with tail -->
  <path d="M 370 210
           L 654 210
           C 703 210, 744 251, 744 300
           L 744 540
           C 744 589, 703 630, 654 630
           L 475 630
           L 365 755
           L 365 630
           C 316 630, 280 589, 280 540
           L 280 300
           C 280 251, 316 210, 370 210 Z"
        fill="white" fill-opacity="0.95"/>

  <!-- Play triangle -->
  <path d="M 460 335 L 460 545 L 625 440 Z" fill="url(#play)"/>
</svg>`;

// Maskable version: full-bleed, no rounded corners, 80% safe zone
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="play2" x1="440" y1="340" x2="620" y2="540" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#d946ef"/>
    </linearGradient>
  </defs>

  <!-- Full-bleed background (no border radius — OS crops) -->
  <rect width="1024" height="1024" fill="url(#bg2)"/>

  <!-- Bubble scaled to 80% safe zone (shifted slightly up to compensate tail) -->
  <path d="M 390 240
           L 634 240
           C 678 240, 714 276, 714 320
           L 714 520
           C 714 564, 678 600, 634 600
           L 485 600
           L 385 710
           L 385 600
           C 341 600, 310 564, 310 520
           L 310 320
           C 310 276, 341 240, 390 240 Z"
        fill="white" fill-opacity="0.95"/>

  <!-- Play triangle (safe zone) -->
  <path d="M 468 340 L 468 530 L 616 435 Z" fill="url(#play2)"/>
</svg>`;

// OG Image background (1200x630)
const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="ogbg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06060f"/>
      <stop offset="100%" stop-color="#0c0c1d"/>
    </linearGradient>
    <radialGradient id="glow1" cx="600" cy="280" r="350" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#a855f7" stop-opacity="0.18"/>
      <stop offset="70%" stop-color="#a855f7" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#a855f7" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="600" cy="350" r="200" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#ec4899" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#ec4899" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#ogbg)"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <!-- Subtle grid dots -->
  <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="20" cy="20" r="0.8" fill="white" fill-opacity="0.06"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#dots)"/>
</svg>`;

// Favicon SVG (for modern browsers)
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="fbg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7c3aed"/>
      <stop offset="50%" stop-color="#a855f7"/>
      <stop offset="100%" stop-color="#ec4899"/>
    </linearGradient>
    <linearGradient id="fp" x1="440" y1="320" x2="640" y2="560" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#8b5cf6"/>
      <stop offset="100%" stop-color="#d946ef"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="224" fill="url(#fbg)"/>
  <path d="M 370 210 L 654 210 C 703 210, 744 251, 744 300 L 744 540 C 744 589, 703 630, 654 630 L 475 630 L 365 755 L 365 630 C 316 630, 280 589, 280 540 L 280 300 C 280 251, 316 210, 370 210 Z" fill="white" fill-opacity="0.95"/>
  <path d="M 460 335 L 460 545 L 625 440 Z" fill="url(#fp)"/>
</svg>`;

// ═══════════════════════════════════════════════════════════
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  const logoBuffer = Buffer.from(LOGO_SVG);
  const maskBuffer = Buffer.from(MASKABLE_SVG);

  // ── 1. Favicon (PNG 512x512) ──
  console.log("→ favicon.png (512x512)");
  await sharp(logoBuffer).resize(512, 512).png({ quality: 100 }).toFile(join(PUBLIC, "favicon.png"));

  // ── 2. Favicon SVG ──
  console.log("→ favicon.svg");
  writeFileSync(join(PUBLIC, "favicon.svg"), FAVICON_SVG.trim());

  // ── 3. PWA Icons ──
  for (const s of ICON_SIZES) {
    console.log(`→ icon-${s}x${s}.png`);
    await sharp(logoBuffer).resize(s, s).png({ quality: 100 }).toFile(join(ICONS, `icon-${s}x${s}.png`));
  }

  // ── 4. Maskable Icon (512x512, full-bleed) ──
  console.log("→ maskable-512x512.png");
  await sharp(maskBuffer).resize(512, 512).png({ quality: 100 }).toFile(join(ICONS, "maskable-512x512.png"));

  // ── 5. OG Image (1200x630) ──
  console.log("→ og-image.png (1200x630)");
  const ogBg = await sharp(Buffer.from(OG_SVG)).resize(1200, 630).png().toBuffer();
  const ogIcon = await sharp(logoBuffer).resize(280, 280).png().toBuffer();
  await sharp(ogBg)
    .composite([{ input: ogIcon, top: 175, left: 460 }])
    .png({ quality: 100 })
    .toFile(join(PUBLIC, "og-image.png"));

  // ── 6. Apple Splash Screens (optional, added bonus) ──
  console.log("→ apple-splash-1125x2436.png");
  const splashBg = await sharp({
    create: { width: 1125, height: 2436, channels: 4, background: { r: 6, g: 6, b: 15, alpha: 255 } }
  }).png().toBuffer();
  const splashIcon = await sharp(logoBuffer).resize(300, 300).png().toBuffer();
  await sharp(splashBg)
    .composite([{ input: splashIcon, top: 1020, left: 412 }])
    .png({ quality: 90 })
    .toFile(join(PUBLIC, "apple-splash-1125x2436.png"));

  console.log("\n✅ All brand assets generated successfully!");
  console.log("   Files:");
  console.log("   • client/public/favicon.png (512x512)");
  console.log("   • client/public/favicon.svg");
  console.log("   • client/public/og-image.png (1200x630)");
  console.log("   • client/public/apple-splash-1125x2436.png");
  console.log(`   • client/public/icons/ (${ICON_SIZES.length} sizes + maskable)`);
}

main().catch(e => { console.error("❌ Error:", e.message); process.exit(1); });
