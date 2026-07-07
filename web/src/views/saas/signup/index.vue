<template>
  <div class="signup-page flex w-full h-screen">
    <LoginLeftView />

    <div class="relative flex-1">
      <AuthTopBar />

      <div class="auth-right-wrap">
        <div class="form">
          <h3 class="title">{{ copy.title }}</h3>
          <p class="sub-title">{{ copy.subTitle }}</p>
          <ElForm
            ref="formRef"
            :model="formData"
            :rules="rules"
            :key="formKey"
            label-position="top"
            class="signup-form mt-7.5"
            @keyup.enter="handleSubmit"
          >
            <ElFormItem prop="tenant_name">
              <ElInput
                v-model.trim="formData.tenant_name"
                class="custom-height"
                :placeholder="copy.placeholder.tenant_name"
              />
            </ElFormItem>

            <ElFormItem prop="realname">
              <ElInput
                v-model.trim="formData.realname"
                class="custom-height"
                :placeholder="copy.placeholder.realname"
              />
            </ElFormItem>

            <ElFormItem prop="username">
              <ElInput
                v-model.trim="formData.username"
                class="custom-height"
                :placeholder="copy.placeholder.username"
              />
            </ElFormItem>

            <ElFormItem prop="phone">
              <ElInput
                v-model.trim="formData.phone"
                class="custom-height"
                :placeholder="copy.placeholder.phone"
              />
            </ElFormItem>

            <ElFormItem prop="email">
              <ElInput
                v-model.trim="formData.email"
                class="custom-height"
                :placeholder="copy.placeholder.email"
              />
            </ElFormItem>

            <ElFormItem prop="password">
              <ElInput
                v-model.trim="formData.password"
                class="custom-height"
                :placeholder="copy.placeholder.password"
                type="password"
                autocomplete="off"
                show-password
              />
            </ElFormItem>

            <ElFormItem prop="confirmPassword">
              <ElInput
                v-model.trim="formData.confirmPassword"
                class="custom-height"
                :placeholder="copy.placeholder.confirmPassword"
                type="password"
                autocomplete="off"
                show-password
              />
            </ElFormItem>

            <ElFormItem prop="agreement" class="signup-form__agreement">
              <ElCheckbox v-model="formData.agreement">
                {{ copy.agreementPrefix }}
                <RouterLink class="text-theme signup-form__link" to="/terms">
                  {{ copy.agreementTerms }}
                </RouterLink>
                {{ copy.agreementAnd }}
                <RouterLink class="text-theme signup-form__link" to="/privacy-policy">
                  {{ copy.agreementPrivacy }}
                </RouterLink>
              </ElCheckbox>
            </ElFormItem>

            <div class="signup-form__submit">
              <ElButton
                class="w-full custom-height"
                type="primary"
                :loading="loading"
                v-ripple
                @click="handleSubmit"
              >
                {{ copy.submitText }}
              </ElButton>
            </div>

            <div class="mt-5 text-sm text-g-600">
              <span>{{ copy.hasAccount }}</span>
              <RouterLink class="text-theme" :to="{ name: 'Login' }">
                {{ copy.toLogin }}
              </RouterLink>
            </div>
          </ElForm>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { signupTenant, type SaasSignupParams } from '@/api/saas'
  import { useI18n } from 'vue-i18n'
  import { ElMessage, type FormInstance, type FormRules } from 'element-plus'
  import {
    SIGNUP_PASSWORD_MAX_LENGTH,
    SIGNUP_PASSWORD_MESSAGE,
    SIGNUP_PASSWORD_MESSAGE_EN,
    SIGNUP_PASSWORD_MIN_LENGTH,
    SIGNUP_PASSWORD_PATTERN
  } from '@/utils/saas/signup-password-policy'

  defineOptions({ name: 'SaasSignupPage' })

  interface SignupForm extends SaasSignupParams {
    confirmPassword: string
    agreement: boolean
  }

  const USERNAME_MIN_LENGTH = 2
  const USERNAME_MAX_LENGTH = 64
  const PASSWORD_MIN_LENGTH = SIGNUP_PASSWORD_MIN_LENGTH
  const PASSWORD_MAX_LENGTH = SIGNUP_PASSWORD_MAX_LENGTH
  const PHONE_MAX_LENGTH = 20
  const TENANT_NAME_MAX_LENGTH = 100
  const REALNAME_MAX_LENGTH = 64
  const EMAIL_MAX_LENGTH = 128

  const { locale } = useI18n()
  const router = useRouter()
  const formRef = ref<FormInstance>()
  const formKey = ref(0)
  const loading = ref(false)

  watch(locale, () => {
    formKey.value++
  })

  const isZh = computed(() => locale.value.toLowerCase().startsWith('zh'))

  const copy = computed(() => {
    if (isZh.value) {
      return {
        title: '创建租户账号',
        subTitle: '填写基础信息，立即开通你的 SaaS 租户空间',
        submitText: '立即注册',
        hasAccount: '已有账号？',
        toLogin: '去登录',
        agreementPrefix: '我已阅读并同意',
        agreementTerms: '《服务协议》',
        agreementAnd: '和',
        agreementPrivacy: '《隐私政策》',
        success: '注册成功，请登录并开始使用。',
        placeholder: {
          tenant_name: '请输入租户名称',
          realname: '请输入联系人姓名',
          username: '请输入登录账号',
          phone: '请输入手机号',
          email: '请输入邮箱',
          password: '请输入密码',
          confirmPassword: '请再次输入密码'
        },
        rule: {
          requiredTenantName: '请输入租户名称',
          requiredRealname: '请输入联系人姓名',
          requiredUsername: '请输入登录账号',
          requiredPhone: '请输入手机号',
          requiredEmail: '请输入邮箱',
          requiredPassword: '请输入密码',
          requiredConfirmPassword: '请再次输入密码',
          tenantNameLength: '租户名称长度不能超过 100 个字符',
          realnameLength: '联系人姓名长度不能超过 64 个字符',
          usernameLength: '账号长度需在 2 到 64 个字符之间',
          phoneLength: '手机号长度不能超过 20 个字符',
          emailLength: '邮箱长度不能超过 128 个字符',
          emailInvalid: '请输入正确的邮箱地址',
          passwordLength: SIGNUP_PASSWORD_MESSAGE,
          passwordMismatch: '两次输入的密码不一致',
          agreementRequired: '请先勾选协议'
        }
      }
    }

    return {
      title: 'Create your tenant account',
      subTitle: 'Complete the essentials to open your SaaS workspace',
      submitText: 'Sign up',
      hasAccount: 'Already have an account? ',
      toLogin: 'Login',
      agreementPrefix: 'I have read and agree to the ',
      agreementTerms: 'Terms of Service',
      agreementAnd: ' and ',
      agreementPrivacy: 'Privacy Policy',
      success: 'Signup successful. Please log in to continue.',
      placeholder: {
        tenant_name: 'Enter tenant name',
        realname: 'Enter contact name',
        username: 'Enter username',
        phone: 'Enter phone number',
        email: 'Enter email address',
        password: 'Enter password',
        confirmPassword: 'Confirm password'
      },
      rule: {
        requiredTenantName: 'Please enter tenant name',
        requiredRealname: 'Please enter contact name',
        requiredUsername: 'Please enter username',
        requiredPhone: 'Please enter phone number',
        requiredEmail: 'Please enter email address',
        requiredPassword: 'Please enter password',
        requiredConfirmPassword: 'Please confirm your password',
        tenantNameLength: 'Tenant name must be 100 characters or fewer',
        realnameLength: 'Contact name must be 64 characters or fewer',
        usernameLength: 'Username must be 2 to 64 characters',
        phoneLength: 'Phone number must be 20 characters or fewer',
        emailLength: 'Email must be 128 characters or fewer',
        emailInvalid: 'Please enter a valid email address',
        passwordLength: SIGNUP_PASSWORD_MESSAGE_EN,
        passwordMismatch: 'Passwords do not match',
        agreementRequired: 'Please accept the agreement first'
      }
    }
  })

  const formData = reactive<SignupForm>({
    username: '',
    password: '',
    confirmPassword: '',
    realname: '',
    tenant_name: '',
    phone: '',
    email: '',
    agreement: false
  })

  const validatePassword = (_rule: any, value: string, callback: (error?: Error) => void) => {
    if (!value) {
      callback(new Error(copy.value.rule.requiredPassword))
      return
    }

    if (formData.confirmPassword) {
      formRef.value?.validateField('confirmPassword')
    }

    callback()
  }

  const validateConfirmPassword = (
    _rule: any,
    value: string,
    callback: (error?: Error) => void
  ) => {
    if (!value) {
      callback(new Error(copy.value.rule.requiredConfirmPassword))
      return
    }

    if (value !== formData.password) {
      callback(new Error(copy.value.rule.passwordMismatch))
      return
    }

    callback()
  }

  const validateAgreement = (_rule: any, value: boolean, callback: (error?: Error) => void) => {
    if (!value) {
      callback(new Error(copy.value.rule.agreementRequired))
      return
    }

    callback()
  }

  const rules = computed<FormRules<SignupForm>>(() => ({
    tenant_name: [
      { required: true, message: copy.value.rule.requiredTenantName, trigger: 'blur' },
      { max: TENANT_NAME_MAX_LENGTH, message: copy.value.rule.tenantNameLength, trigger: 'blur' }
    ],
    realname: [
      { required: true, message: copy.value.rule.requiredRealname, trigger: 'blur' },
      { max: REALNAME_MAX_LENGTH, message: copy.value.rule.realnameLength, trigger: 'blur' }
    ],
    username: [
      { required: true, message: copy.value.rule.requiredUsername, trigger: 'blur' },
      {
        min: USERNAME_MIN_LENGTH,
        max: USERNAME_MAX_LENGTH,
        message: copy.value.rule.usernameLength,
        trigger: 'blur'
      }
    ],
    phone: [
      { required: true, message: copy.value.rule.requiredPhone, trigger: 'blur' },
      { max: PHONE_MAX_LENGTH, message: copy.value.rule.phoneLength, trigger: 'blur' }
    ],
    email: [
      { required: true, message: copy.value.rule.requiredEmail, trigger: 'blur' },
      { max: EMAIL_MAX_LENGTH, message: copy.value.rule.emailLength, trigger: 'blur' },
      { type: 'email', message: copy.value.rule.emailInvalid, trigger: ['blur', 'change'] }
    ],
    password: [
      { required: true, validator: validatePassword, trigger: 'blur' },
      {
        min: PASSWORD_MIN_LENGTH,
        max: PASSWORD_MAX_LENGTH,
        pattern: SIGNUP_PASSWORD_PATTERN,
        message: copy.value.rule.passwordLength,
        trigger: 'blur'
      }
    ],
    confirmPassword: [{ required: true, validator: validateConfirmPassword, trigger: 'blur' }],
    agreement: [{ validator: validateAgreement, trigger: 'change' }]
  }))

  const handleSubmit = async () => {
    if (!formRef.value) return

    try {
      await formRef.value.validate()
      loading.value = true

      await signupTenant({
        username: formData.username.trim(),
        password: formData.password,
        realname: formData.realname.trim(),
        tenant_name: formData.tenant_name.trim(),
        phone: formData.phone.trim(),
        email: formData.email.trim()
      })

      ElMessage.success(copy.value.success)
      router.push({ name: 'Login' })
    } catch (error) {
      console.error('[SaasSignup] submit failed:', error)
    } finally {
      loading.value = false
    }
  }
</script>

<style scoped>
  @import '../../auth/login/style.css';
</style>

<style lang="scss" scoped>
  .signup-form {
    :deep(.el-form-item) {
      margin-bottom: 16px;
    }

    &__agreement {
      margin-bottom: 8px;
    }

    &__submit {
      margin-top: 16px;
    }

    &__link {
      text-decoration: none;
    }
  }
</style>
