<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { apiRequest } from '@/api'
import { API_BASE_URL, API_DISPLAY_URL, TOKEN_STORAGE_KEY } from '@/config'
import type { ApiDebugSnapshot, ApiResult, Workspace, WorkspacePayload } from '@/types'

const tokenInput = ref(localStorage.getItem(TOKEN_STORAGE_KEY) || '')
const savedToken = ref(localStorage.getItem(TOKEN_STORAGE_KEY) || '')
const tokenMessage = ref('')

const form = reactive<WorkspacePayload>({
  name: 'My Beauty Studio',
  type: 'personal',
  timezone: 'Europe/Moscow',
  locale: 'ru-RU',
})

const liveHealth = ref<ApiResult | null>(null)
const readyHealth = ref<ApiResult | null>(null)
const isCheckingHealth = ref(false)

const workspaces = ref<Workspace[]>([])
const selectedWorkspace = ref<Workspace | null>(null)
const isCreating = ref(false)
const isLoadingList = ref(false)
const createError = ref('')
const listError = ref('')
const copyMessage = ref('')
const lastResponse = ref<ApiDebugSnapshot | null>(null)
const isDebugOpen = ref(false)

const hasToken = computed(() => savedToken.value.trim().length > 0)

const tokenPreview = computed(() => {
  const token = savedToken.value.trim()

  if (!token) {
    return 'Токен не сохранён'
  }

  return token.length > 22 ? `${token.slice(0, 12)}…${token.slice(-8)}` : token
})

const readyState = computed(() => {
  if (!readyHealth.value) {
    return 'unknown'
  }

  return readyHealth.value.ok ? 'ready' : 'down'
})

const workspaceCountLabel = computed(() => {
  const count = workspaces.value.length

  if (count === 0) {
    return 'Пока нет workspace'
  }

  if (count === 1) {
    return '1 workspace'
  }

  return `${count} workspaces`
})

function setLastResponse(result: ApiResult) {
  lastResponse.value = result.debug
}

function extractErrorMessage(error: unknown, fallback = 'Что-то пошло не так') {
  if (!error) {
    return fallback
  }

  if (error instanceof Error) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (typeof error === 'object') {
    const record = error as Record<string, unknown>
    const nestedError = record.error as Record<string, unknown> | undefined

    if (typeof nestedError?.message === 'string') {
      return nestedError.message
    }

    if (typeof record.message === 'string') {
      return record.message
    }
  }

  return fallback
}

function extractWorkspaces(data: unknown): Workspace[] {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>

    if (Array.isArray(record.workspaces)) {
      return record.workspaces as Workspace[]
    }
  }

  return []
}

