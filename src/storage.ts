export function readStoredJson<T>(key: string, fallback: T): T {
  const value = localStorage.getItem(key)

  if (!value) {
    return fallback
  }

  try {
    return JSON.parse(value) as T
  } catch {
    localStorage.removeItem(key)
    return fallback
  }
}
