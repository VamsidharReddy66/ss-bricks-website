const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const output = path.join(root, 'public');

const entries = [
  'admin.html',
  'css',
  'images',
  'index.html',
  'js',
  'products.html',
];

fs.rmSync(output, {
  force: true,
  recursive: true,
});
fs.mkdirSync(output, {
  recursive: true,
});

for (const entry of entries) {
  fs.cpSync(path.join(root, entry), path.join(output, entry), {
    recursive: true,
  });
}

console.log('Static frontend files copied to public/.');
