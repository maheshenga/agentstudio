# P1 Security UX Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close P1 audit gaps that can cause unsafe file handling, weak production authentication defaults, broken public legal links, and poor login conversion.

**Architecture:** Keep the existing NestJS/Vue structure. Add focused backend unit tests around upload path handling and JWT secret resolution, then implement minimal helpers in the touched services. Add frontend static legal routes and restore the visible registration path without changing router or auth contracts.

**Tech Stack:** NestJS 11, TypeORM repositories mocked with Jest, Express response download, Vue 3, Vue Router 5, Element Plus, Vite.

---

## File Structure

- `server/src/module/upload/upload.service.spec.ts`
  - New Jest unit tests for safe chunk upload, chunk merge path validation, missing attachment download, and successful local attachment download metadata.
- `server/src/module/upload/upload.service.ts`
  - Add safe token validation for `uploadId`, sanitized chunk filenames, path containment checks, and a real download descriptor.
- `server/src/module/upload/upload.controller.ts`
  - Inject `@Res()` into download endpoint and call `res.download()` with the descriptor returned by service.
- `server/src/module/system/auth/auth.strategy.spec.ts`
  - New Jest unit tests that verify configured JWT secrets work and missing secrets fail fast.
- `server/src/module/system/auth/auth.strategy.ts`
  - Remove `default_secret` fallback and throw when no configured secret exists.
- `server/src/main.ts`
  - Replace disabled CSP with configurable report-only CSP defaulting to enabled outside development/test.
- `web/src/views/auth/login/index.vue`
  - Remove production default credentials, restore the register CTA, and keep optional demo defaults behind Vite env flags.
- `web/src/views/legal/privacy-policy.vue`
  - New static privacy policy page.
- `web/src/views/legal/terms.vue`
  - New static terms page.
- `web/src/router/routes/staticRoutes.ts`
  - Add `/privacy-policy` and `/terms` static routes before catch-all 404.
- `web/src/views/saas/signup/index.vue`
  - Link to both privacy policy and terms.

## Task 1: Backend Upload Path And Download Safety

**Files:**
- Create: `server/src/module/upload/upload.service.spec.ts`
- Modify: `server/src/module/upload/upload.service.ts`
- Modify: `server/src/module/upload/upload.controller.ts`

- [ ] **Step 1: Write failing upload service tests**

Add tests that instantiate `UploadService` with mocked repositories and config:

