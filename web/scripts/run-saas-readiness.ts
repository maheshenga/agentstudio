import { spawnSync } from 'node:child_process'

const checks = [
  'verify-saas-launch-flow-readiness.ts',
  'verify-saas-route-contract.ts',
  'verify-saas-ui-state-readiness.ts',
  'verify-saas-tenant-ui-state-readiness.ts',
  'verify-saas-visible-copy-encoding.ts',
  'verify-saas-signup-activation.ts',
  'verify-saas-platform-tenant-page.ts',
  'verify-saas-payment-path-copy.ts',
  'verify-saas-resource-pack-crud.ts',
  'verify-no-legacy-saiadmin-composable.ts',
  'verify-saas-public-brand-surfaces.ts'
]

for (const script of checks) {
  console.log(`\n[saas-readiness] ${script}`)
  const result = spawnSync(process.execPath, ['node_modules/tsx/dist/cli.mjs', `scripts/${script}`], {
    cwd: process.cwd(),
    stdio: 'inherit',
    shell: false
  })

  if (result.status !== 0) {
    console.error(`[saas-readiness] ${script} failed`)
    process.exit(result.status || 1)
  }
}

console.log('\nSaaS frontend readiness verified.')
