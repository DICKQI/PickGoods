<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="admin-page-header">
    <div class="admin-page-header__text">
      <h2 class="admin-page-header__title">{{ title }}</h2>
      <span v-if="subtitle" class="admin-page-header__subtitle">{{ subtitle }}</span>
    </div>
    <div v-if="$slots.default" class="admin-page-header__actions">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.admin-page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: var(--space-lg);
  gap: var(--space-md);
}

.admin-page-header__text {
  display: flex;
  flex-direction: column;
  gap: var(--space-xs);
}

.admin-page-header__title {
  font-size: var(--font-title-lg);
  font-weight: 600;
  color: var(--text-dark);
  margin: 0;
}

.admin-page-header__subtitle {
  font-size: var(--font-caption);
  color: var(--text-light);
}

.admin-page-header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-sm);
}

@media (max-width: 768px) {
  .admin-page-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .admin-page-header__actions {
    width: 100%;
  }

  .admin-page-header__actions :deep(.el-button) {
    width: 100%;
  }
}
</style>
