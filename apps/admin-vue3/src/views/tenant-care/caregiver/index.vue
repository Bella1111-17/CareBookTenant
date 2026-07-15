<template>
  <div class="app-container tenant-care-page">
    <el-form ref="queryRef" :model="queryParams" :inline="true" v-show="showSearch" class="toolbar-form">
      <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
        <el-select v-model="queryParams.tenantId" placeholder="全部机构" clearable filterable style="width: 220px" @change="handleTenantChange">
          <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
        </el-select>
      </el-form-item>
      <el-form-item label="护理单元" prop="orgUnitId">
        <el-select v-model="queryParams.orgUnitId" placeholder="全部单元" clearable filterable style="width: 180px">
          <el-option v-for="item in orgUnitOptions" :key="item.id" :label="item.unitName" :value="item.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="关键词" prop="keyword">
        <el-input v-model="queryParams.keyword" placeholder="姓名 / 手机号" clearable style="width: 220px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部" clearable style="width: 120px">
          <el-option label="启用" value="0" />
          <el-option label="停用" value="1" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="openCaregiverDialog()" v-hasPermi="['tenant-care:caregiver:add']">新增护工</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="OfficeBuilding" @click="openOrgUnitDialog()" v-hasPermi="['tenant-care:org-unit:add']">护理单元</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="caregiverList">
      <el-table-column label="护工ID" width="90" align="center">
        <template #default="{ $index }">{{ (queryParams.pageNum - 1) * queryParams.pageSize + $index + 1 }}</template>
      </el-table-column>
      <el-table-column label="姓名" min-width="140" align="center" prop="realName" />
      <el-table-column label="手机号" width="150" align="center" prop="phone" />
      <el-table-column label="护理单元" min-width="160" align="center">
        <template #default="{ row }">{{ row.orgUnitName || '-' }}</template>
      </el-table-column>
      <el-table-column label="技能标签" min-width="220" align="center">
        <template #default="{ row }">
          <el-tag v-for="tag in row.skillTags || []" :key="tag" class="tag-item" size="small">{{ tag }}</el-tag>
          <span v-if="!row.skillTags?.length" class="empty-text">-</span>
        </template>
      </el-table-column>
      <el-table-column label="资质" min-width="180" align="center" prop="qualification" show-overflow-tooltip />
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="row.status === '0' ? 'success' : 'danger'">{{ row.status === '0' ? '启用' : '停用' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="更新时间" width="170" align="center">
        <template #default="{ row }">{{ parseTime(row.updateTime) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="170" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" icon="EditPen" @click="openCaregiverDialog(row)" v-hasPermi="['tenant-care:caregiver:edit']">编辑</el-button>
          <el-button link type="danger" icon="Delete" @click="handleDeleteCaregiver(row)" v-hasPermi="['tenant-care:caregiver:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog :title="caregiverDialogTitle" v-model="caregiverDialogOpen" width="640px" append-to-body>
      <el-form ref="caregiverRef" :model="caregiverForm" :rules="caregiverRules" label-width="96px">
        <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
          <el-select v-model="caregiverForm.tenantId" placeholder="请选择机构" filterable style="width: 100%" @change="loadOrgUnitOptions">
            <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
          </el-select>
        </el-form-item>
        <el-form-item label="姓名" prop="realName">
          <el-input v-model="caregiverForm.realName" maxlength="64" placeholder="请输入护工姓名" />
        </el-form-item>
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="caregiverForm.phone" maxlength="32" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="护理单元" prop="orgUnitId">
          <el-select v-model="caregiverForm.orgUnitId" placeholder="请选择护理单元" clearable filterable style="width: 100%">
            <el-option v-for="item in orgUnitOptions" :key="item.id" :label="item.unitName" :value="item.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="caregiverForm.status">
            <el-radio label="0">启用</el-radio>
            <el-radio label="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="资质" prop="qualification">
          <el-input v-model="caregiverForm.qualification" maxlength="500" placeholder="资质/证书说明" />
        </el-form-item>
        <el-form-item label="健康证" prop="healthCertificate">
          <el-input v-model="caregiverForm.healthCertificate" maxlength="1000" placeholder="健康证材料或编号" />
        </el-form-item>
        <el-form-item label="技能标签" prop="skillTagsText">
          <el-input v-model="caregiverForm.skillTagsText" placeholder="用逗号分隔，例如：失能照护,康复陪护" />
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="caregiverForm.remark" type="textarea" :rows="3" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="caregiverDialogOpen = false">取消</el-button>
        <el-button type="primary" @click="submitCaregiver">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog :title="orgUnitDialogTitle" v-model="orgUnitDialogOpen" width="520px" append-to-body>
      <el-form ref="orgUnitRef" :model="orgUnitForm" :rules="orgUnitRules" label-width="96px">
        <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
          <el-select v-model="orgUnitForm.tenantId" placeholder="请选择机构" filterable style="width: 100%">
            <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
          </el-select>
        </el-form-item>
        <el-form-item label="单元名称" prop="unitName">
          <el-input v-model="orgUnitForm.unitName" maxlength="100" placeholder="例如：三楼失能护理区" />
        </el-form-item>
        <el-form-item label="排序" prop="sortOrder">
          <el-input-number v-model="orgUnitForm.sortOrder" :min="0" style="width: 160px" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="orgUnitForm.status">
            <el-radio label="0">启用</el-radio>
            <el-radio label="1">停用</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <el-table :data="orgUnitOptions" size="small" class="org-unit-table">
        <el-table-column label="单元" align="center" prop="unitName" />
        <el-table-column label="排序" width="80" align="center" prop="sortOrder" />
        <el-table-column label="操作" width="90" align="center">
          <template #default="{ row }">
            <el-button link type="primary" @click="editOrgUnit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="orgUnitDialogOpen = false">关闭</el-button>
        <el-button type="primary" @click="submitOrgUnit">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="TenantCaregiver">
import { computed, getCurrentInstance, reactive, ref, toRefs } from 'vue'
import useUserStore from '@/store/modules/user'
import { listTenant } from '@/api/system/tenant'
import {
  createTenantCaregiver,
  createTenantOrgUnit,
  deleteTenantCaregiver,
  listTenantCaregivers,
  listTenantOrgUnits,
  updateTenantCaregiver,
  updateTenantOrgUnit,
} from '@/api/tenant-care'

const { proxy } = getCurrentInstance()
const userStore = useUserStore()
const isPlatformUser = computed(() => userStore.userScope === 'platform')
const tenantOptions = ref([])
const orgUnitOptions = ref([])
const caregiverList = ref([])
const loading = ref(false)
const showSearch = ref(true)
const total = ref(0)

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, tenantId: undefined, orgUnitId: undefined, keyword: undefined, status: undefined },
})
const { queryParams } = toRefs(data)

