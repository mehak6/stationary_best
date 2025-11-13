# App Icons

## Required Icons for PWA

This directory should contain the following icon files:

- `icon-72x72.png`
- `icon-96x96.png`
- `icon-128x128.png`
- `icon-144x144.png`
- `icon-152x152.png`
- `icon-192x192.png`
- `icon-384x384.png`
- `icon-512x512.png`
- `apple-touch-icon.png` (180x180)
- `favicon.ico`

## How to Generate Icons

### Option 1: Use an Online Tool
1. **PWA Asset Generator**: https://www.pwabuilder.com/imageGenerator
   - Upload a 512x512 source image
   - Download all generated sizes

2. **Real Favicon Generator**: https://realfavicongenerator.net/
   - Upload your logo
   - Generate all required formats

### Option 2: Use Command Line

Install sharp-cli:
```bash
npm install -g sharp-cli
```

Generate all sizes from a source image:
```bash
# From a 1024x1024 source.png
sharp -i source.png -o icon-72x72.png resize 72 72
sharp -i source.png -o icon-96x96.png resize 96 96
sharp -i source.png -o icon-128x128.png resize 128 128
sharp -i source.png -o icon-144x144.png resize 144 144
sharp -i source.png -o icon-152x152.png resize 152 152
sharp -i source.png -o icon-192x192.png resize 192 192
sharp -i source.png -o icon-384x384.png resize 384 384
sharp -i source.png -o icon-512x512.png resize 512 512
sharp -i source.png -o apple-touch-icon.png resize 180 180
```

### Recommended Design

**Logo Concept**: Package box or inventory icon
**Colors**: Use theme color #0ea5e9 (sky blue)
**Background**: White or light gradient
**Safe Area**: Keep important elements in center 80%

### Temporary Placeholder

For development, you can use a simple colored square:
```bash
# Create a blue square placeholder (requires ImageMagick)
convert -size 512x512 xc:#0ea5e9 -gravity center -pointsize 72 -fill white -annotate +0+0 "INV" icon-512x512.png
```

## Current Status

⚠️ **Icons not yet generated** - Please add icons before deploying to production.

For now, the PWA will work but may show default browser icons during installation.
