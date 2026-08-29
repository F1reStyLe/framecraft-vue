import { authRequest } from '@/auth-api'
import { ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME } from '@/config'
import type { TokenResponse } from '@/types'

export const SESSION_CHANGED_EVENT = 'framecraft:session-changed'

let refreshPromise: Promise<string | null> | null = null

function getCookie(name: string) {
  const prefix = `${encodeURIComponent(name)}=`
  const cookie = document.cookie.split('; ').find((item) => item.startsWith(prefix))

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : ''
}

function getMaxAge(expiresAt: string) {
  const expiresAtMs = new Date(expiresAt).getTime()

  if (Number.isNaN(expiresAtMs)) {
    return undefined
  }

  return Math.max(0, Math.floor((expiresAtMs - Date.now()) / 1000))
}

function writeCookie(name: string, value: string, expiresAt?: string) {
  const attributes = [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    'Path=/',
    'SameSite=Lax',
  ]
  const maxAge = expiresAt ? getMaxAge(expiresAt) : undefined

  if (maxAge !== undefined) {
    attributes.push(`Max-Age=${maxAge}`)
  }

  if (window.location.protocol === 'https:') {
    attributes.push('Secure')
  }

  document.cookie = attributes.join('; ')
}

export function getAccessToken() {
  return getCookie(ACCESS_TOKEN_COOKIE_NAME)
}

export function getRefreshToken() {
  return getCookie(REFRESH_TOKEN_COOKIE_NAME)
}

export function saveSession(tokens: TokenResponse) {
  writeCookie(ACCESS_TOKEN_COOKIE_NAME, tokens.access_token, tokens.access_token_expires_at)
  writeCookie(REFRESH_TOKEN_COOKIE_NAME, tokens.refresh_token, tokens.refresh_token_expires_at)
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT))
}

export function clearSession() {
  writeCookie(ACCESS_TOKEN_COOKIE_NAME, '', '1970-01-01T00:00:00.000Z')
  writeCookie(REFRESH_TOKEN_COOKIE_NAME, '', '1970-01-01T00:00:00.000Z')
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
