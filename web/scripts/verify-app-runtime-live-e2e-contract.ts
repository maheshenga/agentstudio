import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(
  resolve(process.cwd(), 'scripts/verify-app-runtime-live-e2e.ts'),
  'utf8'
)

assert.match(source, /APP_RUNTIME_E2E_REDIS_ISOLATED/)
assert.match(source, /APP_RUNTIME_E2E_REDIS_DB/)
assert.match(source, /redis\.call\('DBSIZE'\)/)
assert.match(source, /redis\.call\('SET'/)
assert.match(source, /redis\.call\('GET'/)
assert.match(source, /redis\.call\('FLUSHDB'\)/)
assert.match(source, /for \(const value of \[\s*ownerUsername,\s*ownerEmail,\s*ownerPhone,/)
assert.match(source, /process\.on\('SIGINT'/)
assert.match(source, /process\.on\('SIGTERM'/)
assert.match(source, /await waitForForcedExit/)
assert.doesNotMatch(source, /Redis cleanup warning|Database cleanup warning/)
assert.match(source, /if \(terminationController\.signal\.aborted\) throw/)
assert.match(source, /if \(backendStopped\) \{/)
assert.match(source, /Failure evidence collection failed/)
assert.doesNotMatch(source, /await page\.reload\(/)
assert.match(source, /getByRole\('button', \{ name: 'Reload' \}\)/)
assert.match(source, /__agentStudioMessageListenerCount/)
assert.match(source, /reloaded iframe body/)
assert.match(source, /reloaded host page/)
assert.match(source, /reloaded browser console/)

console.log('App runtime live E2E contract verified.')
