export { APP_RUNTIME_ERROR_CODES, AppRuntimeError } from './errors'
export { APP_RUNTIME_CHANNEL, APP_RUNTIME_PROTOCOL_VERSION } from './protocol'
export type {
  AppRuntimeCapability,
  AppRuntimeCapabilityMetadata,
  AppRuntimeContext,
  AppRuntimeDeleteResult,
  AppRuntimeErrorCode,
  AppRuntimeFileMetadata,
  AppRuntimeFileReadResult,
  AppRuntimeFileUploadOptions,
  AppRuntimeHttpRequest,
  AppRuntimeHttpResponse,
  AppRuntimeJsonValue,
  AppRuntimeKvRecord,
  AppRuntimeKvSetOptions,
  AppRuntimeRequestOptions,
  AppRuntimeServiceInvokeResult,
  AppRuntimeWebhookRequest,
  GetContextOptions
} from './types'

import { createGetContext, createRuntimeClient, type RuntimeWindow } from './client'

const resolveRuntimeWindow = () =>
  typeof window === 'undefined' ? undefined : (window as unknown as RuntimeWindow)

export const getContext = createGetContext(resolveRuntimeWindow)
export const runtime = createRuntimeClient(resolveRuntimeWindow)
