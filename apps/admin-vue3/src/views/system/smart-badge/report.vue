<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
      <el-form-item label="设备号" prop="deviceNo">
        <el-input
          v-model="queryParams.deviceNo"
          placeholder="请输入设备号"
          clearable
          style="width: 180px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="护工用户ID" prop="userId">
        <el-input-number
          v-model="queryParams.userId"
          :min="0"
          placeholder="护工用户ID"
          style="width: 150px"
          @keyup.enter="handleQuery"
        />
      </el-form-item>
      <el-form-item label="日期" prop="dateStr">
        <el-date-picker
          v-model="queryParams.dateStr"
          value-format="YYYY-MM-DD"
          type="date"
          placeholder="选择日期"
          style="width: 160px"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button
          type="warning"
          plain
          icon="EditPen"
          @click="handleGenerate"
          v-hasPermi="['system:badge:audit:generate']"
        >
          生成日报分析
        </el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList" />
    </el-row>

    <el-table v-loading="loading" :data="reportList">
      <el-table-column label="ID" align="center" width="60" prop="id" />
      <el-table-column label="设备号" align="center" min-width="150" prop="deviceNo" show-overflow-tooltip />
      <el-table-column label="护工用户ID" align="center" width="110" prop="userId" />
      <el-table-column label="日期" align="center" width="120" prop="reportDate" sortable />
      <el-table-column label="切片数" align="center" width="80" prop="totalChunks" />
      <el-table-column label="录音时长" align="center" width="100">
        <template #default="scope">
          {{ formatMinute(scope.row.totalDurationSeconds) }}
        </template>
      </el-table-column>
      <el-table-column label="讲话时长" align="center" width="100">
        <template #default="scope">
          {{ formatMinute(scope.row.totalSpeechSeconds) }}
        </template>
      </el-table-column>
      <el-table-column label="AI摘要" align="center" min-width="320" show-overflow-tooltip>
        <template #default="scope">
          {{ scope.row.reportCard?.aiSummary || scope.row.summaryText || '-' }}
        </template>
      </el-table-column>
      <el-table-column label="更新时间" align="center" min-width="160" prop="updateTime">
        <template #default="scope">
          <span>{{ parseTime(scope.row.updateTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="170" align="center" fixed="right">
        <template #default="scope">
          <div class="op-actions">
            <el-button link type="primary" icon="View" @click="showDetail(scope.row)">详情</el-button>
            <el-button
              link
              type="success"
              icon="DataBoard"
              :disabled="!hasReportContent(scope.row)"
              @click="showReport(scope.row)"
            >
              日报分析
            </el-button>
          </div>
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

    <el-dialog title="分析详情" v-model="detailOpen" width="920px" append-to-body>
      <div class="detail-shell">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="设备号">{{ detail.deviceNo || '-' }}</el-descriptions-item>
          <el-descriptions-item label="护工用户ID">{{ detail.userId || '-' }}</el-descriptions-item>
          <el-descriptions-item label="分析日期">{{ detail.reportDate || '-' }}</el-descriptions-item>
          <el-descriptions-item label="切片数">{{ detail.totalChunks || 0 }}</el-descriptions-item>
          <el-descriptions-item label="录音时长">{{ formatMinute(detail.totalDurationSeconds) }}</el-descriptions-item>
          <el-descriptions-item label="讲话时长">{{ formatMinute(detail.totalSpeechSeconds) }}</el-descriptions-item>
          <el-descriptions-item label="创建时间">{{ parseTime(detail.createTime) }}</el-descriptions-item>
          <el-descriptions-item label="更新时间">{{ parseTime(detail.updateTime) }}</el-descriptions-item>
        </el-descriptions>

        <div class="detail-section">
          <div class="detail-section__header">
            <span class="detail-section__title">对话时间线</span>
            <el-button size="small" icon="CopyDocument" @click="copyText(detail.asrPayload || detail.fullTranscript)">
              复制
            </el-button>
          </div>
          <div class="text-panel text-panel-muted">
            {{ detail.asrPayload || detail.fullTranscript || '暂无内容' }}
          </div>
        </div>

        <div class="detail-section">
          <div class="detail-section__header">
            <span class="detail-section__title">清洗后文本</span>
            <el-button size="small" icon="CopyDocument" @click="copyText(detail.fullTranscript)">
              复制
            </el-button>
          </div>
          <div class="text-panel">
            {{ detail.fullTranscript || '暂无清洗文本' }}
          </div>
        </div>
      </div>
    </el-dialog>

    <el-dialog title="日报分析详情" v-model="reportOpen" width="920px" append-to-body>
      <div class="analysis-report" v-if="reportData.reportCard">
        <section class="hero-card hero-card--analysis">
          <div class="hero-card__badge">底层分析结果</div>
          <div class="hero-card__title">日报分析</div>
          <div class="hero-card__date">
            {{ reportData.reportDate }} · 设备 {{ reportData.deviceNo || '-' }} · 护工用户ID {{ reportData.userId || '-' }}
          </div>
          <div class="hero-card__meta">
            <span>切片 {{ reportData.totalChunks || 0 }} 段</span>
            <span>录音 {{ formatMinute(reportData.totalDurationSeconds) }}</span>
            <span>讲话 {{ formatMinute(reportData.totalSpeechSeconds) }}</span>
          </div>
          <div class="hero-card__summary">
            {{ reportData.reportCard.aiSummary || reportData.summaryText || '暂无 AI 摘要' }}
          </div>
          <div class="hero-card__tip">
            该页面为设备侧底层分析结果，仅用于生成正式护理日报。正式评分与正式摘要以护理日报为准。
          </div>
        </section>

        <section class="analysis-grid analysis-grid--top">
          <article class="panel-card panel-card--score">
            <div class="panel-card__title">分析评分</div>
            <div class="score-head">
              <div class="score-head__value">{{ formatOverallScore(reportData.reportCard.overallScore) }}</div>
              <div class="score-head__unit">/ 10</div>
              <div class="score-head__badge">{{ reportLevelLabel(reportData.reportCard.overallScore) }}</div>
            </div>
            <div class="score-comment">{{ reportData.reportCard.scoreComment || '暂无评分说明' }}</div>
            <div class="score-bars">
              <div class="score-bar" v-for="item in scoreItems" :key="item.key">
                <div class="score-bar__label">{{ item.label }}</div>
                <div class="score-bar__track">
                  <div class="score-bar__fill" :style="{ width: `${getDimensionScore(item.key) * 10}%` }"></div>
                </div>
                <div class="score-bar__value">{{ formatScore(getDimensionScore(item.key)) }}/10</div>
              </div>
            </div>
          </article>

          <article class="panel-card panel-card--compact">
            <div class="panel-card__title">任务清单</div>
            <div class="task-grid" v-if="reportData.reportCard.tasksCompleted?.length">
              <div class="task-chip" v-for="item in reportData.reportCard.tasksCompleted" :key="item">
                <span class="task-chip__dot"></span>
                <span>{{ item }}</span>
              </div>
            </div>
            <div class="panel-empty" v-else>暂无任务记录</div>
          </article>
        </section>

        <section class="analysis-grid analysis-grid--middle" v-if="reportData.reportCard.highlights?.length || reportData.reportCard.riskAlerts?.length">
          <article class="soft-card soft-card--blue">
            <div class="soft-card__title">服务亮点</div>
            <div v-if="reportData.reportCard.highlights?.length" class="soft-card__list">
              <div v-for="item in reportData.reportCard.highlights" :key="item">{{ item }}</div>
            </div>
            <div v-else class="soft-card__content">暂无明显亮点</div>
          </article>

          <article class="soft-card soft-card--orange">
            <div class="soft-card__title">异常提醒</div>
            <div v-if="reportData.reportCard.riskAlerts?.length" class="soft-card__list">
              <div v-for="item in reportData.reportCard.riskAlerts" :key="item">{{ item }}</div>
            </div>
            <div v-else class="soft-card__content">今日无明显异常</div>
          </article>
        </section>

        <section
          class="analysis-grid analysis-grid--middle"
          v-if="
            reportData.reportCard.warmMoments?.length ||
            reportData.reportCard.emotionSummary ||
            reportData.emotionSummary ||
            reportData.reportCard.medicalFeedback?.hasMedicalFeedback
          "
        >
          <article class="soft-card soft-card--yellow">
            <div class="soft-card__title">温暖瞬间</div>
            <div v-if="reportData.reportCard.warmMoments?.length" class="quote-list">
              <div class="quote-item" v-for="item in reportData.reportCard.warmMoments" :key="item">
                “{{ item }}”
              </div>
            </div>
            <div v-else class="soft-card__content">暂无温暖互动记录</div>
          </article>

          <article class="soft-card soft-card--purple">
            <div class="soft-card__title">扩展信息</div>
            <div class="soft-card__list">
              <div v-if="reportData.reportCard.emotionSummary || reportData.emotionSummary">
                情绪概况：{{ reportData.reportCard.emotionSummary || reportData.emotionSummary }}
              </div>
              <div v-if="reportData.reportCard.medicalFeedback?.hasMedicalFeedback">
                医护反馈：{{ formatMedicalFeedback(reportData.reportCard.medicalFeedback) }}
              </div>
            </div>
          </article>
        </section>

        <section class="panel-card" v-if="reportData.reportCard.evidenceSnippets?.length">
          <div class="panel-card__title">证据摘录</div>
          <ul class="evidence-list" v-if="reportData.reportCard.evidenceSnippets?.length">
            <li v-for="item in reportData.reportCard.evidenceSnippets" :key="item">{{ item }}</li>
          </ul>
        </section>
      </div>
    </el-dialog>

    <el-dialog title="生成日报分析" v-model="genOpen" width="420px" append-to-body>
      <el-form :model="genForm" label-width="84px">
        <p class="dialog-tip">设备号留空表示对所选日期的全部设备生成日报分析。</p>
        <el-form-item label="设备号">
          <el-input v-model="genForm.deviceNo" placeholder="留空表示全部设备" />
        </el-form-item>
        <el-form-item label="日期">
          <el-date-picker
            v-model="genForm.dateStr"
            value-format="YYYY-MM-DD"
            type="date"
            placeholder="选择日期"
            style="width: 100%"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="genOpen = false">取消</el-button>
        <el-button type="warning" @click="submitGenerate" :loading="genLoading">生成分析</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="HardwareAudioReport">
import { getCurrentInstance, reactive, ref, toRefs } from 'vue'
import { generateReport, reportDetail, reportList as fetchReportList } from '@/api/system/smart-badge/index'

const { proxy } = getCurrentInstance()

const loading = ref(false)
const showSearch = ref(true)
const total = ref(0)
const reportList = ref([])
const detailOpen = ref(false)
const detail = ref({})

const reportOpen = ref(false)
const reportData = ref({})

const scoreItems = [
  { key: 'communication', label: '沟通' },
  { key: 'operation', label: '操作' },
  { key: 'response', label: '响应' },
  { key: 'safety', label: '安全' },
  { key: 'care', label: '关怀' },
  { key: 'completeness', label: '完整' },
]

const genOpen = ref(false)
const genLoading = ref(false)
const genForm = reactive({ deviceNo: '', dateStr: '' })

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, deviceNo: undefined, userId: undefined, dateStr: undefined },
})
const { queryParams } = toRefs(data)

