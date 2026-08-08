const envApiBaseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, '')

export const API_BASE_URL = envApiBaseUrl || (import.meta.env.DEV ? '/api' : 'http://localhost:8180')

export const API_DISPLAY_URL =
  API_BASE_URL === '/api' ? '/api → http://localhost:8180' : API_BASE_URL

export const TOKEN_STORAGE_KEY = 'framecraft.accessToken'
