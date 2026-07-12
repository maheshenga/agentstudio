import request from '@/utils/http'
import type { AppRuntimeContext } from '@/utils/app-runtime'

export function fetchAppRuntimeContext(token: string, signal?: AbortSignal) {
  return request.get<AppRuntimeContext>({
    url: '/api/app-runtime/context',
    headers: { 'X-App-Runtime-Token': token },
    signal,
    showErrorMessage: false
  })
}
