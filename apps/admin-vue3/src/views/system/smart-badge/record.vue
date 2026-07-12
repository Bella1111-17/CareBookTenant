<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
      <el-form-item v-if="isPlatformUser" label="机构" prop="tenantId">
        <el-select v-model="queryParams.tenantId" placeholder="全部机构" clearable filterable style="width: 220px">
          <el-option v-for="item in tenantOptions" :key="item.tenantId" :label="item.tenantName" :value="item.tenantId" />
        </el-select>
      </el-form-item>
      <el-form-item label="设备号" prop="deviceNo">
        <el-input v-model="queryParams.deviceNo" placeholder="请输入设备号" clearable
          style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="人员" prop="userName">
        <el-input v-model="queryParams.userName" placeholder="姓名 / 昵称" clearable
          style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="用户ID" prop="userId">
        <el-input-number v-model="queryParams.userId" :min="1" placeholder="用户ID"
          style="width: 140px" @keyup.enter="handleQuery" />
      </el-form-item>
      <!-- 转写状态：只看我们自己的 ASR，第三方状态对用户隐藏 -->
      <el-form-item label="转写(阿里)" prop="asrStatus">
        <el-select v-model="queryParams.asrStatus" placeholder="全部" clearable style="width: 140px">
          <el-option label="待转写" value="PENDING" />
          <el-option label="转写中" value="RUNNING" />
          <el-option label="成功" value="SUCCESS" />
          <el-option label="失败" value="FAILED" />
        </el-select>
      </el-form-item>
      <el-form-item label="类型" prop="segmentType">
        <el-select v-model="queryParams.segmentType" placeholder="全部" clearable style="width: 100px">
          <el-option label="A 切片" value="A" />
          <el-option label="Z 切片" value="Z" />
          <el-option label="合并录音" value="MERGED" />
        </el-select>
      </el-form-item>
      <el-form-item label="录音时间">
        <el-date-picker v-model="dateRange" value-format="YYYY-MM-DD" type="daterange"
          range-separator="-" start-placeholder="开始" end-placeholder="结束" />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <el-col :span="1.5">
        <el-button type="warning" plain icon="RefreshRight" :disabled="multiple"
          @click="handleRebuild" v-hasPermi="['system:badge:record:edit']">重组文本</el-button>
      </el-col>
      <el-col :span="1.5">
        <el-button type="danger" plain icon="Delete" :disabled="multiple"
          @click="handleDelete" v-hasPermi="['system:badge:record:remove']">删除</el-button>
      </el-col>
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="audioList" @selection-change="handleSelectionChange">
      <el-table-column type="selection" width="55" align="center" />
      <el-table-column label="ID" align="center" prop="id" width="70" />
      <el-table-column label="设备号" align="center" prop="deviceNo" width="120" show-overflow-tooltip />
      <el-table-column label="用户ID" align="center" prop="userId" width="90" />
      <el-table-column label="文件名" align="center" prop="fileName" show-overflow-tooltip min-width="160" />
      <el-table-column label="切片序号" align="center" prop="chunkIndex" width="90" />
      <el-table-column label="类型" align="center" prop="segmentType" width="110">
        <template #default="scope">
          <el-tag v-if="scope.row.segmentType === 'A'" type="warning" size="small">自动切片</el-tag>
          <el-tag v-else-if="scope.row.segmentType === 'Z'" size="small">结束切片</el-tag>
          <el-tag v-else type="success" size="small">合并录音</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="大小(KB)" align="center" prop="sizeBytes" width="100">
        <template #default="scope">
          <span>{{ scope.row.sizeBytes ? (scope.row.sizeBytes / 1024).toFixed(1) : '-' }}</span>
        </template>
      </el-table-column>
      <el-table-column label="开始时间" align="center" prop="startTime" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.startTime) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="结束时间" align="center" prop="endTime" width="160">
        <template #default="scope">
          <span>{{ scope.row.endTime ? parseTime(scope.row.endTime) : '-' }}</span>
        </template>
      </el-table-column>
      <!-- 转写状态：只看我们自己的 ASR，第三方状态对用户完全隐藏 -->
      <el-table-column label="转写(阿里)" align="center" prop="asrStatus" width="120">
        <template #default="scope">
          <el-tag :type="asrType(scope.row.asrStatus)">
            {{ asrLabel(scope.row.asrStatus) }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" align="center" class-name="small-padding fixed-width">
        <template #default="scope">
          <el-button link type="primary" icon="VideoPlay" @click="playAudio(scope.row)" v-if="scope.row.fileUrl">播放</el-button>
          <el-button link type="primary" icon="View" @click="showDetail(scope.row)">详情</el-button>
          <el-button link type="success" icon="Microphone" @click="handleTranscribe(scope.row)"
            v-if="scope.row.fileUrl && scope.row.asrStatus !== 'RUNNING'"
            v-hasPermi="['system:badge:record:edit']">转写</el-button>
          <el-button link type="primary" icon="Link" @click="copyUrl(scope.row)" v-if="scope.row.fileUrl">链接</el-button>
          <el-button link type="danger" icon="Delete" @click="handleDelete(scope.row)"
            v-hasPermi="['system:badge:record:remove']">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total"
      v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize"
      @pagination="getList" />

    <!-- 详情弹窗 -->
    <el-dialog title="录音详情" v-model="detailOpen" width="700px" append-to-body>
      <el-descriptions :column="2" border>
        <el-descriptions-item label="设备号">{{ detail.deviceNo }}</el-descriptions-item>
        <el-descriptions-item label="用户ID">{{ detail.userId || '未匹配' }}</el-descriptions-item>
        <el-descriptions-item label="文件名">{{ detail.fileName }}</el-descriptions-item>
        <el-descriptions-item label="切片序号">{{ detail.chunkIndex || '-' }}</el-descriptions-item>
        <el-descriptions-item label="开始时间">{{ parseTime(detail.startTime) }}</el-descriptions-item>
        <el-descriptions-item label="结束时间">{{ detail.endTime ? parseTime(detail.endTime) : '-' }}</el-descriptions-item>
        <el-descriptions-item label="文件大小">{{ detail.sizeBytes ? (detail.sizeBytes / 1024).toFixed(1) + ' KB' : '-' }}</el-descriptions-item>
        <el-descriptions-item label="转写(阿里)">
          <el-tag :type="asrType(detail.asrStatus)">{{ asrLabel(detail.asrStatus) }}</el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="入库时间">{{ parseTime(detail.createTime) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ parseTime(detail.updateTime) }}</el-descriptions-item>
        <el-descriptions-item label="播放链接" :span="2">
          <el-link type="primary" :href="detail.fileUrl" target="_blank">{{ detail.fileUrl }}</el-link>
        </el-descriptions-item>
        <el-descriptions-item label="转写文本" :span="2">
          <div style="max-height: 200px; overflow-y: auto; white-space: pre-wrap; background: #f5f7fa; padding: 12px; border-radius: 4px;">
            {{ detail.transcriptText || '暂无转写文本' }}
          </div>
        </el-descriptions-item>
      </el-descriptions>
    </el-dialog>

    <!-- 播放弹窗 -->
    <el-dialog title="播放录音" v-model="playerOpen" width="500px" append-to-body>
      <div style="text-align:center">
        <audio :src="playerUrl" controls autoplay style="width:100%">
          您的浏览器不支持音频播放
        </audio>
      </div>
      <template #footer>
        <el-button @click="playerOpen = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup name="HardwareAudioRecord">
import useUserStore from '@/store/modules/user';
import { listTenant } from '@/api/system/tenant';
import { recordList, delRecord, transcribeRecord, rebuildTranscriptText } from "@/api/system/smart-badge/index";

const { proxy } = getCurrentInstance();
const userStore = useUserStore();

const audioList = ref([]);
const loading = ref(true);
const showSearch = ref(true);
const ids = ref([]);
const single = ref(true);
const multiple = ref(true);
const total = ref(0);
const detailOpen = ref(false);
const detail = ref({});
const dateRange = ref([]);
const tenantOptions = ref([]);
const isPlatformUser = computed(() => userStore.userScope === 'platform');

const data = reactive({
  queryParams: { pageNum: 1, pageSize: 10, tenantId: undefined, deviceNo: undefined, userName: undefined, userId: undefined, asrStatus: undefined, segmentType: undefined, params: {} }
});
const { queryParams } = toRefs(data);

// 自有 ASR 状态展示 — 隐藏第三方状态，用户无感知
function asrType(s) { return { RUNNING: '', SUCCESS: 'success', FAILED: 'danger' }[s] || 'info'; }
function asrLabel(s) { return { PENDING: '待转写', RUNNING: '转写中', SUCCESS: '成功', FAILED: '失败' }[s] || s || '待转写'; }

function getList() {
  loading.value = true;
  const q = { ...queryParams.value };
  if (!q.userId) delete q.userId;
  if (!q.tenantId) delete q.tenantId;
  if (!q.userName) delete q.userName;
  if (dateRange.value && dateRange.value.length === 2) {
    q.params = { beginTime: dateRange.value[0], endTime: dateRange.value[1] };
  }
  recordList(q).then(res => { audioList.value = res.data.list; total.value = res.data.total; loading.value = false; });
}
function handleQuery() { queryParams.value.pageNum = 1; getList(); }
function resetQuery() {
  proxy.resetForm("queryRef");
  queryParams.value.tenantId = undefined;
  queryParams.value.userName = undefined;
  dateRange.value = [];
  handleQuery();
}
function handleSelectionChange(s) { ids.value = s.map(i => i.id); single.value = s.length !== 1; multiple.value = !s.length; }

function loadTenantOptions() {
  if (!isPlatformUser.value) return;
  listTenant({ pageNum: 1, pageSize: 200 }).then((res) => {
    tenantOptions.value = res.data?.list || [];
  });
}

const playerOpen = ref(false);
const playerUrl = ref('');
function playAudio(row) { playerUrl.value = row.fileUrl; playerOpen.value = true; }
function showDetail(row) { detail.value = row; detailOpen.value = true; }
function copyUrl(row) {
  navigator.clipboard.writeText(row.fileUrl).then(() => proxy.$modal.msgSuccess("链接已复制"));
}

function handleRebuild() {
  proxy.$modal.confirm(`从原始JSON重组选中 ${ids.value.length} 条，不花Token。`).then(() => rebuildTranscriptText({ ids: ids.value })).then(res => { proxy.$modal.msgSuccess(`完成，成功 ${res.data.ok}`); getList(); }).catch(() => {});
}
function handleTranscribe(row) {
  proxy.$modal.confirm(`确认对「${row.fileName}」发起转写？`).then(() => {
    return transcribeRecord(row.id);
  }).then(() => {
    proxy.$modal.msgSuccess('已提交转写，请稍后刷新查看');
    getList();
  }).catch(() => {});
}

function handleDelete(row) {
  const idsToDel = row.id ? [row.id] : ids.value;
  proxy.$modal.confirm('确认删除选中的录音记录？').then(() => {
    return Promise.all(idsToDel.map(id => delRecord(id)));
  }).then(() => { getList(); proxy.$modal.msgSuccess("删除成功"); }).catch(() => {});
}

loadTenantOptions();
getList();
</script>
