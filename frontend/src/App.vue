<template>
  <Layout />
</template>

<script setup lang="ts">
import Layout from './components/Layout.vue'
</script>

<style>
#app {
  min-height: 100vh;
  height: 100%;
  overflow-x: hidden;
  /* Keep the WebView from forwarding edge gestures to the document root. */
  overscroll-behavior: none;
  position: relative;
}
</style>
