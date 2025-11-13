const fs = require('fs');
const path = require('path');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '..', 'public', 'icons');
if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
}

// SVG icon template
const createSVG = (size) => `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0ea5e9;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#0284c7;stop-opacity:1" />
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${size}" height="${size}" fill="url(#grad)"/>

  <!-- Package Box -->
  <g transform="translate(${size * 0.25}, ${size * 0.25})">
    <!-- Box shadow -->
    <rect x="10" y="10" width="${size * 0.5}" height="${size * 0.5}" fill="rgba(0,0,0,0.2)" rx="8"/>

    <!-- Main box -->
    <rect x="0" y="0" width="${size * 0.5}" height="${size * 0.5}" fill="#ffffff" rx="8"/>

    <!-- Box details -->
    <line x1="${size * 0.25}" y1="0" x2="${size * 0.25}" y2="${size * 0.5}" stroke="#94a3b8" stroke-width="${size * 0.02}" stroke-linecap="round"/>
    <line x1="0" y1="${size * 0.17}" x2="${size * 0.5}" y2="${size * 0.17}" stroke="#94a3b8" stroke-width="${size * 0.02}" stroke-linecap="round"/>

    <!-- Checkmark -->
    <polyline points="${size * 0.15},${size * 0.3} ${size * 0.225},${size * 0.375} ${size * 0.375},${size * 0.225}"
              fill="none" stroke="#10b981" stroke-width="${size * 0.03}" stroke-linecap="round" stroke-linejoin="round"/>
  </g>

  <!-- Text -->
  <text x="${size / 2}" y="${size * 0.85}" font-family="Arial, sans-serif" font-size="${size * 0.08}" font-weight="bold" fill="white" text-anchor="middle">INVENTORY</text>
</svg>`;

// Generate icons
const sizes = [
    { size: 512, name: 'icon-512x512.png' },
    { size: 192, name: 'icon-192x192.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 512, name: 'icon-512x512.svg' } // Also save SVG
];

sizes.forEach(({ size, name }) => {
    const svg = createSVG(size);
    const filePath = path.join(iconsDir, name.replace('.png', '.svg'));
    fs.writeFileSync(filePath, svg);
    console.log(`✓ Generated ${name.replace('.png', '.svg')}`);
});

console.log('\n✨ Icons generated successfully!');
console.log('📁 Location: public/icons/');
console.log('\n📝 Next steps:');
console.log('1. Convert SVGs to PNGs using an online tool like:');
console.log('   - https://svgtopng.com/');
console.log('   - https://cloudconvert.com/svg-to-png');
console.log('2. Or use the generate-icons.html file in your browser');
console.log('3. Save the PNG files to public/icons/\n');
