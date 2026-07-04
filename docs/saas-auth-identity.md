# SaaS Auth Identity Notes

## Current Login Model

The current system uses tenant-bound admin login.

- Platform administrator: `sa_system_user.is_super = 1`, returned as `account_scope = platform`.
- Tenant account: a system user linked through `sa_system_user_tenant`, returned as `account_scope = tenant`.
- Tenant owner: any current-role code ending in `:owner`, returned as `is_tenant_owner = true`.
- Standalone username/password registration is disabled because login requires a tenant context.

## Public Signup

Public signup uses `POST /api/saas/signup`.

It creates:

- user
- tenant
- user-tenant default membership
- owner/admin/member tenant roles
- baseline tenant menus and permissions
- free subscription, optional trial, and quota initialization

## Not Yet A Separate End-User System

The current "普通用户" is still a backend account inside the tenant/admin permission model. If the product later needs real customer-facing end users, build them as a separate bounded module instead of mixing them into `sa_system_user`.

Recommended future boundary:

- `sa_system_user`: platform and tenant staff accounts
- new end-user table/module: external product users, app users, or customer identities
- explicit mapping only when an end user needs tenant membership or billing ownership
