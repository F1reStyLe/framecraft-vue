import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadUserProfile, uploadUserAvatar } from '@/user-profile-api'

const { apiRequestMock } = vi.hoisted(() => ({ apiRequestMock: vi.fn() }))

vi.mock('@/api', () => ({ apiRequest: apiRequestMock }))

describe('user profile API', () => {
  beforeEach(() => apiRequestMock.mockReset())

  it('loads the current user profile', async () => {
    apiRequestMock.mockResolvedValue({ ok: true, statusCode: 200, data: { user_id: 'user-1' }, error: null })

    await loadUserProfile()

    expect(apiRequestMock).toHaveBeenCalledWith('GET', '/v1/me/profile')
  })

  it('uploads the original image bytes with the declared MIME type', async () => {
    const file = new File(['avatar'], 'avatar.webp', { type: 'image/webp' })
    apiRequestMock.mockResolvedValue({
      ok: true,
      statusCode: 200,
      data: { user_id: 'user-1', avatar_url: 'https://storage.example/avatar' },
      error: null,
    })

    await uploadUserAvatar(file)

    expect(apiRequestMock).toHaveBeenCalledWith('PUT', '/v1/me/avatar', {
      body: file,
      headers: { 'Content-Type': 'image/webp' },
    })
  })
})
