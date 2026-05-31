const fs = require('fs');
const { createCanvas } = require('canvas');

function createIcon(size, text) {
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  // Background (earthy warm)
  ctx.fillStyle = '#C7835A';
  ctx.fillRect(0, 0, size, size);

  // Text
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `bold ${Math.floor(size/3)}px Inter`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, size/2, size/2);

  return canvas.toBuffer('image/png');
}

fs.writeFileSync('apps/pwa/public/icon-192.png', createIcon(192, 'S'));
fs.writeFileSync('apps/pwa/public/icon-512.png', createIcon(512, 'S'));
