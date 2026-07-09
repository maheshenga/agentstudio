const { spawnSync } = require('node:child_process')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')
const checks = [
  { label: 'frontend readiness', cwd: path.join(rootDir, 'web'), script: 'verify:saas-readiness' },
  { label: 'frontend build', cwd: path.join(rootDir, 'web'), script: 'build' },
  { label: 'frontend preview smoke', cwd: path.join(rootDir, 'web'), script: 'verify:saas-preview-smoke' },
  { label: 'frontend browser smoke', cwd: path.join(rootDir, 'web'), script: 'verify:saas-browser-smoke' },
  { label: 'backend build', cwd: path.join(rootDir, 'server'), script: 'build' },
  { label: 'backend readiness', cwd: path.join(rootDir, 'server'), script: 'verify:saas-readiness' }
]

function runPnpmScript(cwd, script) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', `pnpm.cmd run ${script}`], {
      cwd,
      stdio: 'inherit',
      shell: false
    })
  }

  return spawnSync('pnpm', ['run', script], {
    cwd,
    stdio: 'inherit',
    shell: false
  })
}

for (const check of checks) {
  console.log(`\n[saas-readiness] ${check.label}`)
  const result = runPnpmScript(check.cwd, check.script)

  if (result.status !== 0) {
    if (result.error) console.error(result.error.message)
    console.error(`[saas-readiness] ${check.label} failed`)
    process.exit(result.status || 1)
  }
}

console.log('\nSaaS repository readiness verified.')
