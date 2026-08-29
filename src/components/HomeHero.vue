<script setup lang="ts">
import postFlowHeroWorkflow from '@/assets/postflow-hero-workflow.png'

const emit = defineEmits<{ createPost: []; watchVideo: [] }>()
</script>

<template>
  <section class="hero">
    <div class="hero-copy how-it-works">
      <div class="hero-showcase">
        <div class="hero-pitch">
          <p class="hero-kicker">✦ AI-сервис для контента и автопостинга</p>
          <h1><span>Создавайте.</span><span>Собирайте.</span><span>Публикуйте.</span></h1>
          <p class="hero-intro">PostFlow объединяет весь процесс работы с контентом в одном сервисе — создание текста, изображений, сбор поста и публикация во всех соцсетях.</p>
          <div class="hero-actions"><button type="button" @click="emit('createPost')">✦ Создать пост</button><button type="button" class="hero-secondary" @click="emit('watchVideo')"><span>▶</span> Смотреть видео</button></div>
        </div>
        <div class="hero-visual"><img :src="postFlowHeroWorkflow" alt="Создание текста, изображения и готового поста в PostFlow" /></div>
      </div>
      <div class="how-grid">
        <article class="how-step"><span class="how-icon" aria-hidden="true">✎</span><div><strong>Создайте текст</strong><p>Опишите тему или идею — AI подготовит текст поста под вашу задачу, аудиторию и стиль.</p></div></article>
        <article class="how-step"><span class="how-icon" aria-hidden="true">▧</span><div><strong>Создайте изображение</strong><p>Сгенерируйте уникальный визуал для публикации прямо в PostFlow.</p></div></article>
        <article class="how-step"><span class="how-icon" aria-hidden="true">✦</span><div><strong>Соберите готовый пост</strong><p>Объедините текст и изображение, отредактируйте результат и посмотрите, как будет выглядеть публикация.</p></div></article>
        <article class="how-step"><span class="how-icon" aria-hidden="true">➤</span><div><strong>Опубликуйте везде</strong><p>Выберите нужные социальные сети и опубликуйте пост сразу или запланируйте его на удобное время.</p></div></article>
      </div>
    </div>
  </section>
</template>
