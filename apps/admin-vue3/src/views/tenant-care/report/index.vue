<template>
  <div class="app-container tenant-report-page">
    <el-form ref="queryRef" :model="queryParams" :inline="true" v-show="showSearch" class="toolbar-form">
      <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
        <el-select v-model="queryParams.tenantId" placeholder="全部机构" clearable filterable style="width: 220px">
          <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
        </el-select>
      </el-form-item>
      <el-form-item label="设备号" prop="deviceNo">
        <el-input v-model="queryParams.deviceNo" placeholder="请输入设备号" clearable style="width: 200px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="护工ID" prop="tenantCaregiverId">
        <el-input-number v-model="queryParams.tenantCaregiverId" :min="1" style="width: 150px" />
      </el-form-item>
      <el-form-item label="日报日期" prop="dateStr">
        <el-date-picker v-model="queryParams.dateStr" value-format="YYYY-MM-DD" type="date" placeholder="选择日期" style="width: 160px" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="warning" plain icon="EditPen" @click="openGenerateDialog" v-hasPermi="['tenant-care:report:generate']">生成单设备日报</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="reportList">
      <el-table-column label="ID" width="70" align="center" prop="id" />
      <el-table-column label="设备号" width="150" prop="deviceNo" show-overflow-tooltip />
      <el-table-column label="护工ID" width="100" align="center">
        <template #default="{ row }">{{ row.tenantCaregiverId || '——' }}</template>
      </el-table-column>
      <el-table-column label="护工名称" width="120" align="center" prop="caregiverName">
        <template #default="{ row }">{{ row.caregiverName || '-' }}</template>
      </el-table-column>
      <el-table-column label="日报日期" width="120" align="center" prop="reportDate" />
      <el-table-column label="切片数" width="90" align="center" prop="totalChunks" />
      <el-table-column label="录音时长" width="110" align="center">
        <template #default="{ row }">{{ formatMinute(row.totalDurationSeconds) }}</template>
      </el-table-column>
      <el-table-column label="生成状态" width="130" align="center">
        <template #default="{ row }">
          <el-tag :type="generationType(row.generationStatus)">{{ row.generationStatus || 'PENDING' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="质检状态" width="130" align="center">
        <template #default="{ row }">
          <el-tag :type="row.qualityStatus === 'NORMAL' ? 'success' : 'warning'">{{ row.qualityStatus || 'NORMAL' }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="AI摘要" min-width="300" show-overflow-tooltip>
        <template #default="{ row }">{{ row.reportCard?.aiSummary || row.summaryText || '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="170" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" icon="View" @click="showDetail(row)">详情</el-button>
          <el-button link type="success" icon="DataBoard" :disabled="!hasReportContent(row)" @click="showAnalysis(row)">分析</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />

    <el-dialog title="生成单设备租户日报" v-model="generateOpen" width="460px" append-to-body>
      <el-alert type="warning" :closable="false" class="mb16">批量生成已临时停用。请指定租户与设备号后手动生成，避免跨租户误聚合。</el-alert>
      <el-form ref="generateRef" :model="generateForm" :rules="generateRules" label-width="110px">
        <el-form-item label="测试模式">
          <el-checkbox v-model="generateForm.allowUnboundAnalysis">未绑定录音测试</el-checkbox>
        </el-form-item>
        <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
          <el-select v-model="generateForm.tenantId" placeholder="请选择机构" filterable style="width: 100%">
            <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
          </el-select>
        </el-form-item>
        <el-form-item label="设备号" prop="deviceNo">
          <el-input v-model="generateForm.deviceNo" placeholder="必须填写设备号" />
        </el-form-item>
        <el-form-item label="日报日期" prop="dateStr">
          <el-date-picker v-model="generateForm.dateStr" value-format="YYYY-MM-DD" type="date" placeholder="选择日期" style="width: 100%" />
        </el-form-item>
        <el-form-item v-if="generateForm.allowUnboundAnalysis" label="录音文件名" prop="fileName">
          <el-input v-model="generateForm.fileName" placeholder="请输入完整 mp3 文件名" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="generateOpen = false">取消</el-button>
        <el-button type="warning" :loading="generateLoading" @click="submitGenerate">生成</el-button>
      </template>
    </el-dialog>

    <el-dialog title="日报详情" v-model="detailOpen" width="860px" append-to-body>
      <div class="detail-shell">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="设备号">{{ detail.deviceNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="护工ID">{{ detail.tenantCaregiverId || '——' }}</el-descriptions-item>
          <el-descriptions-item label="护工名称">{{ detail.caregiverName || '-' }}</el-descriptions-item>
          <el-descriptions-item label="日报日期">{{ detail.reportDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="生成状态">{{ detail.generationStatus || '-' }}</el-descriptions-item>
          <el-descriptions-item label="录音时长">{{ formatMinute(detail.totalDurationSeconds) }}</el-descriptions-item>
          <el-descriptions-item label="讲话时长">{{ formatMinute(detail.totalSpeechSeconds) }}</el-descriptions-item>
        </el-descriptions>
        <section class="detail-section">
          <div class="section-title">AI 投喂时间线</div>
          <div class="text-panel muted">{{ detail.asrPayload || '暂无内容' }}</div>
        </section>
        <section class="detail-section">
          <div class="section-title">清洗后文本</div>
          <div class="text-panel">{{ detail.fullTranscript || '暂无内容' }}</div>
        </section>
      </div>
    </el-dialog>

    <el-dialog title="质检 / 风险分析" v-model="analysisOpen" width="920px" append-to-body>
      <div class="analysis-layout" v-if="analysis.reportCard">
        <section class="analysis-hero">
          <div class="analysis-hero__title">{{ analysis.reportDate }} 日报分析</div>
          <div class="analysis-hero__meta">设备 {{ analysis.deviceNo || '-' }} · 护工ID {{ analysis.tenantCaregiverId || '——' }} · 护工 {{ analysis.caregiverName || '-' }}</div>
          <div class="analysis-hero__summary">{{ analysis.reportCard.aiSummary || analysis.summaryText || '暂无 AI 摘要' }}</div>
        </section>
        <section class="analysis-grid">
          <article class="panel">
            <div class="panel-title">评分</div>
            <div class="score-line">
              <span class="score-value">{{ formatScore(analysis.reportCard.overallScore) }}</span>
              <span class="score-unit">/10</span>
            </div>
            <p class="panel-text">{{ analysis.reportCard.scoreComment || '暂无评分说明' }}</p>
          </article>
          <article class="panel">
            <div class="panel-title">任务完成</div>
            <div v-if="analysis.reportCard.tasksCompleted?.length" class="tag-list">
              <el-tag v-for="item in analysis.reportCard.tasksCompleted" :key="item">{{ item }}</el-tag>
            </div>
            <p v-else class="panel-text">暂无任务记录</p>
          </article>
        </section>
        <section class="analysis-grid">
          <article class="panel risk-panel">
            <div class="panel-title">风险提醒</div>
            <ul v-if="analysis.reportCard.riskAlerts?.length" class="plain-list">
              <li v-for="item in analysis.reportCard.riskAlerts" :key="item">{{ item }}</li>
            </ul>
            <p v-else class="panel-text">暂无明显风险</p>
          </article>
          <article class="panel">
            <div class="panel-title">服务亮点</div>
            <ul v-if="analysis.reportCard.highlights?.length" class="plain-list">
              <li v-for="item in analysis.reportCard.highlights" :key="item">{{ item }}</li>
            </ul>
            <p v-else class="panel-text">暂无服务亮点</p>
          </article>
        </section>
      </div>
    </el-dialog>
  </div>
</template>

<script setup name="TenantDailyReport">
import { computed, getCurrentInstance, reactive, ref, toRefs } from 'vue'
import useUserStore from '@/store/modules/user'
import { listTenant } from '@/api/system/tenant'
import { generateTenantDailyReport, listTenantDailyReports, tenantDailyReportDetail } from '@/api/tenant-care'

const { proxy } = getCurrentInstance()
const userStore = useUserStore()
const isPlatformUser = computed(() => userStore.userScope === 'platform')
const tenantOptions = ref([])
const reportList = ref([])
const loading = ref(false)
const showSearch = ref(true)
const total = ref(0)
const detailOpen = ref(false)
const detail = ref({})
const analysisOpen = ref(false)
const analysis = ref({})
const generateOpen = ref(false)
const generateLoading = ref(false)

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, tenantId: undefined, deviceNo: undefined, tenantCaregiverId: undefined, dateStr: undefined },
})
const { queryParams } = toRefs(data)

const generateForm = reactive({ tenantId: undefined, deviceNo: '', dateStr: '', fileName: '', allowUnboundAnalysis: false })
const generateRules = {
  tenantId: [
    {
      validator: (_rule, value, callback) => {
        if (isPlatformUser.value && !generateForm.allowUnboundAnalysis && !value) {
          callback(new Error('请选择机构'))
          return
        }
        callback()
      },
      trigger: 'change',
    },
  ],
  deviceNo: [{ required: true, message: '请输入设备号', trigger: 'blur' }],
  dateStr: [{ required: true, message: '请选择日报日期', trigger: 'change' }],
  fileName: [
    {
      validator: (_rule, value, callback) => {
        if (generateForm.allowUnboundAnalysis && !String(value || '').trim()) {
          callback(new Error('请输入完整 mp3 文件名'))
          return
        }
        callback()
      },
      trigger: 'blur',
    },
  ],
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
  if (!query.tenantCaregiverId) delete query.tenantCaregiverId
  listTenantDailyReports(query)
    .then((res) => {
      reportList.value = res.data?.list || []
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
  handleQuery()
}

function formatMinute(value) {
  if (!value) return '-'
  return `${Math.round(Number(value) / 60)} 分钟`
}

function generationType(status) {
  return { SUCCESS: 'success', FAILED: 'danger', NO_TEXT: 'warning', AI_PENDING: '' }[status] || 'info'
}

function normalizeScore(value) {
  const score = Number(value || 0)
  if (!Number.isFinite(score) || score <= 0) return 0
  return score > 10 ? Math.min(10, score / 10) : Math.min(10, score)
}

function formatScore(value) {
  const score = normalizeScore(value)
  if (!score) return '-'
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function hasReportContent(row) {
  return Boolean(row?.reportCard?.aiSummary || row?.summaryText || row?.reportCard?.overallScore != null || row?.emotionSummary)
}

function showDetail(row) {
  tenantDailyReportDetail(row.id).then((res) => {
    detail.value = res.data || {}
    detailOpen.value = true
  })
}

function showAnalysis(row) {
  if (!hasReportContent(row)) return
  tenantDailyReportDetail(row.id).then((res) => {
    analysis.value = res.data || {}
    analysisOpen.value = true
  })
}

function openGenerateDialog() {
  Object.assign(generateForm, {
    tenantId: isPlatformUser.value ? queryParams.value.tenantId : userStore.tenantId || undefined,
    deviceNo: queryParams.value.deviceNo || '',
    dateStr: queryParams.value.dateStr || proxy.parseTime(new Date(), '{y}-{m}-{d}'),
    fileName: '',
    allowUnboundAnalysis: false,
  })
  generateOpen.value = true
}

function submitGenerate() {
  proxy.$refs.generateRef.validate((valid) => {
    if (!valid || generateLoading.value) return
    generateLoading.value = true
    const payload = { ...generateForm }
    if (!payload.tenantId) delete payload.tenantId
    if (!payload.fileName) delete payload.fileName
    generateTenantDailyReport(payload)
      .then(() => {
        proxy.$modal.msgSuccess('已提交单设备日报生成')
        generateOpen.value = false
        if (payload.allowUnboundAnalysis && !payload.tenantId) {
          queryParams.value.tenantId = undefined
        }
        setTimeout(() => getList(), 1200)
      })
      .finally(() => {
        generateLoading.value = false
      })
  })
}

loadTenantOptions()
getList()
</script>

<style scoped>
.tenant-report-page {
  background: #f5f7fa;
  min-height: 100%;
}

.toolbar-form {
  padding: 16px 16px 0;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 6px;
}

.mb16 {
  margin-bottom: 16px;
}

.detail-shell {
  display: grid;
  gap: 14px;
}

.section-title,
.panel-title {
  margin-bottom: 8px;
  font-weight: 700;
  color: #303133;
}

.text-panel {
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  padding: 14px;
  border-radius: 6px;
  background: #fff;
  border: 1px solid #ebeef5;
  line-height: 1.75;
}

.text-panel.muted {
  background: #f7f9fb;
}

.analysis-layout {
  display: grid;
  gap: 12px;
}

.analysis-hero,
.panel {
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  background: #fff;
}

.analysis-hero__title {
  font-size: 20px;
  font-weight: 700;
  color: #17324d;
}

.analysis-hero__meta {
  margin-top: 6px;
  color: #667085;
}

.analysis-hero__summary {
  margin-top: 12px;
  line-height: 1.8;
  color: #303133;
}

.analysis-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.score-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.score-value {
  font-size: 34px;
  line-height: 1;
  font-weight: 700;
  color: #1f6fb2;
}

.score-unit,
.panel-text {
  color: #667085;
}

.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.plain-list {
  margin: 0;
  padding-left: 18px;
  line-height: 1.8;
}

.risk-panel {
  border-color: #f6d6ad;
  background: #fffaf3;
}

@media (max-width: 960px) {
  .analysis-grid {
    grid-template-columns: 1fr;
  }
}
</style>
