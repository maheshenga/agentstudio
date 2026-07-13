<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="commercial-page">
      <template #header>
        <div class="commercial-page__header">
          <div>
            <h1 class="commercial-page__title">Commercial Operations</h1>
            <p class="commercial-page__subtitle">
              Manage application pricing, purchases, licenses, revenue, and developer settlements.
            </p>
          </div>
          <ElTooltip content="Refresh current view" placement="bottom">
            <ElButton
              circle
              :icon="Refresh"
              :loading="currentTabLoading"
              aria-label="Refresh commercial operations"
              @click="refreshCurrentTab"
            />
          </ElTooltip>
        </div>
      </template>

      <ElTabs v-model="activeTab" class="commercial-page__tabs" @tab-change="handleTabChange">
        <ElTabPane label="Price Plans" name="prices">
          <div class="commercial-page__toolbar">
            <ElSelect
              v-model="selectedAppCode"
              filterable
              placeholder="Select application"
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
              New plan
            </ElButton>
          </div>

          <StateError
            v-if="loadError.prices"
            :message="loadError.prices"
            :loading="priceLoading"
            @retry="loadPricePlans"
          />

          <ElTable v-loading="priceLoading" :data="pricePlans" border>
            <ElTableColumn label="Plan" min-width="210">
              <template #default="{ row }">
                <div class="commercial-page__primary">{{ row.name }}</div>
                <div class="commercial-page__muted">{{ row.code }}</div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Pricing" width="150">
              <template #default="{ row }">
                <ElTag effect="light" type="info">{{ pricingModelText(row.pricing_model) }}</ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Billing" width="130">
              <template #default="{ row }">{{ billingPeriodText(row.billing_period) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Amount" width="140" align="right">
              <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Trial" width="100" align="right">
              <template #default="{ row }">{{ row.trial_days || 0 }} days</template>
            </ElTableColumn>
            <ElTableColumn label="Developer share" width="150" align="right">
              <template #default="{ row }">{{
                formatBasisPoints(row.developer_share_bps)
              }}</template>
            </ElTableColumn>
            <ElTableColumn label="Availability" min-width="190">
              <template #default="{ row }">
                <div>{{ saleScopeText(row.sale_scope) }}</div>
                <div v-if="row.pricing_model === 'included'" class="commercial-page__muted">
                  {{ row.included_plan_codes?.join(', ') || 'No SaaS plans selected' }}
                </div>
                <div
                  v-else-if="row.sale_scope === 'selected_tenants'"
                  class="commercial-page__muted"
                >
                  {{ row.tenant_ids?.length || 0 }} tenants
                </div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Status" width="110">
              <template #default="{ row }">
                <ElTag :type="row.status === 0 ? 'info' : 'success'" effect="light">
                  {{ row.status === 0 ? 'Disabled' : 'Enabled' }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Actions" width="190" fixed="right">
              <template #default="{ row }">
                <ElButton link type="primary" @click="openPlanDialog(row)">Edit</ElButton>
                <ElButton
                  link
                  :type="row.status === 0 ? 'success' : 'warning'"
                  :loading="actionLoading === `plan:${row.code}`"
                  @click="togglePlanStatus(row)"
                >
                  {{ row.status === 0 ? 'Enable' : 'Disable' }}
                </ElButton>
              </template>
            </ElTableColumn>
            <template #empty>
              <ElEmpty
                :description="
                  selectedAppCode ? 'No price plans for this app' : 'Select an application'
                "
              />
            </template>
          </ElTable>
        </ElTabPane>

        <ElTabPane label="Orders" name="orders">
          <div class="commercial-page__toolbar commercial-page__toolbar--wrap">
            <ElInput
              v-model="orderFilters.order_no"
              clearable
              placeholder="Order number"
              class="commercial-page__input"
              @keyup.enter="refreshOrders"
            />
            <ElInput
              v-model="orderFilters.app_code"
              clearable
              placeholder="App code"
              class="commercial-page__input"
              @keyup.enter="refreshOrders"
            />
            <ElInput
              v-model="orderFilters.tenant_id"
              clearable
              placeholder="Tenant ID"
              class="commercial-page__small-input"
              @keyup.enter="refreshOrders"
            />
            <ElSelect
              v-model="orderFilters.status"
              clearable
              placeholder="Status"
              class="commercial-page__select"
              @change="refreshOrders"
            >
              <ElOption label="Pending" value="pending" />
              <ElOption label="Paid" value="paid" />
              <ElOption label="Refunded" value="refunded" />
              <ElOption label="Closed" value="closed" />
            </ElSelect>
            <ElButton type="primary" :loading="orderLoading" @click="refreshOrders"
              >Search</ElButton
            >
            <ElButton :disabled="orderLoading" @click="resetOrderFilters">Reset</ElButton>
          </div>

          <StateError
            v-if="loadError.orders"
            :message="loadError.orders"
            :loading="orderLoading"
            @retry="loadOrders"
          />

          <ElTable v-loading="orderLoading" :data="orders" border>
            <ElTableColumn prop="order_no" label="Order" min-width="210" show-overflow-tooltip />
            <ElTableColumn prop="tenant_id" label="Tenant" width="100" />
            <ElTableColumn label="Application" min-width="190">
              <template #default="{ row }">
                <div class="commercial-page__primary">{{ row.app_name || row.app_code }}</div>
                <div class="commercial-page__muted">{{ row.app_code }}</div>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Plan" min-width="160">
              <template #default="{ row }">{{ row.price_plan_code }}</template>
            </ElTableColumn>
            <ElTableColumn label="Amount" width="130" align="right">
              <template #default="{ row }">{{ formatMoney(row.amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Status" width="120">
              <template #default="{ row }">
                <ElTag :type="orderStatusTagType(row.status)" effect="light">
                  {{ orderStatusText(row.status) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Paid" width="180">
              <template #default="{ row }">{{ formatDateTime(row.paid_at) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Created" width="180">
              <template #default="{ row }">{{ formatDateTime(row.create_time) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Actions" width="110" fixed="right">
              <template #default="{ row }">
                <ElButton
                  v-if="row.status === 'paid'"
                  link
                  type="danger"
                  @click="openRefundDialog(row)"
                >
                  Refund
                </ElButton>
                <span v-else class="commercial-page__muted">-</span>
              </template>
            </ElTableColumn>
            <template #empty><ElEmpty description="No application orders" /></template>
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

        <ElTabPane label="Licenses" name="licenses">
          <div class="commercial-page__toolbar commercial-page__toolbar--wrap">
            <ElInput
              v-model="licenseFilters.tenant_id"
              clearable
              placeholder="Tenant ID"
              class="commercial-page__small-input"
              @keyup.enter="refreshLicenses"
            />
            <ElSelect
              v-model="licenseFilters.app_id"
              clearable
              filterable
              placeholder="Application"
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
              placeholder="Status"
              class="commercial-page__select"
              @change="refreshLicenses"
            >
              <ElOption label="Active" value="active" />
              <ElOption label="Trialing" value="trialing" />
              <ElOption label="Expired" value="expired" />
              <ElOption label="Revoked" value="revoked" />
              <ElOption label="Refunded" value="refunded" />
            </ElSelect>
            <ElButton type="primary" :loading="licenseLoading" @click="refreshLicenses">
              Search
            </ElButton>
            <ElButton :disabled="licenseLoading" @click="resetLicenseFilters">Reset</ElButton>
          </div>

          <StateError
            v-if="loadError.licenses"
            :message="loadError.licenses"
            :loading="licenseLoading"
            @retry="loadLicenses"
          />

          <ElTable v-loading="licenseLoading" :data="licenses" border>
            <ElTableColumn prop="id" label="License" width="100" />
            <ElTableColumn prop="tenant_id" label="Tenant" width="100" />
            <ElTableColumn label="Application" min-width="210">
              <template #default="{ row }">
                <div class="commercial-page__primary">{{ appName(row.app_id) }}</div>
                <div class="commercial-page__muted">{{ appCode(row.app_id) }}</div>
              </template>
            </ElTableColumn>
            <ElTableColumn prop="price_plan_id" label="Plan ID" width="100" />
            <ElTableColumn label="Source" width="110">
              <template #default="{ row }">{{ sourceText(row.source) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Status" width="120">
              <template #default="{ row }">
                <ElTag :type="licenseStatusTagType(row.status)" effect="light">
                  {{ licenseStatusText(row.status) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Effective" width="180">
              <template #default="{ row }">{{ formatDateTime(row.effective_at) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Expires" width="180">
              <template #default="{ row }">{{ formatDateTime(row.expires_at) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Actions" width="110" fixed="right">
              <template #default="{ row }">
                <ElButton
                  v-if="row.status === 'active' || row.status === 'trialing'"
                  link
                  type="danger"
                  @click="openRevokeDialog(row)"
                >
                  Revoke
                </ElButton>
                <span v-else class="commercial-page__muted">-</span>
              </template>
            </ElTableColumn>
            <template #empty><ElEmpty description="No application licenses" /></template>
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

        <ElTabPane label="Revenue" name="revenue">
          <div class="commercial-page__toolbar commercial-page__toolbar--wrap">
            <ElDatePicker
              v-model="revenueDateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              range-separator="to"
              start-placeholder="Start date"
              end-placeholder="End date"
              class="commercial-page__date"
            />
            <ElInput
              v-model="revenueAppCode"
              clearable
              placeholder="App code"
              class="commercial-page__input"
              @keyup.enter="loadRevenue"
            />
            <ElButton type="primary" :loading="revenueLoading" @click="loadRevenue">
              Apply
            </ElButton>
            <ElButton :disabled="revenueLoading" @click="resetRevenueFilters">Reset</ElButton>
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
              <ElTableColumn label="Application" min-width="210">
                <template #default="{ row }">
                  <div class="commercial-page__primary">{{ row.app_name }}</div>
                  <div class="commercial-page__muted">{{ row.app_code }}</div>
                </template>
              </ElTableColumn>
              <ElTableColumn label="Gross" width="140" align="right">
                <template #default="{ row }">{{ formatMoney(row.gross_amount_cents) }}</template>
              </ElTableColumn>
              <ElTableColumn label="Refunds" width="140" align="right">
                <template #default="{ row }">{{ formatMoney(row.refund_amount_cents) }}</template>
              </ElTableColumn>
              <ElTableColumn label="Developer" width="150" align="right">
                <template #default="{ row }">{{
                  formatMoney(row.developer_amount_cents)
                }}</template>
              </ElTableColumn>
              <ElTableColumn label="Platform" width="150" align="right">
                <template #default="{ row }">{{ formatMoney(row.platform_amount_cents) }}</template>
              </ElTableColumn>
              <ElTableColumn label="Unsettled" width="150" align="right">
                <template #default="{ row }">
                  {{ formatMoney(row.unsettled_developer_amount_cents) }}
                </template>
              </ElTableColumn>
              <ElTableColumn prop="order_count" label="Orders" width="100" align="right" />
              <template #empty><ElEmpty description="No application revenue" /></template>
            </ElTable>
          </div>
        </ElTabPane>

        <ElTabPane label="Settlements" name="settlements">
          <div class="commercial-page__toolbar commercial-page__toolbar--wrap">
            <ElSelect
              v-model="settlementFilters.developer_id"
              clearable
              filterable
              placeholder="Developer"
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
              placeholder="Period"
              class="commercial-page__month"
              @change="refreshSettlements"
            />
            <ElSelect
              v-model="settlementFilters.status"
              clearable
              placeholder="Status"
              class="commercial-page__select"
              @change="refreshSettlements"
            >
              <ElOption label="Draft" value="draft" />
              <ElOption label="Approved" value="approved" />
              <ElOption label="Paid" value="paid" />
              <ElOption label="Cancelled" value="cancelled" />
            </ElSelect>
            <ElButton type="primary" :icon="Plus" @click="openCreateSettlement">
              New settlement
            </ElButton>
          </div>

          <StateError
            v-if="loadError.settlements"
            :message="loadError.settlements"
            :loading="settlementLoading"
            @retry="loadSettlements"
          />

          <ElTable v-loading="settlementLoading" :data="settlements" border>
            <ElTableColumn prop="batch_no" label="Batch" min-width="210" show-overflow-tooltip />
            <ElTableColumn label="Developer" min-width="170">
              <template #default="{ row }">{{ developerName(row.developer_id) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Period" width="210">
              <template #default="{ row }">{{ row.period_start }} to {{ row.period_end }}</template>
            </ElTableColumn>
            <ElTableColumn label="Gross" width="130" align="right">
              <template #default="{ row }">{{ formatMoney(row.gross_amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Refunds" width="130" align="right">
              <template #default="{ row }">{{ formatMoney(row.refund_amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Developer" width="150" align="right">
              <template #default="{ row }">{{ formatMoney(row.developer_amount_cents) }}</template>
            </ElTableColumn>
            <ElTableColumn label="Status" width="120">
              <template #default="{ row }">
                <ElTag :type="settlementStatusTagType(row.status)" effect="light">
                  {{ settlementStatusText(row.status) }}
                </ElTag>
              </template>
            </ElTableColumn>
            <ElTableColumn label="Actions" width="230" fixed="right">
              <template #default="{ row }">
                <ElButton
                  v-if="row.status === 'draft'"
                  link
                  type="success"
                  @click="openSettlementAction(row, 'approve')"
                >
                  Approve
                </ElButton>
                <ElButton
                  v-if="row.status === 'approved'"
                  link
                  type="primary"
                  @click="openSettlementAction(row, 'paid')"
                >
                  Mark paid
                </ElButton>
                <ElButton
                  v-if="row.status === 'draft'"
                  link
                  type="danger"
                  @click="openSettlementAction(row, 'cancel')"
                >
                  Cancel
                </ElButton>
                <span
                  v-if="row.status === 'paid' || row.status === 'cancelled'"
                  class="commercial-page__muted"
                >
                  Finalized
                </span>
              </template>
            </ElTableColumn>
            <template #empty><ElEmpty description="No settlement batches" /></template>
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
      :title="editingPlanCode ? 'Edit price plan' : 'Create price plan'"
      width="min(720px, 94vw)"
      destroy-on-close
    >
      <ElForm label-position="top">
        <div class="commercial-page__form-grid">
          <ElFormItem label="Code" required>
            <ElInput v-model="planForm.code" :disabled="Boolean(editingPlanCode)" maxlength="50" />
          </ElFormItem>
          <ElFormItem label="Name" required>
            <ElInput v-model="planForm.name" maxlength="100" />
          </ElFormItem>
          <ElFormItem label="Pricing model" required>
            <ElSelect v-model="planForm.pricing_model" @change="normalizePlanForm">
              <ElOption label="Free" value="free" />
              <ElOption label="Included in SaaS plan" value="included" />
              <ElOption label="Subscription" value="subscription" />
              <ElOption label="One-time" value="one_time" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="Billing period" required>
            <ElSelect
              v-model="planForm.billing_period"
              :disabled="planForm.pricing_model !== 'subscription'"
            >
              <ElOption label="None" value="none" />
              <ElOption label="Monthly" value="monthly" />
              <ElOption label="Yearly" value="yearly" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="Amount (CNY cents)" required>
            <ElInputNumber
              v-model="planForm.amount_cents"
              :min="0"
              :max="2147483647"
              :step="100"
              controls-position="right"
              :disabled="planForm.pricing_model === 'free' || planForm.pricing_model === 'included'"
            />
          </ElFormItem>
          <ElFormItem label="Trial days">
            <ElInputNumber
              v-model="planForm.trial_days"
              :min="0"
              :max="365"
              controls-position="right"
            />
          </ElFormItem>
          <ElFormItem label="Developer share (basis points)">
            <ElInputNumber
              v-model="planForm.developer_share_bps"
              :min="0"
              :max="10000"
              :step="100"
              controls-position="right"
            />
          </ElFormItem>
          <ElFormItem label="Sort order">
            <ElInputNumber v-model="planForm.sort" :min="0" controls-position="right" />
          </ElFormItem>
          <ElFormItem label="Sale scope">
            <ElSelect v-model="planForm.sale_scope">
              <ElOption label="All tenants" value="all" />
              <ElOption label="Selected tenants" value="selected_tenants" />
            </ElSelect>
          </ElFormItem>
          <ElFormItem label="Initial status">
            <ElSwitch v-model="planForm.enabled" active-text="Enabled" inactive-text="Disabled" />
          </ElFormItem>
        </div>
        <ElFormItem
          v-if="planForm.pricing_model === 'included'"
          label="Included SaaS plan codes"
          required
        >
          <ElInput v-model="includedPlanCodes" placeholder="starter, pro, enterprise" />
        </ElFormItem>
        <ElFormItem v-if="planForm.sale_scope === 'selected_tenants'" label="Tenant IDs" required>
          <ElInput v-model="selectedTenantIds" placeholder="12, 18, 26" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="planSaving" @click="planDialogVisible = false">Cancel</ElButton>
        <ElButton type="primary" :loading="planSaving" @click="savePlan">Save plan</ElButton>
      </template>
    </ElDialog>

    <ElDialog v-model="refundDialogVisible" title="Record full refund" width="520px">
      <ElAlert
        type="warning"
        title="This records a provider-confirmed full refund and revokes application access."
        show-icon
        :closable="false"
      />
      <ElForm label-position="top" class="commercial-page__dialog-form">
        <ElFormItem label="Order">
          <ElInput :model-value="refundOrder?.order_no" disabled />
        </ElFormItem>
        <ElFormItem label="Reason" required>
          <ElInput v-model="refundReason" type="textarea" :rows="3" maxlength="255" />
        </ElFormItem>
        <ElFormItem label="Provider refund reference" required>
          <ElInput v-model="refundReference" maxlength="100" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="mutationLoading" @click="refundDialogVisible = false">Cancel</ElButton>
        <ElButton type="danger" :loading="mutationLoading" @click="confirmRefund"
          >Confirm refund</ElButton
        >
      </template>
    </ElDialog>

    <ElDialog v-model="revokeDialogVisible" title="Revoke application license" width="520px">
      <ElAlert
        type="warning"
        title="Revocation immediately blocks opening and runtime access for this license."
        show-icon
        :closable="false"
      />
      <ElForm label-position="top" class="commercial-page__dialog-form">
        <ElFormItem label="License">
          <ElInput :model-value="revokeLicense ? `#${revokeLicense.id}` : ''" disabled />
        </ElFormItem>
        <ElFormItem label="Reason" required>
          <ElInput v-model="revokeReason" type="textarea" :rows="3" maxlength="255" />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="mutationLoading" @click="revokeDialogVisible = false">Cancel</ElButton>
        <ElButton type="danger" :loading="mutationLoading" @click="confirmRevoke"
          >Confirm revoke</ElButton
        >
      </template>
    </ElDialog>

    <ElDialog v-model="createSettlementVisible" title="Create settlement batch" width="520px">
      <ElForm label-position="top">
        <ElFormItem label="Developer" required>
          <ElSelect v-model="createSettlementForm.developer_id" filterable>
            <ElOption
              v-for="developer in developers"
              :key="developer.id"
              :label="developer.display_name"
              :value="Number(developer.user_id)"
            />
          </ElSelect>
        </ElFormItem>
        <ElFormItem label="Period" required>
          <ElDatePicker
            v-model="createSettlementForm.period"
            type="month"
            value-format="YYYY-MM"
            placeholder="Select month"
          />
        </ElFormItem>
      </ElForm>
      <template #footer>
        <ElButton :disabled="mutationLoading" @click="createSettlementVisible = false"
          >Cancel</ElButton
        >
        <ElButton type="primary" :loading="mutationLoading" @click="confirmCreateSettlement">
          Create batch
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
        <ElFormItem label="Batch">
          <ElInput :model-value="selectedSettlement?.batch_no" disabled />
        </ElFormItem>
        <ElFormItem :label="settlementAction === 'paid' ? 'Payment reference' : 'Note'" required>
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
          >Cancel</ElButton
        >
        <ElButton
          :type="settlementAction === 'cancel' ? 'danger' : 'primary'"
          :loading="mutationLoading"
          @click="confirmSettlementAction"
        >
          Confirm
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
            () => 'Retry'
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
  const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })

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
        label: 'Gross revenue',
        value: formatMoney(totals.gross_amount_cents),
        note: `${totals.order_count} paid orders`
      },
      {
        label: 'Refunds',
        value: formatMoney(totals.refund_amount_cents),
        note: 'Confirmed full refunds'
      },
      {
        label: 'Developer amount',
        value: formatMoney(totals.developer_amount_cents),
        note: 'Developer share'
      },
      {
        label: 'Platform amount',
        value: formatMoney(totals.platform_amount_cents),
        note: 'Platform share'
      },
      {
        label: 'Unsettled developer amount',
        value: formatMoney(totals.unsettled_developer_amount_cents),
        note: 'Available for settlement'
      }
    ]
  })

  const settlementActionTitle = computed(() => {
    const labels: Record<SettlementAction, string> = {
      approve: 'Approve settlement',
      paid: 'Mark settlement paid',
      cancel: 'Cancel settlement'
    }
    return labels[settlementAction.value]
  })

  const settlementActionDescription = computed(() => {
    const labels: Record<SettlementAction, string> = {
      approve: 'Approval locks the batch for payment.',
      paid: 'Only mark paid after the external transfer has been confirmed.',
      cancel: 'Cancellation is final for this draft batch.'
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

  function formatMoney(amountCents?: number) {
    return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(
      (Number(amountCents) || 0) / 100
    )
  }

  function formatBasisPoints(value?: number) {
    return `${((Number(value) || 0) / 100).toFixed(2).replace(/\.00$/, '')}%`
  }

  function formatDateTime(value: unknown) {
    if (!value) return '-'
    const date = value instanceof Date ? value : new Date(String(value))
    return Number.isNaN(date.getTime()) ? String(value) : dateFormatter.format(date)
  }

  function pricingModelText(model: AppPricingModel) {
    const labels: Record<AppPricingModel, string> = {
      free: 'Free',
      included: 'Included',
      subscription: 'Subscription',
      one_time: 'One-time'
    }
    return labels[model]
  }

  function billingPeriodText(period: AppBillingPeriod) {
    const labels: Record<AppBillingPeriod, string> = {
      none: 'None',
      monthly: 'Monthly',
      yearly: 'Yearly'
    }
    return labels[period]
  }

  function saleScopeText(scope?: 'all' | 'selected_tenants') {
    return scope === 'selected_tenants' ? 'Selected tenants' : 'All tenants'
  }

  function orderStatusText(status: AppOrderStatus) {
    const labels: Record<AppOrderStatus, string> = {
      pending: 'Pending',
      paid: 'Paid',
      refunded: 'Refunded',
      closed: 'Closed'
    }
    return labels[status]
  }

  function orderStatusTagType(status: AppOrderStatus) {
    const types: Record<AppOrderStatus, 'success' | 'warning' | 'danger' | 'info'> = {
      pending: 'warning',
      paid: 'success',
      refunded: 'danger',
      closed: 'info'
    }
    return types[status]
  }

  function sourceText(source: TenantAppLicenseRecord['source']) {
    const labels: Record<TenantAppLicenseRecord['source'], string> = {
      trial: 'Trial',
      order: 'Order',
      platform: 'Platform'
    }
    return labels[source]
  }

  function licenseStatusText(status: TenantAppLicenseRecord['status']) {
    const labels: Record<TenantAppLicenseRecord['status'], string> = {
      active: 'Active',
      trialing: 'Trialing',
      expired: 'Expired',
      revoked: 'Revoked',
      refunded: 'Refunded'
    }
    return labels[status]
  }

  function licenseStatusTagType(status: TenantAppLicenseRecord['status']) {
    if (status === 'active' || status === 'trialing') return 'success'
    if (status === 'expired') return 'warning'
    return 'danger'
  }

  function settlementStatusText(status: AppSettlementRecord['status']) {
    const labels: Record<AppSettlementRecord['status'], string> = {
      draft: 'Draft',
      approved: 'Approved',
      paid: 'Paid',
      cancelled: 'Cancelled'
    }
    return labels[status]
  }

  function settlementStatusTagType(status: AppSettlementRecord['status']) {
    const types: Record<AppSettlementRecord['status'], 'success' | 'warning' | 'danger' | 'info'> =
      {
        draft: 'info',
        approved: 'warning',
        paid: 'success',
        cancelled: 'danger'
      }
    return types[status]
  }

  function appName(id: number) {
    return apps.value.find((app) => app.id === Number(id))?.name || `App #${id}`
  }

  function appCode(id: number) {
    return apps.value.find((app) => app.id === Number(id))?.code || '-'
  }

  function developerName(id?: number) {
    if (!id) return '-'
    return (
      developers.value.find((item) => Number(item.user_id) === Number(id))?.display_name ||
      `Developer #${id}`
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
      ElMessage.error('Applications or developers failed to load')
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
      loadError.prices = 'Price plans failed to load'
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
      ElMessage.warning('A valid code and name are required')
      return
    }
    const includedCodes = parseCsvStrings(includedPlanCodes.value)
    const tenantIds = parseCsvIds(selectedTenantIds.value)
    if (planForm.pricing_model === 'included' && !includedCodes.length) {
      ElMessage.warning('Select at least one included SaaS plan code')
      return
    }
    if (planForm.sale_scope === 'selected_tenants' && !tenantIds.length) {
      ElMessage.warning('Enter at least one tenant ID')
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
        ElMessage.success('Price plan updated')
      } else {
        await createPlatformAppPricePlan(selectedAppCode.value, data)
        ElMessage.success('Price plan created')
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
      `${nextStatus ? 'Enable' : 'Disable'} ${plan.name}?`,
      `${nextStatus ? 'Enable' : 'Disable'} price plan`,
      { type: 'warning', confirmButtonText: nextStatus ? 'Enable' : 'Disable' }
    )
    actionLoading.value = `plan:${plan.code}`
    try {
      await updatePlatformAppPricePlanStatus(selectedAppCode.value, plan.code, nextStatus)
      ElMessage.success(`Price plan ${nextStatus ? 'enabled' : 'disabled'}`)
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
      loadError.orders = 'Application orders failed to load'
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
      ElMessage.warning('A refund reason and provider reference are required')
      return
    }
    await ElMessageBox.confirm(
      `Record a full refund for ${refundOrder.value.order_no}?`,
      'Confirm full refund',
      { type: 'warning', confirmButtonText: 'Record refund' }
    )
    mutationLoading.value = true
    try {
      await refundPlatformAppOrder(refundOrder.value.order_no, reason, reference)
      refundDialogVisible.value = false
      ElMessage.success('Full refund recorded')
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
      loadError.licenses = 'Application licenses failed to load'
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
      ElMessage.warning('A revocation reason is required')
      return
    }
    await ElMessageBox.confirm(
      `Revoke license #${revokeLicense.value.id}?`,
      'Confirm license revocation',
      { type: 'warning', confirmButtonText: 'Revoke' }
    )
    mutationLoading.value = true
    try {
      await revokePlatformAppLicense(revokeLicense.value.id, reason)
      revokeDialogVisible.value = false
      ElMessage.success('Application license revoked')
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
      loadError.revenue = 'Application revenue failed to load'
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
      loadError.settlements = 'Application settlements failed to load'
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
      ElMessage.warning('Developer and settlement month are required')
      return
    }
    await ElMessageBox.confirm(
      `Create a settlement batch for ${developerName(createSettlementForm.developer_id)} in ${createSettlementForm.period}?`,
      'Confirm settlement creation',
      { type: 'warning', confirmButtonText: 'Create batch' }
    )
    mutationLoading.value = true
    try {
      await createPlatformAppSettlement(
        createSettlementForm.developer_id,
        createSettlementForm.period
      )
      createSettlementVisible.value = false
      ElMessage.success('Settlement batch created')
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
      ElMessage.warning(
        settlementAction.value === 'paid' ? 'Payment reference is required' : 'A note is required'
      )
      return
    }
    await ElMessageBox.confirm(
      `${settlementActionTitle.value} for ${record.batch_no}?`,
      settlementActionTitle.value,
      { type: 'warning', confirmButtonText: 'Confirm' }
    )
    mutationLoading.value = true
    try {
      if (settlementAction.value === 'approve') await approvePlatformAppSettlement(record.id, value)
      if (settlementAction.value === 'paid') await markPlatformAppSettlementPaid(record.id, value)
      if (settlementAction.value === 'cancel') await cancelPlatformAppSettlement(record.id, value)
      settlementActionVisible.value = false
      ElMessage.success('Settlement status updated')
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