const caregiverDialogOpen = ref(false)
const caregiverDialogTitle = ref('新增护工')
const caregiverForm = reactive({
  id: undefined,
  tenantId: undefined,
  realName: '',
  phone: '',
  orgUnitId: undefined,
  status: '0',
  qualification: '',
  healthCertificate: '',
  skillTagsText: '',
  remark: '',
})

const orgUnitDialogOpen = ref(false)
const orgUnitDialogTitle = ref('护理单元')
const orgUnitForm = reactive({ id: undefined, tenantId: undefined, unitName: '', sortOrder: 0, status: '0' })

const caregiverRules = {
  tenantId: [{ required: true, message: '请选择机构', trigger: 'change' }],
  realName: [{ required: true, message: '请输入姓名', trigger: 'blur' }],
}
const orgUnitRules = {
  tenantId: [{ required: true, message: '请选择机构', trigger: 'change' }],
  unitName: [{ required: true, message: '请输入护理单元名称', trigger: 'blur' }],
}

function currentTenantId() {
  return isPlatformUser.value ? undefined : userStore.tenantId || undefined
}

function selectedTenantId() {
  return isPlatformUser.value ? queryParams.value.tenantId : userStore.tenantId
}

function loadTenantOptions() {
  if (!isPlatformUser.value) return Promise.resolve()
  return listTenant({ pageNum: 1, pageSize: 200 }).then((res) => {
    tenantOptions.value = res.data?.list || []
  })
}

function loadOrgUnitOptions(tenantId = selectedTenantId()) {
  return listTenantOrgUnits({ tenantId: isPlatformUser.value ? tenantId : currentTenantId() }).then((res) => {
    orgUnitOptions.value = res.data?.list || []
  })
}

