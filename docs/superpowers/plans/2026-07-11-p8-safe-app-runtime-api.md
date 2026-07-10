# P8 Safe App Runtime API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let entitled static apps request a sanitized tenant, user, and app context through a versioned parent-page `postMessage` bridge without receiving platform credentials.

**Architecture:** Add a backend runtime-context resolver that reads only allowlisted identity fields after static-version scope and non-deleted membership checks. Extend existing app open metadata with a nullable runtime bootstrap, then add a pure frontend protocol resolver and wire it to the current sandboxed iframe runner with exact `WindowProxy` source validation.

**Tech Stack:** NestJS 11, TypeORM, Jest, Vue 3, TypeScript, Element Plus, Vite, `tsx` readiness scripts.

## Global Constraints

- The only P8 runtime scope is the exact string `runtime:context:read`.
- Runtime context contains only tenant `{ id, name }`, user `{ id, display_name }`, and app `{ code, name, version }`.
- Runtime IDs are strings to preserve MySQL `bigint` precision.
- `display_name` comes only from `UserEntity.realname`; never fall back to the login `username`.
- Never expose username, tenant code, email, phone, avatar, department, roles, permissions, IP, user agent, cookies, authorization values, access tokens, refresh tokens, Redis UUIDs, request objects, or raw exceptions.
- Only static apps can receive a runtime bootstrap; external iframe and internal-route apps receive `runtime: null`.
- Existing publication, installation, entitlement, resolved-version, and app-open audit behavior remains authoritative.
- Static manifests without `runtime:context:read` continue to open and receive an empty runtime scope list with null context.
- The iframe sandbox must continue to exclude `allow-same-origin`.
- `targetOrigin: "*"` is allowed only after exact `event.source === iframe.contentWindow` validation because sandboxed static apps have opaque origins.
- P8 adds no runtime token, direct iframe-to-backend API, write API, data API, migration, billing, AI, file, storage, or service-plugin capability.
- Use `pnpm.cmd` in PowerShell.
- Do not use multi-agents and do not push unless the user explicitly requests it.

## File Structure

Backend create:

- `server/src/module/app/services/app-runtime-context.service.ts`: scope resolution, membership verification, sanitized bootstrap construction.
- `server/src/module/app/services/app-runtime-context.service.spec.ts`: focused runtime context behavior and sensitive-field tests.

Backend modify:

- `server/src/module/app/app.module.ts`: register user, tenant, membership repositories and runtime context provider.
- `server/src/module/app/services/app-tenant.service.ts`: attach runtime bootstrap to existing open metadata.
- `server/src/module/app/services/app-tenant.service.spec.ts`: prove integration does not alter open and audit behavior.

Frontend create:

- `web/src/utils/app-runtime.ts`: protocol constants, types, parser, fixed responses.
- `web/scripts/verify-app-runtime-readiness.ts`: executable protocol tests and source/security readiness checks.

Frontend modify:

- `web/src/api/app-marketplace.ts`: type the runtime bootstrap on `AppOpenMetadata`.
- `web/src/views/app-center/open/index.vue`: bind the bridge to the current static iframe.
- `web/package.json`: add `verify:app-runtime-readiness`.
- `docs/saas-launch-readiness-checklist.md`: add P8 automated, manual, and acceptance checks.

---

### Task 1: Resolve Sanitized Runtime Context

**Files:**

- Create: `server/src/module/app/services/app-runtime-context.service.ts`
- Create: `server/src/module/app/services/app-runtime-context.service.spec.ts`
- Modify: `server/src/module/app/app.module.ts`

**Interfaces:**

- Consumes: `AppPackageEntity`, `AppPackageVersionEntity`, authenticated `tenantId` and `userId`.
- Produces: `APP_RUNTIME_PROTOCOL_VERSION`, `APP_RUNTIME_CONTEXT_SCOPE`, `AppRuntimeContext`, `AppRuntimeBootstrap`, and `AppRuntimeContextService.buildBootstrap()`.

- [ ] **Step 1: Write the failing runtime context service spec**

Create the spec with repository fakes for `TenantEntity`, `UserEntity`, and `SysUserTenantEntity`. Import `UserEntity` from `../../system/user/entities/sys-user.entity`. Follow one-test-at-a-time Red-Green-Refactor cycles while covering these exact behaviors:

