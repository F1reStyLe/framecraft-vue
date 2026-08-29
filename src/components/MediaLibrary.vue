<script setup lang="ts">
import type { MediaAsset, MediaAssetsSummaryResponse } from '@/types'

defineProps<{
  isAuthenticated: boolean
  selectedFile: File | null
  fileInputKey: number
  filePreviewUrl: string
  uploadStatus: string
  uploadError: string
  isUploading: boolean
  assets: MediaAsset[]
  summary: MediaAssetsSummaryResponse | null
  nextCursor: string
  isLoading: boolean
  actionId: string
}>()

const emit = defineEmits<{
  selectFile: [event: Event]
  clearFile: []
  upload: []
  refresh: [append?: boolean]
  openAsset: [asset: MediaAsset, kind: 'download' | 'thumbnail']
  deleteAsset: [asset: MediaAsset]
}>()

function formatBytes(value: number) {
  if (value < 1024) return `${value} B`
  const units = ['KB', 'MB', 'GB']
  let size = value / 1024
  let index = 0
  while (size >= 1024 && index < units.length - 1) { size /= 1024; index += 1 }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[index]}`
}
</script>

<template>
  <article class="panel upload-panel">
    <div class="panel-title"><span class="step">2</span><div><h2>Загрузить файл</h2><p>Добавьте изображение, чтобы использовать его в публикации.</p></div></div>
    <div class="upload-box">
      <label>Изображение<input :key="fileInputKey" type="file" accept="image/*" :disabled="!isAuthenticated" @change="emit('selectFile', $event)" /></label>
      <div v-if="selectedFile" class="file-summary"><img v-if="filePreviewUrl" :src="filePreviewUrl" alt="" /><div><strong>{{ selectedFile.name }}</strong><span>{{ selectedFile.type || 'application/octet-stream' }} · {{ formatBytes(selectedFile.size) }}</span></div><button type="button" class="secondary small" :disabled="isUploading" @click="emit('clearFile')">Убрать</button></div>
      <p v-if="!isAuthenticated" class="error-message">Войдите в аккаунт, чтобы загружать изображения.</p><p v-if="uploadStatus" class="success-message">{{ uploadStatus }}</p><p v-if="uploadError" class="error-message">{{ uploadError }}</p><button type="button" class="full-width" :disabled="isUploading || !isAuthenticated || !selectedFile" @click="emit('upload')">{{ isUploading ? 'Загружаю…' : 'Загрузить файл' }}</button>
    </div>
    <div class="asset-list">
      <div class="asset-list-head"><div><p class="eyebrow">Media assets</p><h3>{{ assets.length ? `${assets.length} файлов` : 'Файлов пока нет' }}</h3></div><button type="button" class="secondary small" :disabled="isLoading || !isAuthenticated" @click="emit('refresh')">{{ isLoading ? 'Обновляю…' : 'Обновить' }}</button></div>
      <p v-if="summary" class="muted summary-line">Всего: {{ summary.total }} · {{ summary.statuses.map((item) => `${item.status}: ${item.count}`).join(' · ') }}</p>
      <div v-if="assets.length" class="asset-grid"><div v-for="asset in assets" :key="asset.id" class="asset-card"><strong>{{ asset.original_name }}</strong><span>{{ asset.status }} · {{ formatBytes(asset.size_bytes) }}</span><small>{{ asset.mime_type }}</small><code>{{ asset.id }}</code><div class="asset-actions"><button type="button" class="secondary small" :disabled="actionId === asset.id || asset.status !== 'ready' || !asset.has_thumbnail" @click="emit('openAsset', asset, 'thumbnail')">Превью</button><button type="button" class="secondary small" :disabled="actionId === asset.id || asset.status !== 'ready'" @click="emit('openAsset', asset, 'download')">Скачать</button><button type="button" class="danger small" :disabled="actionId === asset.id" @click="emit('deleteAsset', asset)">Удалить</button></div></div></div>
      <button v-if="nextCursor" type="button" class="secondary" :disabled="isLoading" @click="emit('refresh', true)">{{ isLoading ? 'Загружаю…' : 'Показать ещё' }}</button>
    </div>
  </article>
</template>
