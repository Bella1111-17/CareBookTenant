<template>
  <section class="summary-grid" v-loading="loading">
    <article
      v-for="card in summaryCards"
      :key="card.type"
      class="summary-card"
      tabindex="0"
      @click="emit('select', card)"
      @keyup.enter="emit('select', card)"
    >
      <div class="summary-card__label">{{ card.label }}</div>
      <div class="summary-card__value" :class="card.valueClass">{{ card.value }}</div>
    </article>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import useUserStore from '@/store/modules/user'

const props = defineProps({
  summary: {
    type: Object,
    required: true,
  },
  loading: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['select'])
const userStore = useUserStore()
const isPlatformUser = computed(() => userStore.userScope === 'platform')

const summaryCards = computed(() => {
  if (isPlatformUser.value) {
    return [
      { label: '设备总数', value: props.summary.totalDevices, type: 'totalDevices' },
      { label: '已归属租户', value: props.summary.assignedDevices, type: 'assignedDevices', valueClass: 'summary-card__value--blue' },
      { label: '未归属设备', value: props.summary.idleDevices, type: 'idleDevices', valueClass: 'summary-card__value--amber' },
      { label: '归属租户数', value: props.summary.boundTenants, type: 'boundTenants', valueClass: 'summary-card__value--green' },
    ]
  }

  return [
    { label: '设备总数', value: props.summary.totalDevices, type: 'totalDevices' },
    { label: '已绑定护工', value: props.summary.boundDevices, type: 'boundDevices', valueClass: 'summary-card__value--blue' },
    { label: '空闲设备', value: props.summary.idleDevices, type: 'idleDevices', valueClass: 'summary-card__value--amber' },
    { label: '已绑定护工数', value: props.summary.boundCaregivers, type: 'boundCaregivers', valueClass: 'summary-card__value--green' },
  ]
})
</script>

<style scoped>
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.summary-card {
  min-height: 92px;
  padding: 16px 18px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s, transform 0.2s;
}

.summary-card:hover,
.summary-card:focus {
  border-color: #409eff;
  box-shadow: 0 8px 20px rgba(64, 158, 255, 0.12);
  outline: none;
  transform: translateY(-1px);
}

.summary-card__label {
  color: #606266;
  font-size: 13px;
  line-height: 20px;
}

.summary-card__value {
  margin-top: 10px;
  color: #303133;
  font-size: 28px;
  font-weight: 700;
  line-height: 34px;
}

.summary-card__value--blue {
  color: #2563eb;
}

.summary-card__value--green {
  color: #16a34a;
}

.summary-card__value--amber {
  color: #d97706;
}

@media (max-width: 1200px) {
  .summary-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .summary-grid {
    grid-template-columns: 1fr;
  }
}
</style>
