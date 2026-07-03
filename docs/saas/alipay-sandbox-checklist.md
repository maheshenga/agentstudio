# SaaS Alipay Sandbox Checklist

This checklist prepares the SaaS upgrade payment flow for Alipay sandbox testing.

## Current Flow

1. Tenant creates an upgrade order from the plan page.
2. Frontend calls `POST /api/saas/payment/alipay/create`.
3. Backend validates the tenant order is `pending`.
4. Backend generates a signed `alipay.trade.page.pay` URL.
5. Frontend opens the Alipay page and polls the local order status.
6. Alipay posts async notifications to `POST /api/saas/payment/alipay/notify`.
7. Backend verifies the Alipay signature and marks the order `paid`.

## Required Environment Variables

Configure these in `server/.env`:

```env
ALIPAY_ENABLED=true
ALIPAY_APP_ID=2021000123456789
ALIPAY_PRIVATE_KEY=
ALIPAY_PUBLIC_KEY=
ALIPAY_NOTIFY_URL=https://your-public-domain.example.com/api/saas/payment/alipay/notify
ALIPAY_RETURN_URL=http://127.0.0.1:5731/#/tenant-saas/plan
ALIPAY_GATEWAY_URL=https://openapi-sandbox.dl.alipaydev.com/gateway.do
```

Do not commit real keys. Keep `server/.env.example` as placeholders only.

## Key Format

The backend accepts either PEM format or a single line with escaped newlines.

PEM format:

```text
-----BEGIN PRIVATE KEY-----
...
-----END PRIVATE KEY-----
```

Single-line `.env` format:

```env
ALIPAY_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
```

Use the application private key for `ALIPAY_PRIVATE_KEY`.
Use the Alipay public key for `ALIPAY_PUBLIC_KEY`.

## Public Callback URL

Alipay must be able to reach `ALIPAY_NOTIFY_URL` from the public internet.

For local sandbox testing, expose the backend with a tunnel such as:

```text
https://your-tunnel.example.com -> http://127.0.0.1:8181
```

Then set:

```env
ALIPAY_NOTIFY_URL=https://your-tunnel.example.com/api/saas/payment/alipay/notify
```

Restart the backend after changing `.env`.

## Config Self-Check

After login as a tenant owner, call:

```http
GET /api/saas/payment/alipay/config-status
```

Expected complete status:

```json
{
  "enabled": true,
  "configured": true,
  "missing_keys": [],
  "app_id_masked": "2021********6789",
  "gateway_url": "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
  "notify_url_configured": true,
  "return_url_configured": true
}
```

The tenant plan page also displays the config status in the pending order payment area.

## Sandbox Test Steps

1. Start MySQL, Redis, backend, and frontend.
2. Confirm migrations are applied.
3. Login as a tenant owner.
4. Open `/#/tenant-saas/plan`.
5. Create an upgrade order.
6. Click `去支付宝支付`.
7. Complete payment in Alipay sandbox.
8. Wait for the frontend polling to update the order to `paid`.
9. Confirm the tenant subscription and quotas changed.

## Expected Backend Behavior

`POST /api/saas/payment/alipay/notify`:

- Returns plain text `success` after a valid signed notification is accepted.
- Returns plain text `fail` when signature verification fails or order processing fails.
- Processes only `TRADE_SUCCESS` and `TRADE_FINISHED`.
- Ignores non-success statuses after successful verification by returning `success`.
- Handles duplicate paid notifications idempotently.

## Troubleshooting

- `configured=false`: call `config-status` and fill every `missing_keys` item.
- Frontend opens no payment page: check `ALIPAY_ENABLED=true` and backend logs.
- Notify not received: verify the tunnel URL is public and points to backend port `8181`.
- Notify returns `fail`: check `ALIPAY_PUBLIC_KEY`, `sign_type`, and whether the notification body is modified by a proxy.
- Order remains `pending`: verify the notify endpoint was called and backend could find `out_trade_no`.

## References

- Alipay Page Pay: https://opendocs.alipay.com/open/028r8t
- Alipay async notify: https://opendocs.alipay.com/support/01rawm