```ts
const staticApp = {
  id: 10,
  code: 'job_board',
  name: 'Job Board',
  type: 'static',
} as AppPackageEntity;

const scopedVersion = {
  id: 20,
  version: '1.2.0',
  manifest: { permissions: ['job:view', 'runtime:context:read'] },
} as AppPackageVersionEntity;

it('returns allowlisted context for an active scoped static app', async () => {
  tenantRepo.findOne.mockResolvedValue({ id: 23, tenantName: 'Acme', status: 1 });
  userRepo.findOne.mockResolvedValue({ id: 91, realname: 'Owner', status: 1 });
  membershipRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, userId: 91 });

  await expect(
    service.buildBootstrap({ tenantId: 23, userId: 91, app: staticApp, version: scopedVersion }),
  ).resolves.toEqual({
    protocol_version: 1,
    scopes: ['runtime:context:read'],
    context: {
      tenant: { id: '23', name: 'Acme' },
      user: { id: '91', display_name: 'Owner' },
      app: { code: 'job_board', name: 'Job Board', version: '1.2.0' },
    },
  });
});

it('returns an empty bootstrap when the manifest lacks the supported scope', async () => {
  await expect(
    service.buildBootstrap({
      tenantId: 23,
      userId: 91,
      app: staticApp,
      version: { ...scopedVersion, manifest: { permissions: ['job:view'] } },
    }),
  ).resolves.toEqual({ protocol_version: 1, scopes: [], context: null });
  expect(tenantRepo.findOne).not.toHaveBeenCalled();
});

it('returns null for a non-static app', async () => {
  await expect(
    service.buildBootstrap({
      tenantId: 23,
      userId: 91,
      app: { ...staticApp, type: 'iframe' },
      version: scopedVersion,
    }),
  ).resolves.toBeNull();
});

it.each(['tenant', 'user', 'membership'] as const)(
  'returns context unavailable when %s identity is missing',
  async (missing) => {
    tenantRepo.findOne.mockResolvedValue(missing === 'tenant' ? null : { id: 23, tenantName: 'Acme', status: 1 });
    userRepo.findOne.mockResolvedValue(
      missing === 'user' ? null : { id: 91, realname: '', status: 1 },
    );
    membershipRepo.findOne.mockResolvedValue(
      missing === 'membership' ? null : { id: 7, tenantId: 23, userId: 91 },
    );

    const result = await service.buildBootstrap({ tenantId: 23, userId: 91, app: staticApp, version: scopedVersion });
    expect(result).toEqual({ protocol_version: 1, scopes: ['runtime:context:read'], context: null });
  },
);

it('never serializes credential or contact fields', async () => {
  tenantRepo.findOne.mockResolvedValue({
    id: 23,
    tenantName: 'Acme',
    tenantCode: 'acme-secret',
    contactEmail: 'owner@example.com',
    status: 1,
  });
  userRepo.findOne.mockResolvedValue({
    id: 91,
    username: 'owner-login',
    realname: 'Owner',
    email: 'owner@example.com',
    phone: '13800000000',
    password: 'secret',
    status: 1,
  });
  membershipRepo.findOne.mockResolvedValue({ id: 7, tenantId: 23, userId: 91 });

  const result = await service.buildBootstrap({ tenantId: 23, userId: 91, app: staticApp, version: scopedVersion });
  expect(JSON.stringify(result)).not.toMatch(/username|tenantCode|email|phone|password|token|authorization/i);
  expect(JSON.stringify(result)).not.toContain('owner-login');
});
```

Add a separate incremental test proving that `{ realname: '', username: 'owner-login' }` produces `display_name: ''`, never the username value. Membership validity is existence plus `deleteTime IS NULL`; `SysUserTenantEntity` has no `status` column.

- [ ] **Step 2: Run the new spec to verify RED**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-runtime-context.service.spec.ts
```

Expected: FAIL because `AppRuntimeContextService` and its exported contracts do not exist.

- [ ] **Step 3: Implement the runtime context service**

Create these exact contracts and behavior:

```ts
export const APP_RUNTIME_PROTOCOL_VERSION = 1 as const;
export const APP_RUNTIME_CONTEXT_SCOPE = 'runtime:context:read' as const;
export type AppRuntimeScope = typeof APP_RUNTIME_CONTEXT_SCOPE;

