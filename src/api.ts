import { API_BASE_URL } from '@/config'
import { parseResponseBody } from '@/http'
import { getAccessToken, refreshSession } from '@/session'
import type { ApiResult } from '@/types'

interface RequestOptions extends RequestInit {
  rawUrl?: boolean
  auth?: boolean
}

export function buildApiUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { rawUrl = false, auth = !rawUrl, ...fetchOptions } = options
  const url = rawUrl ? path : buildApiUrl(path)
  const headers = new Headers(fetchOptions.headers)

  if (fetchOptions.body && typeof fetchOptions.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const currentToken = auth ? getAccessToken() : ''
  if (currentToken) {
    headers.set('Authorization', `Bearer ${currentToken}`)
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      method,
      headers,
      credentials: 'include',
    })

    if (response.status === 401 && currentToken) {
      const refreshedToken = await refreshSession()
      if (refreshedToken) {
        headers.set('Authorization', `Bearer ${refreshedToken}`)
        const retryResponse = await fetch(url, {
          ...fetchOptions,
          method,
          headers,
        })
        const retryBody = await parseResponseBody(retryResponse)

        return {
          ok: retryResponse.ok,
          statusCode: retryResponse.status,
          data: retryResponse.ok ? (retryBody as T) : null,
          error: retryResponse.ok ? null : retryBody,
        }
      }
    }

    const body = await parseResponseBody(response)
    const data = response.ok ? (body as T) : null
    const error = response.ok ? null : body

    return {
      ok: response.ok,
      statusCode: response.status,
      data,
      error,
    }
  } catch (error) {
    const normalizedError =
      error instanceof Error
        ? {
            message:
              error.name === 'TypeError'
                ? `Browser could not reach ${url}. Check that the Vite dev server is running on 5173 and the backend/proxy target is available.`
                : error.message,
            originalMessage: error.message,
            name: error.name,
          }
        : error

    return {
      ok: false,
      statusCode: null,
      data: null,
      error: normalizedError,
    }
  }
}
