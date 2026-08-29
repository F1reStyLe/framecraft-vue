<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'

import { apiRequest, buildApiUrl } from '@/api'
import { loadAppNavigationState, saveAppNavigationState } from '@/app-state'
import { authRequest } from '@/auth-api'
import AppHeader from '@/components/AppHeader.vue'
import HomeHero from '@/components/HomeHero.vue'
import MediaLibrary from '@/components/MediaLibrary.vue'
import TextChat from '@/components/TextChat.vue'
import {
  createChatGeneration,
  loadChatMessages,
  loadProfile,
  updateProfile,
  type BrandProfileDTO,
} from '@/profile-chat-api'
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  saveSession as persistSession,
  SESSION_CHANGED_EVENT,
} from '@/session'
import { loadUserProfile, uploadUserAvatar } from '@/user-profile-api'
import type {
  ApiResult,
  AppView,
  ChatMessage,
  CompleteMediaUploadResponse,
  ContentProject,
  CreateMediaDownloadURLResponse,
  CreateMediaThumbnailURLResponse,
  CreateMediaUploadResponse,
  GptProfileSettings,
  ListContentProjectsResponse,
  ListMediaAssetsResponse,
  MediaAsset,
  MediaAssetsSummaryResponse,
  RegisterPayload,
  TextTemplateKey,
  TokenResponse,
  Workspace,
} from '@/types'

const initialNavigationState = loadAppNavigationState()
const savedToken = ref(getAccessToken())
const refreshToken = ref(getRefreshToken())
const savedLogin = ref(localStorage.getItem('framecraft.login') || '')
const tokenMessage = ref('')
const authMode = ref<'login' | 'register'>('login')
const isAuthOpen = ref(false)
const isAuthSubmitting = ref(false)
const authError = ref('')
const authNotice = ref('')
const authModal = ref<HTMLElement | null>(null)
let authTrigger: HTMLElement | null = null
const currentView = ref<AppView>(initialNavigationState.view)
const avatarDataUrl = ref('')
const avatarError = ref('')
const avatarFileName = ref('Файл не выбран')
const isLoadingAvatar = ref(false)
const isUploadingAvatar = ref(false)
const isAvatarModalOpen = ref(false)
const avatarModal = ref<HTMLElement | null>(null)
const avatarEditorCanvas = ref<HTMLCanvasElement | null>(null)
const avatarEditorImage = ref<HTMLImageElement | null>(null)
const avatarEditorZoom = ref(1)
const avatarEditorRotation = ref(0)
const avatarEditorOffset = reactive({ x: 0, y: 0 })
let avatarEditorObjectUrl = ''
let avatarTrigger: HTMLElement | null = null
let avatarDragPointer: number | null = null
let avatarDragPosition = { x: 0, y: 0 }
const loginForm = reactive({ identifier: '', password: '' })
const registerForm = reactive<RegisterPayload>({ username: '', email: '', password: '' })
const registerPasswordConfirmation = ref('')

const defaultGptProfile: GptProfileSettings = {
  name: '', occupation: '', services: '', city: '', address: '', audiences: [], ageMin: 18, ageMax: 65,
  advantage: '', addressStyle: '', emojiLevel: '', useHashtags: '',
  forbiddenTopics: '', postSignature: '', contacts: '', bookingUrl: '',
}
const gptProfile = reactive<GptProfileSettings>({
  ...defaultGptProfile,
})
const gptProfileSaved = ref(false)
const isLoadingProfile = ref(false)
const isSavingProfile = ref(false)
const profileError = ref('')
const brandProfileSource = ref<BrandProfileDTO | null>(null)
const audienceOptions = ['Дети', 'Подростки', 'Женщины', 'Мужчины', 'Старшее поколение']
const openProfileSelect = ref<'address' | 'emoji' | 'hashtags' | null>(null)
const addressOptions = [{ value: '', label: 'не выбрано' }, { value: 'ты', label: 'на ТЫ' }, { value: 'вы', label: 'на ВЫ' }] as const
const emojiOptions = [{ value: '', label: 'не выбрано' }, { value: 'none', label: 'нет' }, { value: 'few', label: 'немного' }, { value: 'medium', label: 'средне' }, { value: 'many', label: 'много' }] as const
const hashtagOptions = [{ value: '', label: 'не выбрано' }, { value: 'yes', label: 'да' }, { value: 'no', label: 'нет' }] as const

function selectedOptionLabel(options: ReadonlyArray<{ value: string; label: string }>, value: string) {
  return options.find((option) => option.value === value)?.label ?? 'Не выбрано'
}

const liveHealth = ref<ApiResult | null>(null)
const readyHealth = ref<ApiResult | null>(null)
const isCheckingHealth = ref(false)

