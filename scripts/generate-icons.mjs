/**
 * Rasterizes src/app/icon.svg into the PNG sizes the PWA manifest needs.
 *
 * Run with `node scripts/generate-icons.mjs` after changing the logo.
 * The generated PNGs are committed, so this is not part of the build.
 * sharp comes along with next, so there is no extra dependency to install.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import sharp from "sharp";

const SRC = "src/app/icon.svg";
const OUT = "public/icons";

// Maskable icons get cropped to a circle by the launcher, so the logo has to
// sit inside the middle ~80% ("safe zone") with the brand colour bleeding out.
const MASKABLE_SAFE_ZONE = 0.8;
const MASKABLE_BG = "#1e3a8a";

const svg = await readFile(SRC);
await mkdir(OUT, { recursive: true });

async function plain(size) {
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png()
    .toFile(`${OUT}/icon-${size}.png`);
  console.log(`icon-${size}.png`);
}

async function maskable(size) {
  const inner = Math.round(size * MASKABLE_SAFE_ZONE);
  const logo = await sharp(svg, { density: 384 }).resize(inner, inner).png().toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: MASKABLE_BG,
    },
  })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(`${OUT}/icon-maskable-${size}.png`);
  console.log(`icon-maskable-${size}.png`);
}

await plain(192);
await plain(512);
await plain(180); // apple-touch-icon
await maskable(512);
