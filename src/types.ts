export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type WorkspaceType = 'personal' | 'studio'

export interface WorkspacePayload {
  name: string
  type: WorkspaceType
  timezone: string
  locale: string
}

export interface Workspace {
  id: string
  name: string
  type: WorkspaceType | string
  timezone: string
  locale: string
  role: 'owner' | 'admin' | 'editor' | 'viewer' | string
  created_by: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface MediaAsset {
  id: string
  workspace_id: string
  source: string
  status: string
  original_name: string
  mime_type: string
  size_bytes: number
  checksum_sha256?: string
  created_by: string
  created_at: string
  updated_at: string
  uploaded_at?: string
  processed_at?: string
  error_code?: string
  error_message?: string
}

export interface MediaJob {
  id: string
  asset_id: string
  workspace_id: string
  type: string
  status: string
  attempts: number
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface CreateMediaUploadResponse {
  asset: MediaAsset
  upload_session_id: string
  upload_url: string
  upload_http_method: 'PUT'
  upload_url_expires_at: string
}

export interface CompleteMediaUploadResponse {
  asset: MediaAsset
  job: MediaJob
}

export interface ListMediaAssetsResponse {
  assets: MediaAsset[]
}

export interface ApiDebugSnapshot {
  method: string
  url: string
  statusCode: number | null
  responseJson: unknown
  errorJson: unknown
}

export interface ApiResult<T = unknown> {
  ok: boolean
  statusCode: number | null
  data: T | null
  error: unknown
  debug: ApiDebugSnapshot
}
