# P10 SaaS Env Contract Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a backend readiness gate that keeps SaaS runtime environment keys, `.env.example`, and Joi validation synchronized and removes unsafe example secrets.

**Architecture:** Implement this as a Jest spec under `server/src/config` so it runs inside the existing backend readiness command. The spec reads `env.validation.ts`, `configuration.ts`, `server/.env.example`, and `docs/saas-launch-readiness-checklist.md`, then verifies SaaS/Alipay/local-runtime keys are documented, schema-covered, and free of unsafe default secret values.

**Tech Stack:** Jest, TypeScript, Node `fs/path`, existing `pnpm.cmd run verify:saas-readiness`.

## Global Constraints

- Do not read or modify real `server/.env`.
- Do not add invoice functionality.
- Do not add runtime dependencies.
- Keep the gate static and deterministic; it must not require MySQL, Redis, Alipay, or external network access.
- Use `pnpm.cmd` on Windows PowerShell.
- Use TDD: write the failing spec first, verify it fails on current env contract gaps, then fix the minimal files.

---

### Task 1: Add Failing Env Contract Spec

**Files:**
- Create: `server/src/config/saas-env-contract.spec.ts`

**Interfaces:**
- Consumes: `server/src/config/env.validation.ts`, `server/src/config/configuration.ts`, `server/.env.example`, and `docs/saas-launch-readiness-checklist.md`.
- Produces: Jest coverage for SaaS environment readiness.

- [ ] **Step 1: Write the failing spec**

Create `server/src/config/saas-env-contract.spec.ts`:

```typescript
import { readFileSync } from 'fs';
import { join } from 'path';

const REPO_ROOT = join(__dirname, '../../..');

const REQUIRED_SAAS_ENV_KEYS = [
  'DB_HOST',
  'DB_PORT',
  'DB_USERNAME',
  'DB_PASSWORD',
  'DB_NAME',
  'JWT_SECRET',
  'JWT_EXPIRES_IN',
  'LOGIN_CAPTCHA_ENABLED',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_DB',
  'SAAS_DEV_PAYMENT_CONFIRM_ENABLED',
  'ALIPAY_ENABLED',
  'ALIPAY_APP_ID',
  'ALIPAY_PRIVATE_KEY',
  'ALIPAY_PUBLIC_KEY',
  'ALIPAY_NOTIFY_URL',
  'ALIPAY_RETURN_URL',
  'ALIPAY_GATEWAY_URL',
] as const;

const CONFIGURATION_ENV_KEYS_REQUIRING_SCHEMA = [
  'TAIXU_QDRANT_URL',
  'TAIXU_QDRANT_COLLECTION_PREFIX',
  'TAIXU_QDRANT_VECTOR_SIZE',
  'TAIXU_QDRANT_TIMEOUT',
  'TAIXU_QDRANT_EMBED_BATCH',
  'TAIXU_TAVILY_API_KEY',
] as const;

const UNSAFE_EXAMPLE_VALUES = new Map([
  ['DB_PASSWORD', ['root', 'password', '123456']],
  ['ADMIN_PASSWORD', ['demo_admin_pass_R4x8p2Lm', 'admin', 'password', '123456']],
  ['TAIXU_NEO4J_PASSWORD', ['chen6800', 'neo4j', 'password', '123456']],
]);

describe('SaaS environment contract readiness', () => {
  it('documents and validates SaaS runtime environment keys', () => {
    const schema = readProjectFile('server/src/config/env.validation.ts');
    const example = parseEnvExample(readProjectFile('server/.env.example'));
    const checklist = readProjectFile('docs/saas-launch-readiness-checklist.md');

    for (const key of REQUIRED_SAAS_ENV_KEYS) {
      expect(schema).toContain(`${key}: Joi.`);
      expect(example).toHaveProperty(key);
      expect(checklist).toContain(key);
    }

    expect(schema).toContain("ALIPAY_GATEWAY_URL: Joi.string().uri()");
    expect(example.ALIPAY_GATEWAY_URL).toBe('https://openapi-sandbox.dl.alipaydev.com/gateway.do');
  });

  it('keeps configuration env usage covered by Joi validation', () => {
    const configuration = readProjectFile('server/src/config/configuration.ts');
    const schema = readProjectFile('server/src/config/env.validation.ts');

    for (const key of CONFIGURATION_ENV_KEYS_REQUIRING_SCHEMA) {
      expect(configuration).toContain(`process.env.${key}`);
      expect(schema).toContain(`${key}: Joi.`);
    }
  });

  it('does not ship unsafe secret defaults in server .env.example', () => {
    const example = parseEnvExample(readProjectFile('server/.env.example'));

    for (const [key, unsafeValues] of UNSAFE_EXAMPLE_VALUES) {
      const actual = example[key] || '';
      expect(unsafeValues).not.toContain(actual);
    }

    expect(example.JWT_SECRET).toContain('change_me');
    expect(example.JWT_SECRET.length).toBeGreaterThanOrEqual(32);
    expect(example.ADMIN_PASSWORD).toContain('change_me');
  });
});

function readProjectFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

function parseEnvExample(source: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separator = trimmed.indexOf('=');
    if (separator === -1) continue;
    env[trimmed.slice(0, separator)] = trimmed.slice(separator + 1);
  }
  return env;
}
```

- [ ] **Step 2: Run the spec to verify RED**

Run:

```powershell
cd server
pnpm.cmd test -- saas-env-contract.spec.ts --runInBand --forceExit
```

