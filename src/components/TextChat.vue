<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'

import type { ChatMessage, ContentProject } from '@/types'

const props = defineProps<{
  selectedProject: ContentProject | null
  isAuthenticated: boolean
  messages: ChatMessage[]
  isLoading: boolean
  isGenerating: boolean
  generationError: string
  speechError: string
  isListening: boolean
  avatarLetter: string
}>()

const topic = defineModel<string>('topic', { required: true })
const emit = defineEmits<{ generate: []; toggleSpeech: [] }>()
const chatScroll = ref<HTMLElement | null>(null)
const chatTextarea = ref<HTMLTextAreaElement | null>(null)

function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('ru-RU', { dateStyle: 'medium', timeStyle: 'short' }).format(date)
}

async function scrollToBottom(behavior: ScrollBehavior = 'auto') {
  await nextTick()
  chatScroll.value?.scrollTo({ top: chatScroll.value.scrollHeight, behavior })
}

function resizeTextarea() {
  const textarea = chatTextarea.value
  if (!textarea) return
  textarea.style.height = 'auto'
  const styles = window.getComputedStyle(textarea)
  const lineHeight = Number.parseFloat(styles.lineHeight) || 24
  const maxHeight = lineHeight * 10 + Number.parseFloat(styles.paddingTop) + Number.parseFloat(styles.paddingBottom)
  textarea.style.height = `${Math.min(textarea.scrollHeight, maxHeight)}px`
  textarea.style.overflowY = textarea.scrollHeight > maxHeight ? 'auto' : 'hidden'
}

function handleKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' && !event.shiftKey) {
    event.preventDefault()
    emit('generate')
  }
}

watch(() => [props.selectedProject?.id, props.messages.length], () => void scrollToBottom(), { flush: 'post' })
</script>

<template>
  <article id="text-creation" class="text-chat">
    <header class="chat-header"><div class="chat-heading"><span class="ai-avatar">✦</span><div><h2>Создай текст</h2><p>{{ selectedProject ? selectedProject.title : 'AI-помощник для ваших публикаций' }}</p></div></div></header>
    <div ref="chatScroll" class="chat-history" aria-live="polite">
      <div v-if="isLoading" class="chat-welcome"><span class="ai-avatar large">✦</span><h3>Загружаю историю…</h3></div>
      <div v-else-if="!messages.length" class="chat-welcome"><span class="ai-avatar large">✦</span><h3>Привет! Я помогу создать текст</h3><p>Опишите тему, задачу или идею публикации. Можно указать аудиторию, тон и важные детали.</p></div>
      <article v-for="message in messages" :key="message.id" class="chat-row" :class="message.role"><span v-if="message.role === 'assistant'" class="message-avatar">✦</span><div class="chat-message"><p>{{ message.body }}</p><time>{{ formatDate(message.createdAt) }}</time></div><span v-if="message.role === 'user'" class="message-avatar user-avatar">{{ avatarLetter }}</span></article>
      <article v-if="isGenerating" class="chat-row assistant"><span class="message-avatar">✦</span><div class="chat-message typing"><i></i><i></i><i></i></div></article>
    </div>
    <footer class="chat-composer-wrap"><p v-if="!isAuthenticated" class="error-message chat-error">Войдите в аккаунт, чтобы начать диалог.</p><p v-if="generationError" class="error-message chat-error">{{ generationError }}</p><p v-if="speechError" class="error-message chat-error">{{ speechError }}</p><div class="chat-composer"><textarea ref="chatTextarea" v-model="topic" rows="1" placeholder="Напишите, какой текст хотите создать…" aria-label="Сообщение" :disabled="!isAuthenticated || isLoading" @input="resizeTextarea" @keydown="handleKeydown" /><button type="button" class="mic-button" :class="{ listening: isListening }" :disabled="!isAuthenticated || isLoading" :aria-label="isListening ? 'Остановить голосовой ввод' : 'Начать голосовой ввод'" @click="emit('toggleSpeech')"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M9 21h6"/></svg></button><button type="button" class="send-button" :disabled="isGenerating || isLoading || !topic.trim() || !isAuthenticated" aria-label="Отправить сообщение" @click="emit('generate')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 14-7-4 14-3-6-7-1Z"/><path d="m12 13 7-8"/></svg></button></div><small>Enter — отправить · Shift + Enter — новая строка</small></footer>
  </article>
</template>
