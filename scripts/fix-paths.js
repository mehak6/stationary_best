const fs = require('fs');
const path = require('path');

// Fix paths in index.html to be relative
const indexPath = path.join(__dirname, '../out/index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf8');

  // Replace absolute paths with relative paths
  html = html.replace(/href="\/_next\//g, 'href="./_next/');
  html = html.replace(/src="\/_next\//g, 'src="./_next/');
  html = html.replace(/href="\/icons\//g, 'href="./icons/');
  html = html.replace(/src="\/icons\//g, 'src="./icons/');
  html = html.replace(/href="\/manifest/g, 'href="./manifest');

  fs.writeFileSync(indexPath, html, 'utf8');
  console.log('✅ Fixed paths in index.html to be relative');
} else {
  console.error('❌ index.html not found');
}
