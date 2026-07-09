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
  menus?: unknown[];
  permissions?: string[];
};

type PlanItem = {
  code?: string;
  name?: string;
  status?: number | string;
};

type OrderData = {
  order_no?: string;
  status?: string;
};

type RequestOptions = {
  method?: 'GET' | 'POST';
  token?: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
};

const failures: string[] = [];
const completedReadChecks: string[] = [];
const baseUrl = requiredEnv('SAAS_LIVE_E2E_BASE_URL');
const username = requiredEnv('SAAS_LIVE_E2E_USERNAME');
const password = requiredEnv('SAAS_LIVE_E2E_PASSWORD');
const requestedTenantId = process.env.SAAS_LIVE_E2E_TENANT_ID?.trim();
const planCode = process.env.SAAS_LIVE_E2E_PLAN_CODE?.trim() || 'pro';
const billingCycle = process.env.SAAS_LIVE_E2E_BILLING_CYCLE?.trim() || 'monthly';
const runPayment = process.env.SAAS_LIVE_E2E_RUN_PAYMENT === '1';

function requiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    failures.push(`${name} is required for live SaaS E2E`);
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

async function requestJson<T>(path: string, options: RequestOptions = {}) {
  const url = new URL(path.replace(/^\//, ''), `${baseUrl.replace(/\/$/, '')}/`);
  for (const [key, value] of Object.entries(options.query ?? {})) {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value));
    }
  }

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

async function verifyReadEndpoint(label: string, path: string, token: string) {
  const result = await requestJson(path, { token });
  const data = assertOk(label, result);
  if (failures.length === 0) {
    completedReadChecks.push(label);
  }
  return data;
}

async function verifyLiveE2E() {
  if (failures.length) return;

  assert(
    ['monthly', 'yearly'].includes(billingCycle),
    'SAAS_LIVE_E2E_BILLING_CYCLE must be either monthly or yearly',
  );
  if (failures.length) return;

  assertOk('login captcha status', await requestJson('/api/core/login-captcha'));

  const tenants = assertOk<TenantItem[]>(
    'credential-gated tenant lookup',
    await requestJson('/api/core/tenants-by-credentials', {
      method: 'POST',
      body: { username, password },
    }),
  );
  assert(Array.isArray(tenants) && tenants.length > 0, 'credential-gated tenant lookup must return at least one tenant');
  if (!Array.isArray(tenants) || tenants.length === 0) return;

  const selectedTenant = selectTenant(tenants);
  assert(
    selectedTenant?.id,
    requestedTenantId
      ? `SAAS_LIVE_E2E_TENANT_ID ${requestedTenantId} was not found for the supplied credentials`
      : 'credential-gated tenant lookup returned a tenant without id',
  );
  if (!selectedTenant?.id) return;

  const selectedTenantId = Number(selectedTenant.id);
  const loginData = assertOk<LoginData>(
    'tenant-scoped login',
    await requestJson('/api/core/login', {
      method: 'POST',
      body: { username, password, tenant_id: selectedTenantId },
    }),
  );
  assert(loginData?.access_token, 'tenant-scoped login must return data.access_token');
  assert(loginData?.refresh_token, 'tenant-scoped login must return data.refresh_token');
  assert(Number(loginData?.tenant_id) === selectedTenantId, 'tenant-scoped login must preserve selected tenant_id');
  if (!loginData?.access_token) return;

  const token = loginData.access_token;
  await verifyReadEndpoint('current user profile', '/api/core/system/user', token);
  await verifyReadEndpoint('current user menu', '/api/core/system/menu', token);
  await verifyReadEndpoint('tenant usage', '/api/saas/tenant/usage', token);
  const plans = (await verifyReadEndpoint('tenant plans', '/api/saas/tenant/plans', token)) as PlanItem[] | undefined;
  await verifyReadEndpoint('tenant subscription', '/api/saas/tenant/subscription', token);
  await verifyReadEndpoint('tenant modules', '/api/saas/tenant/modules', token);
  await verifyReadEndpoint('Alipay config status', '/api/saas/payment/alipay/config-status', token);

  if (runPayment) {
    await verifyPaymentFlow(token, plans);
  } else {
    console.log('Skipping payment mutation; set SAAS_LIVE_E2E_RUN_PAYMENT=1 to verify dev payment confirmation.');
  }

  if (failures.length) return;

  console.log(
    JSON.stringify(
      {
        base_url: baseUrl,
        username,
        tenant_id: selectedTenantId,
        read_checks: completedReadChecks,
        payment_checked: runPayment,
        plan_code: runPayment ? planCode : undefined,
      },
      null,
      2,
    ),
  );
}

async function verifyPaymentFlow(token: string, plans: PlanItem[] | undefined) {
  assert(Array.isArray(plans), 'tenant plans must return an array before payment can be checked');
  const selectedPlan = plans?.find((plan) => plan.code === planCode);
  assert(selectedPlan, `SAAS_LIVE_E2E_PLAN_CODE ${planCode} was not found in tenant plans`);
  if (!selectedPlan) return;

  const order = assertOk<OrderData>(
    'create plan upgrade order',
    await requestJson('/api/saas/tenant/orders', {
      method: 'POST',
      token,
      body: { plan_code: planCode, billing_cycle: billingCycle, payment_method: 'alipay' },
    }),
  );
  assert(order?.order_no, 'create plan upgrade order must return data.order_no');
  if (!order?.order_no) return;

  const paidOrder = assertOk<OrderData>(
    'dev payment confirmation',
    await requestJson('/api/saas/payment/dev-confirm', {
      method: 'POST',
      token,
      body: { order_no: order.order_no, order_type: 'plan' },
    }),
  );
  assert(paidOrder?.status === 'paid', `dev payment confirmation must return paid status, got ${paidOrder?.status}`);
}

async function main() {
  try {
    await verifyLiveE2E();
  } catch (error) {
    failures.push(error instanceof Error ? error.message : String(error));
  }

  if (failures.length) {
    console.error(failures.join('\n'));
    process.exit(1);
  }

  console.log('SaaS live E2E verified.');
}

void main();