function normalizeScore10(value) {
  const score = Number(value || 0)
  if (!Number.isFinite(score) || score <= 0) return 0
  const normalized = score > 10 ? score / 10 : score
  return Math.max(0, Math.min(10, normalized))
}

function formatScore(value) {
  const score = normalizeScore10(value)
  if (!score) return '0'
  return Number.isInteger(score) ? String(score) : score.toFixed(1)
}

function formatOverallScore(value) {
  if (value === null || value === undefined || value === '') return '-'
  return formatScore(value)
}

function getList() {
  loading.value = true
  const query = { ...queryParams.value }
  if (!query.userId && query.userId !== 0) delete query.userId
  if (!query.dateStr) delete query.dateStr

  fetchReportList(query)
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

function showDetail(row) {
  reportDetail(row.id).then((res) => {
    detail.value = res.data || {}
    detailOpen.value = true
  })
}

function showReport(row) {
  if (!hasReportContent(row)) return
  reportDetail(row.id).then((res) => {
    reportData.value = res.data || {}
    reportOpen.value = true
  })
}

function getDimensionScore(key) {
  return normalizeScore10(reportData.value?.reportCard?.dimensionScores?.[key])
}

function formatMinute(value) {
  if (!value) return '-'
  return `${(Number(value) / 60).toFixed(0)} 分钟`
}

function reportLevelLabel(score) {
  const value = normalizeScore10(score)
  if (value >= 9) return '建议优秀'
  if (value >= 8) return '建议良好'
  if (value >= 7) return '建议稳定'
  if (value > 0) return '建议关注'
  return '暂无'
}

function formatVisitStats(visitStats) {
  if (!visitStats) return '-'
  if (!visitStats.hasVisit) return '今日无探视'
  return `有探视，共 ${visitStats.visitCount || 0} 次`
}

function formatMedicalFeedback(medicalFeedback) {
  if (!medicalFeedback) return '暂无医护反馈'
  if (!medicalFeedback.hasMedicalFeedback) {
    return medicalFeedback.notes || '暂无医护反馈'
  }
  return medicalFeedback.notes || '存在医护反馈'
}

function hasReportContent(row) {
  return Boolean(
    row?.reportCard?.aiSummary ||
      row?.reportCard?.overallScore != null ||
      row?.summaryText ||
      row?.serviceScore ||
      row?.emotionSummary,
  )
}

function copyText(text) {
  if (!text) {
    proxy.$modal.msgError('无可复制内容')
    return
  }
  navigator.clipboard.writeText(text).then(() => proxy.$modal.msgSuccess('复制成功'))
}

function handleGenerate() {
  genForm.deviceNo = ''
  genForm.dateStr = proxy.parseTime(new Date(), '{y}-{m}-{d}')
  genOpen.value = true
}

function submitGenerate() {
  if (!genForm.dateStr) {
    proxy.$modal.msgError('请选择日期')
    return
  }
  if (genLoading.value) return

  genLoading.value = true
  generateReport(genForm)
    .then((res) => {
      const queuedCount = res?.data?.queuedCount ?? (genForm.deviceNo ? 1 : 0)
      const message =
        queuedCount > 0
          ? `已提交 ${queuedCount} 个日报分析生成任务，AI 正在后台处理，请稍后刷新查看`
          : '已提交日报分析生成任务，AI 正在后台处理，请稍后刷新查看'
      proxy.$modal.msgSuccess(message)
      genOpen.value = false
      setTimeout(() => getList(), 3000)
    })
    .finally(() => {
      genLoading.value = false
    })
}

getList()
</script>

<style scoped>
.op-actions {
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}

.detail-shell {
  display: grid;
  gap: 14px;
}

.detail-section__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.detail-section__title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.text-panel {
  max-height: 320px;
  overflow-y: auto;
  white-space: pre-wrap;
  background: #f5f7fa;
  padding: 16px;
  border-radius: 8px;
  line-height: 1.8;
}

.text-panel-muted {
  background: #fafafa;
  font-size: 13px;
}

.dialog-tip {
  color: #909399;
  margin-bottom: 12px;
}

.analysis-report {
  display: grid;
  gap: 10px;
  padding: 2px;
  background: linear-gradient(180deg, #f8fbff 0%, #f7f8fa 100%);
}

.hero-card,
.panel-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 12px;
  box-shadow: 0 6px 18px rgba(31, 45, 61, 0.04);
}

.hero-card {
  padding: 14px 16px;
  text-align: center;
}

.hero-card__badge {
  display: inline-flex;
  padding: 4px 12px;
  border-radius: 999px;
  background: #eef6ff;
  color: #2e6cb3;
  font-size: 13px;
}

.hero-card__title {
  margin-top: 10px;
  font-size: 24px;
  line-height: 1.2;
  font-weight: 700;
  color: #1f5fae;
}

.hero-card__date,
.hero-card__meta,
.hero-card__tip {
  margin-top: 8px;
  color: #7d8795;
  font-size: 13px;
}

.hero-card__meta {
  display: flex;
  justify-content: center;
  flex-wrap: wrap;
  gap: 18px;
}

.hero-card__summary {
  margin: 12px auto 0;
  max-width: 620px;
  line-height: 1.75;
  color: #303133;
  font-size: 14px;
}

.hero-card__tip {
  margin-top: 12px;
}

.analysis-grid {
  display: grid;
  gap: 12px;
}

.analysis-grid--top,
.analysis-grid--middle {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel-card {
  padding: 14px 16px;
}

.panel-card__title {
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.panel-card--compact {
  min-height: 0;
}

.score-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}

.score-head__value {
  font-size: 38px;
  line-height: 1;
  font-weight: 700;
  color: #1f5fae;
}

.score-head__unit {
  color: #7d8795;
  font-size: 18px;
}

.score-head__badge {
  margin-left: auto;
  padding: 6px 10px;
  border-radius: 10px;
  background: #eaf4ff;
  color: #1f5fae;
  font-size: 13px;
  font-weight: 600;
}

.score-comment {
  margin-top: 8px;
  color: #7d8795;
  line-height: 1.7;
  font-size: 13px;
}

.score-bars {
  margin-top: 12px;
  display: grid;
  gap: 9px;
}

.score-bar {
  display: grid;
  grid-template-columns: 42px minmax(0, 1fr) 52px;
  gap: 10px;
  align-items: center;
}

.score-bar__label,
.score-bar__value {
  color: #606266;
  font-size: 13px;
}

.score-bar__track {
  height: 8px;
  background: #edf1f7;
  border-radius: 999px;
  overflow: hidden;
}

.score-bar__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #49a7ff 0%, #1f7ae0 100%);
}

.task-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
}