export interface AppRuntimeContext {
  tenant: { id: string; name: string };
  user: { id: string; display_name: string };
  app: { code: string; name: string; version: string };
}

export interface AppRuntimeBootstrap {
  protocol_version: typeof APP_RUNTIME_PROTOCOL_VERSION;
  scopes: AppRuntimeScope[];
  context: AppRuntimeContext | null;
}

@Injectable()
export class AppRuntimeContextService {
  constructor(
    @InjectRepository(TenantEntity) private readonly tenantRepo: Repository<TenantEntity>,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(SysUserTenantEntity)
    private readonly membershipRepo: Repository<SysUserTenantEntity>,
  ) {}

  async buildBootstrap(input: {
    tenantId: number;
    userId?: number;
    app: AppPackageEntity;
    version: AppPackageVersionEntity | null;
  }): Promise<AppRuntimeBootstrap | null> {
    if (input.app.type !== 'static') return null;

    const scopes = this.resolveScopes(input.version?.manifest);
    const unavailable = {
      protocol_version: APP_RUNTIME_PROTOCOL_VERSION,
      scopes,
      context: null,
    } satisfies AppRuntimeBootstrap;

    if (!scopes.includes(APP_RUNTIME_CONTEXT_SCOPE) || !input.version || !input.userId) {
      return unavailable;
    }

    try {
      const [tenant, user, membership] = await Promise.all([
        this.tenantRepo.findOne({
          where: { id: input.tenantId, status: 1, deleteTime: IsNull() },
          select: { id: true, tenantName: true },
        }),
        this.userRepo.findOne({
          where: { id: input.userId, status: 1, deleteTime: IsNull() },
          select: { id: true, realname: true },
        }),
        this.membershipRepo.findOne({
          where: {
            tenantId: input.tenantId,
            userId: input.userId,
            deleteTime: IsNull(),
          },
          select: { id: true },
        }),
      ]);

      if (!tenant || !user || !membership) return unavailable;

      return {
        protocol_version: APP_RUNTIME_PROTOCOL_VERSION,
        scopes,
        context: {
          tenant: { id: String(tenant.id), name: String(tenant.tenantName || '') },
          user: {
            id: String(user.id),
            display_name: String(user.realname || ''),
          },
          app: {
            code: String(input.app.code || ''),
            name: String(input.app.name || ''),
            version: String(input.version.version || ''),
          },
        },
      };
    } catch {
      return unavailable;
    }
  }

  private resolveScopes(manifest?: Record<string, unknown> | null): AppRuntimeScope[] {
    const permissions = Array.isArray(manifest?.permissions) ? manifest.permissions : [];
    return permissions.includes(APP_RUNTIME_CONTEXT_SCOPE) ? [APP_RUNTIME_CONTEXT_SCOPE] : [];
  }
}
```

Register `TenantEntity`, `UserEntity`, and `SysUserTenantEntity` in the app module `TypeOrmModule.forFeature()` list and register/export `AppRuntimeContextService`. Use the existing entity paths under `system/tenant/entities/tenant.entity`, `system/user/entities/sys-user.entity`, and `system/user/entities/user-tenant.entity`.

- [ ] **Step 4: Run the runtime context spec and backend build**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-runtime-context.service.spec.ts
pnpm.cmd run build
```

Expected: the new suite passes and the backend build exits `0`.

- [ ] **Step 5: Commit the context resolver**

```powershell
git add server/src/module/app/services/app-runtime-context.service.ts server/src/module/app/services/app-runtime-context.service.spec.ts server/src/module/app/app.module.ts
git commit -m "feat: resolve app runtime context"
```

---

### Task 2: Attach Runtime Bootstrap To App Open Metadata

**Files:**

- Modify: `server/src/module/app/services/app-tenant.service.ts`
- Modify: `server/src/module/app/services/app-tenant.service.spec.ts`

**Interfaces:**

- Consumes: `AppRuntimeContextService.buildBootstrap()` from Task 1.
- Produces: existing open metadata plus `runtime: AppRuntimeBootstrap | null`.

- [ ] **Step 1: Add failing integration expectations**

