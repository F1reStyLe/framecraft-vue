<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

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
const colorTheme = ref<'light' | 'dark'>((localStorage.getItem('framecraft.theme') as 'light' | 'dark' | null) ?? 'light')
watch(colorTheme, (theme) => {
  document.documentElement.dataset.theme = theme
  localStorage.setItem('framecraft.theme', theme)
}, { immediate: true })
const avatarDataUrl = ref(localStorage.getItem('framecraft.avatar') || '')
const avatarError = ref('')
const avatarFileName = ref('Файл не выбран')
const loginForm = reactive({ identifier: '', password: '' })
const registerForm = reactive<RegisterPayload>({ username: '', email: '', password: '' })
const registerPasswordConfirmation = ref('')

interface GptProfileSettings {
  name: string; occupation: string; services: string; city: string; address: string; audiences: string[]
  ageMin: number; ageMax: number; advantage: string; addressStyle: '' | 'ты' | 'вы'
  emojiLevel: '' | 'none' | 'few' | 'medium' | 'many'; useHashtags: '' | 'yes' | 'no'
  forbiddenTopics: string; postSignature: string; contacts: string; bookingUrl: string
}
const defaultGptProfile: GptProfileSettings = {
  name: '', occupation: '', services: '', city: '', address: '', audiences: [], ageMin: 18, ageMax: 65,
  advantage: '', addressStyle: '', emojiLevel: '', useHashtags: '',
  forbiddenTopics: '', postSignature: '', contacts: '', bookingUrl: '',
}
const storedGptProfile = localStorage.getItem('framecraft.gpt-profile')
const gptProfile = reactive<GptProfileSettings>({ ...defaultGptProfile, ...(storedGptProfile ? JSON.parse(storedGptProfile) as Partial<GptProfileSettings> : {}) })
const gptProfileSaved = ref(false)
const audienceOptions = ['Дети', 'Подростки', 'Женщины', 'Мужчины', 'Старшее поколение']
const openProfileSelect = ref<'address' | 'emoji' | 'hashtags' | null>(null)
const addressOptions = [{ value: '', label: 'не выбрано' }, { value: 'ты', label: 'на ТЫ' }, { value: 'вы', label: 'на ВЫ' }] as const
const emojiOptions = [{ value: '', label: 'не выбрано' }, { value: 'none', label: 'нет' }, { value: 'few', label: 'немного' }, { value: 'medium', label: 'средне' }, { value: 'many', label: 'много' }] as const
const hashtagOptions = [{ value: '', label: 'не выбрано' }, { value: 'yes', label: 'да' }, { value: 'no', label: 'нет' }] as const

function selectedOptionLabel(options: ReadonlyArray<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? 'Не выбрано'
}

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
const defaultPostGoals = [
  'Получить записи', 'Показать работу', 'Продать услугу', 'Привлечь новых клиентов',
  'Повысить доверие', 'Показать экспертность', 'Дать полезную информацию', 'Вовлечь аудиторию',
  'Рассказать о себе', 'Поделиться новостью', 'Рассказать об акции',
]
const postGoalGroups = [
  { title: 'Продажи и клиенты', goals: ['Получить записи', 'Продать услугу', 'Продать товар', 'Рассказать об акции', 'Заполнить свободные окна', 'Привлечь новых клиентов', 'Вернуть старых клиентов', 'Предложить дополнительную услугу', 'Анонсировать новую услугу'] },
  { title: 'Работы и портфолио', goals: ['Показать работу', 'Показать результат «до / после»', 'Показать процесс работы', 'Показать необычный случай', 'Продемонстрировать мастерство', 'Показать разнообразие работ', 'Рассказать историю клиента'] },
  { title: 'Доверие и экспертность', goals: ['Повысить доверие', 'Показать экспертность', 'Дать полезную информацию', 'Дать полезный совет', 'Ответить на частый вопрос', 'Развеять миф', 'Объяснить процедуру / услугу', 'Рассказать об используемых материалах', 'Объяснить цену', 'Рассказать о безопасности и качестве', 'Поделиться профессиональным мнением'] },
  { title: 'Вовлечение', goals: ['Вовлечь аудиторию', 'Получить комментарии', 'Задать вопрос аудитории', 'Провести опрос', 'Начать обсуждение', 'Узнать мнение подписчиков', 'Предложить выбрать вариант', 'Получить реакции', 'Побудить сохранить пост', 'Побудить поделиться постом'] },
  { title: 'Личный бренд', goals: ['Рассказать о себе', 'Познакомиться с аудиторией', 'Рассказать свою историю', 'Поделиться личным опытом', 'Рассказать о ценностях', 'Показать себя за работой', 'Показать закулисье', 'Поделиться достижением', 'Рассказать об обучении / повышении квалификации', 'Познакомить с командой'] },
  { title: 'Информационные', goals: ['Поделиться новостью', 'Сообщить новость', 'Анонсировать событие', 'Рассказать об изменениях', 'Сообщить новый график', 'Рассказать о новом месте / кабинете', 'Объяснить правила записи', 'Напомнить важную информацию', 'Ответить сразу на несколько вопросов'] },
]
const savedPostGoals = localStorage.getItem('framecraft.favorite-post-goals')
const favoritePostGoals = ref<string[]>((savedPostGoals ? JSON.parse(savedPostGoals) as string[] : [...defaultPostGoals]).filter((goal) => goal !== 'Другое'))
const selectedPostGoal = ref('')
const customPostGoal = ref('')
const isPostGoalSettingsOpen = ref(false)
const isPostGoalSelectOpen = ref(false)
const predefinedPostGoals = new Set(postGoalGroups.flatMap((group) => group.goals))
const customPostGoals = computed(() => favoritePostGoals.value.filter((goal) => !predefinedPostGoals.has(goal)))

