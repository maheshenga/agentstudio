# SaaS Payment Request Status UI Design

## Context

SaaS plan orders and resource-pack orders now store `payment_requested_at`. Backend risk logic protects these orders from timeout closing and tenant cancellation once an external payment URL has been issued. The UI should expose that state so tenants and platform operators understand why an order behaves differently from a normal pending order.

## Selected Approach

Use approach A: show a clear "payment requested" state in tenant and platform order surfaces, and prevent misleading actions where appropriate.

This keeps the change small and aligned with the existing order-risk model. It does not add invoices, refunds, reconciliation, recurring billing, notifications, or provider polling.

## User-Facing Behavior

Tenant plan orders:

- Pending orders with `payment_requested_at` show a visible tag or status hint such as "Payment requested".
- The current-order block and order-history table show the payment request time.
- The cancel action is hidden or disabled for payment-requested pending orders, matching backend behavior.
- Continue payment remains available when the order is still pending.

Tenant resource-pack orders:

- Current order and history table show the same "Payment requested" state and request time.
- Cancel is hidden or disabled for payment-requested pending orders.
- Closed orders still show close reason/time as they do today.

Platform plan-order operations:

- The subscription/orders page shows payment request state and time in the orders table and detail drawer.
- Risk filters continue to work as they do today. This feature only adds visibility, not a new risk bucket.

Platform resource-pack order operations:

- The resource-pack order list and detail drawer show payment request state and time.
- Existing status and close-reason filters remain unchanged.

## Data Flow

The UI uses the existing `payment_requested_at` field returned by:

- tenant plan order list/current order APIs
- tenant resource-pack order list/current order APIs
- platform plan order list/detail APIs
- platform resource-pack order list/detail APIs

Frontend helpers should normalize null, undefined, Date-like strings, and empty values consistently. A pending order is considered externally requested when `status === 'pending'` and `payment_requested_at` is present.

## Error Handling

If `payment_requested_at` is missing, the UI falls back to the current behavior.

If a user somehow triggers cancel on a payment-requested order, backend rejection remains the source of truth. The frontend should avoid offering that action but does not replace backend enforcement.

## Testing

Add focused frontend tests around pure helper behavior if an existing practical test surface exists. Otherwise verify with typecheck and browser/API smoke:

- `pnpm exec vue-tsc --noEmit`
- tenant order page renders payment-requested state from existing API data
- platform order pages render payment-requested state from existing API data
- cancel action is not available for payment-requested pending orders

Backend tests are not required unless response mapping is missing the field, because backend persistence and risk protections are already covered.

## Non-Goals

- No invoice UI.
- No refund UI.
- No reconciliation workflow.
- No SMS/email notification.
- No Alipay callback changes.
- No new order status value.
