<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="commercial-page">
      <template #header>
        <div class="commercial-page__header">
          <div>
            <h1 class="commercial-page__title">商业运营</h1>
            <p class="commercial-page__subtitle">
              管理应用定价、购买订单、使用授权、收入和开发者结算。
            </p>
          </div>
          <ElTooltip content="刷新当前视图" placement="bottom">
            <ElButton
              circle
              :icon="Refresh"
              :loading="currentTabLoading"
              aria-label="刷新商业运营数据"
              @click="refreshCurrentTab"
            />
          </ElTooltip>
        </div>
      </template>

      <ElTabs v-model="activeTab" class="commercial-page__tabs" @tab-change="handleTabChange">
        <ElTabPane label="价格方案" name="prices">
          <div class="commercial-page__toolbar">
            <ElSelect
              v-model="selectedAppCode"
              filterable
              placeholder="选择应用"
              class="commercial-page__app-select"
              :loading="referenceLoading"
              @change="loadPricePlans"
            >
              <ElOption
                v-for="app in apps"
                :key="app.code"
                :label="`${app.name} (${app.code})`"
                :value="app.code"
              />
            </ElSelect>
            <ElButton
              type="primary"
              :icon="Plus"
              :disabled="!selectedAppCode"
              @click="openPlanDialog()"
            >
              新建方案
            </ElButton>
          </div>

          <StateError
            v-if="loadError.prices"
            :message="loadError.prices"
            :loading="priceLoading"
            @retry="loadPricePlans"
          />

          <ElTable v-loading="priceLoading" :data="pricePlans" border>
            <ElTableColumn label="方案" min-width="210">
              <template #default="{ row }">
                <div class="commercial-page__primary">{{ row.name }}</div>
                <div class="commercial-page__muted">{{ row.code }}</div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="计价模式" width="150">
              <template #default="{ row }">
                <ElTag effect="light" type="info">{{ pricingModelText(row.pricing_model) }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="计费周期" width="130">
              <template #default="{ row }">{{ billingPeriodText(row.billing_period) }}</template>
            </ElTableColumn>
            <ElTableColumn label="金额" width="140" align="right">
              <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="试用期" width="100" align="right">
              <template #default="{ row }">{{ row.trial_days || 0 }} 天</template>
            </ElTableColumn>
            <ElTableColumn label="开发者分成" width="150" align="right">
              <template #default="{ row }">{{
                formatBasisPoints(row.developer_share_bps)
              }}</template>
            </ElTableColumn>
            <ElTableColumn label="销售范围" min-width="190">
              <template #default="{ row }">
                <div>{{ saleScopeText(row.sale_scope) }}</div>
                <div v-if="row.pricing_model === 'included'" class="commercial-page__muted">
                  {{ row.included_plan_codes?.join(', ') || '未选择 SaaS 套餐' }}
                </div>
                <div
                  v-else-if="row.sale_scope === 'selected_tenants'"
                  class="commercial-page__muted"
                >
                  {{ row.tenant_ids?.length || 0 }} 个租户
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="110">
              <template #default="{ row }">
                <ElTag :type="row.status === 0 ? 'info' : 'success'" effect="light">
                  {{ row.status === 0 ? '已禁用' : '已启用' }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="190" fixed="right">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openPlanDialog(row)">编辑</ElButton>
                <ElButton
                  link
                  :type="row.status === 0 ? 'success' : 'warning'"
                  :loading="actionLoading === `plan:${row.code}`"
                  @click="togglePlanStatus(row)"
                >
                  {{ row.status === 0 ? '启用' : '禁用' }}
                </ElButton>
              </template>
            </ElTableColumn>
            <template #empty>
              <ElEmpty :description="selectedAppCode ? '该应用暂无价格方案' : '请先选择应用'" />
            </template>
          </ElTable>
        </ElTabPane>

        <ElTabPane label="订单" name="orders">
          <div class="commercial-page__toolbar commercial-page__toolbar--wrap">
            <ElInput
              v-model="orderFilters.order_no"
              clearable
              placeholder="订单号"
              class="commercial-page__input"
              @keyup.enter="refreshOrders"
            />
            <ElInput
              v-model="orderFilters.app_code"
              clearable
              placeholder="应用编码"
              class="commercial-page__input"
              @keyup.enter="refreshOrders"
            />
            <ElInput
              v-model="orderFilters.tenant_id"
              clearable
              placeholder="租户 ID"
              class="commercial-page__small-input"
              @keyup.enter="refreshOrders"
            />
            <ElSelect
              v-model="orderFilters.status"
              clearable
              placeholder="订单状态"
              class="commercial-page__select"
              @change="refreshOrders"
            >
              <ElOption label="待支付" value="pending" />
              <ElOption label="已支付" value="paid" />
              <ElOption label="已退款" value="refunded" />
              <ElOption label="已关闭" value="closed" />
            </ElSelect>
            <ElButton type="primary" :loading="orderLoading" @click="refreshOrders">查询</ElButton>
            <ElButton :disabled="orderLoading" @click="resetOrderFilters">重置</ElButton>
          </div>

          <StateError
            v-if="loadError.orders"
            :message="loadError.orders"
            :loading="orderLoading"
            @retry="loadOrders"
          />

          <ElTable v-loading="orderLoading" :data="orders" border>
            <ElTableColumn prop="order_no" label="订单号" min-width="210" show-overflow-tooltip />
            <ElTableColumn prop="tenant_id" label="租户" width="100" />
            <ElTableColumn label="应用" min-width="190">
              <template #default="{ row }">
                <div class="commercial-page__primary">{{ row.app_name || row.app_code }}</div>
                <div class="commercial-page__muted">{{ row.app_code }}</div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="价格方案" min-width="160">
              <template #default="{ row }">{{ row.price_plan_code }}</template>
            </ElTableColumn>
            <ElTableColumn label="金额" width="130" align="right">
              <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="120">
              <template #default="{ row }">
                <ElTag :type="orderStatusTagType(row.status)" effect="light">
                  {{ orderStatusText(row.status) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="支付时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.paid_at) }}</template>
            </ElTableColumn>
            <ElTableColumn label="创建时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <ElButton
                  v-if="row.status === 'paid'"
                  link
                  type="danger"
                  @click="openRefundDialog(row)"
                >
                  退款
                </ElButton>
                <span v-else class="commercial-page__muted">-</span>
              </template>
            </ElTableColumn>
            <template #empty><ElEmpty description="暂无应用订单" /></template>
          </ElTable>

          <ElPagination
            v-model:current-page="orderPager.page"
            v-model:page-size="orderPager.limit"
            class="commercial-page__pagination"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50, 100]"
            :total="orderPager.total"
            @current-change="loadOrders"
            @size-change="handleOrderSizeChange"
          />
        </ElTabPane>

        <ElTabPane label="使用授权" name="licenses">
          <div class="commercial-page__toolbar commercial-page__toolbar--wrap">
            <ElInput
              v-model="licenseFilters.tenant_id"
              clearable
              placeholder="租户 ID"
              class="commercial-page__small-input"
              @keyup.enter="refreshLicenses"
            />
            <ElSelect
              v-model="licenseFilters.app_id"
              clearable
              filterable
              placeholder="应用"
              class="commercial-page__app-select"
              @change="refreshLicenses"
            >
              <ElOption
                v-for="app in apps"
                :key="app.id"
                :label="`${app.name} (${app.code})`"
                :value="app.id"
              />
            </ElSelect>
            <ElSelect
              v-model="licenseFilters.status"
              clearable
              placeholder="授权状态"
              class="commercial-page__select"
              @change="refreshLicenses"
            >
              <ElOption label="生效中" value="active" />
              <ElOption label="试用中" value="trialing" />
              <ElOption label="已到期" value="expired" />
              <ElOption label="已撤销" value="revoked" />
              <ElOption label="已退款" value="refunded" />
            </ElSelect>
            <ElButton type="primary" :loading="licenseLoading" @click="refreshLicenses">
              查询
            </ElButton>
            <ElButton :disabled="licenseLoading" @click="resetLicenseFilters">重置</ElButton>
          </div>

          <StateError
            v-if="loadError.licenses"
            :message="loadError.licenses"
            :loading="licenseLoading"
            @retry="loadLicenses"
          />

          <ElTable v-loading="licenseLoading" :data="licenses" border>
            <ElTableColumn prop="id" label="授权 ID" width="100" />
            <ElTableColumn prop="tenant_id" label="租户" width="100" />
            <ElTableColumn label="应用" min-width="210">
              <template #default="{ row }">
                <div class="commercial-page__primary">{{ appName(row.app_id) }}</div>
                <div class="commercial-page__muted">{{ appCode(row.app_id) }}</div>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="price_plan_id" label="方案 ID" width="100" />
            <ElTableColumn label="来源" width="110">
              <template #default="{ row }">{{ sourceText(row.source) }}</template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="120">
              <template #default="{ row }">
                <ElTag :type="licenseStatusTagType(row.status)" effect="light">
                  {{ licenseStatusText(row.status) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="生效时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.effective_at) }}</template>
            </ElTableColumn>
            <ElTableColumn label="到期时间" width="180">
              <template #default="{ row }">{{ formatDateTime(row.expires_at) }}</template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="110" fixed="right">
              <template #default="{ row }">
                <ElButton
                  v-if="row.status === 'active' || row.status === 'trialing'"
                  link
                  type="danger"
                  @click="openRevokeDialog(row)"
                >
                  撤销
                </ElButton>
                <span v-else class="commercial-page__muted">-</span>
              </template>
            </ElTableColumn>
            <template #empty><ElEmpty description="暂无应用授权" /></template>
          </ElTable>

          <ElPagination
            v-model:current-page="licensePager.page"
            v-model:page-size="licensePager.limit"
            class="commercial-page__pagination"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50, 100]"
            :total="licensePager.total"
            @current-change="loadLicenses"
            @size-change="handleLicenseSizeChange"
          />
        </ElTabPane>

        <ElTabPane label="收入" name="revenue">
          <div class="commercial-page__toolbar commercial-page__toolbar--wrap">
            <ElDatePicker
              v-model="revenueDateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="至"
              start-placeholder="开始日期"
              end-placeholder="结束日期"
              class="commercial-page__date"
            />
            <ElInput
              v-model="revenueAppCode"
              clearable
              placeholder="应用编码"
              class="commercial-page__input"
              @keyup.enter="loadRevenue"
            />
            <ElButton type="primary" :loading="revenueLoading" @click="loadRevenue">
              查询
            </ElButton>
            <ElButton :disabled="revenueLoading" @click="resetRevenueFilters">重置</ElButton>
          </div>

          <StateError
            v-if="loadError.revenue"
            :message="loadError.revenue"
            :loading="revenueLoading"
            @retry="loadRevenue"
          />

          <div v-loading="revenueLoading" class="commercial-page__revenue">
            <div v-if="revenue" class="commercial-page__kpis">
              <div v-for="item in revenueKpis" :key="item.label" class="commercial-page__kpi">
                <span>{{ item.label }}</span>
                <strong>{{ item.value }}</strong>
                <small>{{ item.note }}</small>
              </div>
            </div>

            <ElTable :data="revenue?.apps || []" border class="commercial-page__revenue-table">
              <ElTableColumn label="应用" min-width="210">
                <template #default="{ row }">
                  <div class="commercial-page__primary">{{ row.app_name }}</div>
                  <div class="commercial-page__muted">{{ row.app_code }}</div>
                </template>
              </ElTableColumn>
              <ElTableColumn label="总收入" width="140" align="right">
                <template #default="{ row }">{{ formatMoney(row.gross_amount_cents) }}</template>
              </ElTableColumn>
              <ElTableColumn label="退款" width="140" align="right">
                <template #default="{ row }">{{ formatMoney(row.refund_amount_cents) }}</template>
              </ElTableColumn>
              <ElTableColumn label="开发者分成" width="150" align="right">
                <template #default="{ row }">{{
                  formatMoney(row.developer_amount_cents)
                }}</template>
              </ElTableColumn>
              <ElTableColumn label="平台分成" width="150" align="right">
                <template #default="{ row }">{{ formatMoney(row.platform_amount_cents) }}</template>
              </ElTableColumn>
              <ElTableColumn label="待结算" width="150" align="right">
                <template #default="{ row }">
                  {{ formatMoney(row.unsettled_developer_amount_cents) }}
                </template>
              </ElTableColumn>
              <ElTableColumn prop="order_count" label="订单数" width="100" align="right" />
              <template #empty><ElEmpty description="暂无应用收入" /></template>
            </ElTable>
          </div>
        </ElTabPane>

        <ElTabPane label="开发者结算" name="settlements">
          <div class="commercial-page__toolbar commercial-page__toolbar--wrap">
            <ElSelect
              v-model="settlementFilters.developer_id"
              clearable
              filterable
              placeholder="开发者"
              class="commercial-page__developer-select"
              @change="refreshSettlements"
            >
              <ElOption
                v-for="developer in developers"
                :key="developer.id"
                :label="developer.display_name"
                :value="Number(developer.user_id)"
              />
            </ElSelect>
            <ElDatePicker
              v-model="settlementFilters.period"
              type="month"
              value-format="YYYY-MM"
              placeholder="结算月份"
              class="commercial-page__month"
              @change="refreshSettlements"
            />
            <ElSelect
              v-model="settlementFilters.status"
              clearable
              placeholder="结算状态"
              class="commercial-page__select"
              @change="refreshSettlements"
            >
              <ElOption label="草稿" value="draft" />
              <ElOption label="已审核" value="approved" />
              <ElOption label="已打款" value="paid" />
              <ElOption label="已取消" value="cancelled" />
            </ElSelect>
            <ElButton type="primary" :icon="Plus" @click="openCreateSettlement">
              新建结算
            </ElButton>
          </div>

          <StateError
            v-if="loadError.settlements"
            :message="loadError.settlements"
            :loading="settlementLoading"
            @retry="loadSettlements"
          />

          <ElTable v-loading="settlementLoading" :data="settlements" border>
            <ElTableColumn prop="batch_no" label="结算批次" min-width="210" show-overflow-tooltip />
            <ElTableColumn label="开发者" min-width="170">
              <template #default="{ row }">{{ developerName(row.developer_id) }}</template>
            </ElTableColumn>
            <ElTableColumn label="结算周期" width="210">
              <template #default="{ row }">{{ row.period_start }} 至 {{ row.period_end }}</template>
            </ElTableColumn>
            <ElTableColumn label="总收入" width="130" align="right">
              <template #default="{ row }">{{ formatMoney(row.gross_amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="退款" width="130" align="right">
              <template #default="{ row }">{{ formatMoney(row.refund_amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="开发者分成" width="150" align="right">
              <template #default="{ row }">{{ formatMoney(row.developer_amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="状态" width="120">
              <template #default="{ row }">
                <ElTag :type="settlementStatusTagType(row.status)" effect="light">
                  {{ settlementStatusText(row.status) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="操作" width="230" fixed="right">
              <template #default="{ row }">
                <ElButton
                  v-if="row.status === 'draft'"
                  link
                  type="success"
                  @click="openSettlementAction(row, 'approve')"
                >
                  审核通过
                </ElButton>
                <ElButton
                  v-if="row.status === 'approved'"
                  link
                  type="primary"
                  @click="openSettlementAction(row, 'paid')"
                >
                  标记已打款
                </ElButton>
                <ElButton
                  v-if="row.status === 'draft'"
                  link
                  type="danger"
                  @click="openSettlementAction(row, 'cancel')"
                >
                  取消结算
                </ElButton>
                <span
                  v-if="row.status === 'paid' || row.status === 'cancelled'"
                  class="commercial-page__muted"
                >
                  已完结
                </span>
              </template>
            </ElTableColumn>
            <template #empty><ElEmpty description="暂无结算批次" /></template>
          </ElTable>

          <ElPagination
            v-model:current-page="settlementPager.page"
            v-model:page-size="settlementPager.limit"
            class="commercial-page__pagination"
            layout="total, sizes, prev, pager, next"
            :page-sizes="[10, 20, 50, 100]"
            :total="settlementPager.total"
            @current-change="loadSettlements"
            @size-change="handleSettlementSizeChange"
          />
        </ElTabPane>
      </ElTabs>
    </ElCard>

    <ElDialog
      v-model="planDialogVisible"
      :title="editingPlanCode ? '编辑价格方案' : '创建价格方案'"
      width="min(720px, 94vw)"
      destroy-on-close
    >
      <ElForm label-position="top">
        <div class="commercial-page__form-grid">
          <ElFormItem label="方案编码" required>
            <ElInput v-model="planForm.code" :disabled="Boolean(editingPlanCode)" maxlength="50" />
          </ElFormItem>
          <ElFormItem label="方案名称" required>
            <ElInput v-model="planForm.name" maxlength="100" />
          </ElFormItem>
          <ElFormItem label="计价模式" required>
            <ElSelect v-model="planForm.pricing_model" @change="normalizePlanForm">
              <ElOption label="免费" value="free" />
              <ElOption label="SaaS 套餐包含" value="included" />
              <ElOption label="订阅" value="subscription" />
              <ElOption label="一次性购买" value="one_time" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="计费周期" required>
            <ElSelect
              v-model="planForm.billing_period"
              :disabled="planForm.pricing_model !== 'subscription'"
            >
              <ElOption label="无" value="none" />
              <ElOption label="按月" value="monthly" />
              <ElOption label="按年" value="yearly" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="金额（人民币分）" required>
            <ElInputNumber
              v-model="planForm.amount_cents"
              :min="0"
              :max="2147483647"
              :step="100"
              controls-position="right"
              :disabled="planForm.pricing_model === 'free' || planForm.pricing_model === 'included'"
            />
          </ElFormItem>
          <ElFormItem label="试用天数">
            <ElInputNumber
              v-model="planForm.trial_days"
              :min="0"
              :max="365"
              controls-position="right"
            />
          </ElFormItem>
          <ElFormItem label="开发者分成（基点）">
            <ElInputNumber
              v-model="planForm.developer_share_bps"
              :min="0"
              :max="10000"
              :step="100"
              controls-position="right"
            />
          </ElFormItem>
          <ElFormItem label="排序">
            <ElInputNumber v-model="planForm.sort" :min="0" controls-position="right" />
          </ElFormItem>
          <ElFormItem label="销售范围">
            <ElSelect v-model="planForm.sale_scope">
              <ElOption label="全部租户" value="all" />
              <ElOption label="指定租户" value="selected_tenants" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="初始状态">
            <ElSwitch v-model="planForm.enabled" active-text="启用" inactive-text="禁用" />
          </ElFormItem>
        </div>
        <ElFormItem
          v-if="planForm.pricing_model === 'included'"
          label="包含该应用的 SaaS 套餐编码"
          required
        >
          <ElInput v-model="includedPlanCodes" placeholder="starter, pro, enterprise" />
        </ElFormItem>
        <ElFormItem v-if="planForm.sale_scope === 'selected_tenants'" label="租户 ID" required>
          <ElInput v-model="selectedTenantIds" placeholder="12, 18, 26" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="planSaving" @click="planDialogVisible = false">取消</ElButton>
        <ElButton type="primary" :loading="planSaving" @click="savePlan">保存方案</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="refundDialogVisible" title="登记全额退款" width="520px">
      <ElAlert
        type="warning"
        title="仅登记支付渠道已确认的全额退款；登记后将撤销应用访问权限。"
        show-icon
        :closable="false"
      />
      <ElForm label-position="top" class="commercial-page__dialog-form">
        <ElFormItem label="订单">
          <ElInput :model-value="refundOrder?.order_no" disabled />
        </ElFormItem>
        <ElFormItem label="退款原因" required>
          <ElInput v-model="refundReason" type="textarea" :rows="3" maxlength="255" />
        </ElFormItem>
        <ElFormItem label="支付渠道退款凭证" required>
          <ElInput v-model="refundReference" maxlength="100" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="mutationLoading" @click="refundDialogVisible = false">取消</ElButton>
        <ElButton type="danger" :loading="mutationLoading" @click="confirmRefund"
          >确认登记退款</ElButton
        >
      </template>
    </ElDialog>

    <ElDialog v-model="revokeDialogVisible" title="撤销应用授权" width="520px">
      <ElAlert
        type="warning"
        title="撤销后将立即阻止该授权打开应用或访问运行时。"
        show-icon
        :closable="false"
      />
      <ElForm label-position="top" class="commercial-page__dialog-form">
        <ElFormItem label="授权">
          <ElInput :model-value="revokeLicense ? `#${revokeLicense.id}` : ''" disabled />
        </ElFormItem>
        <ElFormItem label="撤销原因" required>
          <ElInput v-model="revokeReason" type="textarea" :rows="3" maxlength="255" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="mutationLoading" @click="revokeDialogVisible = false">取消</ElButton>
        <ElButton type="danger" :loading="mutationLoading" @click="confirmRevoke"
          >确认撤销</ElButton
        >
      </template>
    </ElDialog>

    <ElDialog v-model="createSettlementVisible" title="创建结算批次" width="520px">
      <ElForm label-position="top">
        <ElFormItem label="开发者" required>
          <ElSelect v-model="createSettlementForm.developer_id" filterable>
            <ElOption
              v-for="developer in developers"
              :key="developer.id"
              :label="developer.display_name"
              :value="Number(developer.user_id)"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="结算月份" required>
          <ElDatePicker
            v-model="createSettlementForm.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="选择月份"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="mutationLoading" @click="createSettlementVisible = false"
          >取消</ElButton
        >
        <ElButton type="primary" :loading="mutationLoading" @click="confirmCreateSettlement">
          创建批次
        </ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="settlementActionVisible" :title="settlementActionTitle" width="520px">
      <ElAlert
        :type="settlementAction === 'cancel' ? 'warning' : 'info'"
        :title="settlementActionDescription"
        show-icon
        :closable="false"
      />
      <ElForm label-position="top" class="commercial-page__dialog-form">
        <ElFormItem label="结算批次">
          <ElInput :model-value="selectedSettlement?.batch_no" disabled />
        </ElFormItem>
        <ElFormItem :label="settlementAction === 'paid' ? '打款凭证' : '处理说明'" required>
          <ElInput
            v-model="settlementActionValue"
            :type="settlementAction === 'paid' ? 'text' : 'textarea'"
            :rows="3"
            maxlength="255"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="mutationLoading" @click="settlementActionVisible = false"
          >取消</ElButton
        >
        <ElButton
          :type="settlementAction === 'cancel' ? 'danger' : 'primary'"
          :loading="mutationLoading"
          @click="confirmSettlementAction"
        >
          确认
        </ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { computed, defineComponent, h, onMounted, reactive, ref } from 'vue'
  import { ElAlert, ElButton, ElMessage, ElMessageBox } from 'element-plus'
  import { Plus, Refresh } from '@element-plus/icons-vue'
  import {
    fetchDeveloperCertifications,
    type DeveloperCertificationProfile
  } from '@/api/app-developer-certification'
  import { fetchPlatformApps, type AppPackageRecord } from '@/api/app-marketplace'
  import {
    approvePlatformAppSettlement,
    cancelPlatformAppSettlement,
    createPlatformAppPricePlan,
    createPlatformAppSettlement,
    fetchPlatformAppLicenses,
    fetchPlatformAppOrders,
    fetchPlatformAppPricePlans,
    fetchPlatformAppRevenue,
    fetchPlatformAppSettlements,
    markPlatformAppSettlementPaid,
    refundPlatformAppOrder,
    revokePlatformAppLicense,
    updatePlatformAppPricePlan,
    updatePlatformAppPricePlanStatus,
    type AppBillingPeriod,
    type AppOrderRecord,
    type AppOrderStatus,
    type AppPricePlanRecord,
    type AppPricingModel,
    type AppRevenueOverview,
    type AppSettlementRecord,
    type SaveAppPricePlanParams,
    type TenantAppLicenseRecord
  } from '@/api/app-commerce'
  import {
    billingPeriodText,
    formatBasisPoints,
    formatDateTime,
    formatMoney,
    licenseStatusTagType,
    licenseStatusText,
    orderStatusTagType,
    orderStatusText,
    pricingModelText,
    saleScopeText,
    settlementStatusTagType,
    settlementStatusText,
    sourceText
  } from './commercial-display'

  defineOptions({ name: 'AppPlatformCommercialPage' })

  const StateError = defineComponent({
    name: 'CommercialStateError',
    props: {
      message: { type: String, required: true },
      loading: { type: Boolean, default: false }
    },
    emits: ['retry'],
    setup(props, { emit }) {
      return () =>
        h('div', { class: 'commercial-page__error' }, [
          h(ElAlert, { type: 'error', title: props.message, showIcon: true, closable: false }),
          h(
            ElButton,
            {
              link: true,
              type: 'primary',
              loading: props.loading,
              onClick: () => emit('retry')
            },
            () => '重试'
          )
        ])
    }
  })

  type SettlementAction = 'approve' | 'paid' | 'cancel'

  const activeTab = ref('prices')
  const apps = ref<AppPackageRecord[]>([])
  const developers = ref<DeveloperCertificationProfile[]>([])
  const referenceLoading = ref(false)
  const selectedAppCode = ref('')
  const pricePlans = ref<AppPricePlanRecord[]>([])
  const priceLoading = ref(false)
  const orderLoading = ref(false)
  const licenseLoading = ref(false)
  const revenueLoading = ref(false)
  const settlementLoading = ref(false)
  const mutationLoading = ref(false)
  const actionLoading = ref('')
  const loadError = reactive({ prices: '', orders: '', licenses: '', revenue: '', settlements: '' })

  const planDialogVisible = ref(false)
  const editingPlanCode = ref('')
  const planSaving = ref(false)
  const includedPlanCodes = ref('')
  const selectedTenantIds = ref('')
  const planForm = reactive({
    code: '',
    name: '',
    pricing_model: 'subscription' as AppPricingModel,
    billing_period: 'monthly' as AppBillingPeriod,
    amount_cents: 0,
    trial_days: 0,
    developer_share_bps: 7000,
    sale_scope: 'all' as 'all' | 'selected_tenants',
    sort: 100,
    enabled: true
  })

  const orders = ref<AppOrderRecord[]>([])
  const orderFilters = reactive<{
    order_no: string
    app_code: string
    tenant_id: string
    status: AppOrderStatus | ''
  }>({
    order_no: '',
    app_code: '',
    tenant_id: '',
    status: ''
  })
  const orderPager = reactive({ page: 1, limit: 20, total: 0 })
  const refundDialogVisible = ref(false)
  const refundOrder = ref<AppOrderRecord | null>(null)
  const refundReason = ref('')
  const refundReference = ref('')

  const licenses = ref<TenantAppLicenseRecord[]>([])
  const licenseFilters = reactive<{
    tenant_id: string
    app_id: number | ''
    status: TenantAppLicenseRecord['status'] | ''
  }>({ tenant_id: '', app_id: '', status: '' })
  const licensePager = reactive({ page: 1, limit: 20, total: 0 })
  const revokeDialogVisible = ref(false)
  const revokeLicense = ref<TenantAppLicenseRecord | null>(null)
  const revokeReason = ref('')

  const revenue = ref<AppRevenueOverview | null>(null)
  const revenueDateRange = ref<[string, string] | []>([])
  const revenueAppCode = ref('')

  const settlements = ref<AppSettlementRecord[]>([])
  const settlementFilters = reactive<{
    developer_id: number | ''
    period: string
    status: AppSettlementRecord['status'] | ''
  }>({ developer_id: '', period: '', status: '' })
  const settlementPager = reactive({ page: 1, limit: 20, total: 0 })
  const createSettlementVisible = ref(false)
  const createSettlementForm = reactive({ developer_id: '' as number | '', period: '' })
  const settlementActionVisible = ref(false)
  const settlementAction = ref<SettlementAction>('approve')
  const selectedSettlement = ref<AppSettlementRecord | null>(null)
  const settlementActionValue = ref('')
  const currentTabLoading = computed(() => {
    const states: Record<string, boolean> = {
      prices: priceLoading.value,
      orders: orderLoading.value,
      licenses: licenseLoading.value,
      revenue: revenueLoading.value,
      settlements: settlementLoading.value
    }
    return states[activeTab.value] || false
  })

  const revenueKpis = computed(() => {
    const totals = revenue.value?.totals
    if (!totals) return []
    return [
      {
        label: '总收入',
        value: formatMoney(totals.gross_amount_cents),
        note: `${totals.order_count} 个已支付订单`
      },
      {
        label: '退款金额',
        value: formatMoney(totals.refund_amount_cents),
        note: '已确认的全额退款'
      },
      {
        label: '开发者分成',
        value: formatMoney(totals.developer_amount_cents),
        note: '开发者应得金额'
      },
      {
        label: '平台分成',
        value: formatMoney(totals.platform_amount_cents),
        note: '平台应得金额'
      },
      {
        label: '待结算金额',
        value: formatMoney(totals.unsettled_developer_amount_cents),
        note: '可创建结算批次'
      }
    ]
  })

  const settlementActionTitle = computed(() => {
    const labels: Record<SettlementAction, string> = {
      approve: '审核通过结算',
      paid: '标记结算已打款',
      cancel: '取消结算'
    }
    return labels[settlementAction.value]
  })

  const settlementActionDescription = computed(() => {
    const labels: Record<SettlementAction, string> = {
      approve: '审核通过后，该批次将锁定并进入待打款状态。',
      paid: '仅在外部转账确认成功后标记为已打款。',
      cancel: '取消草稿批次后不可恢复。'
    }
    return labels[settlementAction.value]
  })

  function parsePositiveNumber(value: string) {
    const parsed = Number(value)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined
  }

  function parseCsvStrings(value: string) {
    return [
      ...new Set(
        value
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean)
      )
    ]
  }

  function parseCsvIds(value: string) {
    return [
      ...new Set(
        parseCsvStrings(value)
          .map(Number)
          .filter((item) => Number.isInteger(item) && item > 0)
      )
    ]
  }

  function appName(id: number) {
    return apps.value.find((app) => app.id === Number(id))?.name || `应用 #${id}`
  }

  function appCode(id: number) {
    return apps.value.find((app) => app.id === Number(id))?.code || '-'
  }

  function developerName(id?: number) {
    if (!id) return '-'
    return (
      developers.value.find((item) => Number(item.user_id) === Number(id))?.display_name ||
      `开发者 #${id}`
    )
  }

  async function loadReferenceData() {
    referenceLoading.value = true
    try {
      const [appRecords, developerRecords] = await Promise.all([
        fetchPlatformApps(),
        fetchDeveloperCertifications()
      ])
      apps.value = appRecords || []
      developers.value = developerRecords || []
      if (!selectedAppCode.value && apps.value.length) selectedAppCode.value = apps.value[0].code
    } catch (error) {
      console.error('[AppPlatformCommercialPage] load reference data failed:', error)
      ElMessage.error('应用或开发者数据加载失败')
    } finally {
      referenceLoading.value = false
    }
  }

  async function loadPricePlans() {
    if (!selectedAppCode.value) {
      pricePlans.value = []
      return
    }
    priceLoading.value = true
    loadError.prices = ''
    try {
      pricePlans.value = await fetchPlatformAppPricePlans(selectedAppCode.value)
    } catch (error) {
      console.error('[AppPlatformCommercialPage] load price plans failed:', error)
      pricePlans.value = []
      loadError.prices = '价格方案加载失败'
    } finally {
      priceLoading.value = false
    }
  }

  function resetPlanForm() {
    Object.assign(planForm, {
      code: '',
      name: '',
      pricing_model: 'subscription',
      billing_period: 'monthly',
      amount_cents: 0,
      trial_days: 0,
      developer_share_bps: 7000,
      sale_scope: 'all',
      sort: 100,
      enabled: true
    })
    includedPlanCodes.value = ''
    selectedTenantIds.value = ''
  }

  function openPlanDialog(plan?: AppPricePlanRecord) {
    editingPlanCode.value = plan?.code || ''
    resetPlanForm()
    if (plan) {
      Object.assign(planForm, {
        code: plan.code,
        name: plan.name,
        pricing_model: plan.pricing_model,
        billing_period: plan.billing_period,
        amount_cents: plan.amount_cents,
        trial_days: plan.trial_days || 0,
        developer_share_bps: plan.developer_share_bps || 0,
        sale_scope: plan.sale_scope || 'all',
        sort: plan.sort || 0,
        enabled: plan.status !== 0
      })
      includedPlanCodes.value = plan.included_plan_codes?.join(', ') || ''
      selectedTenantIds.value = plan.tenant_ids?.join(', ') || ''
    }
    planDialogVisible.value = true
  }

  function normalizePlanForm() {
    if (planForm.pricing_model === 'free' || planForm.pricing_model === 'included') {
      planForm.billing_period = 'none'
      planForm.amount_cents = 0
      return
    }
    if (planForm.pricing_model === 'one_time') {
      planForm.billing_period = 'none'
      return
    }
    if (planForm.billing_period === 'none') planForm.billing_period = 'monthly'
  }

  async function savePlan() {
    const code = planForm.code.trim()
    const name = planForm.name.trim()
    if (!selectedAppCode.value || !/^[a-z][a-z0-9_]{2,49}$/.test(code) || !name) {
      ElMessage.warning('请输入有效的方案编码和名称')
      return
    }
    const includedCodes = parseCsvStrings(includedPlanCodes.value)
    const tenantIds = parseCsvIds(selectedTenantIds.value)
    if (planForm.pricing_model === 'included' && !includedCodes.length) {
      ElMessage.warning('请至少选择一个包含该应用的 SaaS 套餐编码')
      return
    }
    if (planForm.sale_scope === 'selected_tenants' && !tenantIds.length) {
      ElMessage.warning('请至少输入一个租户 ID')
      return
    }
    normalizePlanForm()
    const data: SaveAppPricePlanParams = {
      code,
      name,
      pricing_model: planForm.pricing_model,
      billing_period: planForm.billing_period,
      amount_cents: planForm.amount_cents,
      trial_days: planForm.trial_days,
      developer_share_bps: planForm.developer_share_bps,
      included_plan_codes: planForm.pricing_model === 'included' ? includedCodes : [],
      sale_scope: planForm.sale_scope,
      tenant_ids: planForm.sale_scope === 'selected_tenants' ? tenantIds : [],
      status: planForm.enabled ? 1 : 0,
      sort: planForm.sort
    }
    planSaving.value = true
    try {
      if (editingPlanCode.value) {
        const changes: Partial<SaveAppPricePlanParams> = { ...data }
        delete changes.code
        await updatePlatformAppPricePlan(selectedAppCode.value, editingPlanCode.value, changes)
        ElMessage.success('价格方案已更新')
      } else {
        await createPlatformAppPricePlan(selectedAppCode.value, data)
        ElMessage.success('价格方案已创建')
      }
      planDialogVisible.value = false
      await loadPricePlans()
    } finally {
      planSaving.value = false
    }
  }

  async function togglePlanStatus(plan: AppPricePlanRecord) {
    const nextStatus = plan.status === 0 ? 1 : 0
    await ElMessageBox.confirm(
      `确认${nextStatus ? '启用' : '禁用'}价格方案“${plan.name}”吗？`,
      `${nextStatus ? '启用' : '禁用'}价格方案`,
      { type: 'warning', confirmButtonText: nextStatus ? '启用' : '禁用' }
    )
    actionLoading.value = `plan:${plan.code}`
    try {
      await updatePlatformAppPricePlanStatus(selectedAppCode.value, plan.code, nextStatus)
      ElMessage.success(`价格方案已${nextStatus ? '启用' : '禁用'}`)
      await loadPricePlans()
    } finally {
      actionLoading.value = ''
    }
  }

  async function loadOrders() {
    orderLoading.value = true
    loadError.orders = ''
    try {
      const result = await fetchPlatformAppOrders({
        page: orderPager.page,
        limit: orderPager.limit,
        order_no: orderFilters.order_no.trim() || undefined,
        app_code: orderFilters.app_code.trim() || undefined,
        tenant_id: parsePositiveNumber(orderFilters.tenant_id),
        status: orderFilters.status || undefined
      })
      orders.value = result.list || []
      orderPager.total = Number(result.total) || 0
    } catch (error) {
      console.error('[AppPlatformCommercialPage] load orders failed:', error)
      orders.value = []
      orderPager.total = 0
      loadError.orders = '应用订单加载失败'
    } finally {
      orderLoading.value = false
    }
  }

  function refreshOrders() {
    orderPager.page = 1
    loadOrders()
  }

  function resetOrderFilters() {
    Object.assign(orderFilters, { order_no: '', app_code: '', tenant_id: '', status: '' })
    refreshOrders()
  }

  function handleOrderSizeChange() {
    orderPager.page = 1
    loadOrders()
  }

  function openRefundDialog(order: AppOrderRecord) {
    refundOrder.value = order
    refundReason.value = ''
    refundReference.value = ''
    refundDialogVisible.value = true
  }

  async function confirmRefund() {
    const reason = refundReason.value.trim()
    const reference = refundReference.value.trim()
    if (!refundOrder.value || reason.length < 3 || !reference) {
      ElMessage.warning('请输入退款原因和支付渠道退款凭证')
      return
    }
    await ElMessageBox.confirm(
      `确认登记订单 ${refundOrder.value.order_no} 的全额退款吗？`,
      '确认全额退款',
      { type: 'warning', confirmButtonText: '登记退款' }
    )
    mutationLoading.value = true
    try {
      await refundPlatformAppOrder(refundOrder.value.order_no, reason, reference)
      refundDialogVisible.value = false
      ElMessage.success('全额退款已登记')
      await Promise.all([loadOrders(), loadLicenses(), loadRevenue()])
    } finally {
      mutationLoading.value = false
    }
  }

  async function loadLicenses() {
    licenseLoading.value = true
    loadError.licenses = ''
    try {
      const result = await fetchPlatformAppLicenses({
        page: licensePager.page,
        limit: licensePager.limit,
        tenant_id: parsePositiveNumber(licenseFilters.tenant_id),
        app_id: licenseFilters.app_id || undefined,
        status: licenseFilters.status || undefined
      })
      licenses.value = result.list || []
      licensePager.total = Number(result.total) || 0
    } catch (error) {
      console.error('[AppPlatformCommercialPage] load licenses failed:', error)
      licenses.value = []
      licensePager.total = 0
      loadError.licenses = '应用授权加载失败'
    } finally {
      licenseLoading.value = false
    }
  }

  function refreshLicenses() {
    licensePager.page = 1
    loadLicenses()
  }

  function resetLicenseFilters() {
    Object.assign(licenseFilters, { tenant_id: '', app_id: '', status: '' })
    refreshLicenses()
  }

  function handleLicenseSizeChange() {
    licensePager.page = 1
    loadLicenses()
  }

  function openRevokeDialog(license: TenantAppLicenseRecord) {
    revokeLicense.value = license
    revokeReason.value = ''
    revokeDialogVisible.value = true
  }

  async function confirmRevoke() {
    const reason = revokeReason.value.trim()
    if (!revokeLicense.value || reason.length < 3) {
      ElMessage.warning('请输入撤销原因')
      return
    }
    await ElMessageBox.confirm(`确认撤销应用授权 #${revokeLicense.value.id} 吗？`, '确认撤销授权', {
      type: 'warning',
      confirmButtonText: '撤销'
    })
    mutationLoading.value = true
    try {
      await revokePlatformAppLicense(revokeLicense.value.id, reason)
      revokeDialogVisible.value = false
      ElMessage.success('应用授权已撤销')
      await loadLicenses()
    } finally {
      mutationLoading.value = false
    }
  }

  async function loadRevenue() {
    revenueLoading.value = true
    loadError.revenue = ''
    try {
      revenue.value = await fetchPlatformAppRevenue({
        start_date: revenueDateRange.value[0] || undefined,
        end_date: revenueDateRange.value[1] || undefined,
        app_code: revenueAppCode.value.trim() || undefined
      })
    } catch (error) {
      console.error('[AppPlatformCommercialPage] load revenue failed:', error)
      revenue.value = null
      loadError.revenue = '应用收入加载失败'
    } finally {
      revenueLoading.value = false
    }
  }

  function resetRevenueFilters() {
    revenueDateRange.value = []
    revenueAppCode.value = ''
    loadRevenue()
  }

  async function loadSettlements() {
    settlementLoading.value = true
    loadError.settlements = ''
    try {
      const result = await fetchPlatformAppSettlements({
        page: settlementPager.page,
        limit: settlementPager.limit,
        developer_id: settlementFilters.developer_id || undefined,
        period: settlementFilters.period || undefined,
        status: settlementFilters.status || undefined
      })
      settlements.value = result.list || []
      settlementPager.total = Number(result.total) || 0
    } catch (error) {
      console.error('[AppPlatformCommercialPage] load settlements failed:', error)
      settlements.value = []
      settlementPager.total = 0
      loadError.settlements = '开发者结算加载失败'
    } finally {
      settlementLoading.value = false
    }
  }

  function refreshSettlements() {
    settlementPager.page = 1
    loadSettlements()
  }

  function handleSettlementSizeChange() {
    settlementPager.page = 1
    loadSettlements()
  }

  function openCreateSettlement() {
    createSettlementForm.developer_id = settlementFilters.developer_id || ''
    createSettlementForm.period = settlementFilters.period || ''
    createSettlementVisible.value = true
  }

  async function confirmCreateSettlement() {
    if (
      !createSettlementForm.developer_id ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(createSettlementForm.period)
    ) {
      ElMessage.warning('请选择开发者和结算月份')
      return
    }
    await ElMessageBox.confirm(
      `确认为 ${developerName(createSettlementForm.developer_id)} 创建 ${createSettlementForm.period} 的结算批次吗？`,
      '确认创建结算',
      { type: 'warning', confirmButtonText: '创建批次' }
    )
    mutationLoading.value = true
    try {
      await createPlatformAppSettlement(
        createSettlementForm.developer_id,
        createSettlementForm.period
      )
      createSettlementVisible.value = false
      ElMessage.success('结算批次已创建')
      await Promise.all([loadSettlements(), loadRevenue()])
    } finally {
      mutationLoading.value = false
    }
  }

  function openSettlementAction(record: AppSettlementRecord, action: SettlementAction) {
    selectedSettlement.value = record
    settlementAction.value = action
    settlementActionValue.value = ''
    settlementActionVisible.value = true
  }

  async function confirmSettlementAction() {
    const record = selectedSettlement.value
    const value = settlementActionValue.value.trim()
    if (!record || (settlementAction.value !== 'paid' && value.length < 2) || !value) {
      ElMessage.warning(settlementAction.value === 'paid' ? '请输入打款凭证' : '请输入处理说明')
      return
    }
    await ElMessageBox.confirm(
      `确认对结算批次 ${record.batch_no} 执行“${settlementActionTitle.value}”吗？`,
      settlementActionTitle.value,
      { type: 'warning', confirmButtonText: '确认' }
    )
    mutationLoading.value = true
    try {
      if (settlementAction.value === 'approve') await approvePlatformAppSettlement(record.id, value)
      if (settlementAction.value === 'paid') await markPlatformAppSettlementPaid(record.id, value)
      if (settlementAction.value === 'cancel') await cancelPlatformAppSettlement(record.id, value)
      settlementActionVisible.value = false
      ElMessage.success('结算状态已更新')
      await Promise.all([loadSettlements(), loadRevenue()])
    } finally {
      mutationLoading.value = false
    }
  }

  function handleTabChange(name: string | number) {
    const loaders: Record<string, () => Promise<void>> = {
      prices: loadPricePlans,
      orders: loadOrders,
      licenses: loadLicenses,
      revenue: loadRevenue,
      settlements: loadSettlements
    }
    loaders[String(name)]?.()
  }

  function refreshCurrentTab() {
    handleTabChange(activeTab.value)
  }

  onMounted(async () => {
    await loadReferenceData()
    await loadPricePlans()
  })
</script>

<style scoped>
  .commercial-page {
    min-height: 100%;
  }

  .commercial-page__header,
  .commercial-page__toolbar,
  .commercial-page__error {
    display: flex;
    gap: 12px;
  }

  .commercial-page__header {
    align-items: flex-start;
    justify-content: space-between;
  }

  .commercial-page__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .commercial-page__subtitle {
    margin: 6px 0 0;
    font-size: 13px;
    line-height: 1.5;
    color: var(--el-text-color-secondary);
  }

  .commercial-page__tabs :deep(.el-tabs__content) {
    overflow: visible;
  }

  .commercial-page__toolbar {
    align-items: center;
    margin-bottom: 16px;
  }

  .commercial-page__toolbar--wrap {
    flex-wrap: wrap;
  }

  .commercial-page__error {
    align-items: center;
    margin-bottom: 16px;
  }

  .commercial-page__app-select,
  .commercial-page__developer-select {
    width: 280px;
  }

  .commercial-page__input {
    width: 220px;
  }

  .commercial-page__small-input,
  .commercial-page__select,
  .commercial-page__month {
    width: 150px;
  }

  .commercial-page__date {
    width: 330px;
  }

  .commercial-page__primary {
    font-weight: 500;
    color: var(--el-text-color-primary);
  }

  .commercial-page__muted {
    margin-top: 2px;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .commercial-page__pagination {
    justify-content: flex-end;
    margin-top: 18px;
  }

  .commercial-page__revenue {
    min-height: 240px;
  }

  .commercial-page__kpis {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    gap: 12px;
  }

  .commercial-page__kpi {
    min-width: 0;
    padding: 14px 16px;
    background: var(--el-fill-color-extra-light);
    border: 1px solid var(--el-border-color-lighter);
  }

  .commercial-page__kpi span,
  .commercial-page__kpi small {
    display: block;
    font-size: 12px;
    color: var(--el-text-color-secondary);
  }

  .commercial-page__kpi strong {
    display: block;
    margin: 8px 0 4px;
    font-size: 21px;
    font-weight: 600;
    line-height: 1.2;
  }

  .commercial-page__revenue-table {
    margin-top: 18px;
  }

  .commercial-page__form-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0 16px;
  }

  .commercial-page__form-grid :deep(.el-select),
  .commercial-page__form-grid :deep(.el-input-number),
  .commercial-page__dialog-form :deep(.el-input) {
    width: 100%;
  }

  .commercial-page__dialog-form {
    margin-top: 16px;
  }

  @media (width <= 1120px) {
    .commercial-page__kpis {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
  }

  @media (width <= 760px) {
    .commercial-page__app-select,
    .commercial-page__developer-select,
    .commercial-page__input,
    .commercial-page__small-input,
    .commercial-page__select,
    .commercial-page__month,
    .commercial-page__date {
      width: 100%;
    }

    .commercial-page__toolbar,
    .commercial-page__form-grid {
      display: grid;
      grid-template-columns: 1fr;
    }

    .commercial-page__kpis {
      grid-template-columns: 1fr;
    }

    .commercial-page__pagination {
      justify-content: flex-start;
      overflow-x: auto;
    }
  }
</style>