Add an `appRuntimeContextService` fake to the existing testing module:

```ts
const appRuntimeContextService = {
  buildBootstrap: jest.fn(),
};
```

Default it to `null`, provide it through `AppRuntimeContextService`, then extend the static-open test:

```ts
appRuntimeContextService.buildBootstrap.mockResolvedValue({
  protocol_version: 1,
  scopes: ['runtime:context:read'],
  context: {
    tenant: { id: '23', name: 'Acme' },
    user: { id: '91', display_name: 'Owner' },
    app: { code: 'job_board', name: 'Job Board', version: '1.0.0' },
  },
});

await expect(service.getOpenMetadata(23, 'job_board', 91)).resolves.toMatchObject({
  code: 'job_board',
  type: 'static',
  runtime: {
    protocol_version: 1,
    scopes: ['runtime:context:read'],
    context: { tenant: { id: '23' }, user: { id: '91' } },
  },
});

expect(appRuntimeContextService.buildBootstrap).toHaveBeenCalledWith(
  expect.objectContaining({ tenantId: 23, userId: 91 }),
);
```

Add an iframe/internal assertion:

```ts
expect(result.runtime).toBeNull();
```

Keep existing open-log assertions unchanged.

- [ ] **Step 2: Run the app tenant suite to verify RED**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-tenant.service.spec.ts
```

Expected: FAIL because open metadata does not include `runtime` and the service dependency is not injected.

- [ ] **Step 3: Integrate the runtime context service**

Inject `AppRuntimeContextService` into `AppTenantService`. After version resolution and before the success audit, call it as a best-effort dependency. A runtime resolver failure must degrade to `runtime: null`, must not fail app opening, and must not create a failed open audit:

```ts
const runtime = await this.appRuntimeContextService
  .buildBootstrap({ tenantId, userId, app, version })
  .catch(() => null);
```

Add an integration test where `buildBootstrap` rejects and verify that open metadata still resolves, `runtime` is null, and the existing success audit remains the only open outcome.

Return `runtime` with the existing fields:

```ts
return {
  code: app.code,
  name: app.name,
  type: app.type,
  open_mode: openMode,
  entry_url: app.entryUrl,
  sandbox: app.type === 'internal' ? '' : STATIC_APP_SANDBOX,
  version: version?.version || '',
  runtime,
};
```

`buildBootstrap()` handles repository failures internally, while the integration catch provides a final containment boundary so app-open audit behavior remains unchanged.

- [ ] **Step 4: Run backend integration and regression suites**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-runtime-context.service.spec.ts app-tenant.service.spec.ts app-analytics.service.spec.ts
pnpm.cmd run build
```

Expected: all suites and the backend build pass.

- [ ] **Step 5: Commit the open metadata integration**

```powershell
git add server/src/module/app/services/app-tenant.service.ts server/src/module/app/services/app-tenant.service.spec.ts
git commit -m "feat: expose app runtime bootstrap"
```

---

### Task 3: Implement The Pure Browser Runtime Protocol

**Files:**

- Create: `web/src/utils/app-runtime.ts`
- Create: `web/scripts/verify-app-runtime-readiness.ts`
- Modify: `web/package.json`

**Interfaces:**

- Consumes: backend runtime bootstrap shape from Task 1.
- Produces: `resolveAppRuntimeRequest(message, bootstrap)` returning a fixed response or `null`.

- [ ] **Step 1: Create a failing executable protocol readiness script**

The script imports the not-yet-created protocol module and asserts:

```ts
import {
  APP_RUNTIME_CHANNEL,
  APP_RUNTIME_PROTOCOL_VERSION,
  resolveAppRuntimeRequest,
  type AppRuntimeBootstrap,
} from '../src/utils/app-runtime'

const bootstrap: AppRuntimeBootstrap = {
  protocol_version: 1,
  scopes: ['runtime:context:read'],
  context: {
    tenant: { id: '23', name: 'Acme' },
    user: { id: '91', display_name: 'Owner' },
    app: { code: 'job_board', name: 'Job Board', version: '1.2.0' },
  },
}

assertDeepEqual(
  resolveAppRuntimeRequest(
    {
      channel: APP_RUNTIME_CHANNEL,
      version: APP_RUNTIME_PROTOCOL_VERSION,
      type: 'context.get',
      request_id: 'request-1',
    },
    bootstrap
  ),
  {
    channel: APP_RUNTIME_CHANNEL,
    version: 1,
    type: 'context.result',
    request_id: 'request-1',
    ok: true,
    data: bootstrap.context,
  }
)
```

