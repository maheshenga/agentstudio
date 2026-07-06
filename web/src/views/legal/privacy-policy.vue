<template>
  <main class="legal-page">
    <section class="legal-page__panel">
      <h1>Privacy Policy</h1>
      <p>
        This page explains how the service collects, uses, stores, and protects account,
        tenant, subscription, and usage information.
      </p>

      <h2>Data we collect</h2>
      <p>
        We collect information needed to create accounts, manage tenant workspaces, process
        subscriptions, and keep audit logs for security and troubleshooting.
      </p>

      <h2>How we use data</h2>
      <p>
        Data is used to provide the SaaS service, enforce permissions and quotas, process
        orders, prevent abuse, and improve reliability.
      </p>

      <h2>Contact</h2>
      <p>
        For privacy requests, contact the platform operator listed in your service contract.
      </p>
    </section>
  </main>
</template>

<script setup lang="ts">
  defineOptions({ name: 'PrivacyPolicyPage' })
</script>

<style scoped>
  .legal-page {
    min-height: 100vh;
    padding: 48px 16px;
    background: var(--el-bg-color-page);
    color: var(--el-text-color-primary);
  }

  .legal-page__panel {
    max-width: 840px;
    margin: 0 auto;
    padding: 32px;
    border-radius: 8px;
    background: var(--el-bg-color);
    box-shadow: var(--el-box-shadow-light);
  }

  h1 {
    margin: 0 0 20px;
    font-size: 28px;
  }

  h2 {
    margin: 28px 0 12px;
    font-size: 18px;
  }

  p {
    margin: 0 0 12px;
    line-height: 1.75;
    color: var(--el-text-color-regular);
  }
</style>
