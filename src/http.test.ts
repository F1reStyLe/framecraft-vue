import { describe, expect, it } from 'vitest'

import { parseResponseBody } from '@/http'

describe('parseResponseBody', () => {
  it('returns JSON data and gracefully falls back to plain text', async () => {
    await expect(parseResponseBody(new Response('{"status":"ok"}'))).resolves.toEqual({ status: 'ok' })
    await expect(parseResponseBody(new Response('service unavailable'))).resolves.toBe('service unavailable')
  })
})
