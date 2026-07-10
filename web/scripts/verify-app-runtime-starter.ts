import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { lstatSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import JSZip from 'jszip'

import { buildRuntimeStarter } from './build-runtime-starter'

const webRoot = process.cwd()
const sourceRoot = resolve(webRoot, 'examples/runtime-starter')
const sdkPath = resolve(webRoot, 'packages/app-runtime-sdk/dist/agentstudio-runtime.global.js')
const allowedFiles = [
  'app.js',
  'index.html',
  'manifest.json',
  'styles.css',
  'vendor/agentstudio-runtime.global.js'
]
const expectedManifest = {
  code: 'runtime_starter',
  name: 'Runtime Starter',
  version: '1.0.0',
  type: 'static',
  entry: 'index.html',
  tenant_scoped: true,
  permissions: ['runtime:context:read']
}

function sha256(value: Buffer | string) {
  return createHash('sha256').update(value).digest('hex')
}

async function inspectZip(zipPath: string) {
  const zipBuffer = readFileSync(zipPath)
  const zip = await JSZip.loadAsync(zipBuffer)
  const entries = Object.values(zip.files).filter((entry) => !entry.dir)
  const names = entries.map((entry) => entry.name).sort()
  assert.deepEqual(names, allowedFiles)

  for (const entry of entries) {
    assert.equal(entry.name.startsWith('/'), false)
    assert.equal(entry.name.includes('..'), false)
    assert.equal(entry.name.startsWith('.'), false)
    assert.doesNotMatch(entry.name, /\.(?:bat|cmd|com|dll|exe|jar|map|msi|php|ps1|py|rb|sh)$/i)
  }

  const manifest = JSON.parse(await zip.file('manifest.json')!.async('string'))
  assert.deepEqual(manifest, expectedManifest)
  assert.ok(zip.file(manifest.entry))

  const archivedSdk = await zip.file('vendor/agentstudio-runtime.global.js')!.async('nodebuffer')
  assert.equal(sha256(archivedSdk), sha256(readFileSync(sdkPath)))

  const textEntries = await Promise.all(
    entries.map(async (entry) => [entry.name, await entry.async('string')] as const)
  )
  for (const [name, source] of textEntries) {
    assert.doesNotMatch(
      source,
      /password|access[_-]?token|refresh[_-]?token|authorization|cookie|localStorage|sessionStorage/i,
      `${name} must not contain credential or storage references`
    )
  }

  return sha256(zipBuffer)
}

async function main() {
  for (const name of ['manifest.json', 'index.html', 'styles.css', 'app.js']) {
    assert.equal(lstatSync(resolve(sourceRoot, name)).isSymbolicLink(), false)
  }

  const html = readFileSync(resolve(sourceRoot, 'index.html'), 'utf8')
  const app = readFileSync(resolve(sourceRoot, 'app.js'), 'utf8')
  assert.match(html, /role="status"/)
  assert.match(html, /aria-live="polite"/)
  assert.match(html, /id="retry"/)
  assert.ok(html.indexOf('./vendor/agentstudio-runtime.global.js') < html.indexOf('./app.js'))
  assert.doesNotMatch(html, /<script[^>]+src="https?:/i)
  assert.doesNotMatch(app, /innerHTML|console\./)

  const first = await buildRuntimeStarter()
  assert.deepEqual(first.files, allowedFiles)
  assert.equal(first.sdkSha256, sha256(readFileSync(sdkPath)))
  const firstHash = await inspectZip(first.zipPath)

  const second = await buildRuntimeStarter()
  const secondHash = await inspectZip(second.zipPath)
  assert.equal(secondHash, firstHash)

  console.log('App runtime starter verified.')
}

await main()
