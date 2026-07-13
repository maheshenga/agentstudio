import request from '@/utils/http'

export type DeveloperRuntimeType = 'static' | 'iframe' | 'service'
export type DeveloperCertificationStatus = 'pending' | 'certified' | 'rejected' | 'expired'
export type DeveloperRiskLevel = 'low' | 'medium' | 'high'

export interface DeveloperCertificationProfile {
  id: string
  user_id: string
  display_name: string
  website: string
  statement: string
  certification_status: DeveloperCertificationStatus
  requested_runtime_types: DeveloperRuntimeType[]
  approved_runtime_types: DeveloperRuntimeType[]
  risk_level: DeveloperRiskLevel
  reviewer_id: string | null
  review_message: string
  certification_time: string | null
  certification_expiry: string | null
  disabled: boolean
  create_time: string | null
  update_time: string | null
}

export interface ApplyDeveloperCertificationParams {
  display_name: string
  website?: string
  statement: string
  requested_runtime_types: DeveloperRuntimeType[]
}

export interface DeveloperCertificationFilters {
  certification_status?: DeveloperCertificationStatus | ''
  risk_level?: DeveloperRiskLevel | ''
  runtime_type?: DeveloperRuntimeType | ''
  disabled?: boolean
}

export interface DecideDeveloperCertificationParams {
  decision: 'certified' | 'rejected'
  approved_runtime_types: DeveloperRuntimeType[]
  risk_level: DeveloperRiskLevel
  certification_expiry?: string
  message: string
}

export function fetchOwnDeveloperProfile() {
  return request.get<DeveloperCertificationProfile | null>({ url: '/api/app-developer/profile' })
}

export function applyDeveloperCertification(params: ApplyDeveloperCertificationParams) {
  return request.post<DeveloperCertificationProfile>({
    url: '/api/app-developer/profile/apply',
    data: params
  })
}

export function fetchDeveloperCertifications(params: DeveloperCertificationFilters = {}) {
  return request.get<DeveloperCertificationProfile[]>({
    url: '/api/app-platform/developers',
    params
  })
}

export function fetchDeveloperCertification(id: string) {
  return request.get<DeveloperCertificationProfile>({
    url: `/api/app-platform/developers/${encodeURIComponent(id)}`
  })
}

export function decideDeveloperCertification(
  id: string,
  params: DecideDeveloperCertificationParams
) {
  return request.post<DeveloperCertificationProfile>({
    url: `/api/app-platform/developers/${encodeURIComponent(id)}/decision`,
    data: params
  })
}

export function setDeveloperCertificationDisabled(id: string, disabled: boolean, message: string) {
  return request.post<DeveloperCertificationProfile>({
    url: `/api/app-platform/developers/${encodeURIComponent(id)}/disabled`,
    data: { disabled, message }
  })
}
