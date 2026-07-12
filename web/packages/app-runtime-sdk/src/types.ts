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

export type AppRuntimeCapability = 'context.read'

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

export type AppRuntimeErrorCode =
  | 'unsupported_protocol'
  | 'unsupported_request'
  | 'scope_denied'
  | 'context_unavailable'
  | 'timeout'
  | 'aborted'
  | 'host_unavailable'
  | 'invalid_response'