Add these checks incrementally, running the script after each new behavior so every assertion is observed failing before its implementation. Assert:

- wrong channel returns `null`;
- arrays, dates, and other non-plain objects return `null`;
- empty or over-100-character request IDs return `null`;
- version `2` returns `unsupported_protocol`;
- unknown type returns `unsupported_request`;
- null bootstrap returns `context_unavailable`;
- a non-null bootstrap with a missing scope returns `scope_denied`;
- null context with the scope returns `context_unavailable`;
- serialized responses contain no forbidden sensitive field names.

Add this package script before the module exists:

```json
"verify:app-runtime-readiness": "tsx scripts/verify-app-runtime-readiness.ts"
```

- [ ] **Step 2: Run the protocol script to verify RED**

```powershell
cd web
pnpm.cmd run verify:app-runtime-readiness
```

Expected: FAIL because `src/utils/app-runtime.ts` does not exist.

- [ ] **Step 3: Implement the pure protocol resolver**

Create these public types and constants:

```ts
export const APP_RUNTIME_CHANNEL = 'agentstudio:app-runtime' as const
export const APP_RUNTIME_PROTOCOL_VERSION = 1 as const
export const APP_RUNTIME_CONTEXT_SCOPE = 'runtime:context:read' as const

export interface AppRuntimeContext {
  tenant: { id: string; name: string }
  user: { id: string; display_name: string }
  app: { code: string; name: string; version: string }
}

export interface AppRuntimeBootstrap {
  protocol_version: 1
  scopes: Array<typeof APP_RUNTIME_CONTEXT_SCOPE>
  context: AppRuntimeContext | null
}
```

Implement `resolveAppRuntimeRequest()` with fixed safe errors:

```ts
const ERROR_MESSAGES = {
  unsupported_protocol: 'Runtime protocol is not supported',
  unsupported_request: 'Runtime request is not supported',
  scope_denied: 'Runtime scope is not available',
  context_unavailable: 'Runtime context is unavailable',
} as const

export function resolveAppRuntimeRequest(
  message: unknown,
  bootstrap: AppRuntimeBootstrap | null
): AppRuntimeResponse | null {
  if (!isPlainRecord(message) || message.channel !== APP_RUNTIME_CHANNEL) return null

  const rawRequestId = typeof message.request_id === 'string' ? message.request_id : ''
  const requestId = rawRequestId.trim()
  if (!requestId || rawRequestId.length > 100) return null

  if (message.version !== APP_RUNTIME_PROTOCOL_VERSION) {
    return errorResponse(requestId, 'unsupported_protocol')
  }
  if (message.type !== 'context.get') {
    return errorResponse(requestId, 'unsupported_request')
  }
  if (!bootstrap) {
    return errorResponse(requestId, 'context_unavailable')
  }
  if (!Array.isArray(bootstrap.scopes) || !bootstrap.scopes.includes(APP_RUNTIME_CONTEXT_SCOPE)) {
    return errorResponse(requestId, 'scope_denied')
  }
  if (!bootstrap.context) {
    return errorResponse(requestId, 'context_unavailable')
  }

  return {
    channel: APP_RUNTIME_CHANNEL,
    version: APP_RUNTIME_PROTOCOL_VERSION,
    type: 'context.result',
    request_id: requestId,
    ok: true,
    data: bootstrap.context,
  }
}
```

Keep helpers private and do not reference `window`, Vue, the API client, cookies, or storage. `isPlainRecord()` must reject arrays, dates, class instances, and other non-plain objects.

- [ ] **Step 4: Run protocol readiness and focused lint**

```powershell
cd web
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd exec eslint src/utils/app-runtime.ts scripts/verify-app-runtime-readiness.ts
```

Expected: protocol readiness and focused lint pass.

- [ ] **Step 5: Commit the protocol module**

```powershell
git add web/src/utils/app-runtime.ts web/scripts/verify-app-runtime-readiness.ts web/package.json
git commit -m "feat: add app runtime message protocol"
```

