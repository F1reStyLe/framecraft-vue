import { apiRequest } from '@/api'
import type { UserProfile } from '@/types'

const profilePath = '/v1/me/profile'
const avatarPath = '/v1/me/avatar'

export function loadUserProfile() {
  return apiRequest<UserProfile>('GET', profilePath)
}

export function uploadUserAvatar(file: File) {
  return apiRequest<UserProfile>('PUT', avatarPath, {
    body: file,
    headers: { 'Content-Type': file.type },
  })
}

export function deleteUserAvatar() {
  return apiRequest<UserProfile>('DELETE', avatarPath)
}
