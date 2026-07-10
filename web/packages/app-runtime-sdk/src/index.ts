export { APP_RUNTIME_ERROR_CODES, AppRuntimeError } from './errors'
export { APP_RUNTIME_CHANNEL, APP_RUNTIME_PROTOCOL_VERSION } from './protocol'
export type { AppRuntimeContext, AppRuntimeErrorCode, GetContextOptions } from './types'

import { createGetContext, type RuntimeWindow } from './client'

export const getContext = createGetContext(() =>
  typeof window === 'undefined' ? undefined : (window as unknown as RuntimeWindow)
)
