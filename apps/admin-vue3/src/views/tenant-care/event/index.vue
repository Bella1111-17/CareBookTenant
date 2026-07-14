<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
      <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
        <el-select v-model="queryParams.tenantId" placeholder="全部机构" clearable filterable style="width: 220px">
          <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
        </el-select>
      </el-form-item>
      <el-form-item label="设备号" prop="deviceNo">
        <el-input v-model="queryParams.deviceNo" placeholder="请输入设备号" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="护工" prop="tenantCaregiverId">
        <el-select v-model="queryParams.tenantCaregiverId" placeholder="全部" clearable filterable style="width: 180px">
          <el-option v-for="item in caregiverOptions" :key="item.id" :label="`${item.realName} ${item.phone || ''}`" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="事件类型" prop="eventType">
        <el-select v-model="queryParams.eventType" placeholder="全部" clearable style="width: 140px">
          <el-option label="心跳" value="heartbeat" />
          <el-option label="登录" value="login" />
          <el-option label="控制" value="control" />
          <el-option label="调试" value="debug" />
        </el-select>
      </el-form-item>
      <el-form-item label="事件日期">
        <el-date-picker
          v-model="dateRange"
          value-format="YYYY-MM-DD"
          type="daterange"
          range-separator="-"
          start-placeholder="开始日期"
          end-placeholder="结束日期"
          style="width: 240px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-form>

    <el-table v-loading="loading" :data="eventList">
      <el-table-column label="设备号" align="center" prop="deviceNo" width="180" show-overflow-tooltip />
      <el-table-column label="护工" align="center" prop="caregiverName" width="150" show-overflow-tooltip>
        <template #default="{ row }">{{ row.caregiverName || '-' }}</template>
      </el-table-column>
      <el-table-column label="事件类型" align="center" prop="eventType" width="120">
        <template #default="{ row }">
          <el-tag :type="tagType(row.eventType)" size="small">{{ label(row.eventType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="事件名称" align="center" prop="eventName" width="160" show-overflow-tooltip />
      <el-table-column label="状态" align="center" prop="eventStatus" width="120" />
      <el-table-column label="详情" align="center" prop="detail" min-width="280" show-overflow-tooltip />
      <el-table-column label="时间" align="center" prop="createdAt" width="180">
        <template #default="{ row }">{{ parseTime(row.createdAt) }}</template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
  </div>
</template>

<script setup name="TenantCareDeviceEvent">
import { computed, getCurrentInstance, reactive, ref, toRefs, watch } from 'vue'
import useUserStore from '@/store/modules/user'
import { listTenant } from '@/api/system/tenant'
import { listTenantCaregivers, listTenantDeviceEvents } from '@/api/tenant-care'

const { proxy } = getCurrentInstance()
const userStore = useUserStore()
const isPlatformUser = computed(() => userStore.userScope === 'platform')
const tenantOptions = ref([])
const caregiverOptions = ref([])
const eventList = ref([])
const loading = ref(false)
const showSearch = ref(true)
const total = ref(0)
const dateRange = ref([])
const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    tenantId: undefined,
    deviceNo: undefined,
    tenantCaregiverId: undefined,
    eventType: undefined,
  },
})
const { queryParams } = toRefs(data)

function tagType(t) {
  return t === 'heartbeat' ? 'success' : t === 'login' ? '' : t === 'control' ? 'warning' : 'info'
}

function label(t) {
  return t === 'heartbeat' ? '心跳' : t === 'login' ? '登录' : t === 'control' ? '控制' : t === 'debug' ? '调试' : t
}

function loadTenantOptions() {
  if (!isPlatformUser.value) return
  listTenant({ pageNum: 1, pageSize: 200 }).then((res) => {
    tenantOptions.value = res.data?.list || []
  })
}

function loadCaregiverOptions() {
  listTenantCaregivers({ pageNum: 1, pageSize: 200, tenantId: queryParams.value.tenantId, status: '0' }).then((res) => {
    caregiverOptions.value = res.data?.list || []
  })
}

function buildQuery() {
  const query = { ...queryParams.value }
  if (dateRange.value?.length === 2) {
    query.beginTime = dateRange.value[0]
    query.endTime = dateRange.value[1]
  }
  return query
}

function getList() {
  loading.value = true
  listTenantDeviceEvents(buildQuery())
    .then((res) => {
      eventList.value = res.data?.list || []
      total.value = res.data?.total || 0
    })
    .finally(() => {
      loading.value = false
    })
}

function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

function resetQuery() {
  proxy.resetForm('queryRef')
  dateRange.value = []
  queryParams.value.tenantCaregiverId = undefined
  handleQuery()
}

watch(() => queryParams.value.tenantId, () => {
  queryParams.value.tenantCaregiverId = undefined
  loadCaregiverOptions()
})

loadTenantOptions()
loadCaregiverOptions()
getList()
</script>