const workspaces = ref<Workspace[]>([])
const selectedWorkspace = ref<Workspace | null>(null)
const isLoadingList = ref(false)
const listError = ref('')
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
const isLoadingProjects = ref(false)
const projectError = ref('')
const chatMessages = ref<ChatMessage[]>([])
const isLoadingChat = ref(false)
const generationForm = reactive<{ template_key: TextTemplateKey; topic: string; input: string }>({
  template_key: 'free_form',
  topic: '',
  input: '{\n  "tone": "friendly"\n}',
})
const isGeneratingText = ref(false)
const generationError = ref('')
const isListening = ref(false)
const speechError = ref('')

watch(
  [currentView, () => selectedWorkspace.value?.id ?? '', () => selectedProject.value?.id ?? ''],
  ([view, workspaceID, projectID]) => {
    saveAppNavigationState({ view: view as AppView, workspaceID, projectID })
  },
  { flush: 'sync' },
)

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
let gptProfileSaveTimeout: number | undefined
let workspaceRequestSequence = 0
let mediaRequestSequence = 0
let mediaSummaryRequestSequence = 0
let projectsRequestSequence = 0
let conversationRequestSequence = 0
let profileRequestSequence = 0
let avatarRequestSequence = 0

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

function openAuth(mode: 'login' | 'register') {
  authTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  authMode.value = mode
  authError.value = ''
  authNotice.value = ''
  isAuthOpen.value = true
  void nextTick(() => authModal.value?.querySelector<HTMLElement>('input, button')?.focus())
}

function closeAuth() {
  isAuthOpen.value = false
  void nextTick(() => authTrigger?.focus())
}

function handleAuthKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeAuth()
    return
  }

  if (event.key !== 'Tab' || !authModal.value) {
    return
  }

  const focusable = Array.from(
    authModal.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href]',
    ),
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]

  if (!first || !last) {
    return
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function openWorkflowStep(view: Extract<AppView, 'text' | 'image' | 'publish'>) {
  currentView.value = view
  window.scrollTo({ top: 0, behavior: 'smooth' })

  if (!hasToken.value || selectedWorkspace.value) {
    return
  }

  if (workspaces.value.length) {
    selectWorkspace(workspaces.value[0])
  } else if (!isLoadingList.value) {
    void loadWorkspaces()
  }
}

function openHome() {
  currentView.value = 'home'
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function openProfile() {
  currentView.value = 'profile'
  window.scrollTo({ top: 0, behavior: 'smooth' })
  if (hasToken.value) {
    void loadCurrentUserProfile()
  }
  if (selectedWorkspace.value) {
    void loadGptProfile()
  } else if (hasToken.value && !isLoadingList.value) {
    void loadWorkspaces()
  }
}

function openIntroVideo() {
  window.open('https://www.youtube.com/watch?v=DeQqqlzgxfI', '_blank', 'noopener,noreferrer')
}

async function loadCurrentUserProfile() {
  if (!hasToken.value) {
    avatarDataUrl.value = ''
    return
  }

  const requestSequence = ++avatarRequestSequence
  isLoadingAvatar.value = true
  avatarError.value = ''
  const result = await loadUserProfile()

  if (requestSequence !== avatarRequestSequence || !hasToken.value) {
    return
  }

  if (result.ok && result.data) {
    avatarDataUrl.value = result.data.avatar_url ?? ''
  } else {
    avatarDataUrl.value = ''
    avatarError.value = extractErrorMessage(result.error, 'Не удалось загрузить аватар.')
  }
  isLoadingAvatar.value = false
}

function revokeAvatarEditorObjectUrl() {
  if (avatarEditorObjectUrl) {
    URL.revokeObjectURL(avatarEditorObjectUrl)
    avatarEditorObjectUrl = ''
  }
}

function openAvatarModal() {
  avatarTrigger = document.activeElement instanceof HTMLElement ? document.activeElement : null
  avatarError.value = ''
  avatarFileName.value = 'Файл не выбран'
  isAvatarModalOpen.value = true
  void nextTick(() => avatarModal.value?.querySelector<HTMLElement>('button, input')?.focus())
}

function closeAvatarModal() {
  if (isUploadingAvatar.value) return

  isAvatarModalOpen.value = false
  avatarEditorImage.value = null
  avatarEditorZoom.value = 1
  avatarEditorRotation.value = 0
  avatarEditorOffset.x = 0
  avatarEditorOffset.y = 0
  avatarDragPointer = null
  revokeAvatarEditorObjectUrl()
  void nextTick(() => avatarTrigger?.focus())
}

function handleAvatarKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    closeAvatarModal()
    return
  }

  if (event.key !== 'Tab' || !avatarModal.value) return

  const focusable = Array.from(
    avatarModal.value.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
    ),
  )
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (!first || !last) return

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault()
    first.focus()
  }
}

