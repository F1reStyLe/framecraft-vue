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
