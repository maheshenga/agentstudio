<template>
  <div class="art-full-height p-5">
    <ElCard shadow="never" class="saas-platform-panel">
      <template #header>
        <div class="saas-platform-panel__header">
          <div>
            <h1 class="saas-platform-panel__title">SaaS Subscriptions</h1>
            <p class="saas-platform-panel__subtitle">Subscription records are created when tenants are provisioned.</p>
          </div>
        </div>
      </template>

      <ElEmpty description="No subscription list API is available yet." />
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  defineOptions({ name: 'SaasPlatformSubscriptionPage' })
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
