<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-marketplace-page">
      <template #header>
        <div class="app-marketplace-page__header">
          <div>
            <h1 class="app-marketplace-page__title">App Marketplace</h1>
            <p class="app-marketplace-page__subtitle">
              Compare access, price, and trial terms before installing tenant applications.
            </p>
          </div>
          <ElButton type="primary" :icon="Refresh" :loading="loading" @click="loadApps"
            >Refresh</ElButton
          >
        </div>
      </template>

      <div v-if="loadError" class="app-marketplace-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadApps"
          >Retry</ElButton
        >
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="App" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-marketplace-page__app-name">{{ row.name || '-' }}</div>
            <div class="app-marketplace-page__app-code">{{ row.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="category" label="Category" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Type" width="110">
          <template #default="{ row }">
            <ElTag :type="typeTagType(row.type)" effect="light">{{ typeText(row.type) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Commerce" min-width="170">
          <template #default="{ row }">
            <div class="app-marketplace-page__commerce">
              <ElTag :type="commerceTagType(row.commerce?.access_status)" effect="light">
                {{ commerceLabel(row.commerce?.access_status) }}
              </ElTag>
              <span>{{ planLabel(row) }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Access" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.available">{{ availabilityText(row.availability_status) }}</span>
            <span v-else>{{
              row.availability_reason || availabilityText(row.availability_status)
            }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="summary" label="Summary" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">{{ row.summary || row.description || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="Capabilities" min-width="180">
          <template #default="{ row }">
            <div
              v-if="row.requested_capabilities?.length"
              class="app-marketplace-page__capabilities"
            >
              <ElTag
                v-for="capability in row.requested_capabilities"
                :key="capability"
                size="small"
                effect="plain"
              >
                {{ capabilityLabel(capability) }}
              </ElTag>
            </div>
            <span v-else>-</span>
          </template>
        </ElTableColumn>
        <ElTableColumn label="Actions" fixed="right" width="250">
          <template #default="{ row }">
            <ElButton
              v-if="pendingOrder(row.code)"
              link
              type="warning"
              :loading="operatingCode === row.code"
              @click="continuePayment(pendingOrder(row.code)!)"
            >
              Continue payment
            </ElButton>
            <ElButton
              v-else-if="row.commerce_action === 'contact_admin'"
              link
              type="danger"
              disabled
            >
              Contact administrator
            </ElButton>
            <ElButton
              v-else-if="row.commerce_action === 'start_trial'"
              link
              type="success"
              :loading="operatingCode === row.code"
              @click="startTrial(row)"
            >
              Start trial
            </ElButton>
            <ElButton
              v-else-if="row.commerce_action === 'purchase' || row.commerce_action === 'renew'"
              link
              type="primary"
              :icon="ShoppingCart"
              @click="openPurchase(row)"
            >
              {{ row.commerce_action === 'renew' ? 'Renew' : 'Choose plan' }}
            </ElButton>
            <ElButton
              v-else-if="row.availability_status === 'missing_plan_module'"
              link
              type="warning"
              @click="openUpgrade"
            >
              Upgrade
            </ElButton>
            <ElButton
              v-else-if="!row.installed"
              link
              type="primary"
              :icon="ShoppingCart"
              :disabled="!row.available"
              :loading="operatingCode === row.code"
              @click="installApp(row)"
            >
              Install
            </ElButton>
            <ElButton
              v-else
              link
              type="success"
              :icon="Link"
              :disabled="!row.can_open"
              :loading="operatingCode === row.code"
              @click="openApp(row.code)"
            >
              Open
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="No approved apps are available for this tenant" />
        </template>
      </ElTable>
    </ElCard>

    <ElDialog v-model="purchaseDialogVisible" title="Purchase application" width="560px">
      <div v-if="purchaseApp" class="app-marketplace-page__purchase">
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem label="Application">{{ purchaseApp.name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="Payment provider">Alipay</ElDescriptionsItem>
        </ElDescriptions>
        <ElForm label-position="top">
          <ElFormItem label="Price plan">
            <ElSelect v-model="selectedPlanCode" class="w-full" placeholder="Choose a plan">
              <ElOption
                v-for="plan in paidPlans(purchaseApp)"
                :key="plan.code"
                :label="`${plan.name} · ${formatMoney(plan.amount_cents)}`"
                :value="plan.code"
              />
            </ElSelect>
          </ElFormItem>
        </ElForm>
        <ElDescriptions v-if="selectedPlan" :column="2" border>
          <ElDescriptionsItem label="Billing">{{ billingLabel(selectedPlan) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="Amount">{{
            formatMoney(selectedPlan.amount_cents)
          }}</ElDescriptionsItem>
          <ElDescriptionsItem label="Trial terms" :span="2">
            {{ selectedPlan.trial_days ? `${selectedPlan.trial_days} days` : 'No trial' }}
          </ElDescriptionsItem>
        </ElDescriptions>
        <ElAlert
          v-if="purchaseError"
          class="app-marketplace-page__purchase-error"
          type="error"
          :title="purchaseError"
          :closable="false"
          show-icon
        />
      </div>
      <template #footer>
        <ElButton @click="purchaseDialogVisible = false">Cancel</ElButton>
        <ElButton
          type="primary"
          :loading="purchaseLoading"
          :disabled="!selectedPlanCode"
          @click="createPurchase"
        >
          Create order and pay
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="consentDialogVisible" title="App permissions" width="520px">
      <ElAlert
        type="info"
        title="Choose which approved capabilities this app may use."
        :closable="false"
        show-icon
      />
      <ElAlert v-if="consentError" type="error" :title="consentError" :closable="false" show-icon />
      <ElCheckboxGroup v-model="selectedCapabilities" class="app-marketplace-page__consent-options">
        <ElCheckbox
          v-for="capability in consentApp?.platform_approved_capabilities || []"
          :key="capability"
          :value="capability"
        >
          {{ capabilityLabel(capability) }}
        </ElCheckbox>
      </ElCheckboxGroup>
      <template #footer>
        <ElButton @click="consentDialogVisible = false">Cancel</ElButton>
        <ElButton type="primary" :loading="Boolean(operatingCode)" @click="confirmInstall"
          >Install</ElButton
        >
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { Link, Refresh, ShoppingCart } from '@element-plus/icons-vue'
  import {
    createTenantAppOrder,
    fetchTenantAppOrders,
    startAppAlipayPayment,
    startTenantAppTrial,
    type AppOrderRecord,
    type AppPricePlanRecord,
    type AppCommerceAccessStatus
  } from '@/api/app-commerce'
  import {
    fetchTenantAppMarketplace,
    installTenantApp,
    type AppPackageType,
    type TenantMarketplaceAppRecord
  } from '@/api/app-marketplace'

  defineOptions({ name: 'AppCenterMarketplacePage' })

  const router = useRouter()
  const records = ref<TenantMarketplaceAppRecord[]>([])
  const pendingOrders = ref<AppOrderRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const operatingCode = ref('')
  const consentDialogVisible = ref(false)
  const consentApp = ref<TenantMarketplaceAppRecord | null>(null)
  const selectedCapabilities = ref<string[]>([])
  const consentError = ref('')
  const purchaseDialogVisible = ref(false)
  const purchaseApp = ref<TenantMarketplaceAppRecord | null>(null)
  const selectedPlanCode = ref('')
  const purchaseLoading = ref(false)
  const purchaseError = ref('')

  const selectedPlan = computed(() =>
    paidPlans(purchaseApp.value).find((plan) => plan.code === selectedPlanCode.value)
  )

  function typeText(type?: AppPackageType) {
    const map: Record<string, string> = {
      internal: 'Internal',
      static: 'Static',
      iframe: 'Iframe',
      service: 'Service'
    }
    return type ? map[type] || type : '-'
  }

  function typeTagType(type?: AppPackageType) {
    const map: Record<string, 'success' | 'warning' | 'info'> = {
      internal: 'success',
      static: 'warning',
      iframe: 'info',
      service: 'info'
    }
    return type ? map[type] || 'info' : 'info'
  }

  function availabilityText(status?: string) {
    const map: Record<string, string> = {
      available: 'Ready',
      missing_plan_module: 'Requires upgrade',
      missing_system_module: 'Module disabled for tenant',
      system_module_unavailable: 'System module unavailable'
    }
    return status ? map[status] || status : 'Ready'
  }

  function commerceLabel(status?: AppCommerceAccessStatus) {
    const map: Record<string, string> = {
      legacy_free: 'Legacy free',
      free: 'Free',
      included: 'Included',
      trialing: 'Trial active',
      licensed: 'Licensed',
      purchase_required: 'Purchase required',
      expired: 'Expired',
      revoked: 'Revoked'
    }
    return status ? map[status] || status : 'Free'
  }

  function commerceTagType(status?: AppCommerceAccessStatus) {
    if (status === 'expired' || status === 'purchase_required') return 'warning'
    if (status === 'revoked') return 'danger'
    if (status === 'licensed' || status === 'trialing' || status === 'included') return 'success'
    return 'info'
  }

  function capabilityLabel(capability: string) {
    return capability === 'context.read' ? 'Read tenant and user context' : capability
  }

  function paidPlans(app: TenantMarketplaceAppRecord | null) {
    return (app?.commerce?.plans || []).filter((plan) =>
      ['subscription', 'one_time'].includes(plan.pricing_model)
    )
  }

  function lowestPlan(app: TenantMarketplaceAppRecord) {
    return [...paidPlans(app)].sort(
      (left, right) => left.amount_cents - right.amount_cents || left.sort - right.sort
    )[0]
  }

  function planLabel(app: TenantMarketplaceAppRecord) {
    const plan = lowestPlan(app)
    if (!plan) return commerceLabel(app.commerce?.access_status)
    return `From ${formatMoney(plan.amount_cents)} · ${billingLabel(plan)}`
  }

  function billingLabel(plan: AppPricePlanRecord) {
    if (plan.pricing_model === 'one_time') return 'One-time'
    if (plan.billing_period === 'yearly') return 'Yearly'
    if (plan.billing_period === 'monthly') return 'Monthly'
    return 'Included'
  }

  function formatMoney(amountCents: number) {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
      minimumFractionDigits: 2
    }).format(Number(amountCents || 0) / 100)
  }

  function pendingOrder(code: string) {
    return pendingOrders.value.find(
      (order) => order.app_code === code && order.status === 'pending'
    )
  }

  async function loadApps() {
    loading.value = true
    loadError.value = ''
    try {
      const [apps, orderPage] = await Promise.all([
        fetchTenantAppMarketplace(),
        fetchTenantAppOrders({ status: 'pending', limit: 100 })
      ])
      records.value = apps
      pendingOrders.value = orderPage.list
    } catch {
      records.value = []
      pendingOrders.value = []
      loadError.value = 'Marketplace failed to load'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  async function installApp(row: TenantMarketplaceAppRecord) {
    if (row.requested_capabilities?.length) {
      consentApp.value = row
      selectedCapabilities.value = [...row.platform_approved_capabilities]
      consentError.value = ''
      consentDialogVisible.value = true
      return
    }
    await submitInstall(row, [])
  }

  async function submitConsent(
    consentApp: TenantMarketplaceAppRecord,
    selectedCapabilities: string[]
  ) {
    await installTenantApp(consentApp.code, selectedCapabilities)
  }

  async function submitInstall(app: TenantMarketplaceAppRecord, capabilities: string[]) {
    operatingCode.value = app.code
    try {
      await submitConsent(app, capabilities)
      ElMessage.success('App installed')
      consentDialogVisible.value = false
      await loadApps()
    } finally {
      operatingCode.value = ''
    }
  }

  async function confirmInstall() {
    if (!consentApp.value) return
    consentError.value = ''
    try {
      await submitInstall(consentApp.value, selectedCapabilities.value)
    } catch {
      consentError.value = 'Permission consent could not be saved. Try again.'
    }
  }

  async function startTrial(row: TenantMarketplaceAppRecord) {
    const plan = paidPlans(row).find((item) => item.trial_days > 0)
    if (!plan) return ElMessage.warning('No trial plan is currently available')
    operatingCode.value = row.code
    try {
      await startTenantAppTrial(row.code, plan.code)
      ElMessage.success('Trial activated')
      await installApp(row)
      await loadApps()
    } catch {
      ElMessage.error('Trial could not be activated')
    } finally {
      operatingCode.value = ''
    }
  }

  function openPurchase(row: TenantMarketplaceAppRecord) {
    purchaseApp.value = row
    selectedPlanCode.value = lowestPlan(row)?.code || ''
    purchaseError.value = ''
    purchaseDialogVisible.value = true
  }

  async function createPurchase() {
    if (!purchaseApp.value || !selectedPlanCode.value) return
    purchaseLoading.value = true
    purchaseError.value = ''
    try {
      const order = await createTenantAppOrder(purchaseApp.value.code, selectedPlanCode.value)
      pendingOrders.value = [
        order,
        ...pendingOrders.value.filter((item) => item.order_no !== order.order_no)
      ]
      await continuePayment(order)
      purchaseDialogVisible.value = false
    } catch {
      purchaseError.value = 'The application order could not be created. Try again.'
    } finally {
      purchaseLoading.value = false
    }
  }

  async function continuePayment(order: AppOrderRecord) {
    operatingCode.value = order.app_code
    try {
      const payment = await startAppAlipayPayment(order.order_no)
      if (payment.configured && payment.pay_url) {
        window.open(payment.pay_url, '_blank', 'noopener,noreferrer')
        ElMessage.success('Alipay opened in a new tab')
        return
      }
      ElMessage.warning(payment.message || 'Alipay is not configured')
      router.push('/app-center/orders')
    } catch {
      ElMessage.error('Payment could not be started')
    } finally {
      operatingCode.value = ''
    }
  }

  function openApp(code: string) {
    router.push({ path: '/app-center/open', query: { code } })
  }

  function openUpgrade() {
    router.push('/tenant-saas/plan')
  }

  onMounted(loadApps)
</script>

<style scoped>
  .app-marketplace-page {
    min-height: 100%;
  }

  .app-marketplace-page__header {
    display: flex;
    gap: 16px;
    align-items: flex-start;
    justify-content: space-between;
  }

  .app-marketplace-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .app-marketplace-page__subtitle {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .app-marketplace-page__load-error {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 16px;
  }

  .app-marketplace-page__capabilities,
  .app-marketplace-page__consent-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .app-marketplace-page__consent-options {
    margin: 18px 0;
  }

  .app-marketplace-page__app-name {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .app-marketplace-page__app-code {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .app-marketplace-page__commerce {
    display: grid;
    gap: 6px;
    justify-items: start;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .app-marketplace-page__purchase {
    display: grid;
    gap: 16px;
  }

  .app-marketplace-page__purchase-error {
    margin-top: 4px;
  }

  @media (width <= 640px) {
    .app-marketplace-page__header {
      display: grid;
    }
  }
</style>
