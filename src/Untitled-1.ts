<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'

import { apiRequest } from '@/api'
import { authRequest } from '@/auth-api'
import postFlowLogo from '@/assets/postflow-logo-transparent.png'
import postFlowHeroWorkflow from '@/assets/postflow-hero-workflow.png'
import {
  API_BASE_URL,
} from '@/config'
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSession as persistSession,
  SESSION_CHANGED_EVENT,
} from '@/session'
import type {
  ApiDebugSnapshot,
  ApiResult,
  CompleteMediaUploadResponse,
  ContentProject,
  ContentType,
  CreateMediaDownloadURLResponse,
  CreateMediaThumbnailURLResponse,
  CreateTextGenerationResponse,
  CreateMediaUploadResponse,
  ListContentProjectsResponse,
  ListMediaAssetsResponse,
  ListTextVersionsResponse,
  MediaAsset,
  MediaAssetsSummaryResponse,
  RegisterPayload,
  TextTemplateKey,
  TextVersion,
  TokenResponse,
  Workspace,
  WorkspacePayload,
} from '@/types'

const savedToken = ref(getAccessToken())
const refreshToken = ref(getRefreshToken())
const savedLogin = ref(localStorage.getItem('framecraft.login') || '')
const tokenMessage = ref('')
const authMode = ref<'login' | 'register'>('login')
const isAuthOpen = ref(false)
const isAuthSubmitting = ref(false)
const authError = ref('')
const authNotice = ref('')
const currentView = ref<'home' | 'text' | 'image' | 'publish' | 'profile'>('home')
const avatarDataUrl = ref(localStorage.getItem('framecraft.avatar') || '')
const avatarError = ref('')
const loginForm = reactive({ identifier: '', password: '' })
const registerForm = reactive<RegisterPayload>({ username: '', email: '', password: '' })
const registerPasswordConfirmation = ref('')

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
const mediaNextCursor = ref('')
const mediaSummary = ref<MediaAssetsSummaryResponse | null>(null)
const mediaActionID = ref('')
const projects = ref<ContentProject[]>([])
const selectedProject = ref<ContentProject | null>(null)
const projectForm = reactive<{ title: string; content_type: ContentType; cover_asset_id: string }>({
  title: '',
  content_type: 'free_form',
  cover_asset_id: '',
})
const isLoadingProjects = ref(false)
const isCreatingProject = ref(false)
const projectError = ref('')
const textVersions = ref<TextVersion[]>([])
const generationForm = reactive<{ template_key: TextTemplateKey; topic: string; input: string }>({
  template_key: 'free_form',
  topic: '',
  input: '{\n  "tone": "friendly"\n}',
})
const isGeneratingText = ref(false)
const generationError = ref('')

const hasToken = computed(() => savedToken.value.trim().length > 0)

const authDisplayName = computed(() => {
  const fallback = loginForm.identifier.trim() || savedLogin.value || 'Профиль'
  const payloadPart = savedToken.value.split('.')[1]

  if (!payloadPart) return fallback

  try {
    const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/')
    const payload = JSON.parse(decodeURIComponent(escape(atob(normalized)))) as Record<string, unknown>
    const value = payload.username ?? payload.preferred_username ?? payload.login ?? payload.email
    return typeof value === 'string' && value.trim() ? value.trim() : fallback
  } catch {
    return fallback
  }
})

const authAvatarLetter = computed(() => authDisplayName.value.charAt(0).toLocaleUpperCase('ru-RU'))

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

    if (typeof record.error === 'string') {
      return record.error
    }

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

function openAuth(mode: 'login' | 'register') {
  authMode.value = mode
  authError.value = ''
  authNotice.value = ''
  isAuthOpen.value = true
}

