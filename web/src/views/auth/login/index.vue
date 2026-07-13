<!-- 登录页面 -->
<template>
  <div class="login-page flex w-full h-screen" :class="`login-layout-${loginLayout}`">
    <div class="login-page-logo">
      <ArtLogo class="icon" size="46" />
      <h1 class="title">{{ systemName }}</h1>
    </div>

    <AuthTopBar
      fixed-to-viewport
      show-login-layout
      v-model:login-layout="loginLayout"
    />

    <LoginLeftView class="login-bg" hide-logo :center-mode="loginLayout === 'center'" />

    <div class="login-main">
      <div class="auth-right-wrap">
        <div class="form">
          <h3 class="title">{{ $t('login.title') }}</h3>
          <p class="sub-title">{{ $t('login.subTitle') }}</p>
          <ElAlert
            v-if="signupActivationVisible"
            class="signup-activation-alert"
            type="success"
            show-icon
            :closable="false"
            :title="signupActivationMessage"
          />
          <ElForm
            ref="formRef"
            :model="formData"
            :rules="rules"
            :validate-on-rule-change="false"
            :key="formKey"
            @keyup.enter="handleSubmit"
            class="login-form"
          >
            <ElFormItem prop="username">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.username')"
                v-model.trim="formData.username"
              />
            </ElFormItem>
            <ElFormItem prop="tenant_id">
              <ElSelect
                class="w-full custom-height"
                :placeholder="tenantList.length > 0 ? tenantSelectPlaceholder : tenantInputFirstPlaceholder"
                v-model="formData.tenant_id"
                :loading="loadingTenants"
                :disabled="tenantList.length === 0"
              >
                <ElOption
                  v-for="tenant in tenantList"
                  :key="tenant.id"
                  :label="tenant.name"
                  :value="tenant.id"
                >
                  <span>{{ tenant.name }}</span>
                  <span v-if="tenant.is_default" style="color: var(--el-color-primary); margin-left: 8px;">{{ defaultTenantLabel }}</span>
                </ElOption>
              </ElSelect>
            </ElFormItem>
            <ElFormItem prop="password">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.password')"
                v-model.trim="formData.password"
                type="password"
                autocomplete="off"
                show-password
              />
            </ElFormItem>
            <ElFormItem v-if="captchaEnabled" prop="code">
              <ElInput
                class="custom-height"
                :placeholder="$t('login.placeholder.code')"
                v-model.trim="formData.code"
                type="text"
                autocomplete="off"
              >
                <template #append>
                  <img
                    :src="captcha"
                    style="height: 36px; cursor: pointer"
                    @click="refreshCaptcha"
                  />
                </template>
              </ElInput>
             
            </ElFormItem>

            <div class="flex-cb mt-2 text-sm">
              <ElCheckbox v-model="formData.rememberPassword">{{
                $t('login.rememberPwd')
              }}</ElCheckbox>
              <!-- <RouterLink class="text-theme" :to="{ name: 'ForgetPassword' }">{{
                $t('login.forgetPwd')
              }}</RouterLink> -->
            </div>

            <div class="login-submit-wrap">
              <ElButton
                class="w-full custom-height"
                type="primary"
                @click="handleSubmit"
                :loading="loading"
                v-ripple
              >
                {{ $t('login.btnText') }}
              </ElButton>
            </div>

            <div class="mt-5 text-sm text-gray-600">
              <span>{{ $t('login.noAccount') }}</span>
              <RouterLink class="text-theme" :to="{ name: 'SaasSignup' }">{{
                $t('login.register')
              }}</RouterLink>
            </div>
          </ElForm>
        </div>
      </div>
    </div>

    <ElDialog
      v-if="homeDebugEnabled"
      v-model="welcomeDialogVisible"
      title="AgentStudio"
      width="520px"
      align-center
      :close-on-click-modal="false"
    >
      <div class="welcome-dialog">
        <p class="welcome-dialog__intro">
          当前系统基于 NestJS、Vue 3、Element Plus 和 Art Design Pro 构建，支持租户化后台管理和 SaaS 能力扩展。
        </p>
        <ul class="welcome-dialog__list">
          <li>后端：NestJS、TypeORM、Redis、MySQL</li>
          <li>前端：Vue 3、Element Plus、Vite</li>
          <li>SaaS：租户、套餐、额度、订单、支付能力</li>
        </ul>
        <p class="welcome-dialog__footer">该弹窗仅在调试开关开启时展示。</p>
      </div>
      <template #footer>
        <ElButton type="primary" @click="welcomeDialogVisible = false">知道了</ElButton>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import AppConfig from '@/config'
  import { useUserStore } from '@/store/modules/user'
  import { useI18n } from 'vue-i18n'
  import { HttpError } from '@/utils/http/error'
  import {
    fetchCaptcha,
    fetchLoginCaptchaStatus,
    fetchLogin,
    fetchGetUserInfo,
    fetchTenantsByCredentials,
    fetchPublicConfigValue
  } from '@/api/auth'
  import { ElNotification, type FormInstance, type FormRules } from 'element-plus'

  defineOptions({ name: 'Login' })

  type LoginLayout = 'center' | 'left' | 'right'
  const loginLayout = ref<LoginLayout>('center')

  const { t, locale } = useI18n()
  const formKey = ref(0)

  // 监听语言切换，重置表单
  watch(locale, () => {
    formKey.value++
  })

  const userStore = useUserStore()
  const router = useRouter()
  const route = useRoute()

  const captcha = ref(
    'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'
  )
  const captchaEnabled = ref(true)

  const systemName = ref(AppConfig.systemInfo.name)
  const formRef = ref<FormInstance>()
  const tenantSelectPlaceholder = '请选择租户'
  const tenantInputFirstPlaceholder = '请先输入用户名'
  const defaultTenantLabel = '(默认)'

  const demoLoginEnabled = import.meta.env.VITE_DEMO_LOGIN === 'true'
  const formData = reactive({
    username: demoLoginEnabled ? import.meta.env.VITE_DEMO_USERNAME || '' : '',
    password: demoLoginEnabled ? import.meta.env.VITE_DEMO_PASSWORD || '' : '',
    code: demoLoginEnabled ? import.meta.env.VITE_DEMO_CODE || '' : '',
    uuid: '',
    tenant_id: undefined as number | undefined,
    rememberPassword: demoLoginEnabled
  })

  const tenantList = ref<Api.Auth.TenantItem[]>([])
  const loadingTenants = ref(false)

  const rules = computed<FormRules>(() => ({
    username: [{ required: true, message: t('login.placeholder.username'), trigger: 'blur' }],
    password: [{ required: true, message: t('login.placeholder.password'), trigger: 'blur' }],
    ...(captchaEnabled.value
      ? { code: [{ required: true, message: t('login.placeholder.code'), trigger: 'blur' }] }
      : {}),
    tenant_id: [{ required: true, message: '请选择租户', trigger: 'change' }]
  }))

  const loading = ref(false)
  const homeDebugEnabled = import.meta.env.DEV && import.meta.env.VITE_HOME_DEGBUG === 'true'
  const welcomeDialogVisible = ref(false)
  let welcomeDialogTimer: ReturnType<typeof setTimeout> | undefined
  const TENANT_LOOKUP_DEBOUNCE_MS = 400
  let tenantLookupTimer: ReturnType<typeof setTimeout> | undefined
  let tenantLookupRequestId = 0

  const signupActivationVisible = computed(() => route.query.signup_success === '1')
  const signupActivationMessage = computed(() => {
    const username = typeof route.query.username === 'string' ? route.query.username.trim() : ''
    return username ? `注册成功，请使用账号 ${username} 和刚设置的密码登录。` : '注册成功，请使用刚设置的账号和密码登录。'
  })

  const applySignupActivation = () => {
    const signupUsername = typeof route.query.username === 'string' ? route.query.username.trim() : ''
    if (signupUsername) {
      formData.username = signupUsername
    }
  }

  const loadSystemName = async () => {
    try {
      const res = await fetchPublicConfigValue('site_name')
      const name = res?.value?.trim()
      if (name) {
        systemName.value = name
      }
    } catch (error) {
      console.error('[Login] 加载站点名称失败:', error)
    }
  }

  const loadLoginCaptchaStatus = async () => {
    try {
      const res = await fetchLoginCaptchaStatus()
      captchaEnabled.value = res?.enabled !== false
      if (!captchaEnabled.value) {
        formData.code = ''
        formData.uuid = ''
      }
    } catch (error) {
      captchaEnabled.value = true
      console.error('[Login] Failed to load captcha status:', error)
    }
  }

  onMounted(async () => {
    applySignupActivation()
    loadSystemName()
    await loadLoginCaptchaStatus()
    if (captchaEnabled.value) {
      refreshCaptcha()
    }
    // 如果有默认用户名，自动加载租户列表
    if (formData.username && formData.password) {
      loadTenantList()
    }
    if (homeDebugEnabled) {
      welcomeDialogTimer = setTimeout(() => {
        welcomeDialogVisible.value = true
      }, 2000)
    }
  })

  onUnmounted(() => {
    if (welcomeDialogTimer) {
      clearTimeout(welcomeDialogTimer)
    }
    if (tenantLookupTimer) {
      clearTimeout(tenantLookupTimer)
    }
  })

  // 监听用户名变化，加载租户列表
  const scheduleTenantLookup = () => {
    if (tenantLookupTimer) {
      clearTimeout(tenantLookupTimer)
    }

    const username = formData.username.trim()
    const password = formData.password.trim()
    tenantLookupRequestId++
    tenantList.value = []
    formData.tenant_id = undefined

    if (username.length < 2 || !password) {
      loadingTenants.value = false
      return
    }

    tenantLookupTimer = setTimeout(() => {
      loadTenantList()
    }, TENANT_LOOKUP_DEBOUNCE_MS)
  }

  watch(() => [formData.username, formData.password], () => {
    scheduleTenantLookup()
  })

  // 加载租户列表
  const loadTenantList = async () => {
    const username = formData.username.trim()
    const password = formData.password.trim()
    if (username.length < 2 || !password) {
      return
    }

    const requestId = ++tenantLookupRequestId
    try {
      loadingTenants.value = true
      const list = await fetchTenantsByCredentials(username, password)
      if (requestId !== tenantLookupRequestId) return
      tenantList.value = list || []
      
      // 如果只有一个租户，自动选中
      if (tenantList.value.length === 1) {
        formData.tenant_id = tenantList.value[0].id
      } else if (tenantList.value.length > 0) {
        // 如果有默认租户，自动选中
        const defaultTenant = tenantList.value.find(t => t.is_default)
        if (defaultTenant) {
          formData.tenant_id = defaultTenant.id
        }
      }
    } catch (error) {
      console.error('[Login] 加载租户列表失败:', error)
      if (requestId === tenantLookupRequestId) {
        tenantList.value = []
      }
    } finally {
      if (requestId === tenantLookupRequestId) {
        loadingTenants.value = false
      }
    }
  }

  // 登录
  const handleSubmit = async () => {
    if (!formRef.value) return

    try {
      // 表单验证
      const valid = await formRef.value.validate()
      if (!valid) return

      loading.value = true

      // 登录请求
      const loginParams: Api.Auth.LoginParams = {
        username: formData.username,
        password: formData.password,
        tenant_id: formData.tenant_id
      }

      if (captchaEnabled.value) {
        loginParams.code = formData.code
        loginParams.uuid = formData.uuid
      }

      const { access_token, refresh_token } = await fetchLogin(loginParams)

      // 验证token
      if (!access_token) {
        throw new Error('Login failed - no token received')
      }

      // 存储token和用户信息
      userStore.setToken(access_token, refresh_token)
      const userInfo = await fetchGetUserInfo()
      userStore.setUserInfo(userInfo)
      userStore.setLoginStatus(true)

      // 登录成功处理
      showLoginSuccessNotice()
      const redirect = router.currentRoute.value.query.redirect
      router.push(typeof redirect === 'string' ? redirect : '/')
    } catch (error) {
      // 处理 HttpError
      if (error instanceof HttpError) {
        // console.log(error.code)
      } else {
        // 处理非 HttpError
        // ElMessage.error('登录失败，请稍后重试')
        console.error('[Login] Unexpected error:', error)
      }
    } finally {
      refreshCaptcha()
      loading.value = false
    }
  }

  // 获取验证码
  const refreshCaptcha = async () => {
    if (!captchaEnabled.value) return

    fetchCaptcha().then((res) => {
      formData.uuid = res.uuid
      captcha.value = res.image
    })
  }

  // 登录成功提示
  const showLoginSuccessNotice = () => {
    setTimeout(() => {
      ElNotification({
        title: t('login.success.title'),
        type: 'success',
        duration: 2500,
        zIndex: 10000,
        //message: `${t('login.success.message')}, ${systemName}!`
        message: `${t('login.success.message')}, ${formData.username}!`
      })
    }, 150)
  }
</script>

<style scoped>
  @import './style.css';
</style>

<style lang="scss" scoped>
  :deep(.el-select__wrapper) {
    height: 40px !important;
  }

  .login-form {
    margin-top: 20px;

    :deep(.el-form-item) {
      margin-bottom: 16px;
    }
  }

  .signup-activation-alert {
    margin-top: 16px;
  }

  .login-submit-wrap {
    margin-top: 20px;
  }

  .welcome-dialog {
    line-height: 1.7;
    font-size: 14px;
    color: var(--el-text-color-regular);

    &__intro {
      margin: 0 0 16px;
      font-weight: 500;
      color: var(--el-text-color-primary);
    }

    &__list {
      margin: 0 0 16px;
      padding-left: 20px;

      li + li {
        margin-top: 10px;
      }

      a {
        color: var(--el-color-primary);
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }

    &__tag {
      color: var(--el-text-color-secondary);
      font-size: 13px;
    }

    &__footer {
      margin: 0 0 10px;
      color: var(--el-text-color-primary);
    }

    &__links {
      display: flex;
      gap: 16px;

      a {
        color: var(--el-color-primary);
        font-weight: 500;
        text-decoration: none;

        &:hover {
          text-decoration: underline;
        }
      }
    }
  }
</style>
