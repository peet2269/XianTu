<template>
  <div class="world-map-route">
    <!-- 地图只保留本地世界视图。 -->
    <GameMapPanel />
  </div>
</template>

<script setup lang="ts">
import GameMapPanel from '@/components/dashboard/GameMapPanel.vue';
</script>

<style scoped>
.world-map-route {
  width: 100%;
  height: 100%;
}
</style>
