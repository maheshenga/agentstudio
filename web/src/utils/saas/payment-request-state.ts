export interface PaymentRequestOrderLike {
  status?: string | null
  payment_requested_at?: unknown
  paymentRequestedAt?: unknown
}

export function hasPaymentRequestedAt(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

export function isPaymentRequestedPendingOrder(
  order: PaymentRequestOrderLike | null | undefined
): boolean {
  if (!order) return false

  return (
    String(order.status || '').toLowerCase() === 'pending' &&
    (hasPaymentRequestedAt(order.payment_requested_at) || hasPaymentRequestedAt(order.paymentRequestedAt))
  )
}

export function getPaymentRequestTagType(order: PaymentRequestOrderLike | null | undefined) {
  return isPaymentRequestedPendingOrder(order) ? 'warning' : 'info'
}
