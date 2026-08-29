import type { AppView } from '@/types'

export const APP_NAVIGATION_STATE_KEY = 'framecraft.navigation'

export interface AppNavigationState {
  view: AppView
  workspaceID: string
  projectID: string
}

const defaultState: AppNavigationState = {
  view: 'home',
  workspaceID: '',
  projectID: '',
}

const appViews = new Set<AppView>(['home', 'text', 'image', 'publish', 'profile'])

type NavigationStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function sessionStateStorage(storage?: NavigationStorage) {
  return storage ?? window.sessionStorage
}

export function loadAppNavigationState(storage?: NavigationStorage): AppNavigationState {
  try {
    const target = sessionStateStorage(storage)
    const raw = target.getItem(APP_NAVIGATION_STATE_KEY)

    if (!raw) return { ...defaultState }

    const value = JSON.parse(raw) as Partial<AppNavigationState>
    if (!value || typeof value !== 'object' || !appViews.has(value.view as AppView)) {
      target.removeItem(APP_NAVIGATION_STATE_KEY)
      return { ...defaultState }
    }

    return {
      view: value.view as AppView,
      workspaceID: typeof value.workspaceID === 'string' ? value.workspaceID : '',
      projectID: typeof value.projectID === 'string' ? value.projectID : '',
    }
  } catch {
    return { ...defaultState }
  }
}

export function saveAppNavigationState(state: AppNavigationState, storage?: NavigationStorage) {
  try {
    sessionStateStorage(storage).setItem(APP_NAVIGATION_STATE_KEY, JSON.stringify(state))
  } catch {
    // Navigation persistence must never prevent the application from working.
  }
}