function toggleFavoritePostGoal(goal: string) {
  favoritePostGoals.value = favoritePostGoals.value.includes(goal)
    ? favoritePostGoals.value.filter((item) => item !== goal)
    : [...favoritePostGoals.value, goal]
}

function saveCustomPostGoal() {
  const goal = customPostGoal.value.trim()
  if (!goal || goal === 'Другое') return
  if (!favoritePostGoals.value.includes(goal)) favoritePostGoals.value = [...favoritePostGoals.value, goal]
  selectedPostGoal.value = goal
  customPostGoal.value = ''
}

function deleteCustomPostGoal(goal: string) {
  if (!window.confirm(`Удалить цель «${goal}»?`)) return
  favoritePostGoals.value = favoritePostGoals.value.filter((item) => item !== goal)
  if (selectedPostGoal.value === goal) selectedPostGoal.value = ''
}

watch(favoritePostGoals, (goals) => {
  localStorage.setItem('framecraft.favorite-post-goals', JSON.stringify(goals))
  if (selectedPostGoal.value && selectedPostGoal.value !== 'Другое' && !goals.includes(selectedPostGoal.value)) selectedPostGoal.value = ''
}, { deep: true })
const isGeneratingText = ref(false)
const isImprovingIdea = ref(false)
const isImproveIdeaEnabled = ref(false)
const generationError = ref('')
const chatScroll = ref<HTMLElement | null>(null)
const chatTextarea = ref<HTMLTextAreaElement | null>(null)
const isListening = ref(false)
const speechError = ref('')

interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean }>
  resultIndex: number
}

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: Event & { error?: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike
let speechRecognition: SpeechRecognitionLike | null = null

interface ChatPrompt {
  id: string
  projectID: string
  body: string
  createdAt: string
}

const chatPrompts = ref<ChatPrompt[]>(JSON.parse(localStorage.getItem('framecraft.chat-prompts') || '[]'))

const chatMessages = computed(() => {
  if (!selectedProject.value) return []
  const prompts = chatPrompts.value
    .filter((message) => message.projectID === selectedProject.value?.id)
    .map((message) => ({ id: message.id, role: 'user' as const, body: message.body, createdAt: message.createdAt }))
  const answers = textVersions.value.map((version) => ({ id: version.id, role: 'assistant' as const, body: version.body, createdAt: version.created_at }))
  return [...prompts, ...answers].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
})
const effectivePostGoal = computed(() => selectedPostGoal.value === 'Другое' ? customPostGoal.value.trim() : selectedPostGoal.value)
const canEnableImproveIdea = computed(() => Boolean(generationForm.topic.trim() || effectivePostGoal.value))

watch(canEnableImproveIdea, (canEnable) => {
  if (!canEnable && !isGeneratingText.value) isImproveIdeaEnabled.value = false
})

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

function openIntroVideo() {
  window.open('https://www.youtube.com/watch?v=DeQqqlzgxfI', '_blank', 'noopener,noreferrer')
}

function selectAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  avatarError.value = ''

  if (!file) return
  avatarFileName.value = file.name
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
  await scrollChatToBottom('auto')
}

