<template>
  <div class="app-container">
    <el-form :model="queryParams" ref="queryRef" :inline="true" v-show="showSearch">
      <el-form-item label="设备号" prop="deviceNo">
        <el-input v-model="queryParams.deviceNo" placeholder="设备号" clearable style="width: 180px" @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="事件类型" prop="eventType">
        <el-select v-model="queryParams.eventType" placeholder="全部" clearable style="width: 130px">
          <el-option label="心跳" value="heartbeat" />
          <el-option label="登录" value="login" />
          <el-option label="操控" value="control" />
          <el-option label="调试" value="debug" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button icon="Refresh" @click="resetQuery">重置</el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="10" class="mb8">
      <right-toolbar v-model:showSearch="showSearch" @queryTable="getList"></right-toolbar>
    </el-row>

    <el-table v-loading="loading" :data="eventList">
      <el-table-column label="设备号" align="center" prop="deviceNo" width="160" show-overflow-tooltip />
      <el-table-column label="用户ID" align="center" prop="userId" width="80" />
      <el-table-column label="事件类型" align="center" prop="eventType" width="100">
        <template #default="scope">
          <el-tag :type="tagType(scope.row.eventType)" size="small">{{ label(scope.row.eventType) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="事件名称" align="center" prop="eventName" width="120" />
      <el-table-column label="状态" align="center" prop="eventStatus" width="100" />
      <el-table-column label="详情" align="center" prop="detail" min-width="220" show-overflow-tooltip />
      <el-table-column label="时间" align="center" prop="createdAt" width="160">
        <template #default="scope">
          <span>{{ parseTime(scope.row.createdAt) }}</span>
        </template>
      </el-table-column>
    </el-table>

    <pagination v-show="total > 0" :total="total" v-model:page="queryParams.pageNum" v-model:limit="queryParams.pageSize" @pagination="getList" />
  </div>
</template>

<script setup name="SmartBadgeEvent">
import { eventLogList } from "@/api/system/smart-badge/index";

const { proxy } = getCurrentInstance();
const eventList = ref([]);
const loading = ref(true);
const showSearch = ref(true);
const total = ref(0);
const data = reactive({ queryParams: { pageNum: 1, pageSize: 10, deviceNo: undefined, eventType: undefined } });
const { queryParams } = toRefs(data);

function tagType(t) { return t === 'heartbeat' ? 'success' : t === 'login' ? '' : t === 'control' ? 'warning' : 'info'; }
function label(t) { return t === 'heartbeat' ? '心跳' : t === 'login' ? '登录' : t === 'control' ? '操控' : t === 'debug' ? '调试' : t; }

function getList() {
  loading.value = true;
  const q = { ...queryParams.value };
  if (!q.eventType) delete q.eventType;
  eventLogList(q).then(res => { eventList.value = res.data.list; total.value = res.data.total; loading.value = false; });
}
function handleQuery() { queryParams.value.pageNum = 1; getList(); }
function resetQuery() { proxy.resetForm("queryRef"); handleQuery(); }
getList();
</script>