Expected: FAIL because:
- `TAIXU_QDRANT_TIMEOUT` and `TAIXU_TAVILY_API_KEY` are used in configuration but missing from Joi validation.
- checklist does not list env keys.
- `.env.example` has unsafe example secret values such as `DB_PASSWORD=root`, `ADMIN_PASSWORD=demo_admin_pass_R4x8p2Lm`, and `TAIXU_NEO4J_PASSWORD=chen6800`.

### Task 2: Fix the Env Contract

**Files:**
- Modify: `server/src/config/env.validation.ts`
- Modify: `server/.env.example`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: required env keys from the failing spec.
- Produces: schema/example/checklist alignment for SaaS local and pre-release readiness.

- [ ] **Step 1: Add missing Joi schema keys**

In `server/src/config/env.validation.ts`, add:

```typescript
TAIXU_QDRANT_TIMEOUT: Joi.number().integer().min(1).max(600).optional(),
TAIXU_TAVILY_API_KEY: Joi.string().allow('').optional(),
```

Place `TAIXU_QDRANT_TIMEOUT` next to the other Qdrant keys and `TAIXU_TAVILY_API_KEY` next to `TAIXU_MCP_AMAP_KEY`.

- [ ] **Step 2: Replace unsafe `.env.example` secret defaults**

Update only example values, not real `.env`:

```dotenv
DB_PASSWORD=change_me_db_password
ADMIN_PASSWORD=change_me_admin_password_32_chars
TAIXU_NEO4J_PASSWORD=
```

Keep `JWT_SECRET=this_is_jwt_secret_change_me_32_chars_min` because it is a clear placeholder and satisfies the min length requirement.

- [ ] **Step 3: Add an env contract section to the readiness checklist**

In `docs/saas-launch-readiness-checklist.md`, add an `Environment Contract` section before manual flows with:

```markdown
## Environment Contract

Required local/demo backend keys:

- `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`
- `JWT_SECRET`, `JWT_EXPIRES_IN`, `LOGIN_CAPTCHA_ENABLED`
- `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_DB`
- `SAAS_DEV_PAYMENT_CONFIRM_ENABLED`
- `ALIPAY_ENABLED`, `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY`, `ALIPAY_NOTIFY_URL`, `ALIPAY_RETURN_URL`, `ALIPAY_GATEWAY_URL`

Use `server/.env.example` as a placeholder-only template. Replace `change_me_*` values before running shared, staging, or production environments.
```

- [ ] **Step 4: Run the spec to verify GREEN**

Run:

```powershell
cd server
pnpm.cmd test -- saas-env-contract.spec.ts --runInBand --forceExit
```

Expected: PASS.

### Task 3: Include Env Contract in Backend Readiness

**Files:**
- Modify: `server/package.json`
- Modify: `server/scripts/verify-saas-readiness-command.ts`
- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**
- Consumes: `saas-env-contract.spec.ts`.
- Produces: backend and root readiness coverage for the env contract.

- [ ] **Step 1: Add the spec to backend readiness**

In `server/package.json`, append `saas-env-contract.spec.ts` to `verify:saas-readiness`.

In `server/scripts/verify-saas-readiness-command.ts`, append `saas-env-contract.spec.ts` to `expectedSuites`.

In `docs/saas-launch-readiness-checklist.md`, add `saas-env-contract.spec.ts` to the expanded backend gate command.

- [ ] **Step 2: Run backend command verifier**

Run:

```powershell
cd server
pnpm.cmd exec tsx scripts/verify-saas-readiness-command.ts
```

Expected: PASS.

### Task 4: Full P10 Verification and Commit

**Files:**
- No additional production files.

**Interfaces:**
- Consumes: changed config/schema/docs/readiness command.
- Produces: local commit if all gates pass.

- [ ] **Step 1: Run focused config/env tests**

Run:

```powershell
cd server
pnpm.cmd test -- configuration.spec.ts saas-env-contract.spec.ts --runInBand --forceExit
```

Expected: PASS.

- [ ] **Step 2: Run backend SaaS readiness**

Run:

```powershell
cd server
pnpm.cmd run verify:saas-readiness
```

Expected: PASS.

- [ ] **Step 3: Run root repository readiness**

Run:

```powershell
node scripts/run-saas-readiness.cjs
```

Expected: PASS.

- [ ] **Step 4: Review diff and whitespace**

Run:

```powershell
git diff --check
git diff -- docs/superpowers/plans/2026-07-08-p10-saas-env-contract-readiness.md docs/saas-launch-readiness-checklist.md server/.env.example server/package.json server/scripts/verify-saas-readiness-command.ts server/src/config/env.validation.ts server/src/config/saas-env-contract.spec.ts
```

Expected: no whitespace errors; diff limited to env contract readiness.

- [ ] **Step 5: Commit**

Run:

```powershell
git add docs/superpowers/plans/2026-07-08-p10-saas-env-contract-readiness.md docs/saas-launch-readiness-checklist.md server/.env.example server/package.json server/scripts/verify-saas-readiness-command.ts server/src/config/env.validation.ts server/src/config/saas-env-contract.spec.ts
git commit -m "test: add saas env contract readiness"
```

## Self-Review

- Spec coverage: The plan covers env schema/example/checklist alignment, missing TaiXu validation keys, unsafe example secrets, and backend readiness inclusion.
- Placeholder scan: No placeholders remain.
- Type consistency: `saas-env-contract.spec.ts` is named consistently across package script, command verifier, and checklist.
