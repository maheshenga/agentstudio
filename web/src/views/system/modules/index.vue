<template>
  <div class="art-full-height p-5 system-modules-page">
    <section class="system-modules-page__header">
      <div>
        <h1 class="system-modules-page__title">系统模块</h1>
        <p class="system-modules-page__subtitle">统一查看平台内置模块、安装状态与运行入口。</p>
      </div>
      <ElTag type="info" effect="light">平台</ElTag>
    </section>

    <ElRow :gutter="16">
      <ElCol :xs="24" :sm="8">
        <div class="system-modules-page__metric">
          <span class="system-modules-page__metric-label">已启用</span>
          <strong>0</strong>
        </div>
      </ElCol>
      <ElCol :xs="24" :sm="8">
        <div class="system-modules-page__metric">
          <span class="system-modules-page__metric-label">待安装</span>
          <strong>0</strong>
        </div>
      </ElCol>
      <ElCol :xs="24" :sm="8">
        <div class="system-modules-page__metric">
          <span class="system-modules-page__metric-label">异常模块</span>
          <strong>0</strong>
        </div>
      </ElCol>
    </ElRow>

    <ElCard class="art-table-card" shadow="never">
      <template #header>
        <div class="system-modules-page__card-header">
          <div>
            <h2>模块列表</h2>
            <p>安装、启停与配置能力将在后续迭代接入。</p>
          </div>
          <ElButton disabled>刷新</ElButton>
        </div>
      </template>

      <ElTable :data="modules" border>
        <ElTableColumn prop="name" label="模块名称" min-width="160" />
        <ElTableColumn prop="code" label="模块编码" min-width="160" />
        <ElTableColumn prop="source" label="来源" width="120" />
        <ElTableColumn prop="status" label="状态" width="120" />
        <template #empty>
          <ElEmpty description="暂无数据" />
        </template>
      </ElTable>
    </ElCard>
  </div>
</template>

<script setup lang="ts">
  defineOptions({ name: 'SystemModulesPage' })

  type ModuleRow = {
    name: string
    code: string
    source: string
    status: string
  }

  const modules: ModuleRow[] = []
</script>

<style scoped>
  .system-modules-page {
    display: grid;
    align-content: start;
    gap: 16px;
  }

  .system-modules-page__header,
  .system-modules-page__card-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
  }

  .system-modules-page__title,
  .system-modules-page__card-header h2 {
    margin: 0;
    line-height: 1.4;
    letter-spacing: 0;
  }

  .system-modules-page__title {
    font-size: 20px;
    font-weight: 600;
  }

  .system-modules-page__subtitle,
  .system-modules-page__card-header p,
  .system-modules-page__metric-label {
    margin: 6px 0 0;
    color: var(--el-text-color-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .system-modules-page__metric {
    display: grid;
    gap: 6px;
    min-height: 92px;
    border: 1px solid var(--el-border-color-light);
    border-radius: 8px;
    background: var(--el-bg-color);
    padding: 18px;
  }

  .system-modules-page__metric strong {
    color: var(--el-text-color-primary);
    font-size: 28px;
    font-weight: 700;
    line-height: 1.2;
  }

  .system-modules-page__card-header h2 {
    font-size: 16px;
    font-weight: 600;
  }

  @media (max-width: 768px) {
    .system-modules-page__header,
    .system-modules-page__card-header {
      display: grid;
    }
  }
</style>
