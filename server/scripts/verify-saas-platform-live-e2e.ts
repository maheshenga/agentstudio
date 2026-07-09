type ApiEnvelope<T = unknown> = {
  code?: number;
  msg?: string;
  message?: string;
  data?: T;
};

type TenantItem = {
  id?: number | string;
  name?: string;
  code?: string;
};

type LoginData = {
  access_token?: string;
  refresh_token?: string;
  tenant_id?: number | string;
};

type UserProfile = {
  is_platform_admin?: boolean;
  is_admin?: boolean;
  account_scope?: string;
  username?: string;
  tenant_id?: number | string;
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  token?: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

const failures: string[] = [];
const completedReadChecks: string[] = [];
const baseUrl = requiredEnv('SAAS_PLATFORM_LIVE_E2E_BASE_URL');
const username = requiredEnv('SAAS_PLATFORM_LIVE_E2E_USERNAME');
const password = requiredEnv('SAAS_PLATFORM_LIVE_E2E_PASSWORD');
const requestedTenantId = process.env.SAAS_PLATFORM_LIVE_E2E_TENANT_ID?.trim();

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    failures.push(`${name} is required for platform live SaaS E2E`);
    return '';
  }
  return value;
}

function assert(condition: unknown, message: string) {
  if (!condition) failures.push(message);
}

function isSuccessEnvelope(value: ApiEnvelope): boolean {
  return Number(value.code) === 200;
}

function describeApiError(label: string, status: number, body: ApiEnvelope | undefined, raw: string) {
  const message = body?.message || body?.msg || raw.slice(0, 200);
  return `${label} failed with HTTP ${status}, code ${body?.code ?? 'unknown'}: ${message}`;
}

function buildUrl(path: string, query?: Record<string, unknown>) {
  const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }
  return url;
}

