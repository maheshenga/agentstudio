import request from '@/utils/http'
import type {
  AppRuntimeContext,
  AppRuntimeDeleteResult,
  AppRuntimeFileMetadata,
  AppRuntimeHttpResponse,
  AppRuntimeJsonValue,
  AppRuntimeKvRecord
} from '@/utils/app-runtime'

const runtimeHeaders = (token: string) => ({ 'X-App-Runtime-Token': token })

export function fetchAppRuntimeContext(token: string, signal?: AbortSignal) {
  return request.get<AppRuntimeContext>({
    url: '/api/app-runtime/context',
    headers: runtimeHeaders(token),
    signal,
    showErrorMessage: false
  })
}

export function fetchAppRuntimeKv(
  token: string,
  namespace: string,
  key: string,
  signal?: AbortSignal
) {
  return request.get<AppRuntimeKvRecord>({
    url: `/api/app-runtime/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
    headers: runtimeHeaders(token),
    signal,
    showErrorMessage: false
  })
}

export function setAppRuntimeKv(
  token: string,
  namespace: string,
  key: string,
  data: {
    value: AppRuntimeJsonValue
    expected_version?: number
    ttl_seconds?: number
  },
  signal?: AbortSignal
) {
  return request.put<AppRuntimeKvRecord>({
    url: `/api/app-runtime/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
    headers: runtimeHeaders(token),
    data,
    signal,
    showErrorMessage: false
  })
}

export function deleteAppRuntimeKv(
  token: string,
  namespace: string,
  key: string,
  signal?: AbortSignal
) {
  return request.del<AppRuntimeDeleteResult>({
    url: `/api/app-runtime/kv/${encodeURIComponent(namespace)}/${encodeURIComponent(key)}`,
    headers: runtimeHeaders(token),
    signal,
    showErrorMessage: false
  })
}

export function uploadAppRuntimeFile(
  token: string,
  file: Blob,
  name?: string,
  signal?: AbortSignal
) {
  const form = new FormData()
  const originalName = typeof File !== 'undefined' && file instanceof File ? file.name : 'file'
  form.append('file', file, name || originalName)
  return request.post<AppRuntimeFileMetadata>({
    url: '/api/app-runtime/files',
    headers: { ...runtimeHeaders(token), 'Content-Type': 'multipart/form-data' },
    data: form,
    signal,
    showErrorMessage: false
  })
}

export function readAppRuntimeFile(token: string, id: string, signal?: AbortSignal) {
  return request.get<Blob>({
    url: `/api/app-runtime/files/${encodeURIComponent(id)}`,
    headers: runtimeHeaders(token),
    responseType: 'blob',
    signal,
    showErrorMessage: false
  })
}

export function deleteAppRuntimeFile(token: string, id: string, signal?: AbortSignal) {
  return request.del<AppRuntimeDeleteResult>({
    url: `/api/app-runtime/files/${encodeURIComponent(id)}`,
    headers: runtimeHeaders(token),
    signal,
    showErrorMessage: false
  })
}

export function requestAppRuntimeHttp(
  token: string,
  data: Record<string, unknown>,
  signal?: AbortSignal
) {
  return request.post<AppRuntimeHttpResponse>({
    url: '/api/app-runtime/http',
    headers: runtimeHeaders(token),
    data,
    signal,
    showErrorMessage: false
  })
}

export function emitAppRuntimeWebhook(
  token: string,
  data: Record<string, unknown>,
  signal?: AbortSignal
) {
  return request.post<AppRuntimeHttpResponse>({
    url: '/api/app-runtime/webhooks',
    headers: runtimeHeaders(token),
    data,
    signal,
    showErrorMessage: false
  })
}