function avatarEditorDimensions(image: HTMLImageElement) {
  const quarterTurn = Math.abs(avatarEditorRotation.value / 90) % 2 === 1
  return quarterTurn
    ? { width: image.naturalHeight, height: image.naturalWidth }
    : { width: image.naturalWidth, height: image.naturalHeight }
}

function constrainAvatarOffset() {
  const image = avatarEditorImage.value
  const canvas = avatarEditorCanvas.value
  if (!image || !canvas) return

  const rotated = avatarEditorDimensions(image)
  const scale = Math.max(canvas.width / rotated.width, canvas.height / rotated.height) * avatarEditorZoom.value
  const maxX = Math.max(0, (rotated.width * scale - canvas.width) / 2)
  const maxY = Math.max(0, (rotated.height * scale - canvas.height) / 2)
  avatarEditorOffset.x = Math.max(-maxX, Math.min(maxX, avatarEditorOffset.x))
  avatarEditorOffset.y = Math.max(-maxY, Math.min(maxY, avatarEditorOffset.y))
}

function drawAvatarEditor() {
  const image = avatarEditorImage.value
  const canvas = avatarEditorCanvas.value
  if (!image || !canvas) return

  constrainAvatarOffset()
  const context = canvas.getContext('2d')
  if (!context) return

  const rotated = avatarEditorDimensions(image)
  const scale = Math.max(canvas.width / rotated.width, canvas.height / rotated.height) * avatarEditorZoom.value
  context.clearRect(0, 0, canvas.width, canvas.height)
  context.save()
  context.translate(canvas.width / 2 + avatarEditorOffset.x, canvas.height / 2 + avatarEditorOffset.y)
  context.rotate((avatarEditorRotation.value * Math.PI) / 180)
  context.drawImage(
    image,
    -(image.naturalWidth * scale) / 2,
    -(image.naturalHeight * scale) / 2,
    image.naturalWidth * scale,
    image.naturalHeight * scale,
  )
  context.restore()
}

function resetAvatarEditor() {
  avatarEditorZoom.value = 1
  avatarEditorRotation.value = 0
  avatarEditorOffset.x = 0
  avatarEditorOffset.y = 0
  drawAvatarEditor()
}

function rotateAvatarEditor(direction: -1 | 1) {
  avatarEditorRotation.value = (avatarEditorRotation.value + direction * 90 + 360) % 360
  avatarEditorOffset.x = 0
  avatarEditorOffset.y = 0
  drawAvatarEditor()
}

function updateAvatarZoom() {
  drawAvatarEditor()
}

function startAvatarDrag(event: PointerEvent) {
  if (!avatarEditorImage.value) return
  avatarDragPointer = event.pointerId
  avatarDragPosition = { x: event.clientX, y: event.clientY }
  ;(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId)
}

function moveAvatarDrag(event: PointerEvent) {
  if (avatarDragPointer !== event.pointerId || !avatarEditorCanvas.value) return

  const bounds = avatarEditorCanvas.value.getBoundingClientRect()
  avatarEditorOffset.x += (event.clientX - avatarDragPosition.x) * (avatarEditorCanvas.value.width / bounds.width)
  avatarEditorOffset.y += (event.clientY - avatarDragPosition.y) * (avatarEditorCanvas.value.height / bounds.height)
  avatarDragPosition = { x: event.clientX, y: event.clientY }
  drawAvatarEditor()
}

function stopAvatarDrag(event: PointerEvent) {
  if (avatarDragPointer === event.pointerId) avatarDragPointer = null
}

function moveAvatarWithKeyboard(event: KeyboardEvent) {
  const direction = {
    ArrowLeft: { x: -1, y: 0 },
    ArrowRight: { x: 1, y: 0 },
    ArrowUp: { x: 0, y: -1 },
    ArrowDown: { x: 0, y: 1 },
  }[event.key]
  if (!direction) return

  event.preventDefault()
  const distance = event.shiftKey ? 24 : 8
  avatarEditorOffset.x += direction.x * distance
  avatarEditorOffset.y += direction.y * distance
  drawAvatarEditor()
}

function selectAvatar(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  avatarError.value = ''

  if (!file) return
  avatarFileName.value = file.name
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    avatarError.value = 'Выберите изображение PNG, JPEG или WebP.'
    input.value = ''
    return
  }
  if (file.size > 3 * 1024 * 1024) {
    avatarError.value = 'Размер изображения не должен превышать 3 МБ.'
    input.value = ''
    return
  }

  revokeAvatarEditorObjectUrl()
  avatarEditorObjectUrl = URL.createObjectURL(file)
  const objectUrl = avatarEditorObjectUrl
  const image = new Image()
  image.onload = () => {
    if (!isAvatarModalOpen.value || avatarEditorObjectUrl !== objectUrl) return
    avatarEditorImage.value = image
    resetAvatarEditor()
    void nextTick(drawAvatarEditor)
  }
  image.onerror = () => {
    if (avatarEditorObjectUrl !== objectUrl) return
    avatarError.value = 'Не удалось открыть изображение. Попробуйте выбрать другой файл.'
    revokeAvatarEditorObjectUrl()
  }
  image.src = objectUrl
  input.value = ''
}

