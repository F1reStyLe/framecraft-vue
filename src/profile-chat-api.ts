import { apiRequest } from '@/api'
import type {
  ApiResult,
  ChatMessage,
  ChatMessagesResponse,
  CreateTextGenerationResponse,
  GptProfileSettings,
  TextTemplateKey,
} from '@/types'

export interface BrandProfileDTO {
  id?: string
  workspace_id?: string
  business_name: string
  specializations: string[]
  target_audience: string
  tone_of_voice: string
  city: string
  services: string[]
  advantages: string[]
  forbidden_phrases: string[]
  preferred_emojis: string[]
  default_language: string
  additional_context: string
  professional_name: string
  occupation: string
  address: string
  audiences: string[]
  audience_age_min: number
  audience_age_max: number
  address_style: '' | 'informal' | 'formal'
  emoji_level: GptProfileSettings['emojiLevel']
  use_hashtags: boolean | null
  forbidden_topics: string
  post_signature: string
  contacts: string
  booking_url: string
  created_at?: string
  updated_at?: string
}

interface ChatMessageDTO {
  id: string
  content_project_id: string
  generation_id?: string
  role: ChatMessage['role']
  body: string
  status: string
  error_code?: string
  error_message?: string
  created_at: string
}

function brandProfilePath(workspaceID: string) {
  return `/v1/workspaces/${encodeURIComponent(workspaceID)}/brand-profile`
}

function conversationPath(projectID: string) {
  return `/v1/content-projects/${encodeURIComponent(projectID)}/conversation`
}

function textGenerationsPath(projectID: string) {
  return `/v1/content-projects/${encodeURIComponent(projectID)}/text-generations`
}

function splitList(value: string) {
  return value.split(/[,;\n]/).map((item) => item.trim()).filter(Boolean)
}

function fromBrandProfileDTO(profile: BrandProfileDTO): GptProfileSettings {
  return {
    name: profile.professional_name ?? '',
    occupation: profile.occupation ?? profile.specializations?.join(', ') ?? '',
    services: profile.services?.join(', ') ?? '',
    city: profile.city ?? '',
    address: profile.address ?? '',
    audiences: Array.isArray(profile.audiences) ? profile.audiences : [],
    ageMin: profile.audience_age_min ?? 18,
    ageMax: profile.audience_age_max ?? 65,
    advantage: profile.advantages?.join(', ') ?? '',
    addressStyle: profile.address_style === 'informal' ? 'ты' : profile.address_style === 'formal' ? 'вы' : '',
    emojiLevel: profile.emoji_level ?? '',
    useHashtags: profile.use_hashtags === true ? 'yes' : profile.use_hashtags === false ? 'no' : '',
    forbiddenTopics: profile.forbidden_topics ?? profile.forbidden_phrases?.join(', ') ?? '',
    postSignature: profile.post_signature ?? '',
    contacts: profile.contacts ?? '',
    bookingUrl: profile.booking_url ?? '',
  }
}

function toBrandProfileDTO(profile: GptProfileSettings, previous?: BrandProfileDTO | null): BrandProfileDTO {
  return {
    business_name: previous?.business_name ?? '',
    specializations: previous?.specializations ?? splitList(profile.occupation),
    target_audience: previous?.target_audience ?? profile.audiences.join(', '),
    tone_of_voice: previous?.tone_of_voice ?? '',
    city: profile.city,
    services: splitList(profile.services),
    advantages: splitList(profile.advantage),
    forbidden_phrases: previous?.forbidden_phrases ?? splitList(profile.forbiddenTopics),
    preferred_emojis: previous?.preferred_emojis ?? [],
    default_language: previous?.default_language || 'ru',
    additional_context: previous?.additional_context ?? '',
    professional_name: profile.name,
    occupation: profile.occupation,
    address: profile.address,
    audiences: profile.audiences,
    audience_age_min: profile.ageMin,
    audience_age_max: profile.ageMax,
    address_style: profile.addressStyle === 'ты' ? 'informal' : profile.addressStyle === 'вы' ? 'formal' : '',
    emoji_level: profile.emojiLevel,
    use_hashtags: profile.useHashtags === 'yes' ? true : profile.useHashtags === 'no' ? false : null,
    forbidden_topics: profile.forbiddenTopics,
    post_signature: profile.postSignature,
    contacts: profile.contacts,
    booking_url: profile.bookingUrl,
  }
}

function fromChatMessageDTO(message: ChatMessageDTO): ChatMessage {
  return {
    id: message.id,
    contentProjectID: message.content_project_id,
    role: message.role,
    body: message.body,
    createdAt: message.created_at,
  }
}

export async function loadProfile(workspaceID: string): Promise<ApiResult<{ profile: GptProfileSettings; source: BrandProfileDTO }>> {
  const result = await apiRequest<BrandProfileDTO>('GET', brandProfilePath(workspaceID))
  return {
    ...result,
    data: result.data ? { profile: fromBrandProfileDTO(result.data), source: result.data } : null,
  }
}

export async function updateProfile(
  workspaceID: string,
  profile: GptProfileSettings,
  previous?: BrandProfileDTO | null,
): Promise<ApiResult<{ profile: GptProfileSettings; source: BrandProfileDTO }>> {
  const result = await apiRequest<BrandProfileDTO>('PUT', brandProfilePath(workspaceID), {
    body: JSON.stringify(toBrandProfileDTO(profile, previous)),
  })
  return {
    ...result,
    data: result.data ? { profile: fromBrandProfileDTO(result.data), source: result.data } : null,
  }
}

export async function loadChatMessages(projectID: string): Promise<ApiResult<ChatMessagesResponse>> {
  const result = await apiRequest<{ messages: ChatMessageDTO[] }>('GET', conversationPath(projectID))
  return {
    ...result,
    data: result.data ? { messages: (result.data.messages ?? []).map(fromChatMessageDTO) } : null,
  }
}

export function createChatGeneration(
  projectID: string,
  templateKey: TextTemplateKey,
  input: Record<string, unknown>,
) {
  return apiRequest<CreateTextGenerationResponse>('POST', textGenerationsPath(projectID), {
    body: JSON.stringify({ template_key: templateKey, input }),
  })
}
