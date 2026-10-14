const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <defs>
    <linearGradient id="vibelyBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#155E49" />
      <stop offset="100%" stop-color="#0C3B2E" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#000000" flood-opacity="0.35" />
    </filter>
  </defs>

  <!-- Squircle Container -->
  <rect width="128" height="128" rx="32" fill="url(#vibelyBg)" />
  <rect width="124" height="124" x="2" y="2" rx="30" fill="none" stroke="rgba(255, 255, 255, 0.22)" stroke-width="2.5" />

  <!-- Center Vibely Emblem -->
  <g transform="translate(18.4, 18.4) scale(3.8)" filter="url(#shadow)">
    <!-- Modern Geometric 'V' with integrated Heartbeat / Wave Resonance -->
    <path
      d="M4.5 4.5L12 18.5L19.5 4.5"
      stroke="#FFFFFF"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- Inner heartbeat pulse wave inside the V -->
    <path
      d="M8.5 9.5L10.5 13L12 10.5L13.5 13L15.5 9.5"
      stroke="rgba(255, 255, 255, 0.95)"
      stroke-width="1.85"
      stroke-linecap="round"
      stroke-linejoin="round"
    />
    <!-- Soft central love aura dot -->
    <circle cx="12" cy="7" r="1.5" fill="#FFFFFF" />
  </g>

  <!-- Dynamic Glowing Emerald Pulse Indicator on Top-Right -->
  <circle cx="106" cy="22" r="9" fill="#34D399" />
  <circle cx="106" cy="22" r="9" fill="none" stroke="#0C3B2E" stroke-width="3" />
</svg>`;

async function run() {
  const root = path.resolve(__dirname, '..');
  const svgBuffer = Buffer.from(svgContent);

  // Write SVG favicons
  fs.writeFileSync(path.join(root, 'src/app/icon.svg'), svgContent);
  fs.writeFileSync(path.join(root, 'public/favicon.svg'), svgContent);

  // Render PNGs at various resolutions
  const png32 = await sharp(svgBuffer).resize(32, 32).png().toBuffer();
  const png48 = await sharp(svgBuffer).resize(48, 48).png().toBuffer();
  const png192 = await sharp(svgBuffer).resize(192, 192).png().toBuffer();
  const png512 = await sharp(svgBuffer).resize(512, 512).png().toBuffer();

  fs.writeFileSync(path.join(root, 'public/icon-192.png'), png192);
  fs.writeFileSync(path.join(root, 'public/icon-512.png'), png512);
  fs.writeFileSync(path.join(root, 'src/app/apple-icon.png'), png192);
  fs.writeFileSync(path.join(root, 'public/apple-icon.png'), png192);

  // Create standard multi-image ICO file containing 32x32 and 48x48 PNGs
  function createIco(images) {
    const numImages = images.length;
    const headerSize = 6;
    const dirEntrySize = 16;
    let offset = headerSize + (numImages * dirEntrySize);

    const header = Buffer.alloc(headerSize);
    header.writeUInt16LE(0, 0); // reserved
    header.writeUInt16LE(1, 2); // ICO type (1)
    header.writeUInt16LE(numImages, 4);

    const dirEntries = [];
    for (const img of images) {
      const entry = Buffer.alloc(dirEntrySize);
      entry.writeUInt8(img.width >= 256 ? 0 : img.width, 0);
      entry.writeUInt8(img.height >= 256 ? 0 : img.height, 1);
      entry.writeUInt8(0, 2); // color palette
      entry.writeUInt8(0, 3); // reserved
      entry.writeUInt16LE(1, 4); // color planes
      entry.writeUInt16LE(32, 6); // bits per pixel
      entry.writeUInt32LE(img.buffer.length, 8); // size
      entry.writeUInt32LE(offset, 12); // offset
      offset += img.buffer.length;
      dirEntries.push(entry);
    }

    return Buffer.concat([header, ...dirEntries, ...images.map(img => img.buffer)]);
  }

  const icoBuffer = createIco([
    { width: 32, height: 32, buffer: png32 },
    { width: 48, height: 48, buffer: png48 }
  ]);

  fs.writeFileSync(path.join(root, 'src/app/favicon.ico'), icoBuffer);
  fs.writeFileSync(path.join(root, 'public/favicon.ico'), icoBuffer);

  console.log('Successfully generated all Vibely favicons, icons, and Apple touch icons!');
}

run().catch(console.error);