function getList() {
  loading.value = true
  const query = { ...queryParams.value }
  if (!query.tenantId) delete query.tenantId
  if (!query.orgUnitId) delete query.orgUnitId
  listTenantCaregivers(query)
    .then((res) => {
      caregiverList.value = res.data?.list || []
      total.value = res.data?.total || 0
    })
    .finally(() => {
      loading.value = false
    })
}

function handleTenantChange() {
  queryParams.value.orgUnitId = undefined
  loadOrgUnitOptions()
  handleQuery()
}

function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

function resetQuery() {
  proxy.resetForm('queryRef')
  queryParams.value.tenantId = undefined
  queryParams.value.orgUnitId = undefined
  handleQuery()
  loadOrgUnitOptions()
}

function resetCaregiverForm() {
  Object.assign(caregiverForm, {
    id: undefined,
    tenantId: selectedTenantId(),
    realName: '',
    phone: '',
    orgUnitId: undefined,
    status: '0',
    qualification: '',
    healthCertificate: '',
    skillTagsText: '',
    remark: '',
  })
}

function openCaregiverDialog(row) {
  resetCaregiverForm()
  if (row) {
    caregiverDialogTitle.value = '编辑护工'
    Object.assign(caregiverForm, {
      id: row.id,
      tenantId: row.tenantId || selectedTenantId(),
      realName: row.realName || '',
      phone: row.phone || '',
      orgUnitId: row.orgUnitId || undefined,
      status: row.status || '0',
      qualification: row.qualification || '',
      healthCertificate: row.healthCertificate || '',
      skillTagsText: (row.skillTags || []).join(','),
      remark: row.remark || '',
    })
  } else {
    caregiverDialogTitle.value = '新增护工'
  }
  loadOrgUnitOptions(caregiverForm.tenantId)
  caregiverDialogOpen.value = true
}

function submitCaregiver() {
  proxy.$refs.caregiverRef.validate((valid) => {
    if (!valid) return
    const payload = {
      id: caregiverForm.id,
      tenantId: caregiverForm.tenantId,
      realName: caregiverForm.realName,
      phone: caregiverForm.phone,
      orgUnitId: caregiverForm.orgUnitId,
      status: caregiverForm.status,
      qualification: caregiverForm.qualification,
      healthCertificate: caregiverForm.healthCertificate,
      skillTags: String(caregiverForm.skillTagsText || '').split(/[，,]/).map((item) => item.trim()).filter(Boolean),
      remark: caregiverForm.remark,
    }
    const request = caregiverForm.id ? updateTenantCaregiver : createTenantCaregiver
    request(payload).then(() => {
      proxy.$modal.msgSuccess('保存成功')
      caregiverDialogOpen.value = false
      getList()
    })
  })
}

function handleDeleteCaregiver(row) {
  proxy.$modal.confirm(`确认删除护工 ${row.realName || row.id} 吗？`).then(() => {
    return deleteTenantCaregiver(row.id)
  }).then(() => {
    proxy.$modal.msgSuccess('删除成功')
    getList()
  }).catch(() => {})
}

function resetOrgUnitForm() {
  Object.assign(orgUnitForm, { id: undefined, tenantId: selectedTenantId(), unitName: '', sortOrder: 0, status: '0' })
}

function openOrgUnitDialog() {
  resetOrgUnitForm()
  orgUnitDialogTitle.value = '护理单元'
  loadOrgUnitOptions(orgUnitForm.tenantId)
  orgUnitDialogOpen.value = true
}

function editOrgUnit(row) {
  Object.assign(orgUnitForm, {
    id: row.id,
    tenantId: row.tenantId || selectedTenantId(),
    unitName: row.unitName,
    sortOrder: row.sortOrder || 0,
    status: row.status || '0',
  })
}

function submitOrgUnit() {
  proxy.$refs.orgUnitRef.validate((valid) => {
    if (!valid) return
    const request = orgUnitForm.id ? updateTenantOrgUnit : createTenantOrgUnit
    request({ ...orgUnitForm }).then(() => {
      proxy.$modal.msgSuccess('保存成功')
      resetOrgUnitForm()
      loadOrgUnitOptions()
    })
  })
}

loadTenantOptions()
loadOrgUnitOptions()
getList()
</script>

<style scoped>
.tenant-care-page {
  background: #f5f7fa;
  min-height: 100%;
}

.toolbar-form {
  padding: 16px 16px 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.tag-item {
  margin-right: 6px;
}

.empty-text {
  color: #909399;
}

.org-unit-table {
  margin-top: 12px;
}
</style>
