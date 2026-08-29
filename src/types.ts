export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export type WorkspaceType = 'personal' | 'studio'

export type AppView = 'home' | 'text' | 'image' | 'publish' | 'profile'

export interface GptProfileSettings {
  name: string
  occupation: string
  services: string
  city: string
  address: string
  audiences: string[]
  ageMin: number
  ageMax: number
  advantage: string
  addressStyle: '' | 'ты' | 'вы'
  emojiLevel: '' | 'none' | 'few' | 'medium' | 'many'
  useHashtags: '' | 'yes' | 'no'
  forbiddenTopics: string
  postSignature: string
  contacts: string
  bookingUrl: string
}

export interface ChatMessage {
  id: string
  contentProjectID?: string
  role: 'user' | 'assistant'
  body: string
  createdAt: string
}

export interface ProfileResponse {
  profile: GptProfileSettings
}

export interface ChatMessagesResponse {
  messages: ChatMessage[]
}

export interface UserProfile {
  user_id: string
  avatar_url?: string
  avatar_url_expires_at?: string
  avatar_mime_type?: 'image/jpeg' | 'image/png' | 'image/webp'
  avatar_size_bytes?: number
  avatar_updated_at?: string
}

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
  has_thumbnail: boolean
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
  next_cursor?: string
  page_size: number
}

export type ContentType =
  | 'before_after'
  | 'portfolio'
  | 'promotion'
  | 'educational'
  | 'personal'
  | 'review'
  | 'service_description'
  | 'free_form'

export type ContentProjectStatus = 'draft' | 'ready' | 'archived' | 'deleted'

export interface ContentProject {
  id: string
  workspace_id: string
  title: string
  status: ContentProjectStatus
  content_type: ContentType
  cover_asset_id?: string
  current_text_version_id?: string
  created_by: string
  created_at: string
  updated_at: string
}

export interface ListContentProjectsResponse {
  projects: ContentProject[]
}

export type TextTemplateKey =
  | 'free_form'
  | 'portfolio_post'
  | 'promotion'
  | 'educational_post'
  | 'review_post'

export interface TextGeneration {
  id: string
  workspace_id: string
  content_project_id: string
  provider: string
  model: string
  template_key: string
  template_version: string
  input?: Record<string, unknown>
  status: 'queued' | 'running' | 'succeeded' | 'failed'
  prompt_tokens: number
  completion_tokens: number
  estimated_cost: string
  error_code?: string
  error_message?: string
  created_by: string
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface TextVersion {
  id: string
  content_project_id: string
  generation_id?: string
  source: 'ai' | 'manual'
  body: string
  metadata?: Record<string, unknown>
  created_by: string
  created_at: string
}

export interface CreateTextGenerationResponse {
  generation: TextGeneration
  text_version: TextVersion
}

export interface ListTextVersionsResponse {
  text_versions: TextVersion[]
}

export interface MediaAssetsSummaryResponse {
  total: number
  statuses: Array<{ status: string; count: number }>
}

export interface CreateMediaDownloadURLResponse {
  asset: MediaAsset
  download_url: string
  download_http_method: 'GET'
  download_url_expires_at: string
}

export interface CreateMediaThumbnailURLResponse {
  asset: MediaAsset
  thumbnail_url: string
  thumbnail_http_method: 'GET'
  thumbnail_url_expires_at: string
}

export interface ApiResult<T = unknown> {
  ok: boolean
  statusCode: number | null
  data: T | null
  error: unknown
}

export interface TokenResponse {
  access_token: string
  access_token_expires_at: string
  refresh_token: string
  refresh_token_expires_at: string
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
}

export interface LoginPayload {
  username?: string
  email?: string
  password: string
}
