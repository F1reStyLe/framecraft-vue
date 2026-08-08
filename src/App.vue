<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'

import { apiRequest } from '@/api'
import { API_BASE_URL, API_DISPLAY_URL, TOKEN_STORAGE_KEY } from '@/config'
import type {
  ApiDebugSnapshot,
  ApiResult,
  CompleteMediaUploadResponse,
  CreateMediaUploadResponse,
  ListMediaAssetsResponse,
  MediaAsset,
  Workspace,
  WorkspacePayload,
} from '@/types'

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
const selectedFile = ref<File | null>(null)
const fileInputKey = ref(0)
const filePreviewUrl = ref('')
const uploadStatus = ref('')
const uploadError = ref('')
const isUploading = ref(false)
const mediaAssets = ref<MediaAsset[]>([])
const isLoadingMedia = ref(false)

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

function extractMediaAssets(data: unknown): MediaAsset[] {
  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>

    if (Array.isArray(record.assets)) {
      return record.assets as MediaAsset[]
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

function formatBytes(value: number) {
  if (!Number.isFinite(value)) {
    return '—'
  }

  if (value < 1024) {
    return `${value} B`
  }

  const units = ['KB', 'MB', 'GB']
  let size = value / 1024
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex += 1
  }

  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`
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
  mediaAssets.value = []
  clearSelectedFile()
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

    if (selectedWorkspace.value) {
      await loadMediaAssets()
    } else {
      mediaAssets.value = []
    }
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

function selectWorkspace(workspace: Workspace) {
  selectedWorkspace.value = workspace
  uploadError.value = ''
  uploadStatus.value = ''
  void loadMediaAssets()
}

function clearSelectedFile() {
  selectedFile.value = null

  if (filePreviewUrl.value) {
    URL.revokeObjectURL(filePreviewUrl.value)
    filePreviewUrl.value = ''
  }

  fileInputKey.value += 1
}

function selectFile(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null

  clearSelectedFile()
  selectedFile.value = file
  uploadError.value = ''
  uploadStatus.value = file ? `Выбран файл: ${file.name}` : ''

  if (file?.type.startsWith('image/')) {
    filePreviewUrl.value = URL.createObjectURL(file)
  }
}

function resolveUploadUrl(uploadUrl: string) {
  if (/^https?:\/\//i.test(uploadUrl)) {
    const url = new URL(uploadUrl)

    if (url.hostname === 'minio') {
      url.hostname = 'localhost'
      return url.toString()
    }

    return uploadUrl
  }

  return uploadUrl.startsWith('/') ? `/api${uploadUrl}` : `/api/${uploadUrl}`
}

async function loadMediaAssets() {
  if (!selectedWorkspace.value || !hasToken.value) {
    mediaAssets.value = []
    return
  }

  isLoadingMedia.value = true
  uploadError.value = ''

  const result = await apiRequest<ListMediaAssetsResponse>(
    'GET',
    `/v1/media/assets?workspace_id=${encodeURIComponent(selectedWorkspace.value.id)}`,
    {
      token: savedToken.value,
    },
  )

  setLastResponse(result)

  if (result.ok) {
    mediaAssets.value = extractMediaAssets(result.data)
  } else {
    uploadError.value = extractErrorMessage(result.error, 'Не удалось загрузить файлы workspace.')
    mediaAssets.value = []
  }

  isLoadingMedia.value = false
}

async function uploadFile() {
  if (!hasToken.value) {
    uploadError.value = 'Сначала сохраните JWT token.'
    return
  }

  if (!selectedWorkspace.value) {
    uploadError.value = 'Сначала выберите или создайте workspace.'
    return
  }

  if (!selectedFile.value) {
    uploadError.value = 'Выберите файл для загрузки.'
    return
  }

  uploadError.value = ''
  uploadStatus.value = 'Создаю upload session…'
  isUploading.value = true

  const file = selectedFile.value
  const createResult = await apiRequest<CreateMediaUploadResponse>('POST', '/v1/media/uploads', {
    token: savedToken.value,
    body: JSON.stringify({
      workspace_id: selectedWorkspace.value.id,
      original_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    }),
  })

  setLastResponse(createResult)

  if (!createResult.ok || !createResult.data) {
    uploadError.value = extractErrorMessage(createResult.error, 'Не удалось создать upload session.')
    isUploading.value = false
    return
  }

  uploadStatus.value = 'Загружаю файл…'
  const uploadResult = await apiRequest('PUT', resolveUploadUrl(createResult.data.upload_url), {
    rawUrl: true,
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  })

  setLastResponse(uploadResult)

  if (!uploadResult.ok) {
    uploadError.value = extractErrorMessage(uploadResult.error, 'Не удалось отправить файл.')
    isUploading.value = false
    return
  }

  uploadStatus.value = 'Завершаю upload…'
  const completeResult = await apiRequest<CompleteMediaUploadResponse>(
    'POST',
    `/v1/media/assets/${createResult.data.asset.id}/complete`,
    {
      token: savedToken.value,
    },
  )

  setLastResponse(completeResult)

  if (completeResult.ok) {
    uploadStatus.value = `Файл загружен: ${completeResult.data?.asset.original_name ?? file.name}`
    clearSelectedFile()
    await loadMediaAssets()
  } else {
    uploadError.value = extractErrorMessage(completeResult.error, 'Не удалось завершить upload.')
  }

  isUploading.value = false
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
              @click="selectWorkspace(workspace)"
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

        <article class="panel upload-panel">
          <div class="panel-title">
            <span class="step">3</span>
            <div>
              <h2>Загрузить файл</h2>
              <p>Файл будет привязан к выбранному workspace через media upload API.</p>
            </div>
          </div>

          <div v-if="selectedWorkspace" class="upload-box">
            <label>
              Файл профиля
              <input :key="fileInputKey" type="file" @change="selectFile" />
            </label>

            <div v-if="selectedFile" class="file-summary">
              <img v-if="filePreviewUrl" :src="filePreviewUrl" alt="" />
              <div>
                <strong>{{ selectedFile.name }}</strong>
                <span>{{ selectedFile.type || 'application/octet-stream' }} · {{ formatBytes(selectedFile.size) }}</span>
              </div>
              <button type="button" class="secondary small" :disabled="isUploading" @click="clearSelectedFile">
                Убрать
              </button>
            </div>

            <p v-if="uploadStatus" class="success-message">{{ uploadStatus }}</p>
            <p v-if="uploadError" class="error-message">{{ uploadError }}</p>

            <button type="button" class="full-width" :disabled="isUploading" @click="uploadFile">
              {{ isUploading ? 'Загружаю…' : 'Загрузить файл' }}
            </button>
          </div>

          <div v-else class="empty-state flat">
            <h3>Нужен workspace</h3>
            <p>Создайте или выберите workspace выше, затем можно будет загрузить файл.</p>
          </div>

          <div class="asset-list">
            <div class="asset-list-head">
              <div>
                <p class="eyebrow">Media assets</p>
                <h3>{{ mediaAssets.length ? `${mediaAssets.length} файлов` : 'Файлов пока нет' }}</h3>
              </div>

              <button
                type="button"
                class="secondary small"
                :disabled="isLoadingMedia || !selectedWorkspace || !hasToken"
                @click="loadMediaAssets"
              >
                {{ isLoadingMedia ? 'Обновляю…' : 'Обновить' }}
              </button>
            </div>

            <div v-if="mediaAssets.length" class="asset-grid">
              <div v-for="asset in mediaAssets" :key="asset.id" class="asset-card">
                <strong>{{ asset.original_name }}</strong>
                <span>{{ asset.status }} · {{ formatBytes(asset.size_bytes) }}</span>
                <small>{{ asset.mime_type }}</small>
                <code>{{ asset.id }}</code>
              </div>
            </div>
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
