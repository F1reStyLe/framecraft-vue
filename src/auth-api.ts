import { AUTH_API_BASE_URL } from '@/config'
import { parseResponseBody } from '@/http'
import type { ApiResult } from '@/types'

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
      credentials: 'include',
    })
    const payload = await parseResponseBody(response)
    const data = response.ok ? (payload as T) : null
    const error = response.ok ? null : payload

    return {
      ok: response.ok,
      statusCode: response.status,
      data,
      error,
    }
  } catch (error) {
    const normalizedError =
      error instanceof Error ? { message: error.message, name: error.name } : error

    return {
      ok: false,
      statusCode: null,
      data: null,
      error: normalizedError,
    }
  }
}
