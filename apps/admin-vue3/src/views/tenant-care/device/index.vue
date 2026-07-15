<template>
  <div class="tenant-device-workspace">
    <SummaryCards :summary="summary" :loading="summaryLoading" @select="openSummaryDetail" />

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
          <el-form-item label="护工绑定" prop="bindingStatus">
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
          <el-table-column label="ID" width="80" align="center">
            <template #default="{ $index }">{{ (deviceQuery.pageNum - 1) * deviceQuery.pageSize + $index + 1 }}</template>
          </el-table-column>
          <el-table-column label="设备号" min-width="170" align="center" prop="deviceNo" />
          <el-table-column v-if="isPlatformUser" label="当前机构" min-width="160" align="center">
            <template #default="{ row }">{{ row.tenantName || tenantName(row.effectiveTenantId || row.tenantId) || '-' }}</template>
          </el-table-column>
          <el-table-column label="护工绑定" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row.bindingStatus === 'BOUND' ? 'success' : 'info'">{{ row.bindingStatus === 'BOUND' ? '已绑定' : '空闲' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="当前护工" min-width="150" align="center">
            <template #default="{ row }">{{ row.currentBinding?.caregiverName || '-' }}</template>
          </el-table-column>
          <el-table-column label="手机号" width="140" align="center">
            <template #default="{ row }">{{ row.currentBinding?.caregiverPhone || '-' }}</template>
          </el-table-column>
          <el-table-column label="最近分发" width="165" align="center">
            <template #default="{ row }">{{ row.lastDistributedAt ? parseTime(row.lastDistributedAt) : '-' }}</template>
          </el-table-column>
          <el-table-column label="最近绑定" width="165" align="center">
            <template #default="{ row }">{{ row.lastBoundAt ? parseTime(row.lastBoundAt) : '-' }}</template>
          </el-table-column>
          <el-table-column label="最近上报" width="165" align="center">
            <template #default="{ row }">{{ row.lastSeenAt ? parseTime(row.lastSeenAt) : '-' }}</template>
          </el-table-column>
          <el-table-column label="最近数据" width="120" align="center" prop="lastDataType" />
          <el-table-column label="操作" width="420" align="center" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" icon="EditPen" @click="openDeviceDialog(row)" v-hasPermi="['tenant-care:badge:edit']">编辑</el-button>
              <el-button v-if="isPlatformUser" link type="primary" icon="Position" @click="openDistributeDialog(row)">分发</el-button>
              <el-button v-if="isPlatformUser && (row.effectiveTenantId || row.tenantId)" link type="warning" icon="Back" @click="openReclaimDialog(row)">收回</el-button>
              <el-button link type="primary" icon="Switch" @click="openBindDialog(row)" v-hasPermi="['tenant-care:badge:bind']">
                {{ row.bindingStatus === 'BOUND' ? '换绑' : '绑定' }}
              </el-button>
              <el-button v-if="row.bindingStatus === 'BOUND'" link type="danger" icon="Remove" @click="openUnbindDialog(row)" v-hasPermi="['tenant-care:badge:unbind']">解绑</el-button>
              <el-button v-else link type="danger" icon="Delete" @click="handleDeleteDevice(row)" v-hasPermi="['tenant-care:badge:remove']">删除</el-button>
              <el-button link type="primary" icon="Share" @click="openFlowDialog(row)">流转</el-button>
            </template>
          </el-table-column>
        </el-table>

        <pagination v-show="deviceTotal > 0" :total="deviceTotal" v-model:page="deviceQuery.pageNum" v-model:limit="deviceQuery.pageSize" @pagination="getDeviceList" />
      </el-tab-pane>

      <el-tab-pane v-if="isPlatformUser" label="平台分发历史" name="tenantHistory">
        <el-form :model="tenantBindingQuery" :inline="true" class="toolbar-form">
          <el-form-item label="机构" prop="tenantId">
            <el-select v-model="tenantBindingQuery.tenantId" placeholder="全部机构" clearable filterable style="width: 220px">
              <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
            </el-select>
          </el-form-item>
          <el-form-item label="设备号" prop="deviceNo">
            <el-input v-model="tenantBindingQuery.deviceNo" placeholder="设备号" clearable style="width: 180px" @keyup.enter="handleTenantBindingQuery" />
          </el-form-item>
          <el-form-item label="当前有效" prop="isCurrent">
            <el-switch v-model="tenantBindingQuery.isCurrent" />
          </el-form-item>
          <el-form-item label="时间">
            <el-date-picker v-model="tenantBindingDateRange" value-format="YYYY-MM-DD" type="daterange" range-separator="-" start-placeholder="开始日期" end-placeholder="结束日期" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleTenantBindingQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetTenantBindingQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="tenantBindingLoading" :data="tenantBindingList">
          <el-table-column label="设备号" min-width="170" align="center" prop="deviceNo" />
          <el-table-column label="机构" min-width="160" align="center">
            <template #default="{ row }">{{ row.tenantName ?? tenantName(row.tenantId) ?? row.tenantId }}</template>
          </el-table-column>
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.bindStatus === 'BOUND' && !row.unbindAt ? 'success' : 'info'">{{ row.bindStatus === 'BOUND' && !row.unbindAt ? '当前' : '已收回' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="分发时间" width="165" align="center">
            <template #default="{ row }">{{ row.bindAt ? parseTime(row.bindAt) : '-' }}</template>
          </el-table-column>
          <el-table-column label="收回时间" width="165" align="center">
            <template #default="{ row }">{{ row.unbindAt ? parseTime(row.unbindAt) : '-' }}</template>
          </el-table-column>
          <el-table-column label="说明" min-width="180" align="center" prop="unbindReason" show-overflow-tooltip />
          <el-table-column label="操作人" width="130" align="center">
            <template #default="{ row }">{{ row.unbindOperatorName || row.bindOperatorName || '-' }}</template>
          </el-table-column>
        </el-table>
        <pagination v-show="tenantBindingTotal > 0" :total="tenantBindingTotal" v-model:page="tenantBindingQuery.pageNum" v-model:limit="tenantBindingQuery.pageSize" @pagination="getTenantBindingList" />
      </el-tab-pane>

      <el-tab-pane label="护工绑定历史" name="history">
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
          <el-form-item label="时间">
            <el-date-picker v-model="bindingDateRange" value-format="YYYY-MM-DD" type="daterange" range-separator="-" start-placeholder="开始日期" end-placeholder="结束日期" />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" icon="Search" @click="handleBindingQuery">搜索</el-button>
            <el-button icon="Refresh" @click="resetBindingQuery">重置</el-button>
          </el-form-item>
        </el-form>

        <el-table v-loading="bindingLoading" :data="bindingList">
          <el-table-column label="设备号" min-width="170" align="center" prop="deviceNo" />
          <el-table-column label="护工" min-width="150" align="center" prop="caregiverName" />
          <el-table-column label="手机号" width="140" align="center" prop="caregiverPhone" />
          <el-table-column label="状态" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.bindStatus === 'BOUND' && !row.unbindAt ? 'success' : 'info'">{{ row.bindStatus === 'BOUND' && !row.unbindAt ? '当前' : '已解绑' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="绑定时间" width="165" align="center">
            <template #default="{ row }">{{ parseTime(row.bindAt) }}</template>
          </el-table-column>
          <el-table-column label="解绑时间" width="165" align="center">
            <template #default="{ row }">{{ row.unbindAt ? parseTime(row.unbindAt) : '-' }}</template>
          </el-table-column>
          <el-table-column label="解绑说明" min-width="180" align="center" prop="unbindReason" show-overflow-tooltip />
          <el-table-column label="操作人" width="130" align="center">
            <template #default="{ row }">{{ row.unbindOperatorName || row.bindOperatorName || '-' }}</template>
          </el-table-column>
        </el-table>

        <pagination v-show="bindingTotal > 0" :total="bindingTotal" v-model:page="bindingQuery.pageNum" v-model:limit="bindingQuery.pageSize" @pagination="getBindingList" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog :title="summaryDetailTitle" v-model="summaryDetailOpen" width="860px" append-to-body>
      <el-table v-loading="summaryDetailLoading" :data="summaryDetailList">
        <el-table-column label="设备号" min-width="170" align="center" prop="deviceNo" />
        <el-table-column v-if="summaryDetailKind === 'tenant'" label="机构名称" min-width="180" align="center" prop="tenantName" />
        <el-table-column v-if="summaryDetailKind === 'tenant'" label="绑定设备数" width="120" align="center" prop="assignedDeviceCount" />
        <el-table-column v-if="summaryDetailKind === 'caregiver'" label="护工姓名" min-width="150" align="center" prop="caregiverName" />
        <el-table-column v-if="summaryDetailKind === 'caregiver'" label="手机号" width="150" align="center" prop="caregiverPhone" />
        <el-table-column v-if="summaryDetailKind === 'device'" label="当前护工" min-width="150" align="center">
          <template #default="{ row }">{{ row.currentBinding?.caregiverName || '-' }}</template>
        </el-table-column>
      </el-table>
      <pagination v-show="summaryDetailTotal > 0" :total="summaryDetailTotal" v-model:page="summaryDetailQuery.pageNum" v-model:limit="summaryDetailQuery.pageSize" @pagination="getSummaryDetailList" />
    </el-dialog>

    <el-dialog :title="deviceDialogTitle" v-model="deviceDialogOpen" width="520px" append-to-body>
      <el-form ref="deviceRef" :model="deviceForm" :rules="deviceRules" label-width="92px">
        <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
          <el-select v-model="deviceForm.tenantId" placeholder="平台库存可不选机构" clearable filterable style="width: 100%">
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

    <el-dialog title="分发设备" v-model="distributeDialogOpen" width="560px" append-to-body>
      <el-form ref="distributeRef" :model="distributeForm" :rules="distributeRules" label-width="104px">
        <el-form-item label="设备号" prop="deviceNo">
          <el-input v-model="distributeForm.deviceNo" disabled />
        </el-form-item>
        <el-form-item label="目标机构" prop="tenantId">
          <el-select v-model="distributeForm.tenantId" placeholder="请选择机构" filterable style="width: 100%">
            <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
          </el-select>
        </el-form-item>
        <el-form-item label="转分发说明" prop="unbindReason">
          <el-input v-model="distributeForm.unbindReason" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="设备已有机构时必填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="distributeDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="submitDistribute">确认分发</el-button>
      </template>
    </el-dialog>

    <el-dialog title="收回设备" v-model="reclaimDialogOpen" width="520px" append-to-body>
      <el-form ref="reclaimRef" :model="reclaimForm" :rules="reclaimRules" label-width="92px">
        <el-form-item label="设备号" prop="deviceNo">
          <el-input v-model="reclaimForm.deviceNo" disabled />
        </el-form-item>
        <el-form-item label="收回说明" prop="unbindReason">
          <el-input v-model="reclaimForm.unbindReason" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reclaimDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="submitReclaim">确认收回</el-button>
      </template>
    </el-dialog>

    <el-dialog :title="bindDialogTitle" v-model="bindDialogOpen" width="720px" append-to-body>
      <el-alert type="info" :closable="false" class="mb16">租户侧绑定到租户护工档案；换绑会自动关闭旧绑定并记录说明。</el-alert>
      <el-form ref="bindRef" :model="bindForm" :rules="bindRules" label-width="104px">
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
        <el-form-item label="换绑说明" prop="unbindReason">
          <el-input v-model="bindForm.unbindReason" type="textarea" :rows="3" maxlength="500" show-word-limit placeholder="设备或护工已有绑定时必填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bindDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="submitBind">确定绑定</el-button>
      </template>
    </el-dialog>

    <el-dialog title="解绑设备" v-model="unbindDialogOpen" width="520px" append-to-body>
      <el-form ref="unbindRef" :model="unbindForm" :rules="unbindRules" label-width="92px">
        <el-form-item label="设备号" prop="deviceNo">
          <el-input v-model="unbindForm.deviceNo" disabled />
        </el-form-item>
        <el-form-item label="解绑说明" prop="unbindReason">
          <el-input v-model="unbindForm.unbindReason" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="unbindDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="submitUnbind">确认解绑</el-button>
      </template>
    </el-dialog>

    <el-dialog :title="flowTitle" v-model="flowDialogOpen" width="760px" append-to-body>
      <div class="flow-header" v-loading="flowLoading">
        <div>
          <div class="flow-header__label">设备号</div>
          <div class="flow-header__value">{{ flowDeviceNo }}</div>
        </div>
        <div>
          <div class="flow-header__label">{{ isPlatformUser ? '当前机构' : '当前护工' }}</div>
          <div class="flow-header__value">{{ isPlatformUser ? (tenantName(flowCurrentTenantId) ?? flowCurrentTenantId ?? '平台库存') : (flowCurrentCaregiverName || '-') }}</div>
        </div>
      </div>
      <el-timeline class="device-flow">
        <el-timeline-item v-for="item in flowList" :key="`${item.eventType}-${item.eventTime}-${item.caregiverId || item.tenantId}`" :type="flowItemType(item.eventType)" :timestamp="item.eventTime ? parseTime(item.eventTime) : ''" placement="top">
          <div class="flow-item">
            <div class="flow-item__title">{{ item.statusText }}</div>
            <div class="flow-item__meta">
              <span v-if="item.operatorName">操作人：{{ item.operatorName }}</span>
              <span v-if="item.reason">说明：{{ item.reason }}</span>
            </div>
          </div>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-if="!flowLoading && flowList.length === 0" description="暂无流转记录" />
    </el-dialog>
    </div>
  </div>
