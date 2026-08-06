import { mkdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const outputPath = (relativePath) => fileURLToPath(new URL(relativePath, import.meta.url));
const iconSvg = await readFile(new URL('../assets/gitreview-icon.svg', import.meta.url));
const iconData = iconSvg.toString('base64');

await mkdir(new URL('../public/icon/', import.meta.url), { recursive: true });
await mkdir(new URL('../store-assets/', import.meta.url), { recursive: true });

await Promise.all([16, 32, 48, 128].map((size) =>
  sharp(iconSvg)
    .resize(size, size)
    .png()
    .toFile(outputPath(`../public/icon/${size}.png`)),
));

await sharp(iconSvg)
  .resize(128, 128)
  .png()
  .toFile(outputPath('../store-assets/icon-128.png'));

const promo = `
<svg xmlns="http://www.w3.org/2000/svg" width="440" height="280" viewBox="0 0 440 280">
  <rect width="440" height="280" fill="#0D1117"/>
  <circle cx="220" cy="140" r="112" fill="#161B22" stroke="#30363D" stroke-width="2"/>
  <path d="M65 226 A182 182 0 0 1 375 226" fill="none" stroke="#3D8BFD" stroke-width="18" stroke-linecap="round" opacity=".28"/>
  <path d="M91 226 A154 154 0 0 1 349 226" fill="none" stroke="#3FB950" stroke-width="15" stroke-linecap="round" opacity=".36"/>
  <path d="M120 226 A125 125 0 0 1 320 226" fill="none" stroke="#F0883E" stroke-width="12" stroke-linecap="round" opacity=".5"/>
  <image href="data:image/svg+xml;base64,${iconData}" x="156" y="76" width="128" height="128"/>
</svg>`;

await sharp(Buffer.from(promo))
  .png()
  .toFile(outputPath('../store-assets/promo-440x280.png'));
