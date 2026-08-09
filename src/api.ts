import { API_BASE_URL } from '@/config'
import { getAccessToken, refreshSession } from '@/session'
import type { ApiResult } from '@/types'

interface RequestOptions extends RequestInit {
  token?: string
  rawUrl?: boolean
}

function buildUrl(path: string) {
  if (/^https?:\/\//i.test(path)) {
    return path
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

async function parseJsonSafely(response: Response) {
  const text = await response.text()

  if (!text) {
    return null
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export async function apiRequest<T = unknown>(
  method: string,
  path: string,
  options: RequestOptions = {},
): Promise<ApiResult<T>> {
  const { rawUrl = false, token, ...fetchOptions } = options
  const url = rawUrl ? path : buildUrl(path)
  const headers = new Headers(fetchOptions.headers)

  if (fetchOptions.body && typeof fetchOptions.body === 'string' && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const currentToken = token ? getAccessToken() || token : ''
  if (currentToken) {
    headers.set('Authorization', `Bearer ${currentToken}`)
  }

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      method,
      headers,
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
        const retryBody = await parseJsonSafely(retryResponse)

        return {
          ok: retryResponse.ok,
          statusCode: retryResponse.status,
          data: retryResponse.ok ? (retryBody as T) : null,
          error: retryResponse.ok ? null : retryBody,
          debug: {
            method,
            url,
            statusCode: retryResponse.status,
            responseJson: retryResponse.ok ? retryBody : null,
            errorJson: retryResponse.ok ? null : retryBody,
          },
        }
      }
    }

    const body = await parseJsonSafely(response)
    const data = response.ok ? (body as T) : null
    const error = response.ok ? null : body

    return {
      ok: response.ok,
      statusCode: response.status,
      data,
      error,
      debug: {
        method,
        url,
        statusCode: response.status,
        responseJson: data,
        errorJson: error,
      },
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
      debug: {
        method,
        url,
        statusCode: null,
        responseJson: null,
        errorJson: normalizedError,
      },
    }
  }
}