</template>

<script setup name="TenantBadgeDevice">
import { computed, getCurrentInstance, reactive, ref, watch } from 'vue'
import useUserStore from '@/store/modules/user'
import { listTenant } from '@/api/system/tenant'
import SummaryCards from './components/SummaryCards.vue'
import {
  bindTenantBadge,
  createTenantDevice,
  deleteTenantDevice,
  distributeTenantDevice,
  listDeviceTenantBindings,
  listTenantBadgeBindings,
  listTenantCaregivers,
  listTenantDevices,
  reclaimTenantDevice,
  tenantDeviceFlow,
  tenantDeviceSummary,
  tenantDeviceSummaryDetail,
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
const summaryLoading = ref(false)
const summary = reactive({ totalDevices: 0, assignedDevices: 0, idleDevices: 0, boundTenants: 0, boundDevices: 0, boundCaregivers: 0 })
const summaryDetailOpen = ref(false)
const summaryDetailLoading = ref(false)
const summaryDetailTitle = ref('统计明细')
const summaryDetailKind = ref('device')
const summaryDetailList = ref([])
const summaryDetailTotal = ref(0)
const summaryDetailQuery = reactive({ pageNum: 1, pageSize: 10, type: 'totalDevices', tenantId: undefined })

const tenantBindingLoading = ref(false)
const tenantBindingList = ref([])
const tenantBindingTotal = ref(0)
const tenantBindingDateRange = ref([])
const tenantBindingQuery = reactive({ pageNum: 1, pageSize: 10, tenantId: undefined, deviceNo: undefined, isCurrent: true, beginTime: undefined, endTime: undefined })

const bindingLoading = ref(false)
const bindingList = ref([])
const bindingTotal = ref(0)
const bindingDateRange = ref([])
const bindingQuery = reactive({ pageNum: 1, pageSize: 10, tenantId: undefined, deviceNo: undefined, keyword: undefined, isCurrent: true, beginTime: undefined, endTime: undefined })

const deviceDialogOpen = ref(false)
const deviceDialogTitle = ref('新增设备')
const deviceForm = reactive({ id: undefined, tenantId: undefined, deviceNo: '', status: '0', remark: '' })
const deviceRules = {
  deviceNo: [{ required: true, message: '请输入设备号', trigger: 'blur' }],
}

const distributeDialogOpen = ref(false)
const distributeForm = reactive({ tenantId: undefined, deviceNo: '', unbindReason: '' })
const distributeRules = {
  tenantId: [{ required: true, message: '请选择机构', trigger: 'change' }],
  deviceNo: [{ required: true, message: '请输入设备号', trigger: 'blur' }],
}

const reclaimDialogOpen = ref(false)
const reclaimForm = reactive({ tenantId: undefined, deviceNo: '', unbindReason: '' })
const reclaimRules = {
  deviceNo: [{ required: true, message: '请输入设备号', trigger: 'blur' }],
  unbindReason: [{ required: true, message: '请输入收回说明', trigger: 'blur' }],
}

const bindDialogOpen = ref(false)
const bindDialogTitle = ref('绑定工牌')
const bindForm = reactive({ tenantId: undefined, deviceNo: '', tenantCaregiverId: undefined, unbindReason: '' })
const caregiverOptions = ref([])
const bindRules = {
  tenantId: [{ required: true, message: '请选择机构', trigger: 'change' }],
  deviceNo: [{ required: true, message: '请输入设备号', trigger: 'blur' }],
  tenantCaregiverId: [{ required: true, message: '请选择护工', trigger: 'change' }],
}

const unbindDialogOpen = ref(false)
const unbindForm = reactive({ tenantId: undefined, deviceNo: '', unbindReason: '' })
const unbindRules = {
  unbindReason: [{ required: true, message: '请输入解绑说明', trigger: 'blur' }],
}

const flowDialogOpen = ref(false)
const flowLoading = ref(false)
const flowTitle = ref('设备流转')
const flowDeviceNo = ref('')
const flowCurrentTenantId = ref('')
const flowCurrentCaregiverName = ref('')
const flowList = ref([])

function defaultTenantId() {
  return isPlatformUser.value ? undefined : userStore.tenantId || undefined
}

function summaryTenantId() {
  return isPlatformUser.value ? deviceQuery.tenantId : defaultTenantId()
}

function tenantName(tenantId) {
  if (!tenantId) return ''
  return tenantOptions.value.find((item) => item.tenantId === tenantId)?.tenantName || ''
}

function loadTenantOptions() {
  if (!isPlatformUser.value) return
  listTenant({ pageNum: 1, pageSize: 200 }).then((res) => {
    tenantOptions.value = res.data?.list || []
  })
}

function withDateRange(query, range) {
  return {
    ...query,
    beginTime: range?.[0],
    endTime: range?.[1],
  }
}

function refreshDeviceWorkspace() {
  getDeviceList()
  getDeviceSummary()
  if (isPlatformUser.value) getTenantBindingList()
  getBindingList()
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

function getDeviceSummary() {
  summaryLoading.value = true
  tenantDeviceSummary({ tenantId: summaryTenantId() })
    .then((res) => {
      Object.assign(summary, {
        totalDevices: 0,
        assignedDevices: 0,
        idleDevices: 0,
        boundTenants: 0,
        boundDevices: 0,
        boundCaregivers: 0,
        ...(res.data || {}),
      })
    })
    .finally(() => {
      summaryLoading.value = false
    })
}

function getSummaryDetailKind(type) {
  if (type === 'boundTenants') return 'tenant'
  if (type === 'boundCaregivers') return 'caregiver'
  return 'device'
}

function openSummaryDetail(card) {
  summaryDetailTitle.value = card.label
  summaryDetailKind.value = getSummaryDetailKind(card.type)
  Object.assign(summaryDetailQuery, { pageNum: 1, pageSize: 10, type: card.type, tenantId: summaryTenantId() })
  summaryDetailOpen.value = true
  getSummaryDetailList()
}

function getSummaryDetailList() {
  summaryDetailLoading.value = true
  tenantDeviceSummaryDetail({ ...summaryDetailQuery, tenantId: summaryTenantId() })
    .then((res) => {
      summaryDetailList.value = res.data?.list || []
      summaryDetailTotal.value = res.data?.total || 0
    })
    .finally(() => {
      summaryDetailLoading.value = false
    })
}

function getTenantBindingList() {
  if (!isPlatformUser.value) return
  tenantBindingLoading.value = true
  listDeviceTenantBindings(withDateRange(tenantBindingQuery, tenantBindingDateRange.value))
    .then((res) => {
      tenantBindingList.value = res.data?.list || []
      tenantBindingTotal.value = res.data?.total || 0
    })
    .finally(() => {
      tenantBindingLoading.value = false
    })
}

function getBindingList() {
  bindingLoading.value = true
  listTenantBadgeBindings(withDateRange(bindingQuery, bindingDateRange.value))
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
  getDeviceSummary()
}

function resetDeviceQuery() {
  Object.assign(deviceQuery, { pageNum: 1, pageSize: 10, tenantId: defaultTenantId(), deviceNo: undefined, bindingStatus: undefined })
  getDeviceList()
  getDeviceSummary()
}

function handleTenantBindingQuery() {
  tenantBindingQuery.pageNum = 1
  getTenantBindingList()
}

function resetTenantBindingQuery() {
  tenantBindingDateRange.value = []
  Object.assign(tenantBindingQuery, { pageNum: 1, pageSize: 10, tenantId: undefined, deviceNo: undefined, isCurrent: true, beginTime: undefined, endTime: undefined })
  getTenantBindingList()
}

function handleBindingQuery() {
  bindingQuery.pageNum = 1
  getBindingList()
}

function resetBindingQuery() {
  bindingDateRange.value = []
  Object.assign(bindingQuery, { pageNum: 1, pageSize: 10, tenantId: defaultTenantId(), deviceNo: undefined, keyword: undefined, isCurrent: true, beginTime: undefined, endTime: undefined })
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
      refreshDeviceWorkspace()
    })
  })
}

