# P8 Safe App Runtime API Design

**Status:** Approved conversational design, pending written-spec review

**Goal:** Let reviewed static applications request a small sanitized tenant, user, and app context through a versioned `postMessage` contract without exposing platform credentials or weakening tenant entitlement checks.

## Context

The current app runner opens static and external iframe applications inside a sandboxed iframe without `allow-same-origin`. The backend open flow already verifies that an app is published, installed for the authenticated tenant, entitled through its SaaS/system modules, and backed by a valid published version. Static manifests already persist a `permissions` array.

P8 adds a read-only browser runtime contract on top of those boundaries. It does not add direct data APIs, runtime bearer tokens, service execution, or external iframe integration.

## Product Decision

P8 uses a host-page message bridge:

1. The authenticated host SPA fetches app open metadata through the existing backend endpoint.
2. The backend returns a sanitized runtime context only for an entitled static app whose resolved manifest declares `runtime:context:read`.
3. The static iframe requests that context from its parent with a versioned `postMessage` request.
4. The host verifies the exact iframe window source and returns only the sanitized context.

This approach is preferred over a short-lived runtime token because P8 needs read-only context, not direct backend calls. It is preferred over URL/hash injection because context is returned only on demand and does not enter navigation history or request logs.

## Scope

### Included

- One supported runtime scope: `runtime:context:read`.
- Static app context requests through `window.parent.postMessage`.
- Sanitized tenant, user, and app identity.
- Fixed protocol and error contracts.
- Backend and frontend contract tests and readiness checks.
- Backward-compatible behavior for manifests without the runtime scope.

### Excluded

- Direct iframe-to-backend API calls.
- Runtime access tokens, refresh tokens, signed sessions, or credential forwarding.
- Write operations, tenant data queries, storage APIs, billing APIs, AI APIs, or file APIs.
- External iframe and internal-route app bridges.
- Dynamic scope approval UI or per-install scope consent.
- Service-plugin execution.

## Runtime Context Contract

The runtime context uses string IDs so JavaScript clients do not lose precision when database identifiers are backed by MySQL `bigint` values.

```ts
interface AppRuntimeContext {
  tenant: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    display_name: string;
  };
  app: {
    code: string;
    name: string;
    version: string;
  };
}
```

The context must not contain:

- username or tenant code;
- email address, phone number, avatar, department, role, or permission list;
- JWT, access token, refresh token, Redis token UUID, cookie, or authorization header;
- IP address, user agent, request headers, or raw exception data.

## Backend Design

### Runtime context service

Add a focused `AppRuntimeContextService` under the app module. It receives the authenticated tenant/user IDs plus the already resolved app and version.

The service performs defense-in-depth checks before returning context:

- app type is exactly `static`;
- resolved version exists and is the version selected by the open flow;
- version manifest permissions contain the exact string `runtime:context:read`;
- tenant exists, is active, and is not soft deleted;
- user exists, is active, and is not soft deleted;
- an active, non-deleted user-tenant membership exists for the same tenant and user.

The service selects only the fields needed for the response. It does not serialize full entities.

Supported runtime scopes are resolved from the published version manifest. Unknown manifest permissions remain stored for compatibility but are never surfaced as runtime scopes by P8.

### Open metadata extension

Extend the existing static app open response with:

```ts
interface AppRuntimeBootstrap {
  protocol_version: 1;
  scopes: Array<'runtime:context:read'>;
  context: AppRuntimeContext | null;
}

interface AppOpenMetadata {
  // Existing fields remain unchanged.
  runtime: AppRuntimeBootstrap | null;
}
```

Rules:

- Entitlement, installation, publication, and version checks remain in `AppTenantService.getOpenMetadata` and run before runtime context resolution.
- An entitled static app with the declared scope receives a non-null bootstrap and context.
- A static app without the scope receives `runtime` with protocol version `1`, an empty scope list, and `context: null`.
- External iframe and internal-route apps receive `runtime: null`.
- Runtime context resolution failure must not replace the existing app-open audit outcome or expose raw errors. The app can still render, while the bridge returns `context_unavailable`.

No database migration is required because permissions already live in the version manifest JSON.

## Browser Message Protocol

### Request

```json
{
  "channel": "agentstudio:app-runtime",
  "version": 1,
  "type": "context.get",
  "request_id": "request-1"
}
```

`request_id` must be a non-empty string of at most 100 characters. The request must be a plain object with the exact channel and numeric protocol version.

### Success response

```json
{
  "channel": "agentstudio:app-runtime",
  "version": 1,
  "type": "context.result",
  "request_id": "request-1",
  "ok": true,
  "data": {
    "tenant": { "id": "23", "name": "Acme" },
    "user": { "id": "91", "display_name": "Owner" },
    "app": { "code": "job_board", "name": "Job Board", "version": "1.2.0" }
  }
}
```