function avatarCanvasBlob(canvas: HTMLCanvasElement) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.9))
}

async function saveAvatar() {
  const canvas = avatarEditorCanvas.value
  if (!canvas || !avatarEditorImage.value) return

  avatarError.value = ''
  drawAvatarEditor()
  const blob = await avatarCanvasBlob(canvas)
  if (!blob) {
    avatarError.value = 'Не удалось обработать изображение.'
    return
  }

  isUploadingAvatar.value = true
  const requestSequence = ++avatarRequestSequence
  const result = await uploadUserAvatar(new File([blob], 'avatar.webp', { type: 'image/webp' }))

  if (requestSequence === avatarRequestSequence && hasToken.value) {
    if (result.ok && result.data) {
      avatarDataUrl.value = result.data.avatar_url ?? ''
      isUploadingAvatar.value = false
      closeAvatarModal()
    } else {
      avatarError.value = extractErrorMessage(result.error, 'Не удалось сохранить аватар.')
      isUploadingAvatar.value = false
    }
  }
}

function extractProjects(data: unknown): ContentProject[] {
  return data && typeof data === 'object' && Array.isArray((data as ListContentProjectsResponse).projects)
    ? (data as ListContentProjectsResponse).projects
    : []
}

function clearToken() {
  avatarRequestSequence += 1
  isAvatarModalOpen.value = false
  avatarEditorImage.value = null
  revokeAvatarEditorObjectUrl()
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
  chatMessages.value = []
  avatarDataUrl.value = ''
  avatarFileName.value = 'Файл не выбран'
  avatarError.value = ''
  isLoadingAvatar.value = false
  isUploadingAvatar.value = false
  brandProfileSource.value = null
  Object.assign(gptProfile, defaultGptProfile)
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


  if (result.ok && result.data) {
    localStorage.setItem('framecraft.login', identifier)
    savedLogin.value = identifier
    saveSession(result.data)
    loginForm.password = ''
    isAuthOpen.value = false
    tokenMessage.value = 'Вы авторизованы.'
    await Promise.all([loadWorkspaces(), loadCurrentUserProfile()])
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
  isCheckingHealth.value = false
}

async function loadWorkspaces() {
  if (!hasToken.value) {
    listError.value = 'Сначала сохраните JWT token.'
    return
  }

  listError.value = ''
  const requestSequence = ++workspaceRequestSequence
  isLoadingList.value = true

  try {
    const result = await apiRequest('GET', '/v1/workspaces')

    if (requestSequence !== workspaceRequestSequence) {
      return
    }

    if (result.ok) {
      workspaces.value = extractWorkspaces(result.data)
      const preferredWorkspaceID = selectedWorkspace.value?.id || initialNavigationState.workspaceID
      selectedWorkspace.value =
        workspaces.value.find((workspace) => workspace.id === preferredWorkspaceID) ??
        workspaces.value[0] ??
        null

      if (selectedWorkspace.value) {
        await Promise.all([loadMediaAssets(), loadProjects(), loadGptProfile()])
      } else {
        mediaAssets.value = []
        projects.value = []
        chatMessages.value = []
      }
    } else {
      listError.value = extractErrorMessage(result.error, 'Не удалось загрузить список workspace.')
      workspaces.value = []
      selectedWorkspace.value = null
    }
  } finally {
    if (requestSequence === workspaceRequestSequence) {
      isLoadingList.value = false
    }
  }
}

async function ensureWorkspace() {
  if (selectedWorkspace.value) {
    return selectedWorkspace.value
  }

  await loadWorkspaces()
  if (selectedWorkspace.value) {
    return selectedWorkspace.value
  }

  const result = await apiRequest<Workspace>('POST', '/v1/workspaces', {
    body: JSON.stringify({
      name: 'Мой контент',
      type: 'personal',
      timezone: 'Europe/Moscow',
      locale: 'ru-RU',
    }),
  })

  if (result.ok && result.data) {
    selectedWorkspace.value = result.data
    workspaces.value = [result.data]
    return result.data
  } else {
    projectError.value = extractErrorMessage(result.error, 'Не удалось подготовить пространство для нового чата.')
    return null
  }
}

function selectWorkspace(workspace: Workspace) {
  selectedWorkspace.value = workspace
  uploadError.value = ''
  uploadStatus.value = ''
  void loadMediaAssets()
  void loadProjects()
  void loadGptProfile()
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
    return uploadUrl
  }

  return buildApiUrl(uploadUrl)
}