function openDistributeDialog(row) {
  Object.assign(distributeForm, {
    tenantId: row?.effectiveTenantId || row?.tenantId || undefined,
    deviceNo: row?.deviceNo || '',
    unbindReason: '',
  })
  distributeDialogOpen.value = true
}

function submitDistribute() {
  proxy.$refs.distributeRef.validate((valid) => {
    if (!valid) return
    distributeTenantDevice({ ...distributeForm }).then(() => {
      proxy.$modal.msgSuccess('分发成功')
      distributeDialogOpen.value = false
      refreshDeviceWorkspace()
    })
  })
}

function openReclaimDialog(row) {
  Object.assign(reclaimForm, {
    tenantId: row?.effectiveTenantId || row?.tenantId,
    deviceNo: row?.deviceNo || '',
    unbindReason: '',
  })
  reclaimDialogOpen.value = true
}

function submitReclaim() {
  proxy.$refs.reclaimRef.validate((valid) => {
    if (!valid) return
    reclaimTenantDevice({ ...reclaimForm }).then(() => {
      proxy.$modal.msgSuccess('收回成功')
      reclaimDialogOpen.value = false
      refreshDeviceWorkspace()
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
    unbindReason: '',
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
      refreshDeviceWorkspace()
    })
  })
}

function openUnbindDialog(row) {
  const tenantId = row?.currentBinding?.tenantId || row?.effectiveTenantId || row?.tenantId
  Object.assign(unbindForm, { tenantId, deviceNo: row.deviceNo, unbindReason: '' })
  unbindDialogOpen.value = true
}

