<template>
  <div class="art-full-height p-5 tenant-modules-page">
    <section class="tenant-modules-page__header">
      <div>
        <h1 class="tenant-modules-page__title">租户模块</h1>
        <p class="tenant-modules-page__subtitle">查看当前租户可用模块与开通状态。</p>
      </div>
      <ElTag type="success" effect="light">租户</ElTag>
    </section>

    <ElCard class="art-table-card" shadow="never">
      <template #header>
        <div class="tenant-modules-page__card-header">
          <div>
            <h2>模块清单</h2>
            <p>配置与启停能力将在后续迭代接入。</p>
          </div>
          <ElSegmented v-model="activeScope" :options="scopeOptions" size="small" />
        </div>
      </template>

      <ElTable :data="modules" border>
        <ElTableColumn prop="name" label="模块名称" min-width="160" />
        <ElTableColumn prop="code" label="模块编码" min-width="160" />
        <ElTableColumn prop="source" label="授权来源" width="130" />
        <ElTableColumn prop="status" label="状态" width="120" />
        <template #empty>
          <ElEmpty description="暂无数据" />
        </template>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  defineOptions({ name: 'TenantModulesPage' })

  type ModuleRow = {
    name: string
    code: string
    source: string
    status: string
  }

  const activeScope = ref('all')
  const scopeOptions = [
    { label: '全部', value: 'all' },
    { label: '已启用', value: 'enabled' },
    { label: '未启用', value: 'disabled' }
  ]
  const modules: ModuleRow[] = []
</script>

<style scoped>
  .tenant-modules-page {
    display: grid;
    align-content: start;
    gap: 16px;
  }

  .tenant-modules-page__header,
  .tenant-modules-page__card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .tenant-modules-page__title,
  .tenant-modules-page__card-header h2 {
    margin: 0;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .tenant-modules-page__title {
    font-size: 20px;
    font-weight: 600;
  }

  .tenant-modules-page__subtitle,
  .tenant-modules-page__card-header p {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .tenant-modules-page__card-header h2 {
    font-size: 16px;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .tenant-modules-page__header,
    .tenant-modules-page__card-header {
      display: grid;
    }
  }
</style>
