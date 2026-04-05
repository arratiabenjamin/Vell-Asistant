import { mkdirSync, writeFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

const distDir = resolve(process.cwd(), 'dist')
const indexFile = resolve(distDir, 'index.html')

mkdirSync(distDir, { recursive: true })

if (!existsSync(indexFile)) {
  writeFileSync(
    indexFile,
    '<!doctype html><html><head><meta charset="utf-8" /><title>Forge GUI placeholder</title></head><body><div id="root"></div></body></html>\n',
    'utf8'
  )
  console.log(`[ensure-dist] created ${indexFile}`)
} else {
  console.log(`[ensure-dist] ok ${indexFile}`)
}
