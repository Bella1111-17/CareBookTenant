<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
      <el-form-item label="租户编码" prop="tenantCode">
        <el-input
          v-model="queryParams.tenantCode"
          placeholder="请输入租户编码"
          clearable
          style="width: 220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="租户名称" prop="tenantName">
        <el-input
          v-model="queryParams.tenantName"
          placeholder="请输入租户名称"
          clearable
          style="width: 220px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="请选择状态" clearable style="width: 160px">
          <el-option v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.label" :value="dict.value" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="primary" plain icon="Plus" @click="handleAdd" v-hasPermi="['system:tenant:add']">新增</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="success" plain icon="Edit" :disabled="single" @click="handleUpdate()" v-hasPermi="['system:tenant:edit']">修改</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="tenantList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="租户ID" align="center" prop="tenantId" min-width="220" show-overflow-tooltip />
      <el-table-column label="租户编码" align="center" prop="tenantCode" min-width="180" show-overflow-tooltip />
      <el-table-column label="租户名称" align="center" prop="tenantName" min-width="180" show-overflow-tooltip />
      <el-table-column label="联系人" align="center" prop="contactName" width="120" />
      <el-table-column label="联系电话" align="center" prop="contactPhone" width="140" />
      <el-table-column label="状态" align="center" prop="status" width="100">
        <template #default="scope">
          <dict-tag :options="sys_normal_disable" :value="scope.row.status" />
        </template>
      </el-table-column>
      <el-table-column label="创建时间" align="center" prop="createTime" width="170">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" align="center" width="220" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleUpdate(scope.row)" v-hasPermi="['system:tenant:edit']">修改</el-button>
          <el-button link type="success" icon="User" @click="handleInitAdmin(scope.row)" v-hasPermi="['system:tenant:edit']">初始化管理员</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination
      v-show="total > 0"
      :total="total"
      v-model:page="queryParams.pageNum"
      v-model:limit="queryParams.pageSize"
      @pagination="getList"
    />

    <el-dialog :title="title" v-model="open" width="620px" append-to-body>
      <el-form ref="tenantRef" :model="form" :rules="rules" label-width="100px">
        <el-form-item label="租户编码" prop="tenantCode">
          <el-input v-model="form.tenantCode" placeholder="请输入租户编码" maxlength="64" />
        </el-form-item>
        <el-form-item label="租户名称" prop="tenantName">
          <el-input v-model="form.tenantName" placeholder="请输入租户名称" maxlength="100" />
        </el-form-item>
        <el-form-item label="联系人" prop="contactName">
          <el-input v-model="form.contactName" placeholder="请输入联系人" maxlength="64" />
        </el-form-item>
        <el-form-item label="联系电话" prop="contactPhone">
          <el-input v-model="form.contactPhone" placeholder="请输入联系电话" maxlength="32" />
        </el-form-item>
        <el-form-item label="状态" prop="status">
          <el-radio-group v-model="form.status">
            <el-radio v-for="dict in sys_normal_disable" :key="dict.value" :label="dict.value">{{ dict.label }}</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="备注" prop="remark">
          <el-input v-model="form.remark" type="textarea" placeholder="请输入备注" maxlength="500" show-word-limit />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitForm">确 定</el-button>
          <el-button @click="cancel">取 消</el-button>
        </div>
      </template>
    </el-dialog>

    <el-dialog title="初始化租户管理员" v-model="adminOpen" width="620px" append-to-body>
      <el-alert
        v-if="currentTenant"
        type="info"
        :closable="false"
        show-icon
        :title="`当前租户：${currentTenant.tenantName}（${currentTenant.tenantCode}）`"
        class="mb16"
      />
      <el-form ref="adminRef" :model="adminForm" :rules="adminRules" label-width="100px">
        <el-form-item label="管理员账号" prop="userName">
          <el-input v-model="adminForm.userName" placeholder="建议使用租户编码_admin" maxlength="30" />
        </el-form-item>
        <el-form-item label="管理员密码" prop="password">
          <el-input v-model="adminForm.password" type="password" show-password placeholder="请输入管理员密码" maxlength="200" />
        </el-form-item>
        <el-form-item label="管理员昵称" prop="nickName">
          <el-input v-model="adminForm.nickName" placeholder="请输入管理员昵称" maxlength="30" />
        </el-form-item>
        <el-form-item label="手机号" prop="phonenumber">
          <el-input v-model="adminForm.phonenumber" placeholder="请输入手机号" maxlength="11" />
        </el-form-item>
        <el-form-item label="邮箱" prop="email">
          <el-input v-model="adminForm.email" placeholder="请输入邮箱" maxlength="50" />
        </el-form-item>
      </el-form>
      <template #footer>
        <div class="dialog-footer">
          <el-button type="primary" @click="submitAdminForm">确 定</el-button>
          <el-button @click="cancelAdmin">取 消</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="Tenant">
