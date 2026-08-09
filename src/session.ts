import { authRequest } from '@/auth-api'
import { REFRESH_TOKEN_STORAGE_KEY, TOKEN_STORAGE_KEY } from '@/config'
import type { TokenResponse } from '@/types'

export const SESSION_CHANGED_EVENT = 'framecraft:session-changed'

let refreshPromise: Promise<string | null> | null = null

export function getAccessToken() {
  return localStorage.getItem(TOKEN_STORAGE_KEY) || ''
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_STORAGE_KEY) || ''
}

export function saveSession(tokens: TokenResponse) {
  localStorage.setItem(TOKEN_STORAGE_KEY, tokens.access_token)
  localStorage.setItem(REFRESH_TOKEN_STORAGE_KEY, tokens.refresh_token)
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}

export function clearSession() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  localStorage.removeItem(REFRESH_TOKEN_STORAGE_KEY)
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}

export function refreshSession() {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = (async () => {
    const refreshToken = getRefreshToken()
    if (!refreshToken) {
      clearSession()
      return null
    }

    const result = await authRequest<TokenResponse>('POST', '/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    })

    if (!result.ok || !result.data) {
      clearSession()
      return null
    }

    saveSession(result.data)
    return result.data.access_token
  })().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}