function toggleAudience(audience: string) {
  const index = gptProfile.audiences.indexOf(audience)
  if (index >= 0) gptProfile.audiences.splice(index, 1)
  else gptProfile.audiences.push(audience)
}

function saveGptProfile() {
  localStorage.setItem('framecraft.gpt-profile', JSON.stringify(gptProfile))
  gptProfileSaved.value = true
  window.setTimeout(() => { gptProfileSaved.value = false }, 2500)
}

function setMinimumAge(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  gptProfile.ageMin = Math.min(value, gptProfile.ageMax - 1)
}

function setMaximumAge(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  gptProfile.ageMax = Math.max(value, gptProfile.ageMin + 1)
}

function saveChatPrompts() {
  localStorage.setItem('framecraft.chat-prompts', JSON.stringify(chatPrompts.value))
}

async function scrollChatToBottom(behavior: ScrollBehavior = 'smooth') {
  await nextTick()
  const chat = chatScroll.value
  if (!chat) return
  if (behavior === 'auto') {
    chat.style.scrollBehavior = 'auto'
    chat.scrollTop = chat.scrollHeight
    requestAnimationFrame(() => { chat.style.scrollBehavior = '' })
    return
  }
  chat.scrollTo({ top: chat.scrollHeight, behavior })
}

watch(
  () => [currentView.value, selectedProject.value?.id, chatMessages.value.length],
  async () => {
    if (currentView.value === 'text') await scrollChatToBottom('auto')
  },
  { flush: 'post' },
)

function handleChatKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    void generateText()
  }
}