---

### Task 4: Bind The Protocol To The Sandboxed Static App Runner

**Files:**

- Modify: `web/src/api/app-marketplace.ts`
- Modify: `web/src/views/app-center/open/index.vue`
- Modify: `web/scripts/verify-app-runtime-readiness.ts`

**Interfaces:**

- Consumes: `AppRuntimeBootstrap` and `resolveAppRuntimeRequest()` from Task 3.
- Produces: source-bound `postMessage` replies from the current static iframe only.

- [ ] **Step 1: Extend readiness checks to require runner wiring**

Before editing the runner, make the readiness script read `web/src/views/app-center/open/index.vue` and `web/src/api/app-marketplace.ts`, then require:

```ts
assertIncludes(runnerSource, 'ref="appFrame"', 'app runner iframe binding')
assertIncludes(runnerSource, 'event.source !== frameWindow', 'runtime source validation')
assertIncludes(runnerSource, "metadata.value?.type !== 'static'", 'static-only runtime bridge')
assertIncludes(runnerSource, "frameWindow.postMessage(response, '*')", 'opaque-origin response')
assertIncludes(runnerSource, "window.addEventListener('message', handleRuntimeMessage)", 'runtime listener setup')
assertIncludes(runnerSource, "window.removeEventListener('message', handleRuntimeMessage)", 'runtime listener cleanup')
assertIncludes(runnerSource, 'loadSequence', 'stale metadata response guard')
assertIncludes(apiSource, 'runtime: AppRuntimeBootstrap | null', 'open metadata runtime contract')
assert(!runnerSource.includes('allow-same-origin'), 'app runner must not allow same origin')
```

Reject source containing runtime payload fields matching username, tenant code, email, phone, role, token, authorization, cookie, IP, or user agent.

- [ ] **Step 2: Run readiness to verify RED**

```powershell
cd web
pnpm.cmd run verify:app-runtime-readiness
```

Expected: FAIL because the API type and runner bridge are not wired.

- [ ] **Step 3: Type the runtime bootstrap in the API client**

Import the type from `@/utils/app-runtime` and extend `AppOpenMetadata`:

```ts
import type { AppRuntimeBootstrap } from '@/utils/app-runtime'

export interface AppOpenMetadata {
  code: string
  name: string
  type: AppPackageType
  open_mode: AppOpenMode
  entry_url: string
  sandbox: string
  version?: string
  runtime: AppRuntimeBootstrap | null
}
```

- [ ] **Step 4: Implement source-bound runner messaging**

Add the iframe ref:

```vue
<iframe
  v-if="metadata.open_mode === 'iframe'"
  ref="appFrame"
  class="app-runner-page__iframe"
  :src="metadata.entry_url"
  :title="metadata.name"
  :sandbox="safeSandbox"
  referrerpolicy="no-referrer"
/>
```

Add the pure resolver import and lifecycle wiring:

```ts
import { resolveAppRuntimeRequest } from '@/utils/app-runtime'

const appFrame = ref<HTMLIFrameElement | null>(null)

function handleRuntimeMessage(event: MessageEvent<unknown>) {
  const frameWindow = appFrame.value?.contentWindow
  if (!frameWindow || event.source !== frameWindow || metadata.value?.type !== 'static') return

  const response = resolveAppRuntimeRequest(event.data, metadata.value.runtime)
  if (!response) return
  frameWindow.postMessage(response, '*')
}

onMounted(() => {
  window.addEventListener('message', handleRuntimeMessage)
  loadOpenMetadata()
})

onBeforeUnmount(() => {
  window.removeEventListener('message', handleRuntimeMessage)
})
```

Keep `metadata.value = null` at the beginning of every load so route changes, retries, and reloads remove the old iframe and runtime bootstrap before a new response can be sent.

Add a monotonically increasing `loadSequence`. Capture the sequence at the start of each load and ignore any response, error, or `finally` update whose sequence is no longer current. Increment it during unmount as well. This prevents a slower earlier request from mounting stale app metadata or redirecting to an obsolete internal route after a newer route/reload request.

- [ ] **Step 5: Run frontend readiness, lint, and build**

