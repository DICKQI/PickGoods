<template>
  <div class="profile-workspace">
    <header class="profile-header">
      <div>
        <p class="profile-eyebrow">PERSONAL SPACE</p>
        <h1>个人中心</h1>
        <p class="profile-subtitle">{{ authStore.user?.username || '当前账号' }}</p>
      </div>
    </header>

    <nav class="profile-tabs" aria-label="个人中心">
      <router-link to="/profile/account">账号信息</router-link>
      <router-link v-if="!authStore.isClub" to="/profile/clubs">我的社团</router-link>
    </nav>

    <router-view />
  </div>
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
</script>

<style scoped>
.profile-workspace {
  width: min(980px, 100%);
  margin: 0 auto;
  padding: 30px 24px 64px;
  color: var(--text-dark);
}

.profile-header {
  padding-bottom: 22px;
  border-bottom: 1px solid rgba(212, 175, 55, 0.3);
}

.profile-eyebrow {
  margin: 0 0 7px;
  color: var(--primary-gold-dark);
  font-size: var(--font-small);
  font-weight: 700;
  letter-spacing: 0.08em;
}

.profile-header h1 {
  margin: 0;
  font-size: 30px;
  line-height: 1.25;
}

.profile-subtitle {
  margin: 7px 0 0;
  color: var(--text-light);
  font-size: var(--font-caption);
}

.profile-tabs {
  display: flex;
  gap: 4px;
  margin: 20px 0;
  border-bottom: 1px solid var(--secondary-gray-dark);
}

.profile-tabs a {
  padding: 10px 16px;
  color: var(--text-regular);
  text-decoration: none;
  border-bottom: 2px solid transparent;
  transition: color var(--transition-fast), border-color var(--transition-fast), background-color var(--transition-fast);
}

.profile-tabs a:hover,
.profile-tabs a:focus-visible {
  color: var(--accent-purple-dark);
  background: rgba(162, 155, 254, 0.08);
}

.profile-tabs a.router-link-active {
  color: var(--accent-purple-dark);
  border-bottom-color: var(--primary-gold);
  font-weight: 600;
}

@media (max-width: 768px) {
  .profile-workspace {
    padding: 22px 16px calc(40px + env(safe-area-inset-bottom));
    touch-action: pan-y;
  }

  .profile-header h1 {
    font-size: 25px;
  }

  .profile-tabs {
    overflow-x: auto;
    white-space: nowrap;
  }
}
</style>
