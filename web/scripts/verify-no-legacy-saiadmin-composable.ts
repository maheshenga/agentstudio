import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join, relative, resolve } from 'node:path'

const webRoot = resolve(fileURLToPath(new URL('..', import.meta.url)))
const srcRoot = join(webRoot, 'src')
const forbiddenPatterns = [/useSaiAdmin/, /@\/composables\/useSaiAdmin/]
const failures: string[] = []

function collectFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return collectFiles(path)
    if (!/\.(ts|vue)$/.test(entry.name)) return []
    return [path]
  })
}

const legacyFile = join(srcRoot, 'composables', 'useSaiAdmin.ts')
if (existsSync(legacyFile)) {
  failures.push('src/composables/useSaiAdmin.ts should be renamed to useTableCrud.ts')
}

const newFile = join(srcRoot, 'composables', 'useTableCrud.ts')
if (!existsSync(newFile)) {
  failures.push('src/composables/useTableCrud.ts should exist')
}

for (const file of collectFiles(srcRoot)) {
  const content = readFileSync(file, 'utf8')
  for (const pattern of forbiddenPatterns) {
    if (pattern.test(content)) {
      failures.push(`${relative(webRoot, file)} contains legacy composable name ${pattern}`)
    }
  }
}

if (existsSync(newFile)) {
  const newContent = readFileSync(newFile, 'utf8')
  if (!newContent.includes('export function useTableCrud()')) {
    failures.push('src/composables/useTableCrud.ts should export useTableCrud')
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('No legacy SaiAdmin composable names remain in web/src.')