```typescript
it('rejects unsafe chunk upload ids before writing files', async () => {
  await expect(
    service.chunkFileUpload(file('a'), {
      uploadId: '../escape',
      fileName: 'demo.txt',
      index: 0,
      totalChunks: 1,
    }),
  ).rejects.toThrow('Invalid upload id');
});

it('stores chunk files under upload/thunk without raw filenames in path', async () => {
  await service.chunkFileUpload(file('a'), {
    uploadId: 'upload_123',
    fileName: '../demo.txt',
    index: 0,
    totalChunks: 1,
  });

  const written = fs.readdirSync(path.join(uploadDir, 'thunk', 'upload_123'));
  expect(written).toEqual(['chunk-0.part']);
});

it('returns a failed result for missing downloads', async () => {
  uploadRepo.findOne.mockResolvedValue(null);
  const result = await service.download(404);
  expect(result.code).toBe(404);
});

it('returns safe local download metadata for existing attachments', async () => {
  uploadRepo.findOne.mockResolvedValue({
    id: 1,
    originName: 'demo.txt',
    storagePath: 'demo.txt',
    deleteTime: null,
  });
  fs.writeFileSync(path.join(uploadDir, 'demo.txt'), 'hello');

  const result = await service.download(1);

  expect(result.code).toBe(200);
  expect(result.data.filePath).toBe(path.join(uploadDir, 'demo.txt'));
  expect(result.data.fileName).toBe('demo.txt');
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `cd server; pnpm.cmd test -- upload.service.spec.ts --runInBand`

Expected: tests fail because `upload.service.spec.ts` is new and production code has no validation/download descriptor yet.

- [ ] **Step 3: Implement safe chunk paths and download metadata**

Implementation rules:
- Accept `uploadId` only when it matches `/^[A-Za-z0-9_-]{6,80}$/`.
- Accept finite integer `index >= 0`.
- Store chunks as `chunk-${index}.part`, never with the raw original filename.
- Resolve every generated path and verify it starts with the resolved upload root.
- Merge chunk files by numeric index parsed from `chunk-${index}.part`, while keeping compatibility with the legacy `@index` suffix format.
- `download(id)` returns `ResultData.fail(404, 'Attachment not found')` for missing/deleted DB rows or missing local file.
- `download(id)` returns `ResultData.ok({ filePath, fileName, mimeType })` for local storage rows.

- [ ] **Step 4: Wire controller download response**

Use:

```typescript
@Get('download/:id')
async download(@Param('id') id: string, @Res() res: Response) {
  const result = await this.uploadService.download(+id);
  if (result.code !== SUCCESS_CODE || !result.data?.filePath) {
    return res.status(result.code || 500).json(result);
  }
  return res.download(result.data.filePath, result.data.fileName);
}
```

- [ ] **Step 5: Run focused upload tests**

Run: `cd server; pnpm.cmd test -- upload.service.spec.ts --runInBand`

Expected: PASS.

## Task 2: Backend Auth And CSP Guardrails

**Files:**
- Create: `server/src/module/system/auth/auth.strategy.spec.ts`
- Modify: `server/src/module/system/auth/auth.strategy.ts`
- Modify: `server/src/main.ts`

- [ ] **Step 1: Write failing JWT strategy tests**

Add tests:

```typescript
it('uses jwt.secret when configured', () => {
  expect(() => new JwtStrategy(config({ 'jwt.secret': 'safe-secret' }))).not.toThrow();
});

it('uses legacy jwt.secretkey when jwt.secret is absent', () => {
  expect(() => new JwtStrategy(config({ 'jwt.secretkey': 'legacy-secret' }))).not.toThrow();
});

it('fails fast when no jwt secret is configured', () => {
  expect(() => new JwtStrategy(config({}))).toThrow('JWT secret is not configured');
});
```

- [ ] **Step 2: Run tests and verify they fail**

Run: `cd server; pnpm.cmd test -- auth.strategy.spec.ts --runInBand`

Expected: missing-secret case fails because current code falls back to `default_secret`.

- [ ] **Step 3: Remove default JWT fallback**

Resolve secret as `config.get('jwt.secret') || config.get('jwt.secretkey')`; throw `new Error('JWT secret is not configured')` when absent.

- [ ] **Step 4: Make CSP configurable instead of disabled**

In `server/src/main.ts`, use:

```typescript
const isDevLike = ['development', 'test'].includes(process.env.NODE_ENV || 'development');
const cspDisabled = configService.get('security.cspDisabled') === true;
const cspReportOnly = configService.get('security.cspReportOnly') !== false;
helmet({
  contentSecurityPolicy: cspDisabled
    ? false
    : {
        reportOnly: isDevLike ? true : cspReportOnly,
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          connectSrc: ["'self'", 'http:', 'https:', 'ws:', 'wss:'],
          fontSrc: ["'self'", 'data:'],
        },
      },
});
```

- [ ] **Step 5: Run focused auth tests**

Run: `cd server; pnpm.cmd test -- auth.strategy.spec.ts --runInBand`

Expected: PASS.

## Task 3: Frontend Login And Legal Static Routes

**Files:**
- Modify: `web/src/views/auth/login/index.vue`
- Create: `web/src/views/legal/privacy-policy.vue`
- Create: `web/src/views/legal/terms.vue`
- Modify: `web/src/router/routes/staticRoutes.ts`
- Modify: `web/src/views/saas/signup/index.vue`

- [ ] **Step 1: Add a visible-text regression script check through rg**

Run before changes:

`rg -n "username: 'admin'|password: '123456'|code: '1234'|privacy-policy|terms" web/src/views web/src/router -g "*.vue" -g "*.ts"`

Expected: login defaults and missing terms route are visible.

- [ ] **Step 2: Clear production login defaults**

Use explicit demo flags:

```typescript
const demoLoginEnabled = import.meta.env.VITE_DEMO_LOGIN === 'true';
const formData = reactive({
  username: demoLoginEnabled ? (import.meta.env.VITE_DEMO_USERNAME || '') : '',
  password: demoLoginEnabled ? (import.meta.env.VITE_DEMO_PASSWORD || '') : '',
  code: demoLoginEnabled ? (import.meta.env.VITE_DEMO_CODE || '') : '',
  uuid: '',
  tenant_id: undefined as number | undefined,
  rememberPassword: demoLoginEnabled
});
```

- [ ] **Step 3: Restore register CTA**

Uncomment the register block so users can discover account creation:

```vue
<div class="mt-5 text-sm text-gray-600">
  <span>{{ $t('login.noAccount') }}</span>
  <RouterLink class="text-theme" :to="{ name: 'Register' }">
    {{ $t('login.register') }}
  </RouterLink>
