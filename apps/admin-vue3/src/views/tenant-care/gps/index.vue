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
      <el-form-item label="上报日期">
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

    <el-table v-loading="loading" :data="gpsList">
      <el-table-column label="设备号" align="center" prop="deviceNo" width="160" show-overflow-tooltip />
      <el-table-column label="护工" align="center" prop="caregiverName" width="140" show-overflow-tooltip>
        <template #default="{ row }">{{ row.caregiverName || '-' }}</template>
      </el-table-column>
      <el-table-column label="经度" align="center" prop="longitude" width="120" />
      <el-table-column label="纬度" align="center" prop="latitude" width="120" />
      <el-table-column label="定位方式" align="center" prop="locationType" width="100">
        <template #default="{ row }">
          <el-tag :type="row.locationType === 'WIFI' ? 'warning' : 'success'" size="small">{{ row.locationType || 'GPS' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="上报时间" align="center" prop="reportTime" width="170">
        <template #default="{ row }">{{ row.reportTime ? parseTime(row.reportTime) : '-' }}</template>
      </el-table-column>
      <el-table-column label="地址" align="center" prop="address" min-width="220" show-overflow-tooltip />
      <el-table-column label="接收时间" align="center" prop="createdAt" width="170">
        <template #default="{ row }">{{ parseTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="100" align="center">
        <template #default="{ row }">
          <el-button link type="primary" icon="Location" @click="openMap(row)">地图</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
  </div>
</template>

<script setup name="TenantCareGps">
import { computed, getCurrentInstance, reactive, ref, toRefs, watch } from 'vue'
import useUserStore from '@/store/modules/user'
import { listTenant } from '@/api/system/tenant'
import { listTenantCaregivers, listTenantGpsLogs } from '@/api/tenant-care'

const { proxy } = getCurrentInstance()
const userStore = useUserStore()
const isPlatformUser = computed(() => userStore.userScope === 'platform')
const tenantOptions = ref([])
const caregiverOptions = ref([])
const gpsList = ref([])
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
  },
})
const { queryParams } = toRefs(data)

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
  listTenantGpsLogs(buildQuery())
    .then((res) => {
      gpsList.value = res.data?.list || []
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

function openMap(row) {
  if (row.latitude && row.longitude) {
    window.open(`https://uri.amap.com/marker?position=${row.longitude},${row.latitude}`, '_blank')
  } else {
    proxy.$modal.msgWarning('无有效坐标')
  }
}

watch(() => queryParams.value.tenantId, () => {
  queryParams.value.tenantCaregiverId = undefined
  loadCaregiverOptions()
})

loadTenantOptions()
loadCaregiverOptions()
getList()
</script>