async function requestJson<T>(path: string, options: RequestOptions = {}) {
  const url = buildUrl(path, options.query);
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: {
      accept: 'application/json',
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const raw = await response.text();
  let json: ApiEnvelope<T> | undefined;
  try {
    json = raw ? (JSON.parse(raw) as ApiEnvelope<T>) : {};
  } catch {
    json = undefined;
  }

  return { response, json, raw, url: url.toString() };
}

function assertOk<T>(label: string, result: Awaited<ReturnType<typeof requestJson<T>>>) {
  assert(result.response.ok, `${label} must return HTTP 2xx, got ${result.response.status}`);
  assert(Boolean(result.json), `${label} must return JSON`);
  if (!result.response.ok || !result.json) {
    failures.push(describeApiError(label, result.response.status, result.json, result.raw));
    return undefined;
  }

  assert(isSuccessEnvelope(result.json), describeApiError(label, result.response.status, result.json, result.raw));
  return isSuccessEnvelope(result.json) ? result.json.data : undefined;
}

function selectTenant(tenants: TenantItem[]) {
  if (!requestedTenantId) return tenants[0];
  return tenants.find((tenant) => String(tenant.id) === requestedTenantId);
}

async function authenticatePlatformAdmin() {
  const tenants = assertOk<TenantItem[]>(
    'credential-gated tenant lookup',
    await requestJson('/api/core/tenants-by-credentials', {
      method: 'POST',
      body: { username, password },
    }),
  );
  assert(Array.isArray(tenants) && tenants.length > 0, 'credential-gated tenant lookup must return at least one tenant');
  if (!Array.isArray(tenants) || tenants.length === 0) return undefined;

  const selectedTenant = selectTenant(tenants);
  assert(
    selectedTenant?.id,
    requestedTenantId
      ? `SAAS_PLATFORM_LIVE_E2E_TENANT_ID ${requestedTenantId} was not found for the supplied credentials`
      : 'credential-gated tenant lookup returned a tenant without id',
  );
  if (!selectedTenant?.id) return undefined;

  const selectedTenantId = Number(selectedTenant.id);
  const loginData = assertOk<LoginData>(
    'tenant-scoped platform login bootstrap',
    await requestJson('/api/core/login', {
      method: 'POST',
      body: { username, password, tenant_id: selectedTenantId },
    }),
  );
  assert(loginData?.access_token, 'tenant-scoped platform login must return data.access_token');
  assert(loginData?.refresh_token, 'tenant-scoped platform login must return data.refresh_token');
  assert(Number(loginData?.tenant_id) === selectedTenantId, 'tenant-scoped platform login must preserve selected tenant_id');
  if (!loginData?.access_token) return undefined;

  const profile = assertOk<UserProfile>(
    'current platform user profile',
    await requestJson('/api/core/system/user', { token: loginData.access_token }),
  );
  assert(profile, 'current platform user profile must return user data');
  assert(
    profile?.is_platform_admin === true || profile?.is_admin === true || profile?.account_scope === 'platform',
    'current user must be a platform administrator for platform live SaaS E2E',
  );
  if (!profile) return undefined;

  return {
    tenantId: selectedTenantId,
    token: loginData.access_token,
    profile,
  };
}

async function verifyReadEndpoint(label: string, path: string, token: string, query?: Record<string, unknown>) {
  const data = assertOk(label, await requestJson(path, { token, query }));
  if (failures.length === 0) {
    completedReadChecks.push(label);
  }
  return data;
}

function assertRuntimeHealthRedacted(payload: unknown) {
  const text = JSON.stringify(payload || {});
  assert(!text.includes(password), 'runtime health must not expose the supplied password');
  assert(!/BEGIN RSA PRIVATE KEY|BEGIN PRIVATE KEY/i.test(text), 'runtime health must not expose private key material');
  assert(!/"private_key"\s*:\s*"[^"*]+"/i.test(text), 'runtime health must not expose raw private_key values');
}

async function verifyPlatformLiveE2E() {
  if (failures.length) return;

  assertOk('login captcha status', await requestJson('/api/core/login-captcha'));
  if (failures.length) return;

  const auth = await authenticatePlatformAdmin();
  if (!auth?.token || failures.length) return;

  const token = auth.token;
  await verifyReadEndpoint('current platform menu', '/api/core/system/menu', token);
  const runtimeHealth = await verifyReadEndpoint('platform runtime health', '/api/saas/platform/runtime-health', token);
  assertRuntimeHealthRedacted(runtimeHealth);
  await verifyReadEndpoint('platform tenants', '/api/saas/platform/tenants', token, { page: 1, limit: 1 });
  await verifyReadEndpoint('platform plans', '/api/saas/platform/plans', token, { page: 1, limit: 1 });
  await verifyReadEndpoint('platform modules', '/api/saas/platform/modules', token);
  await verifyReadEndpoint('platform usage overview', '/api/saas/platform/usage/overview', token);
  await verifyReadEndpoint('platform revenue overview', '/api/saas/platform/revenue/overview', token);
  await verifyReadEndpoint('platform orders', '/api/saas/platform/orders', token, { page: 1, limit: 1 });
  await verifyReadEndpoint('platform order risk overview', '/api/saas/platform/orders/risk/overview', token);
  await verifyReadEndpoint('platform payment reconciliation overview', '/api/saas/platform/payment/reconciliation/overview', token);
  await verifyReadEndpoint('platform payment notify logs', '/api/saas/platform/payment/notify-logs', token, { page: 1, limit: 1 });
  await verifyReadEndpoint('platform subscriptions', '/api/saas/platform/subscriptions', token, { page: 1, limit: 1 });
  await verifyReadEndpoint('platform subscription lifecycle overview', '/api/saas/platform/subscriptions/lifecycle/overview', token);
  await verifyReadEndpoint('platform quota ledgers', '/api/saas/platform/quota-ledgers', token, { page: 1, limit: 1 });
  await verifyReadEndpoint('platform resource packs', '/api/saas/platform/resource-packs', token, { page: 1, limit: 1 });
  await verifyReadEndpoint('platform resource-pack orders', '/api/saas/platform/resource-pack-orders', token, { page: 1, limit: 1 });
  await verifyReadEndpoint('platform Alipay config', '/api/saas/platform/payment/alipay/config', token);

  if (failures.length) return;

  console.log(
    JSON.stringify(
      {
        base_url: baseUrl,
        username,
        tenant_id: auth.tenantId,
        account_scope: auth.profile.account_scope,
        read_checks: completedReadChecks,
        mutation_checked: false,
      },
      null,
      2,
    ),
  );
}

async function main() {
  try {
    await verifyPlatformLiveE2E();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log('SaaS platform live E2E verified.');
}

void main();
