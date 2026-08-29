import { describe, expect, it } from 'vitest'

import {
  APP_NAVIGATION_STATE_KEY,
  loadAppNavigationState,
  saveAppNavigationState,
  type AppNavigationState,
} from '@/app-state'

function memoryStorage(initial?: Record<string, string>) {
  const values = new Map(Object.entries(initial ?? {}))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

describe('application navigation state', () => {
  it('restores the active view and selected resources after a refresh', () => {
    const storage = memoryStorage()
    const state: AppNavigationState = {
      view: 'text',
      workspaceID: 'workspace-1',
      projectID: 'project-1',
    }

    saveAppNavigationState(state, storage)

    expect(loadAppNavigationState(storage)).toEqual(state)
  })

  it('falls back to home for an unknown or malformed view', () => {
    const storage = memoryStorage({
      [APP_NAVIGATION_STATE_KEY]: JSON.stringify({ view: 'unknown', workspaceID: 'workspace-1' }),
    })

    expect(loadAppNavigationState(storage)).toEqual({ view: 'home', workspaceID: '', projectID: '' })
    expect(storage.getItem(APP_NAVIGATION_STATE_KEY)).toBeNull()
  })
})
