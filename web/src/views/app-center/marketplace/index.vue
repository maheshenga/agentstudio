<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="app-marketplace-page">
      <template #header>
        <div class="app-marketplace-page__header">
          <div>
            <h1 class="app-marketplace-page__title">应用市场</h1>
            <p class="app-marketplace-page__subtitle">
              查看应用能力、价格与试用条件，并为当前租户安装合适的应用。
            </p>
          </div>
          <ElButton type="primary" :icon="Refresh" :loading="loading" @click="loadApps"
            >刷新</ElButton
          >
        </div>
      </template>

      <div v-if="loadError" class="app-marketplace-page__load-error">
        <ElAlert type="error" :title="loadError" show-icon :closable="false" />
        <ElButton size="small" type="primary" link :loading="loading" @click="loadApps"
          >重试</ElButton
        >
      </div>

      <ElTable v-loading="loading" :data="records" border>
        <ElTableColumn label="应用" min-width="210" show-overflow-tooltip>
          <template #default="{ row }">
            <div class="app-marketplace-page__app-name">{{ row.name || '-' }}</div>
            <div class="app-marketplace-page__app-code">{{ row.code || '-' }}</div>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="category" label="分类" min-width="120" show-overflow-tooltip>
          <template #default="{ row }">{{ row.category || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="类型" width="110">
          <template #default="{ row }">
            <ElTag :type="typeTagType(row.type)" effect="light">{{ typeText(row.type) }}</ElTag>
          </template>
        </ElTableColumn>
        <ElTableColumn label="授权与价格" min-width="170">
          <template #default="{ row }">
            <div class="app-marketplace-page__commerce">
              <ElTag :type="commerceTagType(row.commerce?.access_status)" effect="light">
                {{ commerceLabel(row.commerce?.access_status) }}
              </ElTag>
              <span>{{ planLabel(row) }}</span>
            </div>
          </template>
        </ElTableColumn>
        <ElTableColumn label="可用状态" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <span v-if="row.available">{{ availabilityText(row.availability_status) }}</span>
            <span v-else>{{
              row.availability_reason || availabilityText(row.availability_status)
            }}</span>
          </template>
        </ElTableColumn>
        <ElTableColumn prop="summary" label="简介" min-width="230" show-overflow-tooltip>
          <template #default="{ row }">{{ row.summary || row.description || '-' }}</template>
        </ElTableColumn>
        <ElTableColumn label="申请能力" min-width="180">
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
        <ElTableColumn label="操作" fixed="right" width="320">
          <template #default="{ row }">
            <ElButton link type="primary" :icon="View" @click="openDetail(row)">
              查看详情
            </ElButton>
            <ElButton
              v-if="pendingOrder(row.code)"
              link
              type="warning"
              :loading="operatingCode === row.code"
              @click="continuePayment(pendingOrder(row.code)!)"
            >
              继续支付
            </ElButton>
            <ElButton
              v-else-if="row.commerce_action === 'contact_admin'"
              link
              type="danger"
              disabled
            >
              联系管理员
            </ElButton>
            <ElButton
              v-else-if="row.commerce_action === 'start_trial'"
              link
              type="success"
              :loading="operatingCode === row.code"
              @click="startTrial(row)"
            >
              开始试用
            </ElButton>
            <ElButton
              v-else-if="row.commerce_action === 'purchase' || row.commerce_action === 'renew'"
              link
              type="primary"
              :icon="ShoppingCart"
              @click="openPurchase(row)"
            >
              {{ row.commerce_action === 'renew' ? '续费' : '选择套餐' }}
            </ElButton>
            <ElButton
              v-else-if="row.availability_status === 'missing_plan_module'"
              link
              type="warning"
              @click="openUpgrade"
            >
              升级套餐
            </ElButton>
            <ElButton
              v-else-if="row.installed && row.update_available"
              link
              type="warning"
              :loading="operatingCode === row.code"
              @click="openVersionUpgrade(row)"
            >
              升级应用
            </ElButton>
            <ElButton
              v-else-if="!row.installed"
              link
              type="primary"
              :icon="ShoppingCart"
              :disabled="!row.can_install"
              :loading="operatingCode === row.code"
              @click="installApp(row)"
            >
              安装
            </ElButton>
            <ElTag
              v-else-if="row.type === 'service'"
              :type="row.service_callable ? 'success' : 'info'"
              effect="light"
            >
              {{ row.service_callable ? '服务可用' : '服务不可用' }}
            </ElTag>
            <ElButton
              v-else
              link
              type="success"
              :icon="Link"
              :disabled="!row.can_open"
              :loading="operatingCode === row.code"
              @click="openApp(row.code)"
            >
              打开
            </ElButton>
          </template>
        </ElTableColumn>
        <template #empty>
          <ElEmpty description="当前租户暂无可用应用" />
        </template>
      </ElTable>
      <ElPagination
        v-model:current-page="pagination.page"
        v-model:page-size="pagination.limit"
        class="app-marketplace-page__pagination"
        :page-sizes="[10, 20, 50, 100]"
        :total="pagination.total"
        layout="total, sizes, prev, pager, next, jumper"
        @current-change="loadApps"
        @size-change="handlePageSizeChange"
      />
    </ElCard>

    <ElDrawer v-model="detailDrawerVisible" title="应用详情" size="min(680px, 100%)">
      <div v-if="selectedDetail" class="app-marketplace-page__detail">
        <div>
          <h2>{{ selectedDetail.name }}</h2>
          <p>{{ selectedDetail.summary || selectedDetail.description || '暂无简介' }}</p>
        </div>
        <div v-if="selectedDetail.screenshots?.length" class="app-marketplace-page__screenshots">
          <ElImage
            v-for="screenshot in selectedDetail.screenshots"
            :key="screenshot"
            :src="screenshot"
            :preview-src-list="selectedDetail.screenshots"
            fit="cover"
            lazy
          />
        </div>
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem label="应用编码">{{ selectedDetail.code }}</ElDescriptionsItem>
          <ElDescriptionsItem label="分类">{{ selectedDetail.category || '-' }}</ElDescriptionsItem>
          <ElDescriptionsItem label="类型">{{ typeText(selectedDetail.type) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="开发者">
            {{ selectedDetail.developer_name || '平台' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="最新版本">
            {{ selectedDetail.latest_version || '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="详细说明">
            <div class="app-marketplace-page__long-copy">
              {{ selectedDetail.description || '暂无详细说明' }}
            </div>
          </ElDescriptionsItem>
        </ElDescriptions>
        <div
          v-if="selectedDetail.documentation_url || selectedDetail.support_url"
          class="app-marketplace-page__detail-links"
        >
          <ElLink
            v-if="selectedDetail.documentation_url"
            :href="selectedDetail.documentation_url"
            type="primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            使用文档
          </ElLink>
          <ElLink
            v-if="selectedDetail.support_url"
            :href="selectedDetail.support_url"
            type="primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            获取支持
          </ElLink>
        </div>
        <section>
          <h3>更新日志</h3>
          <div class="app-marketplace-page__long-copy">
            {{ selectedDetail.changelog || '暂无更新日志' }}
          </div>
        </section>
      </div>
    </ElDrawer>

    <ElDialog v-model="purchaseDialogVisible" title="购买应用" width="560px">
      <div v-if="purchaseApp" class="app-marketplace-page__purchase">
        <ElDescriptions :column="1" border>
          <ElDescriptionsItem label="应用">{{ purchaseApp.name }}</ElDescriptionsItem>
          <ElDescriptionsItem label="支付方式">支付宝</ElDescriptionsItem>
        </ElDescriptions>
        <ElForm label-position="top">
          <ElFormItem label="价格套餐">
            <ElSelect v-model="selectedPlanCode" class="w-full" placeholder="请选择套餐">
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
          <ElDescriptionsItem label="计费周期">{{ billingLabel(selectedPlan) }}</ElDescriptionsItem>
          <ElDescriptionsItem label="金额">{{
            formatMoney(selectedPlan.amount_cents)
          }}</ElDescriptionsItem>
          <ElDescriptionsItem label="试用条件" :span="2">
            {{ selectedPlan.trial_days ? `${selectedPlan.trial_days} 天` : '不提供试用' }}
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
        <ElButton @click="purchaseDialogVisible = false">取消</ElButton>
        <ElButton
          type="primary"
          :loading="purchaseLoading"
          :disabled="!selectedPlanCode"
          @click="createPurchase"
        >
          创建订单并支付
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="consentDialogVisible" title="应用权限" width="520px">
      <ElAlert
        type="info"
        title="请选择允许该应用使用的平台已审核能力。"
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
        <ElButton @click="consentDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="Boolean(operatingCode)" @click="confirmInstall"
          >安装</ElButton
        >
      </template>
    </ElDialog>

    <ElDialog v-model="upgradeDialogVisible" title="升级应用" width="560px">
      <div v-if="upgradeAppRecord" class="app-marketplace-page__upgrade">
        <ElDescriptions :column="2" border>
          <ElDescriptionsItem label="当前版本">
            {{ upgradeAppRecord.installed_version || '-' }}
          </ElDescriptionsItem>
          <ElDescriptionsItem label="目标版本">
            {{ upgradeAppRecord.latest_version || '-' }}
          </ElDescriptionsItem>
        </ElDescriptions>
        <ElAlert
          v-if="upgradeAppRecord.new_capabilities?.length"
          type="warning"
          title="新版本申请了额外能力；未主动勾选的能力将保持关闭。"
          :closable="false"
          show-icon
        />
        <ElCheckboxGroup
          v-model="upgradeCapabilities"
          class="app-marketplace-page__consent-options"
        >
          <ElCheckbox
            v-for="capability in upgradeAppRecord.latest_platform_approved_capabilities || []"
            :key="capability"
            :value="capability"
          >
            {{ capabilityLabel(capability) }}
          </ElCheckbox>
        </ElCheckboxGroup>
        <ElAlert
          v-if="upgradeError"
          type="error"
          :title="upgradeError"
          :closable="false"
          show-icon
        />
      </div>
      <template #footer>
        <ElButton @click="upgradeDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="Boolean(operatingCode)" @click="confirmUpgrade">
          确认升级
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ElMessage } from 'element-plus'
  import { Link, Refresh, ShoppingCart, View } from '@element-plus/icons-vue'
  import {
    createTenantAppOrder,
    fetchTenantAppOrders,
    startAppAlipayPayment,
    startTenantAppTrial,
    type AppOrderRecord,
    type AppPricePlanRecord
  } from '@/api/app-commerce'
  import {
    fetchTenantAppMarketplace,
    installTenantApp,
    upgradeTenantApp,
    type TenantMarketplaceAppRecord
  } from '@/api/app-marketplace'
  import {
    appAvailabilityText as availabilityText,
    appCapabilityLabel as capabilityLabel,
    appCenterTypeTagType as typeTagType,
    appCenterTypeText as typeText,
    appCommerceLabel as commerceLabel,
    appCommerceTagType as commerceTagType
  } from '../shared/app-center-display'

  defineOptions({ name: 'AppCenterMarketplacePage' })

  const router = useRouter()
  const records = ref<TenantMarketplaceAppRecord[]>([])
  const detailDrawerVisible = ref(false)
  const selectedDetail = ref<TenantMarketplaceAppRecord | null>(null)
  const pagination = reactive({ page: 1, limit: 20, total: 0 })
  const pendingOrders = ref<AppOrderRecord[]>([])
  const loading = ref(false)
  const loadError = ref('')
  const operatingCode = ref('')
  const consentDialogVisible = ref(false)
  const consentApp = ref<TenantMarketplaceAppRecord | null>(null)
  const selectedCapabilities = ref<string[]>([])
  const consentError = ref('')
  const upgradeDialogVisible = ref(false)
  const upgradeAppRecord = ref<TenantMarketplaceAppRecord | null>(null)
  const upgradeCapabilities = ref<string[]>([])
  const upgradeError = ref('')
  const purchaseDialogVisible = ref(false)
  const purchaseApp = ref<TenantMarketplaceAppRecord | null>(null)
  const selectedPlanCode = ref('')
  const purchaseLoading = ref(false)
  const purchaseError = ref('')

  const selectedPlan = computed(() =>
    paidPlans(purchaseApp.value).find((plan) => plan.code === selectedPlanCode.value)
  )

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
    return `${formatMoney(plan.amount_cents)} 起 / ${billingLabel(plan)}`
  }

  function billingLabel(plan: AppPricePlanRecord) {
    if (plan.pricing_model === 'one_time') return '一次性'
    if (plan.billing_period === 'yearly') return '每年'
    if (plan.billing_period === 'monthly') return '每月'
    return '套餐内'
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
      const [appPage, orderPage] = await Promise.all([
        fetchTenantAppMarketplace({ page: pagination.page, limit: pagination.limit }),
        fetchTenantAppOrders({ status: 'pending', limit: 100 })
      ])
      records.value = appPage.list
      pagination.total = appPage.total
      pagination.page = appPage.page
      pagination.limit = appPage.limit
      pendingOrders.value = orderPage.list
    } catch {
      records.value = []
      pendingOrders.value = []
      loadError.value = '应用市场加载失败'
      ElMessage.error(loadError.value)
    } finally {
      loading.value = false
    }
  }

  function handlePageSizeChange() {
    pagination.page = 1
    loadApps()
  }

  function openDetail(row: TenantMarketplaceAppRecord) {
    selectedDetail.value = row
    detailDrawerVisible.value = true
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
      ElMessage.success('应用已安装')
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
      consentError.value = '权限设置保存失败，请重试。'
    }
  }

  function openVersionUpgrade(row: TenantMarketplaceAppRecord) {
    const approved = new Set(row.latest_platform_approved_capabilities || [])
    upgradeAppRecord.value = row
    upgradeCapabilities.value = (row.tenant_approved_capabilities || []).filter((capability) =>
      approved.has(capability)
    )
    upgradeError.value = ''
    upgradeDialogVisible.value = true
  }

  async function confirmUpgrade() {
    if (!upgradeAppRecord.value) return
    operatingCode.value = upgradeAppRecord.value.code
    upgradeError.value = ''
    try {
      await upgradeTenantApp(upgradeAppRecord.value.code, upgradeCapabilities.value)
      ElMessage.success('应用已升级')
      upgradeDialogVisible.value = false
      await loadApps()
    } catch {
      upgradeError.value = '应用升级失败，请刷新后重试。'
    } finally {
      operatingCode.value = ''
    }
  }

  async function startTrial(row: TenantMarketplaceAppRecord) {
    const plan = paidPlans(row).find((item) => item.trial_days > 0)
    if (!plan) return ElMessage.warning('当前没有可用的试用套餐')
    operatingCode.value = row.code
    try {
      await startTenantAppTrial(row.code, plan.code)
      ElMessage.success('试用已开通')
      await installApp(row)
      await loadApps()
    } catch {
      ElMessage.error('试用开通失败')
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
      purchaseError.value = '应用订单创建失败，请重试。'
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
        ElMessage.success('已在新窗口打开支付宝')
        return
      }
      ElMessage.warning(payment.message || '支付宝尚未配置')
      router.push('/app-center/orders')
    } catch {
      ElMessage.error('支付发起失败')
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

  .app-marketplace-page__upgrade {
    display: grid;
    gap: 16px;
  }

  .app-marketplace-page__detail {
    display: grid;
    gap: 20px;
  }

  .app-marketplace-page__detail h2,
  .app-marketplace-page__detail h3 {
    margin: 0;
    letter-spacing: 0;
  }

  .app-marketplace-page__detail p {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
  }

  .app-marketplace-page__screenshots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }

  .app-marketplace-page__screenshots :deep(.el-image) {
    width: 100%;
    aspect-ratio: 16 / 10;
    border: 1px solid var(--el-border-color-lighter);
    border-radius: 6px;
  }

  .app-marketplace-page__detail-links {
    display: flex;
    gap: 20px;
  }

  .app-marketplace-page__long-copy {
    line-height: 1.7;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .app-marketplace-page__pagination {
    justify-content: flex-end;
    margin-top: 16px;
  }

  @media (width <= 640px) {
    .app-marketplace-page__header {
      display: grid;
    }
  }
</style>
