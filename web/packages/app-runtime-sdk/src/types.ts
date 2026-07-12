export interface AppRuntimeContext {
  tenant: {
    id: string
    name: string
  }
  user: {
    id: string
    display_name: string
  }
  app: {
    code: string
    name: string
    version: string
  }
}

export type AppRuntimeCapability =
  | 'context.read'
  | 'kv.read'
  | 'kv.write'
  | 'kv.delete'
  | 'files.read'
  | 'files.write'
  | 'http.request'
  | 'webhook.emit'

export interface AppRuntimeCapabilityMetadata {
  requested: AppRuntimeCapability[]
  platform_approved: AppRuntimeCapability[]
  tenant_approved: AppRuntimeCapability[]
  effective: AppRuntimeCapability[]
}

export interface GetContextOptions {
  timeoutMs?: number
  signal?: AbortSignal
}

export type AppRuntimeRequestOptions = GetContextOptions

export type AppRuntimeJsonValue =
  | null
  | boolean
  | number
  | string
  | AppRuntimeJsonValue[]
  | { [key: string]: AppRuntimeJsonValue }

export interface AppRuntimeKvRecord<T extends AppRuntimeJsonValue = AppRuntimeJsonValue> {
  namespace: string
  key: string
  value: T
  version: number
  expires_at: string | null
}

export interface AppRuntimeKvSetOptions extends AppRuntimeRequestOptions {
  expectedVersion?: number
  ttlSeconds?: number
}

export interface AppRuntimeDeleteResult {
  deleted: boolean
}

export interface AppRuntimeFileMetadata {
  id: string
  name: string
  mime_type: string
  size: number
  checksum: string
  expires_at: string | null
}

export interface AppRuntimeFileReadResult {
  data: ArrayBuffer
  mime_type: string
}

export interface AppRuntimeFileUploadOptions extends AppRuntimeRequestOptions {
  name?: string
}

export interface AppRuntimeHttpRequest {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'
  headers?: Record<string, string>
  body?: AppRuntimeJsonValue
}

export interface AppRuntimeHttpResponse {
  status: number
  headers: Record<string, string>
  body: string
  truncated: boolean
}

export interface AppRuntimeWebhookRequest {
  url: string
  event: string
  payload: AppRuntimeJsonValue
}

export type AppRuntimeErrorCode =
  | 'unsupported_protocol'
  | 'unsupported_request'
  | 'scope_denied'
  | 'context_unavailable'
  | 'capability_denied'
  | 'request_failed'
  | 'timeout'
  | 'aborted'
  | 'host_unavailable'
  | 'invalid_response'
