import request from '@/utils/http'
import type {
  AppPackageDetailRecord,
  AppPackageRecord,
  AppPackageVersionRecord
} from '@/api/app-marketplace'

export interface DeveloperAppRecord extends AppPackageRecord {
  latest_version?: string
  latest_review_status?: AppPackageVersionRecord['review_status'] | ''
  latest_publish_status?: AppPackageVersionRecord['publish_status'] | ''
  latest_review_message?: string
}

export interface SaveDeveloperAppParams {
  code?: string
  name: string
  category?: string
  icon?: string
  summary?: string
  description?: string
}

export function fetchDeveloperApps() {
  return request.get<DeveloperAppRecord[]>({ url: '/api/app-developer/apps' })
}

export function fetchDeveloperApp(code: string) {
  return request.get<AppPackageDetailRecord>({ url: `/api/app-developer/apps/${code}` })
}

export function createDeveloperApp(params: SaveDeveloperAppParams) {
  return request.post<DeveloperAppRecord>({ url: '/api/app-developer/apps', data: params })
}

export function updateDeveloperApp(code: string, params: SaveDeveloperAppParams) {
  return request.put<DeveloperAppRecord>({ url: `/api/app-developer/apps/${code}`, data: params })
}

export function uploadDeveloperAppVersion(code: string, file: File) {
  const form = new FormData()
  form.append('file', file)
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-developer/apps/${code}/versions/upload`,
    data: form,
    headers: { 'Content-Type': 'multipart/form-data' }
  })
}

export function submitDeveloperAppVersion(code: string, version: string) {
  return request.post<AppPackageVersionRecord>({
    url: `/api/app-developer/apps/${code}/versions/${version}/submit`
  })
}
