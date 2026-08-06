<template>
  <div class="histogram" v-if="items.length > 0">
    <h4 class="histogram-title">{{ title }}</h4>
    <div class="histogram-row" v-for="item in items" :key="item.label">
      <span class="histogram-label" :title="item.label">{{ item.label }}</span>
      <div class="histogram-bar-track">
        <div class="histogram-bar-fill" :style="{ width: barWidth(item.count) + '%' }"></div>
      </div>
      <span class="histogram-count">{{ item.count }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

export interface HistogramItem {
  label: string
  count: number
}

const props = defineProps<{
  title: string
  items: HistogramItem[]
}>()

const maxCount = computed(() => Math.max(1, ...props.items.map(i => i.count)))

const barWidth = (count: number) => (count / maxCount.value) * 100
</script>

<style scoped>
.histogram {
  margin-bottom: 16px;
}

.histogram-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  margin: 0 0 8px 0;
}

.histogram-row {
  display: grid;
  grid-template-columns: 140px 1fr 32px;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}

.histogram-label {
  font-size: 12px;
  color: #4b5563;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.histogram-bar-track {
  background-color: #f1f5f9;
  border-radius: 3px;
  height: 14px;
  overflow: hidden;
}

.histogram-bar-fill {
  background-color: #3498db;
  height: 100%;
  border-radius: 3px;
}

.histogram-count {
  font-size: 12px;
  color: #6b7280;
  text-align: right;
}
</style>
