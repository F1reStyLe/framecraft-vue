import { API_BASE_URL } from '@/config'
import type { ApiResult } from '@/types'

interface RequestOptions extends RequestInit {
  token?: string
}

function buildUrl(path: string) {
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
  const url = buildUrl(path)
  const headers = new Headers(options.headers)

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`)
  }

  try {
    const response = await fetch(url, {
      ...options,
      method,
      headers,
    })

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
                ? 'Browser could not read the API response. In local dev this is usually CORS; use VITE_API_BASE_URL=/api or enable CORS on the backend.'
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
