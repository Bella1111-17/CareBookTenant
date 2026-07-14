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
      <el-table-column label="设备号" width="150" align="center" prop="deviceNo" show-overflow-tooltip />
      <el-table-column label="护工ID" width="100" align="center">
        <template #default="{ row }">{{ row.tenantCaregiverId || '-' }}</template>
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
      <el-table-column label="AI摘要" min-width="300" align="center" show-overflow-tooltip>
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

    <el-dialog title="日报详情" v-model="detailOpen" width="960px" append-to-body>
      <div class="report-modal">
        <div class="hero">
          <h1 class="title">{{ detail.reportDate || '-' }} 日报详情</h1>
          <div class="meta">设备 {{ detail.deviceNo || '-' }} · 护工ID {{ detail.tenantCaregiverId || '-' }} · 护工 {{ detail.caregiverName || '-' }}</div>
          <div class="summary" v-if="detail.aiSummary || detail.summaryText">{{ detail.aiSummary || detail.summaryText }}</div>
        </div>

        <div class="grid">
          <article class="card">
            <h2>基本信息</h2>
            <div class="info-list">
              <div class="info-item"><span class="info-label">生成状态</span><span class="info-value">{{ detail.generationStatus || '-' }}</span></div>
              <div class="info-item"><span class="info-label">录音时长</span><span class="info-value">{{ formatMinute(detail.totalDurationSeconds) }}</span></div>
              <div class="info-item"><span class="info-label">讲话时长</span><span class="info-value">{{ formatMinute(detail.totalSpeechSeconds) }}</span></div>
            </div>
          </article>
        </div>

        <div class="grid">
          <div class="detail-text-grid">
            <section class="card">
              <h2>AI 投喂时间线</h2>
              <div class="text-panel">{{ detail.asrPayload || '暂无内容' }}</div>
            </section>
            <section class="card">
              <h2>清洗后文本</h2>
              <div class="text-panel">{{ detail.fullTranscript || '暂无内容' }}</div>
            </section>
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog title="质检 / 风险分析" v-model="analysisOpen" width="960px" append-to-body>
      <div class="report-modal analysis-modal" v-if="analysis.reportCard">
        <div class="hero">
          <h1 class="title">{{ analysis.reportDate }} 日报分析</h1>
          <div class="meta">设备 {{ analysis.deviceNo || '-' }} · 护工ID {{ analysis.tenantCaregiverId || '-' }} · 护工 {{ analysis.caregiverName || '-' }}</div>
          <div class="summary">{{ analysis.reportCard.aiSummary || analysis.summaryText || '暂无 AI 摘要' }}</div>
        </div>

        <div class="analysis-card-grid">
          <article class="card">
            <h2>评分</h2>
            <div class="score-wrap">
              <div class="score">{{ formatScore(analysis.reportCard.overallScore) }}</div>
              <div class="outof">/10</div>
            </div>
            <p class="score-desc">{{ analysis.reportCard.scoreComment || '暂无评分说明' }}</p>
          </article>
          <article class="card">
            <h2>任务完成</h2>
            <div v-if="analysis.reportCard.tasksCompleted?.length" class="task-list">
              <span v-for="item in analysis.reportCard.tasksCompleted" :key="item" class="task">
                <span class="check">✓</span>{{ item }}
              </span>
            </div>
            <p v-else class="panel-text">暂无任务记录</p>
          </article>

          <article class="card risk">
            <h2><span class="icon">⚠</span>风险提醒</h2>
            <ul v-if="analysis.reportCard.riskAlerts?.length" class="list">
              <li v-for="item in analysis.reportCard.riskAlerts" :key="item">{{ item }}</li>
            </ul>
            <p v-else class="panel-text">暂无明显风险</p>
          </article>
          <article class="card service">
            <h2><span class="icon">💙</span>服务亮点</h2>
            <ul v-if="analysis.reportCard.highlights?.length" class="list">
              <li v-for="item in analysis.reportCard.highlights" :key="item">{{ item }}</li>
            </ul>
            <p v-else class="panel-text">暂无服务亮点</p>
          </article>
        </div>
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

.report-modal {
  display: grid;
  gap: 16px;
}

.hero {
  margin: 0;
  padding: 20px 22px 18px;
  border-radius: 14px;
  background: linear-gradient(180deg, rgba(242, 236, 210, 0.88), rgba(255, 255, 255, 0.96));
  border: 1px solid rgba(43, 122, 179, 0.12);
}

.title {
  margin: 0;
  color: #2b7ab3;
  font-size: 30px;
  font-weight: 900;
  line-height: 1.12;
}

.meta {
  margin-top: 10px;
  color: #647385;
  font-size: 15px;
  line-height: 1.65;
}

.summary {
  margin-top: 12px;
  color: #324255;
  font-size: 16px;
  line-height: 1.8;
}

.grid {
  display: grid;
  gap: 14px;
}

.card {
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.88);
  border: 1px solid rgba(43, 122, 179, 0.14);
  padding: 18px 20px 16px;
}

.card h2 {
  margin: 0 0 14px;
  color: #2b7ab3;
  font-size: 18px;
  line-height: 1.1;
  font-weight: 900;
}

.info-list {
  display: grid;
  gap: 10px;
}

.info-item {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 15px;
}

.info-label {
  color: #647385;
  min-width: 80px;
}

.info-value {
  color: #21415b;
  font-weight: 600;
}

.text-panel {
  max-height: 280px;
  overflow-y: auto;
  white-space: pre-wrap;
  padding: 14px;
  border-radius: 10px;
  background: #f7f9fb;
  border: 1px solid rgba(43, 122, 179, 0.08);
  line-height: 1.8;
  font-size: 14px;
  color: #324255;
}

.detail-text-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.risk {
  background: linear-gradient(180deg, rgba(242, 236, 210, 0.78), rgba(255, 255, 255, 0.92));
}

.service {
  background: linear-gradient(180deg, rgba(177, 224, 240, 0.24), rgba(255, 255, 255, 0.92));
}

.score-wrap {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  margin-bottom: 12px;
}

.score {
  font-size: 52px;
  line-height: 0.9;
  font-weight: 900;
  color: #2b7ab3;
}

.outof {
  font-size: 22px;
  color: #6f7b86;
  padding-bottom: 6px;
}

.score-desc {
  color: #4d5c6a;
  font-size: 14px;
  line-height: 1.7;
  margin: 0;
}

.task-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.task {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-radius: 8px;
  background: linear-gradient(180deg, rgba(177, 224, 240, 0.55), rgba(255, 255, 255, 0.82));
  border: 1px solid rgba(43, 122, 179, 0.12);
  color: #1f6f9f;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}

.check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-grid;
  place-items: center;
  background: #2b7ab3;
  color: #fff;
  font-size: 12px;
  font-weight: 900;
  flex: 0 0 auto;
}

.icon {
  font-size: 18px;
  line-height: 1;
}

.list {
  margin: 0;
  padding-left: 18px;
  color: #394754;
  font-size: 14px;
  line-height: 1.85;
}

.list li + li {
  margin-top: 4px;
}

.panel-text {
  color: #647385;
  font-size: 14px;
  margin: 0;
}

.analysis-modal {
  grid-template-columns: 1fr;
}

.analysis-card-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;
}

.analysis-card-grid .card {
  min-height: 0;
}

@media (max-width: 960px) {
  .grid {
    grid-template-columns: 1fr;
  }

  .detail-text-grid,
  .analysis-card-grid {
    grid-template-columns: 1fr;
  }
}
</style>