import { addTenant, getTenant, initTenantAdmin, listTenant, updateTenant } from '@/api/system/tenant'

const { proxy } = getCurrentInstance()
const { sys_normal_disable } = proxy.useDict('sys_normal_disable')

const tenantList = ref([])
const loading = ref(true)
const showSearch = ref(true)
const ids = ref([])
const single = ref(true)
const total = ref(0)
const title = ref('')
const open = ref(false)
const adminOpen = ref(false)
const currentTenant = ref(null)

const data = reactive({
  queryParams: {
    pageNum: 1,
    pageSize: 10,
    tenantCode: undefined,
    tenantName: undefined,
    status: undefined,
  },
  form: {
    tenantId: undefined,
    tenantCode: '',
    tenantName: '',
    contactName: '',
    contactPhone: '',
    status: '0',
    remark: '',
  },
  adminForm: {
    userName: '',
    password: '',
    nickName: '',
    phonenumber: '',
    email: '',
  },
  rules: {
    tenantCode: [{ required: true, message: '租户编码不能为空', trigger: 'blur' }],
    tenantName: [{ required: true, message: '租户名称不能为空', trigger: 'blur' }],
  },
  adminRules: {
    userName: [{ required: true, message: '管理员账号不能为空', trigger: 'blur' }],
    password: [{ required: true, message: '管理员密码不能为空', trigger: 'blur' }],
    nickName: [{ required: true, message: '管理员昵称不能为空', trigger: 'blur' }],
  },
})

const { queryParams, form, adminForm, rules, adminRules } = toRefs(data)

function getList() {
  loading.value = true
  listTenant(queryParams.value).then((res) => {
    tenantList.value = res.data.list
    total.value = res.data.total
    loading.value = false
  }).catch(() => {
    loading.value = false
  })
}

function resetFormState() {
  form.value = {
    tenantId: undefined,
    tenantCode: '',
    tenantName: '',
    contactName: '',
    contactPhone: '',
    status: '0',
    remark: '',
  }
  proxy.resetForm('tenantRef')
}

function resetAdminFormState() {
  adminForm.value = {
    userName: '',
    password: '',
    nickName: '',
    phonenumber: '',
    email: '',
  }
  proxy.resetForm('adminRef')
}

function buildSuggestedAdminUserName(tenant) {
  const tenantCode = String(tenant?.tenantCode || '').trim().toLowerCase()
  return tenantCode ? `${tenantCode}_admin` : ''
}

function handleQuery() {
  queryParams.value.pageNum = 1
  getList()
}

function resetQuery() {
  proxy.resetForm('queryRef')
  handleQuery()
}

function handleSelectionChange(selection) {
  ids.value = selection.map((item) => item.tenantId)
  single.value = selection.length !== 1
}

function handleAdd() {
  resetFormState()
  open.value = true
  title.value = '新增租户'
}

function handleUpdate(row) {
  const tenantId = row?.tenantId || ids.value[0]
  if (!tenantId) return
  resetFormState()
  getTenant(tenantId).then((res) => {
    Object.assign(form.value, res.data || {})
    if (!form.value.status) form.value.status = '0'
    open.value = true
    title.value = '修改租户'
  })
}

function submitForm() {
  proxy.$refs.tenantRef.validate((valid) => {
    if (!valid) return
    const request = form.value.tenantId ? updateTenant(form.value) : addTenant(form.value)
    request.then(() => {
      proxy.$modal.msgSuccess(form.value.tenantId ? '修改成功' : '新增成功')
      open.value = false
      getList()
    })
  })
}

function cancel() {
  open.value = false
  resetFormState()
}

function handleInitAdmin(row) {
  currentTenant.value = row
  resetAdminFormState()
  adminForm.value.userName = buildSuggestedAdminUserName(row)
  adminForm.value.nickName = row?.tenantName ? `${row.tenantName}管理员` : ''
  adminOpen.value = true
}

function submitAdminForm() {
  proxy.$refs.adminRef.validate((valid) => {
    if (!valid || !currentTenant.value?.tenantId) return
    initTenantAdmin(currentTenant.value.tenantId, adminForm.value).then((res) => {
      proxy.$modal.msgSuccess(`初始化成功，管理员用户ID：${res.data.adminUserId}`)
      adminOpen.value = false
      resetAdminFormState()
    })
  })
}

function cancelAdmin() {
  adminOpen.value = false
  currentTenant.value = null
  resetAdminFormState()
}

getList()
</script>

<style scoped>
.mb16 {
  margin-bottom: 16px;
}
</style>
