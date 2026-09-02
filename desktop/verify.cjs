'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const desktopRoot = __dirname;
const repositoryRoot = path.resolve(desktopRoot, '..');
const webRoot = path.join(repositoryRoot, 'web');
const catalog = JSON.parse(fs.readFileSync(path.join(desktopRoot, 'product-catalog.json'), 'utf8'));
const dataSource = fs.readFileSync(path.join(webRoot, 'data.js'), 'utf8');
const mainSource = fs.readFileSync(path.join(desktopRoot, 'main.cjs'), 'utf8');
const packageMetadata = JSON.parse(fs.readFileSync(path.join(desktopRoot, 'package.json'), 'utf8'));

assert.equal(catalog.schemaVersion, '1.0.0');
assert.equal(catalog.suiteVersion, packageMetadata.version, 'Desktop package and product catalogue versions must match');
assert.equal(catalog.products.length, 16, 'Expected the suite plus fifteen focused products');

for (const field of ['id', 'name', 'artifact', 'appId', 'module', 'description']) {
  const values = catalog.products.map((product) => product[field]);
  assert.ok(values.every(Boolean), `Missing ${field}`);
  assert.equal(new Set(values).size, values.length, `Duplicate ${field}`);
}

for (const product of catalog.products) {
  assert.match(dataSource, new RegExp(`id:\\s*['"]${product.module.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`), `Missing module ${product.module}`);
}

for (const file of [
  'index.html',
  'styles.css',
  'dub.css',
  'quality.css',
  'final-fixes.css',
  'data.js',
  'app.js',
  'runtime-bootstrap.js',
  'product-shell.js',
  'escape-fix.js',
  'manifest.webmanifest',
]) {
  const full = path.join(webRoot, file);
  assert.ok(fs.existsSync(full), `Missing web/${file}`);
  assert.ok(fs.statSync(full).size > 0, `Empty web/${file}`);
}

const icon = path.join(desktopRoot, 'assets', 'icon.png');
assert.ok(fs.existsSync(icon), 'Missing desktop/assets/icon.png');
assert.ok(fs.statSync(icon).size > 0, 'Empty desktop/assets/icon.png');

for (const requiredSecuritySetting of [
  'contextIsolation: true',
  'nodeIntegration: false',
  'sandbox: true',
  'webSecurity: true',
  'setPermissionRequestHandler',
  'setPermissionCheckHandler',
  'will-attach-webview',
  'requestSingleInstanceLock',
]) {
  assert.ok(mainSource.includes(requiredSecuritySetting), `Missing desktop security setting: ${requiredSecuritySetting}`);
}

assert.ok(mainSource.includes("path.resolve(__dirname, '..', 'web')"), 'Desktop development runtime must load the standalone web directory');
assert.ok(mainSource.includes('Open-Industrial-Automation'), 'Desktop products must share one user data root');
assert.ok(!mainSource.includes('http://'), 'Desktop runtime must not use insecure HTTP');
console.log(`Desktop catalog verified: ${catalog.products.length} interconnected products, secure shell, shared workspace and standalone web source.`);
