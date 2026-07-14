import assert from 'node:assert/strict'
import {
  appAvailabilityText,
  appCapabilityLabel,
  appCenterTypeText,
  appCommerceLabel,
  appCommerceTagType
} from '../src/views/app-center/shared/app-center-display'

assert.equal(appCenterTypeText('service'), '服务应用')
assert.equal(appAvailabilityText('missing_plan_module'), '需要升级套餐')
assert.equal(appCommerceLabel('licensed'), '已授权')
assert.equal(appCommerceTagType('revoked'), 'danger')
assert.equal(appCapabilityLabel('context.read'), '读取租户与用户上下文')

console.log('App center display contract verified.')
