# Windows Icon (.ico) Generation

## Current Status
You need to create an `icon.ico` file for the Windows Electron app.

## Option 1: Online Converter (Easiest)
1. Go to https://www.icoconverter.com/ or https://convertio.co/png-ico/
2. Upload `icon-512x512.png` from the public/icons/ folder
3. Download the generated `icon.ico` file
4. Save it to `public/icons/icon.ico`

## Option 2: ImageMagick (Command Line)
If you have ImageMagick installed:

```bash
cd public/icons
magick convert icon-512x512.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.ico
```

## Option 3: GIMP (Free Software)
1. Download GIMP: https://www.gimp.org/downloads/
2. Open `icon-512x512.png` in GIMP
3. File → Export As
4. Change extension to `.ico`
5. In the ICO options, select multiple sizes (256, 128, 64, 48, 32, 16)
6. Export

## Option 4: Windows Built-in (Limited)
1. Right-click `icon-512x512.png`
2. Open with Paint
3. File → Save As → Select "256 color bitmap (.bmp)"
4. Rename from .bmp to .ico
   Note: This creates a basic .ico but may not have multiple sizes

## Verification
After creating icon.ico:
- File should be in `public/icons/icon.ico`
- Recommended size: 15-50 KB
- Should contain multiple resolutions (16x16, 32x32, 48x48, 256x256)

## Next Steps
Once icon.ico is created:
1. Update electron-builder.json to use icon.ico
2. Rebuild the Electron app with: `npm run electron:build`
