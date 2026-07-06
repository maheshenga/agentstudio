<template>
  <main class="legal-page">
    <section class="legal-page__panel">
      <h1>Terms of Service</h1>
      <p>
        These terms describe the basic rules for using the SaaS platform, tenant workspaces,
        subscriptions, modules, resource packs, and AI service capabilities.
      </p>

      <h2>Account responsibility</h2>
      <p>
        Users are responsible for keeping credentials secure and for all actions performed
        under their tenant and account permissions.
      </p>

      <h2>Subscription usage</h2>
      <p>
        Access to modules, quotas, and resource packs depends on the active subscription,
        payment status, and platform configuration.
      </p>

      <h2>Acceptable use</h2>
      <p>
        The service may not be used for illegal activity, abuse, credential sharing, or
        attempts to bypass quotas, payment, authentication, or authorization controls.
      </p>
    </section>
  </main>
</template>

<script setup lang="ts">
  defineOptions({ name: 'TermsOfServicePage' })
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