</div>
```

- [ ] **Step 4: Add legal static pages and routes**

Add `/privacy-policy` and `/terms` before the catch-all route in `staticRoutes.ts`, both with `isHideTab: true`.

- [ ] **Step 5: Update signup legal links**

Ensure signup copy links to both `/terms` and `/privacy-policy`.

- [ ] **Step 6: Run frontend typecheck/build**

Run:

```powershell
cd web
pnpm.cmd exec vue-tsc --noEmit
pnpm.cmd run build
```

Expected: both commands exit 0.

## Task 4: Cross-check And Commit

**Files:**
- All files changed in Tasks 1-3.

- [ ] **Step 1: Run backend focused tests**

Run:

```powershell
cd server
pnpm.cmd test -- upload.service.spec.ts auth.strategy.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 2: Run backend build**

Run:

```powershell
cd server
pnpm.cmd run build
```

Expected: exit 0.

- [ ] **Step 3: Run frontend checks**

Run:

```powershell
cd web
pnpm.cmd exec vue-tsc --noEmit
pnpm.cmd run build
```

Expected: exit 0.

- [ ] **Step 4: Review diff**

Run:

```powershell
git diff -- server/src/module/upload/upload.service.ts server/src/module/upload/upload.controller.ts server/src/module/upload/upload.service.spec.ts server/src/module/system/auth/auth.strategy.ts server/src/module/system/auth/auth.strategy.spec.ts server/src/main.ts web/src/views/auth/login/index.vue web/src/views/legal/privacy-policy.vue web/src/views/legal/terms.vue web/src/router/routes/staticRoutes.ts web/src/views/saas/signup/index.vue docs/superpowers/plans/2026-07-06-p1-security-ux-hardening.md
```

Expected: only P1 changes are present.

- [ ] **Step 5: Commit**

Run:

```powershell
git add server/src/module/upload/upload.service.ts server/src/module/upload/upload.controller.ts server/src/module/upload/upload.service.spec.ts server/src/module/system/auth/auth.strategy.ts server/src/module/system/auth/auth.strategy.spec.ts server/src/main.ts web/src/views/auth/login/index.vue web/src/views/legal/privacy-policy.vue web/src/views/legal/terms.vue web/src/router/routes/staticRoutes.ts web/src/views/saas/signup/index.vue docs/superpowers/plans/2026-07-06-p1-security-ux-hardening.md
git commit -m "fix: harden p1 security and login paths"
```

Expected: commit created without staging unrelated `server/pnpm-lock.yaml`, `.codebase-memory/`, or `.codegraph/`.

## Self-Review

- Spec coverage: upload path traversal, broken download, JWT fallback, CSP disabled, login default credentials, hidden register CTA, and missing legal routes are covered.
- Placeholder scan: no TBD/TODO/later-only instructions.
- Type consistency: upload service returns `ResultData` with `data.filePath`, `data.fileName`, and optional `data.mimeType`; controller only streams when those fields are present.
