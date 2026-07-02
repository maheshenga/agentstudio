<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-platform-panel">
      <template #header>
        <div class="saas-platform-panel__header">
          <div>
            <h1 class="saas-platform-panel__title">SaaS Plans</h1>
            <p class="saas-platform-panel__subtitle">Free, Pro, and Enterprise plans are seeded by migration.</p>
          </div>
        </div>
      </template>

      <ElTable :data="plans" border>
        <ElTableColumn prop="code" label="Code" width="160" />
        <ElTableColumn prop="name" label="Name" min-width="180" />
        <ElTableColumn prop="cycle" label="Billing cycle" width="180" />
        <ElTableColumn prop="status" label="Status" width="140">
          <template #default="{ row }">
            <ElTag type="success" effect="light">{{ row.status }}</ElTag>
          </template>
        </ElTableColumn>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  defineOptions({ name: 'SaasPlatformPlanPage' })

  const plans = [
    { code: 'free', name: 'Free', cycle: 'monthly', status: 'enabled' },
    { code: 'pro', name: 'Pro', cycle: 'monthly', status: 'enabled' },
    { code: 'enterprise', name: 'Enterprise', cycle: 'monthly', status: 'enabled' }
  ]
</script>

<style scoped>
  .saas-platform-panel {
    min-height: 100%;
  }

  .saas-platform-panel__header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .saas-platform-panel__title {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.4;
  }

  .saas-platform-panel__subtitle {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }
</style>
