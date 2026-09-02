import { cp, mkdir, rm, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
const source = resolve('web')
const target = resolve('dist')
await rm(target, { recursive: true, force: true })
await mkdir(target, { recursive: true })
await cp(source, target, { recursive: true })
await writeFile(resolve(target, '.nojekyll'), '\n', 'utf8')
console.log(`Built standalone web distribution at ${target}`)
