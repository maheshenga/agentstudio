import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const webRoot = process.cwd()
const failures: string[] = []
const host = '127.0.0.1'
const port = Number(process.env.SAAS_PREVIEW_PORT || 4179)
const baseUrl = `http://${host}:${port}`
const distIndex = resolve(webRoot, 'dist/index.html')
const viteCli = resolve(webRoot, 'node_modules/vite/bin/vite.js')
const smokeUrls = ['/', '/#/saas/signup', '/#/tenant-saas/usage', '/#/saas-platform/usage']

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message)
}

function readBuiltIndex() {
  assert(existsSync(distIndex), 'dist/index.html must exist; run pnpm.cmd build before preview smoke')
  return existsSync(distIndex) ? readFileSync(distIndex, 'utf8') : ''
}

function startPreview() {
  assert(existsSync(viteCli), 'node_modules/vite/bin/vite.js must exist')
  if (!existsSync(viteCli)) return null

  const child = spawn(
    process.execPath,
    [viteCli, 'preview', '--host', host, '--port', String(port), '--strictPort'],
    {
      cwd: webRoot,
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )

  child.stdout.on('data', (data) => process.stdout.write(data))
  child.stderr.on('data', (data) => process.stderr.write(data))
  return child
}

async function waitForPreview() {
  const deadline = Date.now() + 30_000
  let lastError = ''

  while (Date.now() < deadline) {
    try {
      const response = await fetch(baseUrl)
      if (response.ok) return
      lastError = `HTTP ${response.status}`
    } catch (error) {
      lastError = (error as Error).message
    }

    await new Promise((resolveDelay) => setTimeout(resolveDelay, 500))
  }

  failures.push(`vite preview did not become ready at ${baseUrl}: ${lastError}`)
}

function extractEntryAssets(html: string) {
  return Array.from(html.matchAll(/\b(?:src|href)="([^"]+\.(?:js|css)(?:\?[^"]*)?)"/g))
    .map((match) => match[1])
    .filter((asset) => asset.startsWith('/assets/'))
}

async function fetchText(path: string) {
  const response = await fetch(new URL(path, baseUrl))
  assert(response.ok, `${path} must return HTTP 200, got ${response.status}`)
  return response.ok ? response.text() : ''
}

async function runSmoke() {
  const builtIndex = readBuiltIndex()
  assert(builtIndex.includes('<div id="app"'), 'dist/index.html must contain the Vue app mount point')

  const preview = startPreview()
  if (!preview) return

  try {
    await waitForPreview()
    if (failures.length) return

    for (const url of smokeUrls) {
      const html = await fetchText(url)
      assert(html.includes('<div id="app"'), `${url} must serve the Vue app shell`)
    }

    const html = await fetchText('/')
    const assets = extractEntryAssets(html)
    assert(assets.some((asset) => asset.endsWith('.js')), 'preview index must reference at least one JS asset')
    assert(
      assets.some((asset) => asset.endsWith('.css')),
      'preview index must reference at least one CSS asset'
    )

    for (const asset of assets) {
      const body = await fetchText(asset)
      assert(body.length > 0, `${asset} must not be empty`)
    }
  } finally {
    await stopPreview(preview)
  }
}

async function stopPreview(preview: ChildProcessWithoutNullStreams) {
  if (preview.killed) return

  await new Promise<void>((resolveStop) => {
    const timeout = setTimeout(resolveStop, 3_000)
    preview.once('close', () => {
      clearTimeout(timeout)
      resolveStop()
    })
    preview.kill()
  })
}

await runSmoke()

if (failures.length) {
  console.error(failures.join('\n'))
  process.exit(1)
}

console.log('SaaS preview smoke verified.')