function submitUnbind() {
  proxy.$refs.unbindRef.validate((valid) => {
    if (!valid) return
    unbindTenantBadge({ ...unbindForm }).then(() => {
      proxy.$modal.msgSuccess('解绑成功')
      unbindDialogOpen.value = false
      refreshDeviceWorkspace()
    })
  })
}

function handleDeleteDevice(row) {
  proxy.$modal.confirm(`确认删除设备 ${row.deviceNo} 吗？`).then(() => {
    return deleteTenantDevice(row.id)
  }).then(() => {
    proxy.$modal.msgSuccess('删除成功')
    refreshDeviceWorkspace()
  }).catch(() => {})
}

function openFlowDialog(row) {
  flowDialogOpen.value = true
  flowLoading.value = true
  flowTitle.value = `设备流转 - ${row.deviceNo}`
  flowDeviceNo.value = row.deviceNo
  flowCurrentTenantId.value = row.effectiveTenantId || row.tenantId || ''
  flowCurrentCaregiverName.value = ''
  tenantDeviceFlow({ deviceNo: row.deviceNo, tenantId: isPlatformUser.value ? deviceQuery.tenantId : defaultTenantId() })
    .then((res) => {
      flowCurrentTenantId.value = res.data?.currentTenantId || flowCurrentTenantId.value
      flowCurrentCaregiverName.value = res.data?.currentCaregiverName || ''
      flowList.value = res.data?.list || []
    })
    .finally(() => {
      flowLoading.value = false
    })
}

