<script setup lang="ts">
import postFlowLogo from '@/assets/postflow-logo-transparent.png'
import type { AppView } from '@/types'

defineProps<{
  currentView: AppView
  isAuthenticated: boolean
  displayName: string
  avatarLetter: string
  avatarUrl: string
}>()

const emit = defineEmits<{
  navigate: [view: Extract<AppView, 'text' | 'image' | 'publish'>]
  home: []
  profile: []
  logout: []
  auth: [mode: 'login' | 'register']
}>()
</script>

<template>
  <header class="app-toolbar">
    <a class="brand" href="/" aria-label="PostFlow" @click.prevent="emit('home')">
      <img :src="postFlowLogo" alt="PostFlow" />
    </a>

    <nav class="workflow-nav" aria-label="Этапы создания публикации">
      <button type="button" class="workflow-button" :class="{ active: currentView === 'text' }" @click="emit('navigate', 'text')">
        <span class="workflow-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 10.9-10.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m14.7 6.5 2.8 2.8M3.5 21h7"/></svg></span>
        <span class="workflow-copy"><strong>Создай текст</strong><small>AI текст для поста</small></span>
      </button>
      <span class="workflow-arrow" aria-hidden="true">→</span>
      <button type="button" class="workflow-button" :class="{ active: currentView === 'image' }" @click="emit('navigate', 'image')">
        <span class="workflow-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="1.5"/><circle cx="8.5" cy="9" r="1.5"/><path d="m4 18 5-5 3.5 3.5 2.5-2.5 5 5"/></svg></span>
        <span class="workflow-copy"><strong>Создай изображение</strong><small>AI изображение</small></span>
      </button>
      <span class="workflow-arrow" aria-hidden="true">→</span>
      <button type="button" class="workflow-button" :class="{ active: currentView === 'publish' }" @click="emit('navigate', 'publish')">
        <span class="workflow-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M14 14h3v3h-3zM21 14v3M14 21h3M21 20v1h-1"/></svg></span>
        <span class="workflow-copy"><strong>Собери пост и опубликуй</strong><small>Объедини и настрой автопостинг</small></span>
      </button>
    </nav>

    <div class="auth-actions">
      <template v-if="isAuthenticated">
        <button type="button" class="profile-chip" :title="`Открыть профиль: ${displayName}`" @click="emit('profile')">
          <span class="profile-avatar" aria-hidden="true"><img v-if="avatarUrl" :src="avatarUrl" alt="" /><template v-else>{{ avatarLetter }}</template></span>
          <span class="profile-login">{{ displayName }}</span>
        </button>
        <button type="button" class="secondary small logout-button" @click="emit('logout')">Выйти</button>
      </template>
      <template v-else>
        <button type="button" class="secondary small login-button" @click="emit('auth', 'login')">Войти</button>
        <button type="button" class="small registration-button" @click="emit('auth', 'register')">Регистрация</button>
      </template>
    </div>
  </header>
</template>
