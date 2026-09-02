import { readFile, stat } from 'node:fs/promises'
const required = [
  'web/index.html', 'web/styles.css', 'web/dub.css', 'web/quality.css',
  'web/runtime-bootstrap.js', 'web/data.js', 'web/app.js', 'web/quality.js',
  'web/product-shell.js', 'web/model.json', 'web/LICENSE', 'web/README.md',
  'web/schemas/oia-project.schema.json', 'desktop/main.cjs',
  'desktop/preload.cjs', 'desktop/build.cjs', 'desktop/product-catalog.json',
  'scripts/qa-oia-lib.mjs', 'scripts/qa-oia-tests.mjs',
  'scripts/qa-oia.mjs', 'scripts/qa-oia-products.mjs'
]
for (const path of required) {
  const info = await stat(path)
  if (!info.isFile() || info.size === 0) throw new Error(`Missing or empty required file: ${path}`)
}
for (const path of ['web/model.json', 'web/manifest.webmanifest', 'web/schemas/oia-project.schema.json', 'desktop/product-catalog.json', 'package.json']) JSON.parse(await readFile(path, 'utf8'))
const catalog = JSON.parse(await readFile('desktop/product-catalog.json', 'utf8'))
if (catalog.products.length !== 16) throw new Error(`Expected 16 interconnected products, found ${catalog.products.length}`)
if (new Set(catalog.products.map((item) => item.id)).size !== 16) throw new Error('Duplicate product identifier')
const sourceText = await Promise.all(required.filter((path) => !path.endsWith('.json')).map((path) => readFile(path, 'utf8')))
const joined = sourceText.join('\n')
if (/[–—]/u.test(joined)) throw new Error('Unicode dash found in source')
if (/BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/.test(joined)) throw new Error('Private key material detected')
const index = await readFile('web/index.html', 'utf8')
if (!index.includes('quality.css')) throw new Error('Accessibility stylesheet is not loaded')
const app = await readFile('web/app.js', 'utf8')
if (!app.includes('data-testid="plant-mode"')) throw new Error('Plant mode contract is missing')
if (!app.includes('role="progressbar"')) throw new Error('Progress semantics are missing')
console.log('Source verified: web suite, 16 products, desktop shell and release contracts.')