.task-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 10px;
  border-radius: 10px;
  background: #f2f8ff;
  color: #356ca8;
  font-size: 13px;
}

.task-chip__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #2d86ea;
}

.panel-empty {
  color: #909399;
  line-height: 1.8;
}

.soft-card {
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid transparent;
}

.soft-card__title {
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
}

.soft-card__content,
.soft-card__list,
.quote-list {
  line-height: 1.75;
  color: #4b5563;
  font-size: 13px;
}

.soft-card__list:empty {
  display: none;
}

.quote-item + .quote-item,
.soft-card__list > div + div {
  margin-top: 8px;
}

.soft-card--blue {
  background: #f5f8ff;
  border-color: #e7eefb;
}

.soft-card--blue .soft-card__title {
  color: #2e5d9f;
}

.soft-card--yellow {
  background: #fff9e8;
  border-color: #f7edc5;
}

.soft-card--yellow .soft-card__title {
  color: #bf8309;
}

.soft-card--purple {
  background: #f8f2ff;
  border-color: #efe3ff;
}

.soft-card--purple .soft-card__title {
  color: #7c4db2;
}

.soft-card--orange {
  background: #fff6eb;
  border-color: #fde4bf;
}

.soft-card--orange .soft-card__title {
  color: #c46c1b;
}

.evidence-list {
  margin: 0;
  padding-left: 18px;
  color: #606266;
  line-height: 1.75;
  font-size: 13px;
}

.evidence-list li + li {
  margin-top: 6px;
}

@media (max-width: 960px) {
  .hero-card__title {
    font-size: 22px;
  }

  .analysis-grid--top,
  .analysis-grid--middle {
    grid-template-columns: 1fr;
  }

  .score-head {
    flex-wrap: wrap;
  }

  .score-head__badge {
    margin-left: 0;
  }
}
</style>