function flowItemType(eventType) {
  if (eventType === 'TENANT_DISTRIBUTED' || eventType === 'CAREGIVER_BOUND') return 'success'
  if (eventType === 'TENANT_RECLAIMED') return 'warning'
  return 'info'
}

watch(activeTab, (tab) => {
  if (tab === 'tenantHistory' && tenantBindingList.value.length === 0) getTenantBindingList()
  if (tab === 'history' && bindingList.value.length === 0) getBindingList()
})

resetDeviceQuery()
resetBindingQuery()
loadTenantOptions()
</script>

<style scoped>
.tenant-device-workspace {
  background: #f5f7fa;
  min-height: 100%;
  padding: 20px;
}

.tenant-device-page {
  padding: 0;
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

.mb16 {
  margin-bottom: 16px;
}

.flow-header {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  padding: 12px 16px;
  margin-bottom: 16px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
}

.flow-header__label {
  color: #909399;
  font-size: 12px;
  line-height: 18px;
}

.flow-header__value {
  margin-top: 4px;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
  line-height: 24px;
}

.device-flow {
  padding: 4px 8px 0;
}

.flow-item__title {
  color: #303133;
  font-size: 14px;
  font-weight: 600;
  line-height: 22px;
}

.flow-item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 4px;
  color: #606266;
  font-size: 13px;
  line-height: 20px;
}

@media (max-width: 640px) {
  .flow-header {
    grid-template-columns: 1fr;
  }
}
</style>