function resizeChatTextarea() {
  const textarea = chatTextarea.value
  if (!textarea) return
  textarea.style.height = 'auto'
  const styles = window.getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(styles.lineHeight) || 24
  const verticalPadding = Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
  const maxHeight = lineHeight * 10 + verticalPadding
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function toggleSpeechInput() {
  if (isListening.value) {
    speechRecognition?.stop()
    return
  }

  const speechWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
  const Recognition = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
  speechError.value = ''

  if (!Recognition) {
    speechError.value = 'Ваш браузер не поддерживает голосовой ввод.'
    return
  }

  speechRecognition = new Recognition()
  speechRecognition.lang = 'ru-RU'
  speechRecognition.continuous = true
  speechRecognition.interimResults = false
  speechRecognition.onresult = (event) => {
    let transcript = ''
    for (let index = event.resultIndex; index < event.results.length; index += 1) {
      if (event.results[index].isFinal) transcript += event.results[index][0].transcript
    }
    if (!transcript.trim()) return
    const separator = generationForm.topic.trim() ? ' ' : ''
    generationForm.topic += `${separator}${transcript.trim()}`
    void nextTick(resizeChatTextarea)
  }
  speechRecognition.onerror = (event) => {
    isListening.value = false
    speechError.value = event.error === 'not-allowed'
      ? 'Разрешите доступ к микрофону в настройках браузера.'
      : 'Не удалось распознать речь. Попробуйте ещё раз.'
  }
  speechRecognition.onend = () => { isListening.value = false }

  try {
    speechRecognition.start()
    isListening.value = true
  } catch {
    speechError.value = 'Не удалось включить микрофон.'
  }
}

async function generateText() {
  if (!selectedProject.value) return
  if (isImproveIdeaEnabled.value) {
    await improveIdea()
    return
  }
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
  input.profile = { ...gptProfile }
  input.conversation = chatMessages.value.slice(-8).map(({ role, body }) => ({ role, body }))
  const postGoal = selectedPostGoal.value === 'Другое' ? customPostGoal.value.trim() : selectedPostGoal.value
  if (postGoal) input.post_goal = postGoal
  if (new TextEncoder().encode(JSON.stringify(input)).length > 16 * 1024) {
    generationError.value = 'JSON input превышает ограничение 16 КиБ.'
    return
  }
  isGeneratingText.value = true
  generationError.value = ''
  const prompt: ChatPrompt = {
    id: `prompt-${Date.now()}`,
    projectID: selectedProject.value.id,
    body: generationForm.topic.trim(),
    createdAt: new Date().toISOString(),
  }
  chatPrompts.value.push(prompt)
  saveChatPrompts()
  generationForm.topic = ''
  await nextTick()
  resizeChatTextarea()
  await scrollChatToBottom()
  const result = await apiRequest<CreateTextGenerationResponse>('POST', `/v1/content-projects/${selectedProject.value.id}/text-generations`, {
    token: savedToken.value,
    body: JSON.stringify({ template_key: generationForm.template_key, input }),
  })
  setLastResponse(result)
  if (result.ok && result.data) textVersions.value = [result.data.text_version, ...textVersions.value]
  else generationError.value = extractErrorMessage(result.error, 'Не удалось сгенерировать текст.')
  isGeneratingText.value = false
  await scrollChatToBottom()
}

async function improveIdea() {
  if (!selectedProject.value) return
  const idea = generationForm.topic.trim()
  const postGoal = effectivePostGoal.value
  if (!idea && !postGoal) {
    generationError.value = 'Напишите идею или выберите цель поста.'
    return
  }

  const input: Record<string, unknown> = {
    mode: 'clarify_idea',
    topic: idea || postGoal,
    draft_idea: idea,
    profile: { ...gptProfile },
    post_goal: postGoal || undefined,
    conversation: chatMessages.value.slice(-8).map(({ role, body }) => ({ role, body })),
    instruction: 'Не создавай готовый пост. Проанализируй идею и профиль автора, определи, какой важной информации не хватает, и задай только 2–3 конкретных полезных вопроса. Не задавай вопросы, ответы на которые уже есть в профиле или истории диалога.',
  }
  if (new TextEncoder().encode(JSON.stringify(input)).length > 16 * 1024) {
    generationError.value = 'Данные для улучшения идеи превышают ограничение 16 КиБ.'
    return
  }

  isGeneratingText.value = true
  isImprovingIdea.value = true
  generationError.value = ''
  chatPrompts.value.push({ id: `prompt-${Date.now()}`, projectID: selectedProject.value.id, body: idea || `Цель поста: ${postGoal}`, createdAt: new Date().toISOString() })
  saveChatPrompts()
  generationForm.topic = ''
  await nextTick()
  resizeChatTextarea()
  await scrollChatToBottom()

  const result = await apiRequest<CreateTextGenerationResponse>('POST', `/v1/content-projects/${selectedProject.value.id}/text-generations`, {
    token: savedToken.value,
    body: JSON.stringify({ template_key: 'free_form', input }),
  })
  setLastResponse(result)
  if (result.ok && result.data) {
    textVersions.value = [result.data.text_version, ...textVersions.value]
    isImproveIdeaEnabled.value = false
  }
  else generationError.value = extractErrorMessage(result.error, 'Не удалось улучшить идею.')
  isGeneratingText.value = false
  isImprovingIdea.value = false
  await scrollChatToBottom()
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
  speechRecognition?.stop()
})
</script>

