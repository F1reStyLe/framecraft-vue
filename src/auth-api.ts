import { AUTH_API_BASE_URL } from '@/config'
import type { ApiResult } from '@/types'

async function parseResponse(response: Response) {
  const text = await response.text()

  if (!text) return null

  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export async function authRequest<T = unknown>(
  method: string,
  path: string,
  body: Record<string, unknown>,
): Promise<ApiResult<T>> {
  const url = `${AUTH_API_BASE_URL}${path}`

  try {
    const response = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const payload = await parseResponse(response)
    const data = response.ok ? (payload as T) : null
    const error = response.ok ? null : payload

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
      error instanceof Error ? { message: error.message, name: error.name } : error

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