function openWorkflowStep(view: 'text' | 'image' | 'publish') {
  currentView.value = view
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openHome(event: MouseEvent) {
  event.preventDefault()
  currentView.value = 'home'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openProfile() {
  currentView.value = 'profile'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function selectAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  avatarError.value = ''

  if (!file) return
  if (!file.type.startsWith('image/')) {
    avatarError.value = 'Выберите изображение.'
    return
  }
  if (file.size > 3 * 1024 * 1024) {
    avatarError.value = 'Размер изображения не должен превышать 3 МБ.'
    return
  }

  const reader = new FileReader()
  reader.onload = () => {
    if (typeof reader.result !== 'string') return
    try {
      localStorage.setItem('framecraft.avatar', reader.result)
      avatarDataUrl.value = reader.result
    } catch {
      avatarError.value = 'Не удалось сохранить изображение. Попробуйте файл меньшего размера.'
    }
  }
  reader.onerror = () => {
    avatarError.value = 'Не удалось прочитать изображение.'
  }
  reader.readAsDataURL(file)
}

function extractProjects(data: unknown): ContentProject[] {
  return data && typeof data === 'object' && Array.isArray((data as ListContentProjectsResponse).projects)
    ? (data as ListContentProjectsResponse).projects
    : []
}

function clearToken() {
  clearSession()
  localStorage.removeItem('framecraft.login')
  savedToken.value = ''
  refreshToken.value = ''
  savedLogin.value = ''
  workspaces.value = []
  selectedWorkspace.value = null
  mediaAssets.value = []
  projects.value = []
  selectedProject.value = null
  textVersions.value = []
  clearSelectedFile()
}

function saveSession(tokens: TokenResponse) {
  persistSession(tokens)
}

function syncSession() {
  savedToken.value = getAccessToken()
  refreshToken.value = getRefreshToken()
}

async function submitLogin() {
  authError.value = ''
  authNotice.value = ''
  isAuthSubmitting.value = true

  const identifier = loginForm.identifier.trim()
  const result = await authRequest<TokenResponse>('POST', '/api/v1/auth/login', {
    ...(identifier.includes('@') ? { email: identifier } : { username: identifier }),
    password: loginForm.password,
  })

  setLastResponse(result)

  if (result.ok && result.data) {
    localStorage.setItem('framecraft.login', identifier)
    savedLogin.value = identifier
    saveSession(result.data)
    loginForm.password = ''
    isAuthOpen.value = false
    tokenMessage.value = 'Вы авторизованы.'
    await loadWorkspaces()
  } else {
    authError.value = extractErrorMessage(result.error, 'Не удалось войти.')
  }

  isAuthSubmitting.value = false
}

async function submitRegistration() {
  authError.value = ''
  authNotice.value = ''

  if (registerForm.password !== registerPasswordConfirmation.value) {
    authError.value = 'Пароли не совпадают.'
    return
  }

  isAuthSubmitting.value = true

  const result = await authRequest('POST', '/api/v1/auth/register', {
    username: registerForm.username.trim(),
    email: registerForm.email.trim(),
    password: registerForm.password,
  })

  setLastResponse(result)

  if (result.ok) {
    loginForm.identifier = registerForm.email.trim()
    loginForm.password = ''
    registerForm.password = ''
    registerPasswordConfirmation.value = ''
    authMode.value = 'login'
    authNotice.value = 'Аккаунт создан. Теперь войдите.'
  } else {
    authError.value = extractErrorMessage(result.error, 'Не удалось зарегистрироваться.')
  }

  isAuthSubmitting.value = false
}

async function logout() {
  const token = getRefreshToken()

  if (token) {
    const result = await authRequest('POST', '/api/v1/auth/logout', { refresh_token: token })
    setLastResponse(result)
    tokenMessage.value = result.ok
      ? 'Вы вышли из аккаунта.'
      : 'Локальная сессия завершена. Auth-сервер не подтвердил выход.'
  }

  clearToken()
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
      await Promise.all([loadMediaAssets(), loadProjects()])
    } else {
      mediaAssets.value = []
      projects.value = []
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

function selectWorkspace(workspace: Workspace) {
  selectedWorkspace.value = workspace
  uploadError.value = ''
  uploadStatus.value = ''
  void loadMediaAssets()
  void loadProjects()
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
  if (file && !file.type.startsWith('image/')) {
    uploadError.value = 'По новому контракту можно загружать только изображения (MIME image/*).'
    return
  }
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

async function loadMediaAssets(append = false) {
  if (!selectedWorkspace.value || !hasToken.value) {
    mediaAssets.value = []
    return
  }

  isLoadingMedia.value = true
  uploadError.value = ''

  const cursor = append ? mediaNextCursor.value : ''
  const result = await apiRequest<ListMediaAssetsResponse>(
    'GET',
    `/v1/media/assets?workspace_id=${encodeURIComponent(selectedWorkspace.value.id)}&page_size=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    {
      token: savedToken.value,
    },
  )

  setLastResponse(result)

  if (result.ok) {
    const loadedAssets = extractMediaAssets(result.data)
    mediaAssets.value = append ? [...mediaAssets.value, ...loadedAssets] : loadedAssets
    mediaNextCursor.value = result.data?.next_cursor ?? ''
    if (!append) void loadMediaSummary()
  } else {
    uploadError.value = extractErrorMessage(result.error, 'Не удалось загрузить файлы workspace.')
    mediaAssets.value = []
  }

  isLoadingMedia.value = false
}

async function loadMediaSummary() {
  if (!selectedWorkspace.value) return
  const result = await apiRequest<MediaAssetsSummaryResponse>(
    'GET',
    `/v1/media/assets/summary?workspace_id=${encodeURIComponent(selectedWorkspace.value.id)}`,
    { token: savedToken.value },
  )
  setLastResponse(result)
  mediaSummary.value = result.ok ? result.data : null
}

async function openAssetUrl(asset: MediaAsset, kind: 'download' | 'thumbnail') {
  mediaActionID.value = asset.id
  const result = kind === 'download'
    ? await apiRequest<CreateMediaDownloadURLResponse>('GET', `/v1/media/assets/${asset.id}/download-url`, { token: savedToken.value })
    : await apiRequest<CreateMediaThumbnailURLResponse>('GET', `/v1/media/assets/${asset.id}/thumbnail-url`, { token: savedToken.value })
  setLastResponse(result)
  const url = kind === 'download'
    ? (result.data as CreateMediaDownloadURLResponse | null)?.download_url
    : (result.data as CreateMediaThumbnailURLResponse | null)?.thumbnail_url
  if (result.ok && url) window.open(resolveUploadUrl(url), '_blank', 'noopener,noreferrer')
  else uploadError.value = extractErrorMessage(result.error, 'Не удалось получить ссылку на файл.')
  mediaActionID.value = ''
}

async function deleteAsset(asset: MediaAsset) {
  if (!window.confirm(`Удалить ${asset.original_name}?`)) return
  mediaActionID.value = asset.id
  const result = await apiRequest('DELETE', `/v1/media/assets/${asset.id}`, { token: savedToken.value })
  setLastResponse(result)
  if (result.ok) await loadMediaAssets()
  else uploadError.value = extractErrorMessage(result.error, 'Не удалось удалить файл.')
  mediaActionID.value = ''
}

async function loadProjects() {
  if (!selectedWorkspace.value || !hasToken.value) {
    projects.value = []
    return
  }
  isLoadingProjects.value = true
  projectError.value = ''
  const result = await apiRequest<ListContentProjectsResponse>('GET', `/v1/content-projects?workspace_id=${encodeURIComponent(selectedWorkspace.value.id)}`, { token: savedToken.value })
  setLastResponse(result)
  if (result.ok) {
    projects.value = extractProjects(result.data)
    selectedProject.value = projects.value.find(({ id }) => id === selectedProject.value?.id) ?? projects.value[0] ?? null
    if (selectedProject.value) await loadTextVersions()
    else textVersions.value = []
  } else projectError.value = extractErrorMessage(result.error, 'Не удалось загрузить контент-проекты.')
  isLoadingProjects.value = false
}

async function createProject() {
  if (!selectedWorkspace.value || !projectForm.title.trim()) return
  isCreatingProject.value = true
  projectError.value = ''
  const result = await apiRequest<ContentProject>('POST', '/v1/content-projects', {
    token: savedToken.value,
    body: JSON.stringify({
      workspace_id: selectedWorkspace.value.id,
      title: projectForm.title.trim(),
      content_type: projectForm.content_type,
      ...(projectForm.cover_asset_id ? { cover_asset_id: projectForm.cover_asset_id } : {}),
    }),
  })
  setLastResponse(result)
  if (result.ok && result.data) {
    selectedProject.value = result.data
    projectForm.title = ''
    await loadProjects()
  } else projectError.value = extractErrorMessage(result.error, 'Не удалось создать контент-проект.')
  isCreatingProject.value = false
}

async function selectProject(project: ContentProject) {
  selectedProject.value = project
  generationError.value = ''
  await loadTextVersions()
}

async function updateProjectStatus(status: 'draft' | 'ready' | 'archived') {
  if (!selectedProject.value) return
  projectError.value = ''
  const project = selectedProject.value
  const result = await apiRequest<ContentProject>('PUT', `/v1/content-projects/${project.id}`, {
    token: savedToken.value,
    body: JSON.stringify({
      title: project.title,
      status,
      ...(project.cover_asset_id ? { cover_asset_id: project.cover_asset_id } : {}),
    }),
  })
  setLastResponse(result)
  if (result.ok && result.data) {
    selectedProject.value = result.data
    projects.value = projects.value.map((item) => item.id === result.data?.id ? result.data : item)
  } else projectError.value = extractErrorMessage(result.error, 'Не удалось обновить проект.')
}

async function deleteProject() {
  if (!selectedProject.value || !window.confirm(`Удалить проект «${selectedProject.value.title}»?`)) return
  const projectID = selectedProject.value.id
  const result = await apiRequest('DELETE', `/v1/content-projects/${projectID}`, { token: savedToken.value })
  setLastResponse(result)
  if (result.ok) {
    selectedProject.value = null
    textVersions.value = []
    await loadProjects()
  } else projectError.value = extractErrorMessage(result.error, 'Не удалось удалить проект.')
}

async function loadTextVersions() {
  if (!selectedProject.value) return
  const result = await apiRequest<ListTextVersionsResponse>('GET', `/v1/content-projects/${selectedProject.value.id}/text-versions`, { token: savedToken.value })
  setLastResponse(result)
  textVersions.value = result.ok ? result.data?.text_versions ?? [] : []
  if (!result.ok) generationError.value = extractErrorMessage(result.error, 'Не удалось загрузить версии текста.')
}

async function generateText() {
  if (!selectedProject.value) return
  if (!generationForm.topic.trim()) {
    generationError.value = 'Укажите тему текста.'
    return
  }
  let input: Record<string, unknown>
  try {
    input = JSON.parse(generationForm.input) as Record<string, unknown>
  } catch {
    generationError.value = 'Поле input должно содержать корректный JSON-объект.'
    return
  }
  input.topic = generationForm.topic.trim()
  if (new TextEncoder().encode(JSON.stringify(input)).length > 16 * 1024) {
    generationError.value = 'JSON input превышает ограничение 16 КиБ.'
    return
  }
  isGeneratingText.value = true
  generationError.value = ''
  const result = await apiRequest<CreateTextGenerationResponse>('POST', `/v1/content-projects/${selectedProject.value.id}/text-generations`, {
    token: savedToken.value,
    body: JSON.stringify({ template_key: generationForm.template_key, input }),
  })
  setLastResponse(result)
  if (result.ok && result.data) textVersions.value = [result.data.text_version, ...textVersions.value]
  else generationError.value = extractErrorMessage(result.error, 'Не удалось сгенерировать текст.')
  isGeneratingText.value = false
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
  window.addEventListener(SESSION_CHANGED_EVENT, syncSession)
  void checkHealth()

  if (hasToken.value) {
    void loadWorkspaces()
  }
})

onBeforeUnmount(() => {
  window.removeEventListener(SESSION_CHANGED_EVENT, syncSession)
})
</script>

<template>
  <main class="app-shell">
    <header class="app-toolbar">
      <a class="brand" href="/" aria-label="PostFlow" @click="openHome">
        <img :src="postFlowLogo" alt="PostFlow" />
      </a>

      <nav class="workflow-nav" aria-label="Этапы создания публикации">
        <button type="button" class="workflow-button" :class="{ active: currentView === 'text' }" @click="openWorkflowStep('text')">
          <span class="workflow-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m14.7 6.5 2.8 2.8M3.5 21h7"/></svg></span>
          <span class="workflow-copy"><strong>Создай текст</strong><small>AI текст для поста</small></span>
        </button>
        <span class="workflow-arrow" aria-hidden="true">→</span>
        <button type="button" class="workflow-button" :class="{ active: currentView === 'image' }" @click="openWorkflowStep('image')">
          <span class="workflow-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 18 5-5 3.5 3.5 2.5-2.5 5 5"/></svg></span>
          <span class="workflow-copy"><strong>Создай изображение</strong><small>AI изображение</small></span>
        </button>
        <span class="workflow-arrow" aria-hidden="true">→</span>
        <button type="button" class="workflow-button" :class="{ active: currentView === 'publish' }" @click="openWorkflowStep('publish')">
          <span class="workflow-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM21 14v3M14 21h3M21 20v1h-1"/></svg></span>
          <span class="workflow-copy"><strong>Собери пост и опубликуй</strong><small>Объедини и настрой автопостинг</small></span>
        </button>
      </nav>

      <div class="auth-actions">
        <template v-if="hasToken">
          <button type="button" class="profile-chip" :title="`Открыть профиль: ${authDisplayName}`" @click="openProfile">
            <span class="profile-avatar" aria-hidden="true">
              <img v-if="avatarDataUrl" :src="avatarDataUrl" alt="" />
              <template v-else>{{ authAvatarLetter }}</template>
            </span>
            <span class="profile-login">{{ authDisplayName }}</span>
          </button>
          <button type="button" class="secondary small logout-button" @click="logout">Выйти</button>
        </template>
        <template v-else>
          <button type="button" class="secondary small login-button" @click="openAuth('login')">Войти</button>
          <button type="button" class="small registration-button" @click="openAuth('register')">Регистрация</button>
        </template>
      </div>
    </header>

    <section v-if="currentView === 'home'" class="hero">
      <div class="hero-copy how-it-works">
        <div class="hero-showcase">
          <div class="hero-pitch">
            <p class="hero-kicker">✦ AI-сервис для контента и автопостинга</p>
            <h1><span>Создавайте.</span><span>Собирайте.</span><span>Публикуйте.</span></h1>
            <p class="hero-intro">PostFlow объединяет весь процесс работы с контентом в одном сервисе — создание текста, изображений, сбор поста и публикация во всех соцсетях.</p>
            <div class="hero-actions">
              <button type="button" @click="openWorkflowStep('text')">✦ Создать пост</button>
              <button type="button" class="hero-secondary" @click="openWorkflowStep('publish')"><span>▶</span> Смотреть видео</button>
            </div>
          </div>
          <div class="hero-visual">
            <img :src="postFlowHeroWorkflow" alt="Создание текста, изображения и готового поста в PostFlow" />
          </div>
        </div>
        <div class="how-grid">
          <article class="how-step">
            <span class="how-icon" aria-hidden="true">✏️</span>
            <div><strong>Создайте текст</strong><p>Опишите тему или идею — AI подготовит текст поста под вашу задачу, аудиторию и стиль.</p></div>
          </article>
          <article class="how-step">
            <span class="how-icon" aria-hidden="true">🖼️</span>
            <div><strong>Создайте изображение</strong><p>Сгенерируйте подходящий визуал для публикации прямо в PostFlow.</p></div>
          </article>
          <article class="how-step">
            <span class="how-icon" aria-hidden="true">✨</span>
            <div><strong>Соберите готовый пост</strong><p>Объедините текст и изображение, отредактируйте результат и посмотрите, как будет выглядеть публикация.</p></div>
          </article>
          <article class="how-step">
            <span class="how-icon" aria-hidden="true">🚀</span>
            <div><strong>Опубликуйте везде</strong><p>Выберите нужные социальные сети и опубликуйте пост сразу или запланируйте его на удобное время.</p></div>
          </article>
        </div>
      </div>

    </section>

    <section v-if="currentView === 'text' || currentView === 'image' || currentView === 'publish'" class="workspace-layout" :class="{ 'focused-layout': currentView === 'text' || currentView === 'image' }">
      <aside v-if="currentView === 'publish'" class="setup-column">
        <article class="panel">
          <div class="panel-title">
            <span class="step">1</span>
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
        <article v-if="currentView === 'publish'" class="panel workspace-panel">
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

        <article v-if="currentView === 'text'" id="text-creation" class="panel content-panel">
          <div class="panel-title">
            <span class="step">2</span>
            <div><h2>Контент-проекты</h2><p>Создавайте публикации и генерируйте версии текста.</p></div>
          </div>
          <form v-if="selectedWorkspace" class="workspace-form" @submit.prevent="createProject">
            <label>Название проекта<input v-model="projectForm.title" type="text" maxlength="160" required /></label>
            <div class="two-columns">
              <label>Тип контента<select v-model="projectForm.content_type">
                <option value="free_form">Свободный</option><option value="before_after">До / после</option>
                <option value="portfolio">Портфолио</option><option value="promotion">Акция</option>
                <option value="educational">Обучающий</option><option value="personal">Личный</option>
                <option value="review">Отзыв</option><option value="service_description">Описание услуги</option>
              </select></label>
              <label>Обложка<select v-model="projectForm.cover_asset_id">
                <option value="">Без обложки</option>
                <option v-for="asset in mediaAssets" :key="asset.id" :value="asset.id">{{ asset.original_name }}</option>
              </select></label>
            </div>
            <button type="submit" :disabled="isCreatingProject">{{ isCreatingProject ? 'Создаю…' : 'Создать проект' }}</button>
          </form>
          <p v-if="projectError" class="error-message">{{ projectError }}</p>
          <div class="project-list">
            <button v-for="project in projects" :key="project.id" type="button" class="project-card" :class="{ active: selectedProject?.id === project.id }" @click="selectProject(project)">
              <strong>{{ project.title }}</strong><span>{{ project.content_type }} · {{ project.status }}</span>
            </button>
            <p v-if="!projects.length && !isLoadingProjects" class="muted">Контент-проектов пока нет.</p>
          </div>
          <div v-if="selectedProject" class="generation-box">
            <div class="asset-list-head"><div><p class="eyebrow">Генерация текста</p><h3>{{ selectedProject.title }}</h3></div><button type="button" class="secondary small" @click="loadTextVersions">Обновить версии</button></div>
            <div class="asset-actions">
              <button type="button" class="secondary small" @click="updateProjectStatus('draft')">Черновик</button>
              <button type="button" class="secondary small" @click="updateProjectStatus('ready')">Готов</button>
              <button type="button" class="secondary small" @click="updateProjectStatus('archived')">В архив</button>
              <button type="button" class="danger small" @click="deleteProject">Удалить проект</button>
            </div>
            <label>Шаблон<select v-model="generationForm.template_key">
              <option value="free_form">Свободный</option><option value="portfolio_post">Пост портфолио</option>
              <option value="promotion">Акция</option><option value="educational_post">Обучающий пост</option><option value="review_post">Пост-отзыв</option>
            </select></label>
            <label>Тема текста<input v-model="generationForm.topic" type="text" maxlength="500" placeholder="Например: летняя акция на маникюр" required /></label>
            <label>Дополнительные параметры (JSON, до 16 КиБ)<textarea v-model="generationForm.input" rows="5" spellcheck="false" /></label>
            <p v-if="generationError" class="error-message">{{ generationError }}</p>
            <button type="button" :disabled="isGeneratingText" @click="generateText">{{ isGeneratingText ? 'Генерирую…' : 'Сгенерировать текст' }}</button>
            <div v-if="textVersions.length" class="text-version-list">
              <article v-for="version in textVersions" :key="version.id" class="text-version"><span>{{ version.source }} · {{ formatDate(version.created_at) }}</span><p>{{ version.body }}</p></article>
            </div>
          </div>
        </article>

        <article v-if="currentView === 'image'" class="panel upload-panel">
          <div class="panel-title">
            <span class="step">2</span>
            <div>
              <h2>Загрузить файл</h2>
              <p>Файл будет привязан к выбранному workspace через media upload API.</p>
            </div>
          </div>

          <div v-if="selectedWorkspace" class="upload-box">
            <label>
              Файл профиля
              <input :key="fileInputKey" type="file" accept="image/*" @change="selectFile" />
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
                @click="loadMediaAssets()"
              >
                {{ isLoadingMedia ? 'Обновляю…' : 'Обновить' }}
              </button>
            </div>

            <p v-if="mediaSummary" class="muted summary-line">
              Всего: {{ mediaSummary.total }} · {{ mediaSummary.statuses.map((item) => `${item.status}: ${item.count}`).join(' · ') }}
            </p>
            <div v-if="mediaAssets.length" class="asset-grid">
              <div v-for="asset in mediaAssets" :key="asset.id" class="asset-card">
                <strong>{{ asset.original_name }}</strong>
                <span>{{ asset.status }} · {{ formatBytes(asset.size_bytes) }}</span>
                <small>{{ asset.mime_type }}</small>
                <code>{{ asset.id }}</code>
                <div class="asset-actions">
                  <button type="button" class="secondary small" :disabled="mediaActionID === asset.id || asset.status !== 'ready'" @click="openAssetUrl(asset, 'thumbnail')">Превью</button>
                  <button type="button" class="secondary small" :disabled="mediaActionID === asset.id || asset.status !== 'ready'" @click="openAssetUrl(asset, 'download')">Скачать</button>
                  <button type="button" class="danger small" :disabled="mediaActionID === asset.id" @click="deleteAsset(asset)">Удалить</button>
                </div>
              </div>
            </div>
            <button v-if="mediaNextCursor" type="button" class="secondary" :disabled="isLoadingMedia" @click="loadMediaAssets(true)">
              {{ isLoadingMedia ? 'Загружаю…' : 'Показать ещё' }}
            </button>
          </div>
        </article>
      </section>
    </section>

    <section v-if="currentView === 'profile'" class="panel profile-page">
      <div>
        <p class="eyebrow">Профиль</p>
        <h2>{{ authDisplayName }}</h2>
        <p class="muted">Здесь можно установить новую аватарку.</p>
      </div>
      <div class="profile-avatar-large">
        <img v-if="avatarDataUrl" :src="avatarDataUrl" alt="Текущая аватарка" />
        <span v-else>{{ authAvatarLetter }}</span>
      </div>
      <label class="avatar-upload">
        Новая аватарка
        <input type="file" accept="image/*" @change="selectAvatar" />
      </label>
      <p class="form-hint">PNG, JPEG или WebP, до 3 МБ.</p>
      <p v-if="avatarError" class="error-message">{{ avatarError }}</p>
    </section>

    <section v-if="currentView === 'home'" class="debug-drawer">
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

    <div v-if="isAuthOpen" class="modal-backdrop" @click.self="isAuthOpen = false">
      <section class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title">
        <div class="modal-header">
          <div>
            <h2 id="auth-title">{{ authMode === 'login' ? 'Вход' : 'Регистрация' }}</h2>
          </div>
          <button type="button" class="icon-button secondary" aria-label="Закрыть" @click="isAuthOpen = false"><span aria-hidden="true">×</span></button>
        </div>

        <div class="auth-tabs">
          <button type="button" :class="{ active: authMode === 'login' }" @click="openAuth('login')">Вход</button>
          <button type="button" :class="{ active: authMode === 'register' }" @click="openAuth('register')">Регистрация</button>
        </div>

        <form v-if="authMode === 'login'" class="auth-form" @submit.prevent="submitLogin">
          <label>
            Email или Логин
            <input v-model="loginForm.identifier" type="text" autocomplete="username" required />
          </label>
          <label>
            Пароль
            <input v-model="loginForm.password" type="password" autocomplete="current-password" />
          </label>
          <p v-if="authNotice" class="success-message">{{ authNotice }}</p>
          <p v-if="authError" class="error-message">{{ authError }}</p>
          <button type="submit" class="full-width" :disabled="isAuthSubmitting">
            {{ isAuthSubmitting ? 'Вхожу…' : 'Войти' }}
          </button>
        </form>

        <form v-else class="auth-form" @submit.prevent="submitRegistration">
          <label>
            Логин
            <input v-model="registerForm.username" type="text" autocomplete="username" required />
          </label>
          <label>
            Email
            <input v-model="registerForm.email" type="email" autocomplete="email" required />
          </label>
          <label>
            Пароль
            <input v-model="registerForm.password" type="password" autocomplete="new-password" required />
          </label>
          <label>
            Повторите пароль
            <input v-model="registerPasswordConfirmation" type="password" autocomplete="new-password" required />
          </label>
          <p v-if="authError" class="error-message">{{ authError }}</p>
          <button type="submit" class="full-width" :disabled="isAuthSubmitting">
            {{ isAuthSubmitting ? 'Создаю аккаунт…' : 'Зарегистрироваться' }}
          </button>
        </form>
      </section>
    </div>
  </main>
</template>
