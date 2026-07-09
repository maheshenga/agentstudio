import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const webRoot = process.cwd()
const failures: string[] = []
const productionOrigin = 'https://studio.qingyouai.com'
const placeholderOrigin = 'https://agentstudio.example.com'

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function readFile(path: string) {
  const fullPath = resolve(webRoot, path)
  assert(existsSync(fullPath), `${path} must exist`)
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : ''
}

const productionEnv = readFile('.env.production')
const robots = readFile('public/robots.txt')
const sitemap = readFile('public/sitemap.xml')
const indexHtml = readFile('index.html')

assert(
  productionEnv.includes(`VITE_PUBLIC_SITE_URL = ${productionOrigin}`),
  '.env.production must set VITE_PUBLIC_SITE_URL to the deployed public origin'
)
assert(!productionEnv.includes(placeholderOrigin), '.env.production must not use placeholder origin')

assert(robots.includes(`Sitemap: ${productionOrigin}/sitemap.xml`), 'robots.txt must point to production sitemap')
assert(!robots.includes(placeholderOrigin), 'robots.txt must not use placeholder origin')

for (const path of ['/', '/auth/login', '/auth/register', '/privacy-policy', '/terms']) {
  assert(
    sitemap.includes(`<loc>${productionOrigin}${path}</loc>`),
    `sitemap.xml must include ${productionOrigin}${path}`
  )
}
assert(!sitemap.includes(placeholderOrigin), 'sitemap.xml must not use placeholder origin')

assert(
  indexHtml.includes('href="%VITE_PUBLIC_SITE_URL%/"') &&
    indexHtml.includes('content="%VITE_PUBLIC_SITE_URL%/"'),
  'index.html must keep VITE_PUBLIC_SITE_URL placeholders for Vite HTML env replacement'
)

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS public origin verified.')
