/**
 * Ablox Brand Asset Generator
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
// LOGO SVG — Video camera + Play + LIVE broadcast
// Gradient: Indigo → Violet → Pink
// ═══════════════════════════════════════════════════════════

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4338CA"/>
      <stop offset="45%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#DB2777"/>
    </linearGradient>
  </defs>

  <!-- Rounded square background -->
  <rect width="1024" height="1024" rx="224" fill="url(#bg)"/>

  <!-- Subtle top highlight -->
  <rect x="24" y="24" width="976" height="488" rx="210" fill="white" fill-opacity="0.03"/>

  <!-- Video camera body -->
  <rect x="130" y="320" width="480" height="340" rx="48" fill="white" fill-opacity="0.95"/>

  <!-- Camera lens section -->
  <path d="M 630 365 L 810 268 Q 845 248, 845 288 L 845 668 Q 845 708, 810 688 L 630 590 Z"
        fill="white" fill-opacity="0.88"/>

  <!-- Play triangle inside camera body -->
  <path d="M 310 410 L 310 580 L 475 495 Z" fill="url(#bg)" fill-opacity="0.8"/>

  <!-- LIVE indicator (pulsing dot) -->
  <circle cx="880" cy="185" r="45" fill="#EF4444"/>
  <circle cx="880" cy="185" r="58" fill="none" stroke="#EF4444" stroke-width="6" opacity="0.35"/>
  <circle cx="880" cy="185" r="72" fill="none" stroke="#EF4444" stroke-width="4" opacity="0.15"/>

  <!-- Broadcast waves (top-left) -->
  <path d="M 235 232 Q 340 150 445 232" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" opacity="0.4"/>
  <path d="M 195 180 Q 340 75 485 180" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" opacity="0.22"/>
</svg>`;

// Maskable version: full-bleed, no rounded corners, 80% safe zone
const MASKABLE_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg2" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4338CA"/>
      <stop offset="45%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#DB2777"/>
    </linearGradient>
  </defs>

  <!-- Full-bleed background -->
  <rect width="1024" height="1024" fill="url(#bg2)"/>

  <!-- Camera body (80% safe zone) -->
  <rect x="190" y="350" width="400" height="290" rx="40" fill="white" fill-opacity="0.95"/>

  <!-- Camera lens section -->
  <path d="M 608 390 L 760 310 Q 790 293, 790 326 L 790 630 Q 790 663, 760 646 L 608 565 Z"
        fill="white" fill-opacity="0.88"/>

  <!-- Play triangle -->
  <path d="M 340 430 L 340 570 L 470 500 Z" fill="url(#bg2)" fill-opacity="0.8"/>

  <!-- LIVE dot -->
  <circle cx="820" cy="230" r="38" fill="#EF4444"/>
  <circle cx="820" cy="230" r="50" fill="none" stroke="#EF4444" stroke-width="5" opacity="0.3"/>

  <!-- Broadcast waves -->
  <path d="M 265 270 Q 360 195 455 270" fill="none" stroke="white" stroke-width="7" stroke-linecap="round" opacity="0.35"/>
  <path d="M 230 225 Q 360 130 490 225" fill="none" stroke="white" stroke-width="5" stroke-linecap="round" opacity="0.18"/>
</svg>`;

// OG Image background (1200x630)
const OG_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="ogbg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#06060f"/>
      <stop offset="100%" stop-color="#0c0c1d"/>
    </linearGradient>
    <radialGradient id="glow1" cx="600" cy="280" r="350" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#7C3AED" stop-opacity="0.18"/>
      <stop offset="70%" stop-color="#7C3AED" stop-opacity="0.03"/>
      <stop offset="100%" stop-color="#7C3AED" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="600" cy="350" r="200" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#DB2777" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#DB2777" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#ogbg)"/>
  <rect width="1200" height="630" fill="url(#glow1)"/>
  <rect width="1200" height="630" fill="url(#glow2)"/>
  <pattern id="dots" x="0" y="0" width="40" height="40" patternUnits="userSpaceOnUse">
    <circle cx="20" cy="20" r="0.8" fill="white" fill-opacity="0.06"/>
  </pattern>
  <rect width="1200" height="630" fill="url(#dots)"/>
</svg>`;

// Favicon SVG (for modern browsers)
const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="fbg" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#4338CA"/>
      <stop offset="45%" stop-color="#7C3AED"/>
      <stop offset="100%" stop-color="#DB2777"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" rx="224" fill="url(#fbg)"/>
  <rect x="130" y="320" width="480" height="340" rx="48" fill="white" fill-opacity="0.95"/>
  <path d="M 630 365 L 810 268 Q 845 248, 845 288 L 845 668 Q 845 708, 810 688 L 630 590 Z" fill="white" fill-opacity="0.88"/>
  <path d="M 310 410 L 310 580 L 475 495 Z" fill="url(#fbg)" fill-opacity="0.8"/>
  <circle cx="880" cy="185" r="45" fill="#EF4444"/>
  <circle cx="880" cy="185" r="58" fill="none" stroke="#EF4444" stroke-width="6" opacity="0.35"/>
  <path d="M 235 232 Q 340 150 445 232" fill="none" stroke="white" stroke-width="8" stroke-linecap="round" opacity="0.4"/>
  <path d="M 195 180 Q 340 75 485 180" fill="none" stroke="white" stroke-width="6" stroke-linecap="round" opacity="0.22"/>
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
