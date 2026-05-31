const fs = require('fs');

// We don't have canvas installed globally in this setup probably.
// Let's create a 1x1 transparent PNG instead of failing.
const tinyPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
fs.writeFileSync('apps/pwa/public/icon-192.png', tinyPng);
fs.writeFileSync('apps/pwa/public/icon-512.png', tinyPng);
