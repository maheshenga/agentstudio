const { spawnSync } = require('node:child_process')
const path = require('node:path')

const rootDir = path.resolve(__dirname, '..')
const checks = [
  { label: 'frontend', cwd: path.join(rootDir, 'web') },
  { label: 'backend', cwd: path.join(rootDir, 'server') }
]

function runReadinessCommand(cwd) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', 'pnpm.cmd run verify:saas-readiness'], {
      cwd,
      stdio: 'inherit',
      shell: false
    })
  }

  return spawnSync('pnpm', ['run', 'verify:saas-readiness'], {
    cwd,
    stdio: 'inherit',
    shell: false
  })
}

for (const check of checks) {
  console.log(`\n[saas-readiness] ${check.label}`)
  const result = runReadinessCommand(check.cwd)

  if (result.status !== 0) {
    if (result.error) console.error(result.error.message)
    console.error(`[saas-readiness] ${check.label} failed`)
    process.exit(result.status || 1)
  }
}

console.log('\nSaaS repository readiness verified.')
