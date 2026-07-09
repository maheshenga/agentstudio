const failures: string[] = []
const defaultBaseUrl = 'https://studio.qingyouai.com'
const placeholderOrigin = 'https://agentstudio.example.com'
const vitePublicSitePlaceholder = '%VITE_PUBLIC_SITE_URL%'
const baseUrl = normalizeBaseUrl(process.env.SAAS_PUBLIC_LIVE_BASE_URL || defaultBaseUrl)
const htmlPaths = ['/', '/auth/login', '/auth/register', '/privacy-policy', '/terms']

type TextResponse = {
  url: string
  contentType: string
  text: string
}

function normalizeBaseUrl(value: string) {
  const url = new URL(value)
  url.hash = ''
  url.search = ''
  return url.toString().replace(/\/$/, '')
}

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

async function fetchText(path: string): Promise<TextResponse> {
  const target = new URL(path, `${baseUrl}/`)

  try {
    const response = await fetch(target, {
      headers: { accept: 'text/html,application/xml,text/plain,*/*' },
      signal: AbortSignal.timeout(15_000)
    })
    const text = await response.text()
    assert(response.ok, `${target.toString()} must return HTTP 2xx, got ${response.status}`)
    return {
      url: target.toString(),
      contentType: response.headers.get('content-type') || '',
      text
    }
  } catch (error) {
    failures.push(`${target.toString()} request failed: ${(error as Error).message}`)
    return { url: target.toString(), contentType: '', text: '' }
  }
}

function assertHtmlShell(path: string, response: TextResponse) {
  if (!response.text) return

  assert(
    response.contentType.includes('text/html'),
    `${path} must return text/html, got ${response.contentType || 'missing content-type'}`
  )
  assert(response.text.includes('<div id="app"'), `${path} must serve the Vue app shell`)
  assert(
    !response.text.includes(vitePublicSitePlaceholder),
    `${path} must not expose Vite public-site placeholder`
  )
  assert(!response.text.includes(placeholderOrigin), `${path} must not expose placeholder origin`)
}

function assertHomeSeo(html: string) {
  assert(
    html.includes('<title>AgentStudio - SaaS AI Operations Platform</title>'),
    'home HTML must include AgentStudio title'
  )
  assert(
    html.includes(
      'AgentStudio is a multi-tenant SaaS platform for tenant management, subscriptions, modules, resource quotas, payments, and AI operations.'
    ),
    'home HTML must include SaaS description'
  )
  assert(
    html.includes(`href="${baseUrl}/"`),
    'home HTML canonical URL must use the deployed public origin'
  )
  assert(
    html.includes(`content="${baseUrl}/"`),
    'home HTML OpenGraph URL must use the deployed public origin'
  )
  assert(!html.includes(vitePublicSitePlaceholder), 'home HTML must not expose Vite public-site placeholder')
  assert(!html.includes(placeholderOrigin), 'home HTML must not expose placeholder origin')
}

function extractEntryAssets(html: string) {
  const seen = new Set<string>()
  const matches = html.matchAll(/\b(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g)

  for (const match of matches) {
    const assetUrl = new URL(match[1], `${baseUrl}/`)
    if (assetUrl.origin !== new URL(baseUrl).origin) continue
    if (!assetUrl.pathname.startsWith('/assets/')) continue
    seen.add(`${assetUrl.pathname}${assetUrl.search}`)
  }

  return Array.from(seen)
}

async function verifyHtmlRoutes() {
  let homeHtml = ''

  for (const path of htmlPaths) {
    const response = await fetchText(path)
    assertHtmlShell(path, response)
    if (path === '/') homeHtml = response.text
  }

  if (!homeHtml) return []
  assertHomeSeo(homeHtml)

  const assets = extractEntryAssets(homeHtml)
  assert(assets.some((asset) => asset.endsWith('.js')), 'home HTML must reference at least one JS asset')
  assert(assets.some((asset) => asset.endsWith('.css')), 'home HTML must reference at least one CSS asset')
  return assets
}

async function verifyAssets(assets: string[]) {
  for (const asset of assets) {
    const response = await fetchText(asset)
    assert(response.text.length > 0, `${asset} must not be empty`)
  }
}

async function verifyRobots() {
  const response = await fetchText('/robots.txt')
  if (!response.text) return

  assert(
    response.text.includes(`Sitemap: ${baseUrl}/sitemap.xml`),
    'robots.txt must point to the deployed sitemap'
  )
  assert(!response.text.includes(placeholderOrigin), 'robots.txt must not expose placeholder origin')
}

async function verifySitemap() {
  const response = await fetchText('/sitemap.xml')
  if (!response.text) return

  for (const path of ['/', '/auth/login', '/auth/register', '/privacy-policy', '/terms']) {
    assert(
      response.text.includes(`<loc>${baseUrl}${path}</loc>`),
      `sitemap.xml must include ${baseUrl}${path}`
    )
  }
  assert(!response.text.includes(placeholderOrigin), 'sitemap.xml must not expose placeholder origin')
}

const assets = await verifyHtmlRoutes()
await verifyAssets(assets)
await verifyRobots()
await verifySitemap()

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log(
  JSON.stringify(
    {
      base_url: baseUrl,
      checked_paths: htmlPaths.length,
      checked_assets: assets.length
    },
    null,
    2
  )
)
console.log('SaaS public live smoke verified.')
