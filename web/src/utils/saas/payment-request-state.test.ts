import assert from 'node:assert/strict'
import {
  getPaymentRequestTagType,
  hasPaymentRequestedAt,
  isPaymentRequestedPendingOrder
} from './payment-request-state'

assert.equal(hasPaymentRequestedAt(null), false)
assert.equal(hasPaymentRequestedAt(undefined), false)
assert.equal(hasPaymentRequestedAt(''), false)
assert.equal(hasPaymentRequestedAt('   '), false)
assert.equal(hasPaymentRequestedAt('2026-07-04T00:00:00.000Z'), true)

assert.equal(
  isPaymentRequestedPendingOrder({
    status: 'pending',
    payment_requested_at: '2026-07-04T00:00:00.000Z'
  }),
  true
)
assert.equal(
  isPaymentRequestedPendingOrder({
    status: 'pending',
    paymentRequestedAt: '2026-07-04T00:00:00.000Z'
  }),
  true
)
assert.equal(
  isPaymentRequestedPendingOrder({
    status: 'closed',
    payment_requested_at: '2026-07-04T00:00:00.000Z'
  }),
  false
)
assert.equal(isPaymentRequestedPendingOrder(null), false)

assert.equal(
  getPaymentRequestTagType({
    status: 'pending',
    payment_requested_at: '2026-07-04T00:00:00.000Z'
  }),
  'warning'
)
assert.equal(getPaymentRequestTagType({ status: 'pending' }), 'info')