### Error response

```json
{
  "channel": "agentstudio:app-runtime",
  "version": 1,
  "type": "context.error",
  "request_id": "request-1",
  "ok": false,
  "error": {
    "code": "scope_denied",
    "message": "Runtime scope is not available"
  }
}
```

Supported fixed error codes:

- `unsupported_protocol`: channel is valid but the protocol version is not supported;
- `unsupported_request`: channel/version are valid but the request type is unknown;
- `scope_denied`: the app manifest did not declare `runtime:context:read`;
- `context_unavailable`: the backend did not provide a usable sanitized context.

Malformed messages without a valid channel and request ID are ignored without a response.

## Frontend Bridge

Create a pure runtime protocol module that owns message types, parsing, fixed errors, and response construction. Keep window lifecycle wiring in the existing app runner page.

The runner must:

- keep a Vue ref to the rendered iframe;
- register one `message` listener on mount and remove it on unmount;
- process messages only when the current metadata type is `static`;
- require `event.source === iframeRef.contentWindow`;
- never trust a tenant, user, app code, scope, or callback URL from message data;
- read all response data from the current backend-provided runtime bootstrap;
- clear metadata and runtime bootstrap before route changes, retries, and reloads;
- return at most one response for each valid request.

The static iframe has an opaque origin because `allow-same-origin` remains forbidden. Responses therefore use `targetOrigin: "*"`; the security binding is the exact `WindowProxy` identity check against `iframe.contentWindow`. Messages from every other frame or window are ignored.

## Security Properties

- The uploaded app never receives the platform access token or refresh token.
- The bridge never forwards cookies, authorization headers, request objects, or API client instances.
- The iframe remains sandboxed without `allow-same-origin`.
- External iframe apps cannot use the bridge.
- Runtime scope comes from the reviewed, resolved version manifest rather than iframe-supplied input.
- Tenant entitlement and installation are checked before the host receives runtime context.
- User identity is bound to an active membership in the authenticated tenant.
- Context fields are built from an explicit allowlist, not by serializing entities.
- Fixed error messages prevent backend details from crossing into uploaded code.

## Error And Lifecycle Behavior

- A missing scope does not prevent the app from opening; `context.get` returns `scope_denied`.
- Missing tenant/user/membership context does not expose partial identity; `context.get` returns `context_unavailable`.
- A route change or retry clears the previous bootstrap before loading the next app.
- Messages received while loading, after unload, or from a stale iframe source are ignored.
- Runtime bridge errors are not added to app-open failure analytics in P8 because the app itself opened successfully.

## Testing Strategy

### Backend

- Scope resolution accepts only exact `runtime:context:read` from the resolved static version.
- Static app context includes only the approved fields and string IDs.
- Missing scope returns an empty scope list and null context.
- External iframe/internal apps return `runtime: null`.
- Missing or inactive tenant/user/membership returns null context without leaking raw errors.
- Existing open audit success/failure behavior remains unchanged.
- Response serialization contains no credential, contact, role, IP, or user-agent fields.

### Frontend

- Valid requests from the current static iframe receive `context.result`.
- A different window source receives no response.
- External iframe metadata cannot activate the bridge.
- Unsupported versions and request types receive fixed errors.
- Missing scope and context receive the correct fixed errors.
- Malformed messages and oversized request IDs are ignored.
- Route changes and reloads clear stale runtime data.
- Sandbox checks continue to reject `allow-same-origin`.
- Readiness checks reject token, cookie, authorization, email, phone, username, role, IP, and user-agent fields in bridge payloads.

## Acceptance Criteria

- A reviewed static app declaring `runtime:context:read` can request and receive the approved context through `postMessage`.
- A static app without the scope receives `scope_denied` and no context.
- External iframe and internal apps cannot receive runtime context.
- The bridge accepts messages only from the currently rendered iframe window.
- Tenant/user context is derived from authenticated server state and active tenant membership.
- No platform credential or disallowed identity field is present in backend metadata, frontend runtime types, or iframe responses.
- Existing app install, entitlement, open, and P7 analytics behavior remains green.
- Focused backend tests, runtime readiness checks, ESLint, backend build, frontend build, and `git diff --check` pass.

## Deferred Work

- Short-lived scoped runtime sessions for direct backend APIs.
- Read/write tenant data APIs and per-install consent.
- Runtime storage, billing, AI, file, notification, and navigation capabilities.
- Runtime call metrics and rate limiting beyond browser message validation.
- Service-plugin containers and executable backend extensions.