function formatDate(value?: string) {
  if (!value) {
    return '—'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return new Intl.DateTimeFormat('ru-RU', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function formatJson(value: unknown) {
  if (value === undefined) {
    return ''
  }

  if (typeof value === 'string') {
    return value
  }

  return JSON.stringify(value, null, 2)
}

function saveToken() {
  const token = tokenInput.value.trim()

  if (!token) {
    clearToken()
    return
  }

  localStorage.setItem(TOKEN_STORAGE_KEY, token)
  savedToken.value = token
  tokenInput.value = token
  tokenMessage.value = 'Готово, теперь можно создавать и смотреть workspaces.'
}

function clearToken() {
  localStorage.removeItem(TOKEN_STORAGE_KEY)
  savedToken.value = ''
  tokenInput.value = ''
  tokenMessage.value = 'Токен очищен.'
  workspaces.value = []
  selectedWorkspace.value = null
}

async function checkHealth() {
  isCheckingHealth.value = true

  const [live, ready] = await Promise.all([
    apiRequest('GET', '/health/live'),
    apiRequest('GET', '/health/ready'),
  ])

  liveHealth.value = live
  readyHealth.value = ready
  setLastResponse(ready)
  isCheckingHealth.value = false
}

async function loadWorkspaces() {
  if (!hasToken.value) {
    listError.value = 'Сначала сохраните JWT token.'
    return
  }

  listError.value = ''
  isLoadingList.value = true

  const result = await apiRequest('GET', '/v1/workspaces', {
    token: savedToken.value,
  })

  setLastResponse(result)

  if (result.ok) {
    workspaces.value = extractWorkspaces(result.data)
    selectedWorkspace.value =
      workspaces.value.find((workspace) => workspace.id === selectedWorkspace.value?.id) ??
      workspaces.value[0] ??
      null
  } else {
    listError.value = extractErrorMessage(result.error, 'Не удалось загрузить список workspace.')
    workspaces.value = []
    selectedWorkspace.value = null
  }

  isLoadingList.value = false
}

async function createWorkspace() {
  if (!hasToken.value) {
    createError.value = 'Сначала сохраните JWT token.'
    return
  }

  if (!form.name.trim()) {
    createError.value = 'Название workspace обязательно.'
    return
  }

  createError.value = ''
  isCreating.value = true

  const result = await apiRequest<Workspace>('POST', '/v1/workspaces', {
    token: savedToken.value,
    body: JSON.stringify({
      name: form.name.trim(),
      type: form.type,
      timezone: form.timezone.trim(),
      locale: form.locale.trim(),
    }),
  })

  setLastResponse(result)

  if (result.ok && result.data) {
    selectedWorkspace.value = result.data
    tokenMessage.value = 'Workspace создан. Обновляю список.'
    await loadWorkspaces()
  } else {
    createError.value = extractErrorMessage(result.error, 'Не удалось создать workspace.')
  }

  isCreating.value = false
}

async function copyWorkspaceId(workspaceID: string) {
  copyMessage.value = ''

  try {
    await navigator.clipboard.writeText(workspaceID)
    copyMessage.value = 'ID скопирован.'
  } catch {
    copyMessage.value = workspaceID
  }
}

onMounted(() => {
  void checkHealth()

  if (hasToken.value) {
    void loadWorkspaces()
  }
})
</script>

<template>
  <main class="app-shell">
    <section class="hero">
      <div class="hero-copy">
        <p class="eyebrow">FrameCraft MVP</p>
        <h1>Рабочие пространства для бьюти-контента</h1>
        <p>
          Создайте пространство мастера или студии и проверьте, что backend возвращает список
          доступных workspace для текущего JWT пользователя.
        </p>
      </div>

      <aside class="system-card">
        <div class="status-line">
          <span class="status-dot" :class="readyState" />
          <div>
            <strong>
              {{ readyState === 'ready' ? 'Backend готов' : readyState === 'down' ? 'Backend недоступен' : 'Статус неизвестен' }}
            </strong>
            <span>{{ API_DISPLAY_URL }}</span>
          </div>
        </div>

        <button type="button" class="secondary small" :disabled="isCheckingHealth" @click="checkHealth">
          {{ isCheckingHealth ? 'Проверяю…' : 'Проверить API' }}
        </button>
      </aside>
    </section>

    <section class="workspace-layout">
      <aside class="setup-column">
        <article class="panel token-panel">
          <div class="panel-title">
            <span class="step">1</span>
            <div>
              <h2>Доступ</h2>
              <p>Вставьте JWT access token из внешнего auth-сервиса.</p>
            </div>
          </div>

          <label>
            JWT token
            <textarea
              v-model="tokenInput"
              rows="4"
              spellcheck="false"
              placeholder="eyJhbGciOi..."
            />
          </label>

          <div class="button-row">
            <button type="button" @click="saveToken">Сохранить токен</button>
            <button type="button" class="secondary" @click="clearToken">Очистить</button>
          </div>

          <p class="token-preview">{{ tokenPreview }}</p>
          <p v-if="tokenMessage" class="success-message">{{ tokenMessage }}</p>
        </article>

        <article class="panel">
          <div class="panel-title">
            <span class="step">2</span>
            <div>
              <h2>Создать workspace</h2>
              <p>Минимальная форма будущего onboarding-сценария.</p>
            </div>
          </div>

          <form class="workspace-form" @submit.prevent="createWorkspace">
            <label>
              Название
              <input v-model="form.name" type="text" maxlength="120" />
            </label>

            <label>
              Тип
              <select v-model="form.type">
                <option value="personal">Личный мастер</option>
                <option value="studio">Студия</option>
              </select>
            </label>

            <div class="two-columns">
              <label>
                Timezone
                <input v-model="form.timezone" type="text" />
              </label>

              <label>
                Locale
                <input v-model="form.locale" type="text" />
              </label>
            </div>

            <p v-if="createError" class="error-message">{{ createError }}</p>

            <button type="submit" class="full-width" :disabled="isCreating || !hasToken">
              {{ isCreating ? 'Создаю…' : 'Создать workspace' }}
            </button>
          </form>
        </article>
      </aside>

      <section class="main-column">
        <article class="panel workspace-panel">
          <div class="workspace-header">
            <div>
              <p class="eyebrow">Мои пространства</p>
              <h2>{{ workspaceCountLabel }}</h2>
            </div>

            <button
              type="button"
              class="secondary"
              :disabled="isLoadingList || !hasToken"
              @click="loadWorkspaces"
            >
              {{ isLoadingList ? 'Загружаю…' : 'Обновить список' }}
            </button>
          </div>

          <p v-if="listError" class="error-message">{{ listError }}</p>

          <div v-if="!hasToken" class="empty-state">
            <h3>Нужен токен</h3>
            <p>Сохраните JWT token слева — после этого можно загрузить список workspace.</p>
          </div>

          <div v-else-if="isLoadingList && !workspaces.length" class="empty-state">
            <h3>Загружаю workspace…</h3>
            <p>Проверяю, что backend отдаёт список для текущего пользователя.</p>
          </div>

          <div v-else-if="!workspaces.length" class="empty-state">
            <h3>Workspace пока нет</h3>
            <p>Создайте первый workspace слева — он появится здесь после ответа backend.</p>
          </div>

          <div v-else class="workspace-grid">
            <button
              v-for="workspace in workspaces"
              :key="workspace.id"
              type="button"
              class="workspace-card"
              :class="{ active: selectedWorkspace?.id === workspace.id }"
              @click="selectedWorkspace = workspace"
            >
              <span class="workspace-kind">
                {{ workspace.type === 'studio' ? 'Студия' : 'Личный мастер' }}
              </span>
              <strong>{{ workspace.name }}</strong>
              <small>{{ workspace.timezone }} · {{ workspace.locale }}</small>
              <span class="role">{{ workspace.role }}</span>
            </button>
          </div>
        </article>

        <article class="panel detail-card">
          <div v-if="selectedWorkspace" class="selected-workspace">
            <p class="eyebrow">Выбранный workspace</p>
            <div class="selected-heading">
              <div>
                <h2>{{ selectedWorkspace.name }}</h2>
                <p>{{ selectedWorkspace.type }} · роль {{ selectedWorkspace.role }}</p>
              </div>

              <button
                type="button"
                class="secondary small"
                @click="copyWorkspaceId(selectedWorkspace.id)"
              >
                Скопировать ID
              </button>
            </div>

            <dl>
              <div>
                <dt>workspaceID</dt>
                <dd>{{ selectedWorkspace.id }}</dd>
              </div>
              <div>
                <dt>created_by</dt>
                <dd>{{ selectedWorkspace.created_by }}</dd>
              </div>
              <div>
                <dt>created_at</dt>
                <dd>{{ formatDate(selectedWorkspace.created_at) }}</dd>
              </div>
              <div>
                <dt>updated_at</dt>
                <dd>{{ formatDate(selectedWorkspace.updated_at) }}</dd>
              </div>
            </dl>

            <p v-if="copyMessage" class="success-message">{{ copyMessage }}</p>
          </div>

          <div v-else class="empty-state flat">
            <h3>Выберите workspace</h3>
            <p>После создания или загрузки списка здесь появятся детали выбранного пространства.</p>
          </div>
        </article>
      </section>
    </section>

    <section class="debug-drawer">
      <button type="button" class="debug-toggle" @click="isDebugOpen = !isDebugOpen">
        {{ isDebugOpen ? 'Скрыть технический ответ' : 'Показать технический ответ' }}
      </button>

      <article v-if="isDebugOpen" class="panel debug-panel">
        <div v-if="lastResponse" class="debug-grid">
          <div>
            <span>Method</span>
            <code>{{ lastResponse.method }}</code>
          </div>
          <div>
            <span>URL</span>
            <code>{{ lastResponse.url }}</code>
          </div>
          <div>
            <span>Status</span>
            <code>{{ lastResponse.statusCode ?? 'network error' }}</code>
          </div>
        </div>

        <div v-if="lastResponse" class="debug-json">
          <div>
            <h3>Response JSON</h3>
            <pre>{{ formatJson(lastResponse.responseJson) || 'null' }}</pre>
          </div>

          <div>
            <h3>Error JSON</h3>
            <pre>{{ formatJson(lastResponse.errorJson) || 'null' }}</pre>
          </div>
        </div>

        <p v-else class="muted">Запросов пока не было.</p>
      </article>
    </section>
  </main>
</template>
