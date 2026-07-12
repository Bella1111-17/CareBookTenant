<template>
  <div class="app-container tenant-device-page">
    <el-tabs v-model="activeTab" class="workspace-tabs">
      <el-tab-pane label="设备管理" name="device">
        <el-form ref="deviceQueryRef" :model="deviceQuery" :inline="true" v-show="showSearch" class="toolbar-form">
          <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
            <el-select v-model="deviceQuery.tenantId" placeholder="全部机构" clearable filterable style="width: 220px">
              <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
            </el-select>
          </el-form-item>
          <el-form-item label="设备号" prop="deviceNo">
            <el-input v-model="deviceQuery.deviceNo" placeholder="请输入设备号" clearable style="width: 220px" @keyup.enter="handleDeviceQuery" />
          </el-form-item>
          <el-form-item label="绑定状态" prop="bindingStatus">
            <el-select v-model="deviceQuery.bindingStatus" placeholder="全部" clearable style="width: 140px">
              <el-option label="已绑定" value="BOUND" />
              <el-option label="空闲" value="IDLE" />
            </el-select>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleDeviceQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetDeviceQuery">重置</el-button>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" plain icon="Plus" @click="openDeviceDialog()" v-hasPermi="['tenant-care:badge:add']">新增设备</el-button>
          </el-form-item>
          <right-toolbar v-model:showSearch="showSearch" @queryTable="getDeviceList" />
        </el-form>

        <el-table v-loading="deviceLoading" :data="deviceList">
          <el-table-column label="设备号" min-width="180" prop="deviceNo" />
          <el-table-column label="租户" min-width="160" prop="tenantId" v-if="isPlatformUser" />
          <el-table-column label="绑定状态" width="120" align="center">
            <template #default="{ row }">
              <el-tag :type="row.bindingStatus === 'BOUND' ? 'success' : 'info'">{{ row.bindingStatus === 'BOUND' ? '已绑定' : '空闲' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="当前护工" min-width="180">
            <template #default="{ row }">
              <span v-if="row.currentBinding">{{ row.currentBinding.caregiverName || '-' }}</span>
              <span v-else class="empty-text">未绑定</span>
            </template>
          </el-table-column>
          <el-table-column label="手机号" width="150">
            <template #default="{ row }">{{ row.currentBinding?.caregiverPhone || '-' }}</template>
          </el-table-column>
          <el-table-column label="最近数据" width="140" prop="lastDataType" />
          <el-table-column label="最近上报" width="170" align="center">
            <template #default="{ row }">{{ row.lastSeenAt ? parseTime(row.lastSeenAt) : '-' }}</template>
          </el-table-column>
          <el-table-column label="操作" width="300" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" icon="EditPen" @click="openDeviceDialog(row)" v-hasPermi="['tenant-care:badge:edit']">编辑</el-button>
              <el-button link type="primary" icon="Switch" @click="openBindDialog(row)" v-hasPermi="['tenant-care:badge:bind']">
                {{ row.bindingStatus === 'BOUND' ? '换绑' : '绑定' }}
              </el-button>
              <el-button v-if="row.bindingStatus === 'BOUND'" link type="danger" icon="Remove" @click="handleUnbind(row)" v-hasPermi="['tenant-care:badge:unbind']">解绑</el-button>
              <el-button v-else link type="danger" icon="Delete" @click="handleDeleteDevice(row)" v-hasPermi="['tenant-care:badge:remove']">删除</el-button>
            </template>
          </el-table-column>
        </el-table>

        <pagination v-show="deviceTotal > 0" :total="deviceTotal" v-model:page="deviceQuery.pageNum" v-model:limit="deviceQuery.pageSize" @pagination="getDeviceList" />
      </el-tab-pane>

      <el-tab-pane label="绑定历史" name="history">
        <el-form ref="bindingQueryRef" :model="bindingQuery" :inline="true" class="toolbar-form">
          <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
            <el-select v-model="bindingQuery.tenantId" placeholder="全部机构" clearable filterable style="width: 220px">
              <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
            </el-select>
          </el-form-item>
          <el-form-item label="设备号" prop="deviceNo">
            <el-input v-model="bindingQuery.deviceNo" placeholder="设备号" clearable style="width: 180px" @keyup.enter="handleBindingQuery" />
          </el-form-item>
          <el-form-item label="护工" prop="keyword">
            <el-input v-model="bindingQuery.keyword" placeholder="姓名 / 手机号" clearable style="width: 180px" @keyup.enter="handleBindingQuery" />
          </el-form-item>
          <el-form-item label="当前有效" prop="isCurrent">
            <el-switch v-model="bindingQuery.isCurrent" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleBindingQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetBindingQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="bindingLoading" :data="bindingList">
          <el-table-column label="设备号" min-width="180" prop="deviceNo" />
          <el-table-column label="护工" min-width="180" prop="caregiverName" />
          <el-table-column label="手机号" width="150" prop="caregiverPhone" />
          <el-table-column label="状态" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row.bindStatus === 'BOUND' && !row.unbindAt ? 'success' : 'info'">{{ row.bindStatus === 'BOUND' && !row.unbindAt ? '当前' : '已解绑' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="绑定时间" width="170" align="center">
            <template #default="{ row }">{{ parseTime(row.bindAt) }}</template>
          </el-table-column>
          <el-table-column label="解绑时间" width="170" align="center">
            <template #default="{ row }">{{ row.unbindAt ? parseTime(row.unbindAt) : '-' }}</template>
          </el-table-column>
        </el-table>

        <pagination v-show="bindingTotal > 0" :total="bindingTotal" v-model:page="bindingQuery.pageNum" v-model:limit="bindingQuery.pageSize" @pagination="getBindingList" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog :title="deviceDialogTitle" v-model="deviceDialogOpen" width="520px" append-to-body>
      <el-form ref="deviceRef" :model="deviceForm" :rules="deviceRules" label-width="92px">
        <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
          <el-select v-model="deviceForm.tenantId" placeholder="请选择机构" filterable style="width: 100%">
            <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备号" prop="deviceNo">
          <el-input v-model="deviceForm.deviceNo" placeholder="请输入设备号" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="deviceForm.status">
            <el-radio label="0">启用</el-radio>
            <el-radio label="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="deviceForm.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="deviceDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="submitDevice">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog :title="bindDialogTitle" v-model="bindDialogOpen" width="720px" append-to-body>
      <el-alert type="info" :closable="false" class="mb16">租户侧绑定到租户护工档案，不要求给护工创建后台登录账号。</el-alert>
      <el-form ref="bindRef" :model="bindForm" :rules="bindRules" label-width="92px">
        <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
          <el-select v-model="bindForm.tenantId" placeholder="请选择机构" filterable style="width: 100%" @change="loadCaregiverOptions">
            <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备号" prop="deviceNo">
          <el-input v-model="bindForm.deviceNo" />
        </el-form-item>
        <el-form-item label="护工" prop="tenantCaregiverId">
          <el-select v-model="bindForm.tenantCaregiverId" placeholder="请选择护工" filterable style="width: 100%">
            <el-option v-for="item in caregiverOptions" :key="item.id" :label="`${item.realName} ${item.phone || ''}`" :value="item.id" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="submitBind">确定绑定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="TenantBadgeDevice">
import { computed, getCurrentInstance, reactive, ref, watch } from 'vue'
import useUserStore from '@/store/modules/user'
import { listTenant } from '@/api/system/tenant'
import {
  bindTenantBadge,
  createTenantDevice,
  deleteTenantDevice,
  listTenantBadgeBindings,
  listTenantCaregivers,
  listTenantDevices,
  unbindTenantBadge,
  updateTenantDevice,
} from '@/api/tenant-care'

const { proxy } = getCurrentInstance()
const userStore = useUserStore()
const isPlatformUser = computed(() => userStore.userScope === 'platform')
const tenantOptions = ref([])
const activeTab = ref('device')
const showSearch = ref(true)

const deviceLoading = ref(false)
const deviceList = ref([])
const deviceTotal = ref(0)
const deviceQuery = reactive({ pageNum: 1, pageSize: 10, tenantId: undefined, deviceNo: undefined, bindingStatus: undefined })

const bindingLoading = ref(false)
const bindingList = ref([])
const bindingTotal = ref(0)
const bindingQuery = reactive({ pageNum: 1, pageSize: 10, tenantId: undefined, deviceNo: undefined, keyword: undefined, isCurrent: true })

const bindDialogOpen = ref(false)
const bindDialogTitle = ref('绑定工牌')
const bindForm = reactive({ tenantId: undefined, deviceNo: '', tenantCaregiverId: undefined })
const caregiverOptions = ref([])
const deviceDialogOpen = ref(false)
const deviceDialogTitle = ref('新增设备')
const deviceForm = reactive({ id: undefined, tenantId: undefined, deviceNo: '', status: '0', remark: '' })
const deviceRules = {
  tenantId: [{ required: true, message: '请选择机构', trigger: 'change' }],
  deviceNo: [{ required: true, message: '请输入设备号', trigger: 'blur' }],
}
const bindRules = {
  tenantId: [{ required: true, message: '请选择机构', trigger: 'change' }],
  deviceNo: [{ required: true, message: '请输入设备号', trigger: 'blur' }],
  tenantCaregiverId: [{ required: true, message: '请选择护工', trigger: 'change' }],
}

function defaultTenantId() {
  return isPlatformUser.value ? undefined : userStore.tenantId || undefined
}

function loadTenantOptions() {
  if (!isPlatformUser.value) return
  listTenant({ pageNum: 1, pageSize: 200 }).then((res) => {
    tenantOptions.value = res.data?.list || []
  })
}

function getDeviceList() {
  deviceLoading.value = true
  listTenantDevices({ ...deviceQuery })
    .then((res) => {
      deviceList.value = res.data?.list || []
      deviceTotal.value = res.data?.total || 0
    })
    .finally(() => {
      deviceLoading.value = false
    })
}

function getBindingList() {
  bindingLoading.value = true
  listTenantBadgeBindings({ ...bindingQuery })
    .then((res) => {
      bindingList.value = res.data?.list || []
      bindingTotal.value = res.data?.total || 0
    })
    .finally(() => {
      bindingLoading.value = false
    })
}

function handleDeviceQuery() {
  deviceQuery.pageNum = 1
  getDeviceList()
}

function resetDeviceQuery() {
  Object.assign(deviceQuery, { pageNum: 1, pageSize: 10, tenantId: defaultTenantId(), deviceNo: undefined, bindingStatus: undefined })
  getDeviceList()
}

function handleBindingQuery() {
  bindingQuery.pageNum = 1
  getBindingList()
}

function resetBindingQuery() {
  Object.assign(bindingQuery, { pageNum: 1, pageSize: 10, tenantId: defaultTenantId(), deviceNo: undefined, keyword: undefined, isCurrent: true })
  getBindingList()
}

function loadCaregiverOptions() {
  const tenantId = isPlatformUser.value ? bindForm.tenantId : defaultTenantId()
  if (isPlatformUser.value && !tenantId) {
    caregiverOptions.value = []
    return
  }
  listTenantCaregivers({ pageNum: 1, pageSize: 200, tenantId, status: '0' }).then((res) => {
    caregiverOptions.value = res.data?.list || []
  })
}

function openDeviceDialog(row) {
  deviceDialogTitle.value = row?.id ? '编辑设备' : '新增设备'
  Object.assign(deviceForm, {
    id: row?.id,
    tenantId: row?.effectiveTenantId || row?.tenantId || deviceQuery.tenantId || defaultTenantId(),
    deviceNo: row?.deviceNo || '',
    status: row?.status || '0',
    remark: row?.remark || '',
  })
  deviceDialogOpen.value = true
}

function submitDevice() {
  proxy.$refs.deviceRef.validate((valid) => {
    if (!valid) return
    const request = deviceForm.id ? updateTenantDevice : createTenantDevice
    request({
      id: deviceForm.id,
      tenantId: deviceForm.tenantId,
      deviceNo: String(deviceForm.deviceNo || '').trim(),
      status: deviceForm.status,
      remark: deviceForm.remark,
    }).then(() => {
      proxy.$modal.msgSuccess('保存成功')
      deviceDialogOpen.value = false
      getDeviceList()
    })
  })
}

function openBindDialog(row) {
  bindDialogTitle.value = row?.bindingStatus === 'BOUND' ? '换绑工牌' : '绑定工牌'
  const rowTenantId = row?.currentBinding?.tenantId || row?.effectiveTenantId || row?.tenantId
  Object.assign(bindForm, {
    tenantId: rowTenantId || deviceQuery.tenantId || bindingQuery.tenantId || defaultTenantId(),
    deviceNo: row?.deviceNo || '',
    tenantCaregiverId: row?.currentBinding?.tenantCaregiverId || undefined,
  })
  loadCaregiverOptions()
  bindDialogOpen.value = true
}

function submitBind() {
  proxy.$refs.bindRef.validate((valid) => {
    if (!valid) return
    bindTenantBadge({ ...bindForm }).then(() => {
      proxy.$modal.msgSuccess('绑定成功')
      bindDialogOpen.value = false
      getDeviceList()
      getBindingList()
    })
  })
}

function handleUnbind(row) {
  const tenantId = row?.currentBinding?.tenantId || row?.effectiveTenantId || row?.tenantId
  proxy.$modal.confirm(`确认解绑设备 ${row.deviceNo} 吗？`).then(() => {
    return unbindTenantBadge({ tenantId, deviceNo: row.deviceNo })
  }).then(() => {
    proxy.$modal.msgSuccess('解绑成功')
    getDeviceList()
    getBindingList()
  }).catch(() => {})
}

function handleDeleteDevice(row) {
  proxy.$modal.confirm(`确认删除设备 ${row.deviceNo} 吗？`).then(() => {
    return deleteTenantDevice(row.id)
  }).then(() => {
    proxy.$modal.msgSuccess('删除成功')
    getDeviceList()
    getBindingList()
  }).catch(() => {})
}

watch(activeTab, (tab) => {
  if (tab === 'history' && bindingList.value.length === 0) getBindingList()
})

resetDeviceQuery()
resetBindingQuery()
loadTenantOptions()
</script>

<style scoped>
.tenant-device-page {
  background: #f5f7fa;
  min-height: 100%;
}

.workspace-tabs {
  padding: 0 16px 16px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.toolbar-form {
  margin: 14px 0 8px;
}

.empty-text {
  color: #909399;
}

.mb16 {
  margin-bottom: 16px;
}
</style>