<template>
  <main class="app-shell" :class="{ 'text-view': currentView === 'text', 'home-view': currentView === 'home' }">
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
              <button type="button" class="hero-secondary" @click="openIntroVideo"><span>▶</span> Смотреть видео</button>
            </div>
          </div>
          <div class="hero-visual">
            <img :src="postFlowHeroWorkflow" alt="Создание текста, изображения и готового поста в PostFlow" />
          </div>
        </div>
        <div class="how-grid">
          <article class="how-step">
            <span class="how-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m14.7 6.5 2.8 2.8"/></svg></span>
            <div><strong>Создайте текст</strong><p>Опишите тему или идею — AI подготовит текст поста под вашу задачу, аудиторию и стиль.</p></div>
          </article>
          <article class="how-step">
            <span class="how-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 18 5-5 3.5 3.5 2.5-2.5 5 5"/></svg></span>
            <div><strong>Создайте изображение</strong><p>Сгенерируйте уникальный визуал для публикации прямо в PostFlow.</p></div>
          </article>
          <article class="how-step">
            <span class="how-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2c.8 5.3 2.7 7.2 8 8-5.3.8-7.2 2.7-8 8-.8-5.3-2.7-7.2-8-8 5.3-.8 7.2-2.7 8-8Z"/><path d="M19 16c.3 2 1 2.7 3 3-2 .3-2.7 1-3 3-.3-2-1-2.7-3-3 2-.3 2.7-1 3-3Z"/></svg></span>
            <div><strong>Соберите готовый пост</strong><p>Объедините текст и изображение, отредактируйте результат и посмотрите, как будет выглядеть публикация.</p></div>
          </article>
          <article class="how-step">
            <span class="how-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m22 2-7 20-4-9-9-4 20-7Z"/><path d="M22 2 11 13"/></svg></span>
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

        <article v-if="currentView === 'text'" id="text-creation" class="text-chat">
          <header class="chat-header">
            <div class="chat-heading"><span class="ai-avatar">✦</span><div><h2>Создай текст</h2><p>{{ selectedProject ? selectedProject.title : 'AI-помощник для ваших публикаций' }}</p></div></div>
          </header>

          <div v-if="!selectedProject" class="chat-empty-setup">
            <span class="empty-sparkle">✦</span><h2>О чём напишем сегодня?</h2>
            <p>PostFlow превратит вашу идею в готовый пост.</p>
            <form v-if="selectedWorkspace" class="new-chat-project" @submit.prevent="createProject">
              <input v-model="projectForm.title" type="text" maxlength="160" placeholder="Название проекта" required />
              <button type="submit" :disabled="isCreatingProject">{{ isCreatingProject ? 'Создаю…' : 'Создать проект' }}</button>
            </form>
            <p v-else class="error-message">Войдите в аккаунт — и создавайте контент легко, быстро и с вдохновением.</p>
            <p v-if="projectError" class="error-message">{{ projectError }}</p>
          </div>

          <template v-else>
            <div ref="chatScroll" class="chat-history" aria-live="polite">
              <div v-if="!chatMessages.length" class="chat-welcome">
                <span class="ai-avatar large">✦</span><h3>Привет! Я помогу создать текст</h3>
                <p>Опишите тему, задачу или идею публикации. Можно указать аудиторию, тон и важные детали.</p>
              </div>
              <article v-for="message in chatMessages" :key="message.id" class="chat-row" :class="message.role">
                <span v-if="message.role === 'assistant'" class="message-avatar">✦</span>
                <div class="chat-message"><p>{{ message.body }}</p><time>{{ formatDate(message.createdAt) }}</time></div>
                <span v-if="message.role === 'user'" class="message-avatar user-avatar">{{ authAvatarLetter }}</span>
              </article>
              <article v-if="isGeneratingText" class="chat-row assistant">
                <span class="message-avatar">✦</span><div class="chat-message typing"><i></i><i></i><i></i></div>
              </article>
            </div>
            <footer class="chat-composer-wrap">
              <p v-if="generationError" class="error-message chat-error">{{ generationError }}</p>
              <p v-if="speechError" class="error-message chat-error">{{ speechError }}</p>
              <div class="post-goal-control">
                <div class="improve-idea-control">
                  <button type="button" class="improve-idea-switch" :class="{ active: isImproveIdeaEnabled }" role="switch" aria-label="Улучшить идею" :aria-checked="isImproveIdeaEnabled" :data-tooltip="isGeneratingText ? 'Дождитесь завершения текущего ответа.' : canEnableImproveIdea ? (isImproveIdeaEnabled ? 'Улучшение идеи включено. При отправке AI задаст 2–3 вопроса.' : 'Включить улучшение идеи перед отправкой.') : 'Чтобы включить улучшение идеи, выберите цель поста или напишите текст.'" :disabled="isGeneratingText || !canEnableImproveIdea" @click="isImproveIdeaEnabled = !isImproveIdeaEnabled">
                    <span aria-hidden="true"></span>
                  </button>
                  <span>Улучшить идею</span>
                </div>
                <div class="post-goal-field">
                  <label>Цель поста</label>
                  <div v-if="selectedPostGoal === 'Другое'" class="custom-post-goal-inline">
                    <input v-model="customPostGoal" class="custom-post-goal" type="text" maxlength="160" placeholder="Напишите свою цель" autofocus @keydown.enter.prevent="saveCustomPostGoal" />
                    <button type="button" class="save-custom-post-goal" aria-label="Сохранить цель" data-tooltip="Сохранить" :disabled="!customPostGoal.trim()" @click="saveCustomPostGoal">✓</button>
                  </div>
                  <div v-else class="profile-custom-select post-goal-select" :class="{ open: isPostGoalSelectOpen }">
                    <button type="button" class="custom-select-trigger" :class="{ placeholder: !selectedPostGoal }" :aria-expanded="isPostGoalSelectOpen" @click="isPostGoalSelectOpen = !isPostGoalSelectOpen">
                      <span>{{ selectedPostGoal || 'Выберите цель' }}</span><i></i>
                    </button>
                    <div v-if="isPostGoalSelectOpen" class="custom-select-menu">
                      <button type="button" class="placeholder" :class="{ selected: !selectedPostGoal }" @click="selectedPostGoal = ''; isPostGoalSelectOpen = false">Выберите цель<span v-if="!selectedPostGoal">✓</span></button>
                      <button v-for="goal in favoritePostGoals" :key="goal" type="button" :class="{ selected: selectedPostGoal === goal }" @click="selectedPostGoal = goal; isPostGoalSelectOpen = false">{{ goal }}<span v-if="selectedPostGoal === goal">✓</span></button>
                      <button type="button" :class="{ selected: selectedPostGoal === 'Другое' }" @click="selectedPostGoal = 'Другое'; isPostGoalSelectOpen = false">Другое<span v-if="selectedPostGoal === 'Другое'">✓</span></button>
                    </div>
                  </div>
                  <button type="button" class="post-goal-settings-button" aria-label="Настроить список" data-tooltip="Настроить список" :aria-expanded="isPostGoalSettingsOpen" @click="isPostGoalSettingsOpen = !isPostGoalSettingsOpen">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06a1.7 1.7 0 0 0-1.88-.34 1.7 1.7 0 0 0-1.03 1.56V21h-4v-.08A1.7 1.7 0 0 0 8.95 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.58 15 1.7 1.7 0 0 0 3 14H3v-4h.08A1.7 1.7 0 0 0 4.6 8.95a1.7 1.7 0 0 0-.34-1.88L4.2 7l2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.58 1.7 1.7 0 0 0 10 3h4v.08a1.7 1.7 0 0 0 1.03 1.52 1.7 1.7 0 0 0 1.88-.34l.06-.06L19.8 7l-.06.06A1.7 1.7 0 0 0 19.4 9 1.7 1.7 0 0 0 21 10h.08v4H21a1.7 1.7 0 0 0-1.6 1Z"/></svg>
                  </button>
                </div>
              </div>
              <Teleport to="body">
                <div v-if="isPostGoalSettingsOpen" class="post-goal-modal-backdrop" role="presentation" @click.self="isPostGoalSettingsOpen = false">
                  <section class="post-goal-modal" role="dialog" aria-modal="true" aria-labelledby="post-goal-modal-title">
                    <header class="post-goal-modal-header">
                      <div class="post-goal-catalog-heading"><strong id="post-goal-modal-title">Добавьте частые цели поста</strong><small>Отмеченные варианты появятся в основном списке.</small></div>
                      <button type="button" class="post-goal-modal-close" aria-label="Закрыть" @click="isPostGoalSettingsOpen = false">×</button>
                    </header>
                    <div class="post-goal-catalog">
                      <div class="post-goal-groups">
                        <section v-for="group in postGoalGroups" :key="group.title" class="post-goal-group">
                          <h3>{{ group.title }}</h3>
                          <label v-for="goal in group.goals" :key="goal">
                            <input type="checkbox" :checked="favoritePostGoals.includes(goal)" @change="toggleFavoritePostGoal(goal)" />
                            <span>{{ goal }}</span>
                          </label>
                        </section>
                        <section class="post-goal-group custom-goal-group">
                          <h3>Другое</h3>
                          <p v-if="!customPostGoals.length" class="custom-goals-empty">Здесь появятся цели, которые вы добавите вручную.</p>
                          <div v-for="goal in customPostGoals" :key="goal" class="custom-goal-item">
                            <span>{{ goal }}</span>
                            <button type="button" aria-label="Удалить цель" :title="`Удалить «${goal}»`" @click="deleteCustomPostGoal(goal)">×</button>
                          </div>
                        </section>
                      </div>
                    </div>
                    <footer class="post-goal-modal-footer"><button type="button" @click="isPostGoalSettingsOpen = false">Готово</button></footer>
                  </section>
                </div>
              </Teleport>
              <div class="chat-composer">
                <textarea ref="chatTextarea" v-model="generationForm.topic" rows="1" placeholder="Напишите, какой текст хотите создать…" aria-label="Сообщение" @input="resizeChatTextarea" @keydown="handleChatKeydown" />
                <button type="button" class="mic-button" :class="{ listening: isListening }" :aria-label="isListening ? 'Остановить голосовой ввод' : 'Начать голосовой ввод'" :title="isListening ? 'Остановить запись' : 'Голосовой ввод'" @click="toggleSpeechInput">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg>
                </button>
                <button type="button" class="send-button" :disabled="isGeneratingText || (!generationForm.topic.trim() && !(isImproveIdeaEnabled && effectivePostGoal))" aria-label="Отправить сообщение" @click="generateText">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 14-7-4 14-3-6-7-1Z"/><path d="m12 13 7-8"/></svg>
                </button>
              </div>
              <small>Enter — отправить · Shift + Enter — новая строка</small>
            </footer>
          </template>
        </article>

        <article v-if="false" class="panel content-panel">
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
            <div class="asset-list-head"><div><p class="eyebrow">Генерация текста</p><h3>{{ selectedProject?.title }}</h3></div><button type="button" class="secondary small" @click="loadTextVersions">Обновить версии</button></div>
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

    <section v-if="currentView === 'profile'" class="profile-layout">
      <aside class="panel profile-sidebar">
        <div class="profile-avatar-large"><img v-if="avatarDataUrl" :src="avatarDataUrl" alt="Текущая аватарка" /><span v-else>{{ authAvatarLetter }}</span></div>
        <div><p class="eyebrow">Профиль</p><h2>{{ authDisplayName }}</h2></div>
        <label class="avatar-upload">Новая аватарка<span class="avatar-file-picker">Выбрать файл</span><input type="file" accept="image/*" @change="selectAvatar" /><small>{{ avatarFileName }}</small></label>
        <p class="form-hint">PNG, JPEG или WebP, до 3 МБ.</p><p v-if="avatarError" class="error-message">{{ avatarError }}</p>
        <div class="theme-setting">
          <span>Тёмная тема</span>
          <button type="button" class="theme-switch" :class="{ active: colorTheme === 'dark' }" role="switch" :aria-checked="colorTheme === 'dark'" :aria-label="colorTheme === 'dark' ? 'Включить светлую тему' : 'Включить тёмную тему'" @click="colorTheme = colorTheme === 'dark' ? 'light' : 'dark'"><span></span></button>
        </div>
      </aside>
      <form class="panel gpt-profile-form" @submit.prevent="saveGptProfile">
        <header class="gpt-profile-header"><div><p class="eyebrow">Персонализация AI</p><h2>Настройки для профессиональных текстов</h2><p class="muted">GPT будет учитывать эти данные при создании каждого ответа.</p></div><span class="ai-avatar">✦</span></header>
        <div class="profile-fields two-columns">
          <label>Как вас зовут?<input v-model="gptProfile.name" type="text" placeholder="Например, Анна" /></label>
          <label>Чем вы занимаетесь?<input v-model="gptProfile.occupation" type="text" placeholder="Мастер маникюра, фотограф…" /></label>
          <label>Какие услуги оказываете?<input v-model="gptProfile.services" type="text" placeholder="Перечислите основные услуги" /></label>
          <label>Город<input v-model="gptProfile.city" type="text" placeholder="Москва" /></label>
          <label class="full-span">Адрес<input v-model="gptProfile.address" type="text" placeholder="Улица, дом, район или ориентир" /></label>
        </div>
        <div class="audience-settings">
          <fieldset><legend>Кто ваши клиенты?</legend><div class="audience-options"><label v-for="audience in audienceOptions" :key="audience" class="check-chip" :class="{ active: gptProfile.audiences.includes(audience) }"><input type="checkbox" :checked="gptProfile.audiences.includes(audience)" @change="toggleAudience(audience)" />{{ audience }}</label></div></fieldset>
          <fieldset class="age-range"><legend>Возраст: {{ gptProfile.ageMin }}–{{ gptProfile.ageMax }} лет</legend><div class="dual-range" :style="{ '--age-min': `${gptProfile.ageMin / 90 * 100}%`, '--age-max': `${gptProfile.ageMax / 90 * 100}%` }"><div class="range-track"></div><input :value="gptProfile.ageMin" type="range" min="0" max="90" aria-label="Минимальный возраст" @input="setMinimumAge" /><input :value="gptProfile.ageMax" type="range" min="0" max="90" aria-label="Максимальный возраст" @input="setMaximumAge" /></div><div class="range-labels"><span>0 лет</span><span>90 лет</span></div></fieldset>
        </div>
        <label>В чём ваше преимущество?<textarea v-model="gptProfile.advantage" rows="3" placeholder="Опишите опыт, подход, особенности и сильные стороны" /></label>
        <div class="profile-fields three-columns">
          <label>Обращение к аудитории<div class="profile-custom-select" :class="{ open: openProfileSelect === 'address' }"><button type="button" class="custom-select-trigger" :class="{ placeholder: !gptProfile.addressStyle }" @click="openProfileSelect = openProfileSelect === 'address' ? null : 'address'"><span>{{ selectedOptionLabel(addressOptions, gptProfile.addressStyle) }}</span><i></i></button><div v-if="openProfileSelect === 'address'" class="custom-select-menu"><button v-for="option in addressOptions" :key="option.value" type="button" :class="{ selected: gptProfile.addressStyle === option.value, placeholder: !option.value }" @click="gptProfile.addressStyle = option.value; openProfileSelect = null">{{ option.label }}<span v-if="gptProfile.addressStyle === option.value">✓</span></button></div></div></label>
          <label>Использовать эмодзи?<div class="profile-custom-select" :class="{ open: openProfileSelect === 'emoji' }"><button type="button" class="custom-select-trigger" :class="{ placeholder: !gptProfile.emojiLevel }" @click="openProfileSelect = openProfileSelect === 'emoji' ? null : 'emoji'"><span>{{ selectedOptionLabel(emojiOptions, gptProfile.emojiLevel) }}</span><i></i></button><div v-if="openProfileSelect === 'emoji'" class="custom-select-menu"><button v-for="option in emojiOptions" :key="option.value" type="button" :class="{ selected: gptProfile.emojiLevel === option.value, placeholder: !option.value }" @click="gptProfile.emojiLevel = option.value; openProfileSelect = null">{{ option.label }}<span v-if="gptProfile.emojiLevel === option.value">✓</span></button></div></div></label>
          <label>Использовать хэштеги?<div class="profile-custom-select" :class="{ open: openProfileSelect === 'hashtags' }"><button type="button" class="custom-select-trigger" :class="{ placeholder: !gptProfile.useHashtags }" @click="openProfileSelect = openProfileSelect === 'hashtags' ? null : 'hashtags'"><span>{{ selectedOptionLabel(hashtagOptions, gptProfile.useHashtags) }}</span><i></i></button><div v-if="openProfileSelect === 'hashtags'" class="custom-select-menu"><button v-for="option in hashtagOptions" :key="option.value" type="button" :class="{ selected: gptProfile.useHashtags === option.value, placeholder: !option.value }" @click="gptProfile.useHashtags = option.value; openProfileSelect = null">{{ option.label }}<span v-if="gptProfile.useHashtags === option.value">✓</span></button></div></div></label>
        </div>
        <div class="profile-fields two-columns">
          <label>Что нельзя писать?<textarea v-model="gptProfile.forbiddenTopics" rows="2" placeholder="Стоп-слова, темы и обещания" /></label>
          <label>Как подписывать посты?<textarea v-model="gptProfile.postSignature" rows="2" placeholder="Имя, бренд или готовая подпись" /></label>
          <label>Контакты<input v-model="gptProfile.contacts" type="text" placeholder="Телефон, Telegram, WhatsApp" /></label>
          <label>Ссылка для записи<input v-model="gptProfile.bookingUrl" type="url" placeholder="https://…" /></label>
        </div>
        <div class="profile-save-row"><p v-if="gptProfileSaved" class="success-message">Настройки сохранены</p><button type="submit">Сохранить настройки</button></div>
      </form>
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