```powershell
cd web
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd exec eslint src/utils/app-runtime.ts src/api/app-marketplace.ts src/views/app-center/open/index.vue scripts/verify-app-runtime-readiness.ts
pnpm.cmd run build
```

Expected: readiness, focused lint, type-check, and Vite build pass.

- [ ] **Step 6: Commit the runner bridge**

```powershell
git add web/src/api/app-marketplace.ts web/src/views/app-center/open/index.vue web/scripts/verify-app-runtime-readiness.ts
git commit -m "feat: bridge static app runtime context"
```

---

### Task 5: Review, Verify, And Document P8

**Files:**

- Modify: `docs/saas-launch-readiness-checklist.md`

**Interfaces:**

- Consumes: all P8 backend and frontend contracts.
- Produces: final acceptance evidence and local commits with no push.

- [ ] **Step 1: Add automated and manual acceptance checks**

Document:

- `pnpm.cmd run verify:app-runtime-readiness` in automated gates;
- a static manifest declaring `runtime:context:read`;
- valid `context.get` and `context.result` examples;
- missing-scope `scope_denied` behavior;
- external iframe and internal app exclusion;
- exact iframe source validation;
- no `allow-same-origin`;
- approved context field allowlist and forbidden sensitive fields;
- entitlement and non-deleted membership derivation;
- route/reload stale-context clearing;
- no direct iframe backend token or API.

- [ ] **Step 2: Run backend verification**

```powershell
cd server
pnpm.cmd exec jest --runInBand -- app-runtime-context.service.spec.ts app-tenant.service.spec.ts app-analytics.service.spec.ts app-analytics.controller.spec.ts
pnpm.cmd run build
```

- [ ] **Step 3: Run frontend verification**

```powershell
cd web
pnpm.cmd run verify:app-runtime-readiness
pnpm.cmd run verify:app-marketplace-readiness
pnpm.cmd exec eslint src/utils/app-runtime.ts src/api/app-marketplace.ts src/views/app-center/open/index.vue scripts/verify-app-runtime-readiness.ts
pnpm.cmd run build
```

- [ ] **Step 4: Run repository and security checks**

```powershell
git diff --check
rg -n "(access_token|refresh_token|authorization|cookie|username|tenant_code|email|phone|userAgent|user_agent|\\bip\\b|allow-same-origin)" server/src/module/app/services/app-runtime-context.service.ts server/src/module/app/services/app-tenant.service.ts web/src/utils/app-runtime.ts web/src/api/app-marketplace.ts web/src/views/app-center/open/index.vue web/scripts/verify-app-runtime-readiness.ts
git status --short
```

Review every match. Allowed matches are only explicit negative assertions or existing backend audit client-info storage outside runtime responses.

- [ ] **Step 5: Perform final code review**

Inspect the complete P8 diff for:

- context fields serialized from full entities;
- tenant/user IDs accepted from iframe messages;
- missing non-deleted membership checks;
- runtime scope derived from the iframe instead of the resolved manifest;
- external iframe bridge activation;
- messages accepted from a stale or foreign window;
- any platform token/cookie/API client forwarded to the iframe;
- `allow-same-origin` reintroduction;
- runtime resolution changing app-open audit outcomes;
- stale bootstrap surviving route changes or reloads;
- stale asynchronous metadata responses mounting after a newer route or reload request;
- unrelated direct data API or service-plugin scope.

- [ ] **Step 6: Commit P8 verification**

```powershell
git add docs/saas-launch-readiness-checklist.md
git commit -m "docs: verify safe app runtime API"
```

Do not push.

## P8 Definition Of Done

- Static apps can request approved context through `postMessage` only when their resolved manifest declares `runtime:context:read`.
- Context contains only approved string IDs and display names.
- Tenant/user identity comes from authenticated backend state and a non-deleted membership.
- External iframe and internal-route apps receive no runtime bridge.
- The host accepts messages only from the currently rendered static iframe window.
- No platform credential or forbidden identity/contact field crosses the bridge.
- The sandbox continues to exclude `allow-same-origin`.
- Existing app open auditing, tenant entitlement, and P7 analytics tests remain green.
- Backend tests/build, frontend readiness/lint/build, marketplace readiness, and `git diff --check` pass.
- Changes are reviewed and committed locally without a push.