async function loadMediaAssets(append = false) {
  if (!selectedWorkspace.value || !hasToken.value) {
    mediaAssets.value = []
    return
  }

  const workspaceID = selectedWorkspace.value.id
  const requestSequence = ++mediaRequestSequence
  isLoadingMedia.value = true
  uploadError.value = ''

  const cursor = append ? mediaNextCursor.value : ''

  try {
    const result = await apiRequest<ListMediaAssetsResponse>(
      'GET',
      `/v1/media/assets?workspace_id=${encodeURIComponent(workspaceID)}&page_size=20${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    )

    if (requestSequence !== mediaRequestSequence || selectedWorkspace.value?.id !== workspaceID) {
      return
    }

    if (result.ok) {
      const loadedAssets = extractMediaAssets(result.data)
      mediaAssets.value = append ? [...mediaAssets.value, ...loadedAssets] : loadedAssets
      mediaNextCursor.value = result.data?.next_cursor ?? ''
      if (!append) void loadMediaSummary(workspaceID)
    } else {
      uploadError.value = extractErrorMessage(result.error, 'Не удалось загрузить файлы workspace.')
      mediaAssets.value = []
    }
  } finally {
    if (requestSequence === mediaRequestSequence) {
      isLoadingMedia.value = false
    }
  }
}

async function loadMediaSummary(workspaceID = selectedWorkspace.value?.id) {
  if (!workspaceID) return
  const requestSequence = ++mediaSummaryRequestSequence
  const result = await apiRequest<MediaAssetsSummaryResponse>(
    'GET',
    `/v1/media/assets/summary?workspace_id=${encodeURIComponent(workspaceID)}`,
  )

  if (requestSequence !== mediaSummaryRequestSequence || selectedWorkspace.value?.id !== workspaceID) {
    return
  }

  mediaSummary.value = result.ok ? result.data : null
}

async function openAssetUrl(asset: MediaAsset, kind: 'download' | 'thumbnail') {
  mediaActionID.value = asset.id
  const result = kind === 'download'
    ? await apiRequest<CreateMediaDownloadURLResponse>('GET', `/v1/media/assets/${asset.id}/download-url`)
    : await apiRequest<CreateMediaThumbnailURLResponse>('GET', `/v1/media/assets/${asset.id}/thumbnail-url`)
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
  const result = await apiRequest('DELETE', `/v1/media/assets/${asset.id}`)
  if (result.ok) await loadMediaAssets()
  else uploadError.value = extractErrorMessage(result.error, 'Не удалось удалить файл.')
  mediaActionID.value = ''
}

async function loadProjects() {
  if (!selectedWorkspace.value || !hasToken.value) {
    projects.value = []
    return
  }
  const workspaceID = selectedWorkspace.value.id
  const requestSequence = ++projectsRequestSequence
  isLoadingProjects.value = true
  projectError.value = ''
  try {
    const result = await apiRequest<ListContentProjectsResponse>('GET', `/v1/content-projects?workspace_id=${encodeURIComponent(workspaceID)}`)

    if (requestSequence !== projectsRequestSequence || selectedWorkspace.value?.id !== workspaceID) {
      return
    }

    if (result.ok) {
      projects.value = extractProjects(result.data)
      const preferredProjectID = selectedProject.value?.id || initialNavigationState.projectID
      selectedProject.value = projects.value.find(({ id }) => id === preferredProjectID) ?? projects.value[0] ?? null
      if (selectedProject.value) await loadConversation()
      else chatMessages.value = []
    } else {
      projectError.value = extractErrorMessage(result.error, 'Не удалось загрузить контент-проекты.')
    }
  } finally {
    if (requestSequence === projectsRequestSequence) {
      isLoadingProjects.value = false
    }
  }
}

async function ensureContentProject() {
  if (selectedProject.value) {
    return selectedProject.value
  }

  const workspace = await ensureWorkspace()
  if (!workspace) {
    return null
  }

  projectError.value = ''
  const result = await apiRequest<ContentProject>('POST', '/v1/content-projects', {
    body: JSON.stringify({
      workspace_id: workspace.id,
      title: 'Новый пост',
      content_type: 'free_form',
    }),
  })
  if (result.ok && result.data) {
    selectedProject.value = result.data
    projects.value = [result.data, ...projects.value]
    return result.data
  }

  projectError.value = extractErrorMessage(result.error, 'Не удалось создать чат.')
  return null
}

async function selectProject(project: ContentProject) {
  selectedProject.value = project
  generationError.value = ''
  await loadConversation()
}

async function loadConversation() {
  if (!selectedProject.value) {
    chatMessages.value = []
    return
  }
  const projectID = selectedProject.value.id
  const requestSequence = ++conversationRequestSequence
  isLoadingChat.value = true
  generationError.value = ''
  const result = await loadChatMessages(projectID)

  if (requestSequence !== conversationRequestSequence || selectedProject.value?.id !== projectID) {
    return
  }

  chatMessages.value = result.ok ? result.data?.messages ?? [] : []
  if (!result.ok) generationError.value = extractErrorMessage(result.error, 'Не удалось загрузить историю чата.')
  isLoadingChat.value = false
}

function toggleAudience(audience: string) {
  const index = gptProfile.audiences.indexOf(audience)
  if (index >= 0) gptProfile.audiences.splice(index, 1)
  else gptProfile.audiences.push(audience)
}

async function loadGptProfile() {
  if (!selectedWorkspace.value || !hasToken.value) return
  const workspaceID = selectedWorkspace.value.id
  const requestSequence = ++profileRequestSequence
  isLoadingProfile.value = true
  profileError.value = ''
  const result = await loadProfile(workspaceID)

  if (requestSequence !== profileRequestSequence || selectedWorkspace.value?.id !== workspaceID) {
    return
  }

  if (result.ok && result.data) {
    Object.assign(gptProfile, result.data.profile)
    brandProfileSource.value = result.data.source
  } else if (result.statusCode === 404) {
    Object.assign(gptProfile, defaultGptProfile)
    brandProfileSource.value = null
  } else {
    profileError.value = extractErrorMessage(result.error, 'Не удалось загрузить настройки профиля.')
  }
  isLoadingProfile.value = false
}

async function saveGptProfile() {
  if (!selectedWorkspace.value) {
    profileError.value = 'Не удалось определить workspace для профиля.'
    return
  }

  isSavingProfile.value = true
  profileError.value = ''
  gptProfileSaved.value = false
  const workspaceID = selectedWorkspace.value.id
  const result = await updateProfile(workspaceID, { ...gptProfile }, brandProfileSource.value)

  if (result.ok && result.data && selectedWorkspace.value?.id === workspaceID) {
    Object.assign(gptProfile, result.data.profile)
    brandProfileSource.value = result.data.source
    gptProfileSaved.value = true
    if (gptProfileSaveTimeout) window.clearTimeout(gptProfileSaveTimeout)
    gptProfileSaveTimeout = window.setTimeout(() => { gptProfileSaved.value = false }, 2500)
  } else {
    profileError.value = extractErrorMessage(result.error, 'Не удалось сохранить настройки профиля.')
  }
  isSavingProfile.value = false
}

function setMinimumAge(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  gptProfile.ageMin = Math.min(value, gptProfile.ageMax - 1)
}

function setMaximumAge(event: Event) {
  const value = Number((event.target as HTMLInputElement).value)
  gptProfile.ageMax = Math.max(value, gptProfile.ageMin + 1)
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
  if (!hasToken.value) {
    generationError.value = 'Войдите в аккаунт, чтобы начать диалог.'
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
  if (new TextEncoder().encode(JSON.stringify(input)).length > 16 * 1024) {
    generationError.value = 'JSON input превышает ограничение 16 КиБ.'
    return
  }
  isGeneratingText.value = true
  generationError.value = ''
  const project = await ensureContentProject()
  if (!project) {
    isGeneratingText.value = false
    generationError.value = projectError.value || 'Не удалось подготовить чат.'
    return
  }

  const projectID = project.id
  const prompt: ChatMessage = {
    id: `prompt-${Date.now()}`,
    contentProjectID: projectID,
    role: 'user',
    body: generationForm.topic.trim(),
    createdAt: new Date().toISOString(),
  }
  chatMessages.value.push(prompt)
  generationForm.topic = ''
  const result = await createChatGeneration(projectID, generationForm.template_key, input)

  if (selectedProject.value?.id !== projectID) {
    isGeneratingText.value = false
    return
  }

  if (result.ok) {
    await loadConversation()
  } else {
    chatMessages.value = chatMessages.value.filter((item) => item.id !== prompt.id)
    generationForm.topic = prompt.body
    generationError.value = extractErrorMessage(result.error, 'Не удалось сгенерировать текст.')
  }
  isGeneratingText.value = false
}

async function uploadFile() {
  if (!hasToken.value) {
    uploadError.value = 'Сначала сохраните JWT token.'
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
  const workspace = await ensureWorkspace()
  if (!workspace) {
    uploadError.value = projectError.value || 'Не удалось подготовить загрузку файла.'
    isUploading.value = false
    return
  }

  const workspaceID = workspace.id
  const createResult = await apiRequest<CreateMediaUploadResponse>('POST', '/v1/media/uploads', {
    body: JSON.stringify({
      workspace_id: workspaceID,
      original_name: file.name,
      mime_type: file.type || 'application/octet-stream',
      size_bytes: file.size,
    }),
  })


  if (!createResult.ok || !createResult.data) {
    uploadError.value = extractErrorMessage(createResult.error, 'Не удалось создать upload session.')
    isUploading.value = false
    return
  }

  uploadStatus.value = 'Загружаю файл…'
  const uploadResult = await apiRequest('PUT', resolveUploadUrl(createResult.data.upload_url), {
    rawUrl: true,
    auth: false,
    body: file,
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
  })


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
    },
  )


  if (completeResult.ok) {
    uploadStatus.value = `Файл загружен: ${completeResult.data?.asset.original_name ?? file.name}`
    clearSelectedFile()
    if (selectedWorkspace.value?.id === workspaceID) {
      await loadMediaAssets()
    }
  } else {
    uploadError.value = extractErrorMessage(completeResult.error, 'Не удалось завершить upload.')
  }

  isUploading.value = false
}

onMounted(() => {
  window.addEventListener(SESSION_CHANGED_EVENT, syncSession)
  localStorage.removeItem('framecraft.avatar')
  void checkHealth()

  if (hasToken.value) {
    void Promise.all([loadWorkspaces(), loadCurrentUserProfile()])
  }
})

onBeforeUnmount(() => {
  window.removeEventListener(SESSION_CHANGED_EVENT, syncSession)
  speechRecognition?.stop()
  clearSelectedFile()
  revokeAvatarEditorObjectUrl()
  if (gptProfileSaveTimeout) {
    window.clearTimeout(gptProfileSaveTimeout)
  }
})
</script>

<template>
  <main class="app-shell" :class="{ 'text-view': currentView === 'text', 'home-view': currentView === 'home' }">
    <AppHeader :current-view="currentView" :is-authenticated="hasToken" :display-name="authDisplayName" :avatar-letter="authAvatarLetter" :avatar-url="avatarDataUrl" @navigate="openWorkflowStep" @home="openHome" @profile="openProfile" @logout="logout" @auth="openAuth" />
    <HomeHero v-if="currentView === 'home'" @create-post="openWorkflowStep('text')" @watch-video="openIntroVideo" />

    <section v-if="currentView === 'text' || currentView === 'image' || currentView === 'publish'" class="workspace-layout focused-layout">
      <section class="main-column">
        <TextChat v-if="currentView === 'text'" v-model:topic="generationForm.topic" :selected-project="selectedProject" :is-authenticated="hasToken" :messages="chatMessages" :is-loading="isLoadingChat" :is-generating="isGeneratingText" :generation-error="generationError" :speech-error="speechError" :is-listening="isListening" :avatar-letter="authAvatarLetter" @generate="generateText" @toggle-speech="toggleSpeechInput" />

        <MediaLibrary v-if="currentView === 'image'" :is-authenticated="hasToken" :selected-file="selectedFile" :file-input-key="fileInputKey" :file-preview-url="filePreviewUrl" :upload-status="uploadStatus" :upload-error="uploadError" :is-uploading="isUploading" :assets="mediaAssets" :summary="mediaSummary" :next-cursor="mediaNextCursor" :is-loading="isLoadingMedia" :action-id="mediaActionID" @select-file="selectFile" @clear-file="clearSelectedFile" @upload="uploadFile" @refresh="loadMediaAssets" @open-asset="openAssetUrl" @delete-asset="deleteAsset" />

        <article v-if="currentView === 'publish'" class="panel publish-panel">
          <div class="panel-title"><span class="step">3</span><div><h2>Собери пост и опубликуй</h2><p>Здесь появится собранный материал для финальной проверки и публикации.</p></div></div>
          <div class="empty-state flat"><h3>Начните с текста или изображения</h3><p>Созданные материалы останутся в текущем сценарии и будут доступны для сборки поста.</p></div>
        </article>
      </section>
    </section>

    <section v-if="currentView === 'profile'" class="profile-layout">
      <aside class="panel profile-sidebar">
        <div class="profile-avatar-editor">
          <div class="profile-avatar-large"><img v-if="avatarDataUrl" :src="avatarDataUrl" alt="Текущая аватарка" /><span v-else>{{ authAvatarLetter }}</span></div>
          <button type="button" class="avatar-edit-button" :aria-label="avatarDataUrl ? 'Заменить аватар' : 'Добавить аватар'" :title="avatarDataUrl ? 'Заменить аватар' : 'Добавить аватар'" :disabled="isLoadingAvatar || !hasToken" @click="openAvatarModal">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 16.5V20h3.5L18.1 9.4l-3.5-3.5L4 16.5Zm16.7-9.8a1 1 0 0 0 0-1.4l-2-2a1 1 0 0 0-1.4 0l-1.6 1.6 3.5 3.5 1.5-1.7Z" /></svg>
          </button>
        </div>
        <div>
          <h2>{{ authDisplayName }}</h2>
        </div>
        <p v-if="isLoadingAvatar" class="muted">Загружаю аватар…</p>
      </aside>
      <form class="panel gpt-profile-form" :aria-busy="isLoadingProfile || isSavingProfile" @submit.prevent="saveGptProfile">
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
        <div class="profile-save-row"><p v-if="isLoadingProfile" class="muted">Загружаю настройки…</p><p v-else-if="profileError" class="error-message">{{ profileError }}</p><p v-else-if="gptProfileSaved" class="success-message">Настройки сохранены</p><button type="submit" :disabled="isLoadingProfile || isSavingProfile || !selectedWorkspace">{{ isSavingProfile ? 'Сохраняю…' : 'Сохранить настройки' }}</button></div>
      </form>
    </section>

    <div v-if="isAvatarModalOpen" class="modal-backdrop" @click.self="closeAvatarModal">
      <section ref="avatarModal" class="auth-modal avatar-modal" role="dialog" aria-modal="true" aria-labelledby="avatar-modal-title" @keydown="handleAvatarKeydown">
        <div class="modal-header">
          <div><p class="eyebrow">Фото профиля</p><h2 id="avatar-modal-title">{{ avatarDataUrl ? 'Заменить аватар' : 'Добавить аватар' }}</h2></div>
          <button type="button" class="icon-button secondary" aria-label="Закрыть" :disabled="isUploadingAvatar" @click="closeAvatarModal"><span aria-hidden="true">×</span></button>
        </div>

        <div class="avatar-modal-content">
          <div v-if="avatarEditorImage" class="avatar-crop-stage">
            <canvas
              ref="avatarEditorCanvas"
              class="avatar-crop-canvas"
              width="512"
              height="512"
              tabindex="0"
              aria-label="Область обрезки. Перетаскивайте изображение, чтобы выбрать положение."
              @pointerdown="startAvatarDrag"
              @pointermove="moveAvatarDrag"
              @pointerup="stopAvatarDrag"
              @pointercancel="stopAvatarDrag"
              @keydown="moveAvatarWithKeyboard"
            ></canvas>
            <span class="avatar-crop-grid" aria-hidden="true"></span>
            <span class="avatar-crop-hint">Перетаскивайте фото</span>
          </div>
          <div v-else class="avatar-editor-empty">
            <div class="avatar-editor-placeholder"><img v-if="avatarDataUrl" :src="avatarDataUrl" alt="Текущий аватар" /><span v-else>{{ authAvatarLetter }}</span></div>
            <p>Выберите изображение, затем настройте его положение и масштаб.</p>
          </div>

          <label class="avatar-file-control">
            <span class="avatar-file-picker">{{ avatarEditorImage ? 'Выбрать другое фото' : 'Выбрать фото' }}</span>
            <input type="file" accept="image/jpeg,image/png,image/webp" :disabled="isUploadingAvatar" @change="selectAvatar" />
            <small>{{ avatarFileName }}</small>
          </label>

          <div v-if="avatarEditorImage" class="avatar-editor-controls">
            <label class="avatar-zoom-control"><span>Масштаб</span><output>{{ Math.round(avatarEditorZoom * 100) }}%</output><input v-model.number="avatarEditorZoom" type="range" min="1" max="3" step="0.01" aria-label="Масштаб изображения" @input="updateAvatarZoom" /></label>
            <div class="avatar-tool-row" aria-label="Инструменты изображения">
              <button type="button" class="secondary" aria-label="Повернуть влево" title="Повернуть влево" @click="rotateAvatarEditor(-1)">↶ <span>Влево</span></button>
              <button type="button" class="secondary" aria-label="Повернуть вправо" title="Повернуть вправо" @click="rotateAvatarEditor(1)">↷ <span>Вправо</span></button>
              <button type="button" class="secondary" @click="resetAvatarEditor">Сбросить</button>
            </div>
          </div>

          <div class="avatar-rules">
            <strong>Требования к изображению</strong>
            <ul><li>PNG, JPEG или WebP размером до 3 МБ</li><li>Лучше использовать квадратное фото от 512 × 512 px</li><li>Видимая область будет сохранена в профиле в формате WebP</li></ul>
          </div>
          <p v-if="avatarError" class="error-message" role="alert">{{ avatarError }}</p>
          <div class="avatar-modal-actions">
            <button type="button" class="secondary" :disabled="isUploadingAvatar" @click="closeAvatarModal">Отмена</button>
            <button type="button" :disabled="!avatarEditorImage || isUploadingAvatar" @click="saveAvatar">{{ isUploadingAvatar ? 'Сохраняю…' : 'Сохранить аватар' }}</button>
          </div>
        </div>
      </section>
    </div>

    <div v-if="isAuthOpen" class="modal-backdrop" @click.self="closeAuth">
      <section ref="authModal" class="auth-modal" role="dialog" aria-modal="true" aria-labelledby="auth-title" @keydown="handleAuthKeydown">
        <div class="modal-header">
          <div>
            <h2 id="auth-title">{{ authMode === 'login' ? 'Вход' : 'Регистрация' }}</h2>
          </div>
          <button type="button" class="icon-button secondary" aria-label="Закрыть" @click="closeAuth"><span aria-hidden="true">×</span></button>
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
