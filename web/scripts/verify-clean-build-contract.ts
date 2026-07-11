import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8')) as {
  scripts?: Record<string, string>
}
const build = packageJson.scripts?.build || ''

if (build !== 'vite build && vue-tsc --noEmit') {
  throw new Error(
    'Frontend build must run Vite before vue-tsc so ignored auto-import declarations exist in clean archives'
  )
}

const viteConfig = readFileSync(resolve(root, 'vite.config.ts'), 'utf8')
for (const declaration of [
  'src/types/import/auto-imports.d.ts',
  'src/types/import/components.d.ts'
]) {
  if (!viteConfig.includes(`dts: '${declaration}'`)) {
    throw new Error(`Vite must generate ${declaration}`)
  }
}

const gitignore = readFileSync(resolve(root, '.gitignore'), 'utf8')
for (const declaration of ['src/types/import/auto-imports.d.ts', 'src/types/import/components.d.ts']) {
  if (!gitignore.split(/\r?\n/).includes(declaration)) {
    throw new Error(`${declaration} must remain generated and ignored`)
  }
}

console.log('Clean frontend build contract verified.')
