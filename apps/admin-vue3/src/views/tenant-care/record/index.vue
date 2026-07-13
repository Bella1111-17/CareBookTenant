<template>
  <div class="app-container tenant-record-page">
    <el-form ref="queryRef" :model="queryParams" :inline="true" v-show="showSearch" class="toolbar-form">
      <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
        <el-select v-model="queryParams.tenantId" placeholder="全部机构" clearable filterable style="width: 220px">
          <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
        </el-select>
      </el-form-item>
      <el-form-item label="设备号" prop="deviceNo">
        <el-input v-model="queryParams.deviceNo" placeholder="请输入设备号" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="转写状态" prop="asrStatus">
        <el-select v-model="queryParams.asrStatus" placeholder="全部" clearable style="width: 140px">
          <el-option label="待转写" value="PENDING" />
          <el-option label="转写中" value="RUNNING" />
          <el-option label="成功" value="SUCCESS" />
          <el-option label="失败" value="FAILED" />
        </el-select>
      </el-form-item>
      <el-form-item label="隔离状态" prop="isolationStatus">
        <el-select v-model="queryParams.isolationStatus" placeholder="全部" clearable style="width: 160px">
          <el-option label="正常" value="NORMAL" />
          <el-option label="租户未解析" value="TENANT_UNRESOLVED" />
        </el-select>
      </el-form-item>
      <el-form-item label="录音时间">
        <el-date-picker v-model="dateRange" value-format="YYYY-MM-DD" type="daterange" range-separator="-" start-placeholder="开始" end-placeholder="结束" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-form>

    <el-table v-loading="loading" :data="recordList">
      <el-table-column label="ID" width="70" align="center">
        <template #default="{ $index }">{{ recordIndex($index) }}</template>
      </el-table-column>
      <el-table-column label="设备号" width="150" prop="deviceNo" show-overflow-tooltip />
      <el-table-column label="护工ID" width="120" align="center">
        <template #default="{ row }">{{ row.tenantCaregiverId || '——' }}</template>
      </el-table-column>
      <el-table-column label="文件名" min-width="220" prop="fileName" show-overflow-tooltip />
      <el-table-column label="切片" width="90" align="center" prop="chunkIndex" />
      <el-table-column label="开始时间" width="170" align="center">
        <template #default="{ row }">{{ parseTime(row.startTime) }}</template>
      </el-table-column>
      <el-table-column label="结束时间" width="170" align="center">
        <template #default="{ row }">{{ row.endTime ? parseTime(row.endTime) : '-' }}</template>
      </el-table-column>
      <el-table-column label="转写" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="asrType(row.asrStatus)">{{ asrLabel(row.asrStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="隔离" width="130" align="center">
        <template #default="{ row }">
          <el-tag :type="row.isolationStatus === 'NORMAL' ? 'success' : 'danger'">{{ isolationLabel(row.isolationStatus) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="160" align="center" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.fileUrl" link type="primary" icon="VideoPlay" @click="playAudio(row)">播放</el-button>
          <el-button link type="primary" icon="View" @click="showDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog title="录音详情" v-model="detailOpen" width="760px" append-to-body>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="设备号">{{ detail.deviceNo || '-' }}</el-descriptions-item>
        <el-descriptions-item label="护工ID">{{ detail.tenantCaregiverId || '——' }}</el-descriptions-item>
        <el-descriptions-item label="文件名" :span="2">{{ detail.fileName || '-' }}</el-descriptions-item>
        <el-descriptions-item label="隔离状态">{{ isolationLabel(detail.isolationStatus) }}</el-descriptions-item>
        <el-descriptions-item label="隔离原因">{{ detail.isolationReason || '-' }}</el-descriptions-item>
        <el-descriptions-item label="播放链接" :span="2">
          <el-link v-if="detail.fileUrl" type="primary" :href="detail.fileUrl" target="_blank">{{ detail.fileUrl }}</el-link>
          <span v-else>-</span>
        </el-descriptions-item>
        <el-descriptions-item label="转写文本" :span="2">
          <div class="text-panel">{{ detail.transcriptText || '暂无转写文本' }}</div>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <el-dialog title="播放录音" v-model="playerOpen" width="520px" append-to-body>
      <audio :src="playerUrl" controls autoplay class="audio-player">您的浏览器不支持音频播放</audio>
    </el-dialog>
  </div>
</template>

<script setup name="TenantAudioRecord">
import { computed, getCurrentInstance, reactive, ref, toRefs } from 'vue'
import useUserStore from '@/store/modules/user'
import { listTenant } from '@/api/system/tenant'
import { listTenantRecords } from '@/api/tenant-care'

const { proxy } = getCurrentInstance()
const userStore = useUserStore()
const isPlatformUser = computed(() => userStore.userScope === 'platform')
const tenantOptions = ref([])
const recordList = ref([])
const loading = ref(false)
const showSearch = ref(true)
const total = ref(0)
const dateRange = ref([])
const detailOpen = ref(false)
const detail = ref({})
const playerOpen = ref(false)
const playerUrl = ref('')

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, tenantId: undefined, deviceNo: undefined, asrStatus: undefined, isolationStatus: undefined, params: {} },
})
const { queryParams } = toRefs(data)

function asrType(status) {
  return { RUNNING: '', SUCCESS: 'success', FAILED: 'danger' }[status] || 'info'
}

function asrLabel(status) {
  return { PENDING: '待转写', RUNNING: '转写中', SUCCESS: '成功', FAILED: '失败' }[status] || status || '待转写'
}

function isolationLabel(status) {
  return { NORMAL: '正常', TENANT_UNRESOLVED: '租户未解析' }[status] || status || '-'
}

function recordIndex(index) {
  return (Number(queryParams.value.pageNum || 1) - 1) * Number(queryParams.value.pageSize || 10) + index + 1
}

function loadTenantOptions() {
  if (!isPlatformUser.value) return
  listTenant({ pageNum: 1, pageSize: 200 }).then((res) => {
    tenantOptions.value = res.data?.list || []
  })
}

function getList() {
  loading.value = true
  const query = { ...queryParams.value }
  if (!query.tenantId) delete query.tenantId
  if (dateRange.value?.length === 2) {
    query.params = { beginTime: dateRange.value[0], endTime: dateRange.value[1] }
  } else {
    delete query.params
  }
  listTenantRecords(query)
    .then((res) => {
      recordList.value = res.data?.list || []
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
  handleQuery()
}

function showDetail(row) {
  detail.value = row
  detailOpen.value = true
}

function playAudio(row) {
  playerUrl.value = row.fileUrl
  playerOpen.value = true
}

loadTenantOptions()
getList()
</script>

<style scoped>
.tenant-record-page {
  background: #f5f7fa;
  min-height: 100%;
}

.toolbar-form {
  padding: 16px 16px 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.text-panel {
  max-height: 260px;
  overflow-y: auto;
  white-space: pre-wrap;
  padding: 12px;
  border-radius: 6px;
  background: #f5f7fa;
  line-height: 1.7;
}

.audio-player {
  width: 100%;
}
</style>
