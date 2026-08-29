import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadChatMessages, loadProfile, updateProfile, type BrandProfileDTO } from '@/profile-chat-api'
import type { GptProfileSettings } from '@/types'

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }))

vi.mock('@/api', () => ({ apiRequest: apiRequestMock }))

const backendProfile: BrandProfileDTO = {
  id: 'profile-1',
  workspace_id: 'workspace-1',
  business_name: '',
  specializations: [],
  target_audience: '',
  tone_of_voice: '',
  city: 'Москва',
  services: ['Маникюр'],
  advantages: ['Стерильно'],
  forbidden_phrases: [],
  preferred_emojis: [],
  default_language: 'ru',
  additional_context: '',
  professional_name: 'Анна',
  occupation: 'Мастер маникюра',
  address: '',
  audiences: ['Женщины'],
  audience_age_min: 20,
  audience_age_max: 50,
  address_style: 'informal',
  emoji_level: 'few',
  use_hashtags: false,
  forbidden_topics: 'Политика',
  post_signature: 'До встречи',
  contacts: '@anna',
  booking_url: 'https://example.com/book',
}

const uiProfile: GptProfileSettings = {
  name: 'Анна',
  occupation: 'Мастер маникюра',
  services: 'Маникюр',
  city: 'Москва',
  address: '',
  audiences: ['Женщины'],
  ageMin: 20,
  ageMax: 50,
  advantage: 'Стерильно',
  addressStyle: 'вы',
  emojiLevel: 'few',
  useHashtags: 'yes',
  forbiddenTopics: 'Политика',
  postSignature: 'До встречи',
  contacts: '@anna',
  bookingUrl: 'https://example.com/book',
}

describe('profile and chat API mapping', () => {
  beforeEach(() => apiRequestMock.mockReset())

  it('maps backend profile enums and nullable boolean to UI values', async () => {
    apiRequestMock.mockResolvedValue({ ok: true, statusCode: 200, data: backendProfile, error: null })

    const result = await loadProfile('workspace/1')

    expect(apiRequestMock).toHaveBeenCalledWith('GET', '/v1/workspaces/workspace%2F1/brand-profile')
    expect(result.data?.profile).toMatchObject({ addressStyle: 'ты', useHashtags: 'no' })
  })

  it('maps UI values to the backend profile contract', async () => {
    apiRequestMock.mockResolvedValue({ ok: true, statusCode: 200, data: backendProfile, error: null })

    await updateProfile('workspace-1', uiProfile, backendProfile)

    const request = apiRequestMock.mock.calls[0][2]
    expect(JSON.parse(request.body)).toMatchObject({
      professional_name: 'Анна',
      address_style: 'formal',
      use_hashtags: true,
      services: ['Маникюр'],
      advantages: ['Стерильно'],
    })
  })

  it('maps persisted conversation messages to the chat model', async () => {
    apiRequestMock.mockResolvedValue({
      ok: true,
      statusCode: 200,
      error: null,
      data: { messages: [{
        id: 'message-1', content_project_id: 'project-1', generation_id: 'generation-1',
        role: 'assistant', body: 'Готовый текст', status: 'delivered', created_at: '2026-08-29T10:00:00Z',
      }] },
    })

    const result = await loadChatMessages('project-1')

    expect(result.data?.messages).toEqual([{
      id: 'message-1', contentProjectID: 'project-1', role: 'assistant',
      body: 'Готовый текст', createdAt: '2026-08-29T10:00:00Z',
    }])
  })
})
